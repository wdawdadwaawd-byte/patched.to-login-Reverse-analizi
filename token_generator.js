"use strict";
/**
 * patched.to Token Üretici
 *
 * Akış:
 * 1. Puppeteer'da login sayfasını aç → cookie + config al
 * 2. challenge.html'i aç (origin-patch'li cntsw.js ile)
 * 3. CONFIG + EXECUTE postMessage → widget /api/c çağırır (PROXY ile)
 * 4. bP() içindeki p(siteKey, "/api/c") çağrısını intercept et → decrypt key al
 * 5. /api/c response'unu XChaCha20 ile Node.js'de decrypt et
 * 6. ab.p (puzzle) + ab.c.token → VERIFIED token al
 *
 * Patch'ler:
 *   P1: origin check kaldır (postMessage her origin'den)
 *   P2: bP içinde p() çağrısını intercept → window.__pResult = aa
 *   P3: bO içinde an(ag) → window.__msgDecode(ag) ile body decode
 *   P4: u() tamamen bypass → Node.js xchacha20 decrypt + window.__msgDecode
 */

const https     = require("https");
const http      = require("http");
const crypto    = require("crypto");
const fs_mod    = require("fs");
const path      = require("path");
const puppeteer = require("puppeteer");

const WORK_DIR = __dirname;

// ─── XChaCha20 decrypt (Node.js native chacha20 + HChaCha20) ─────────────────
function hchacha20(key, n16) {
    const C = [0x61707865,0x3320646e,0x79622d32,0x6b206574];
    function ld(b,i){return(b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0;}
    const k=[],n=[];
    for(let i=0;i<8;i++) k.push(ld(key,i*4));
    for(let i=0;i<4;i++) n.push(ld(n16,i*4));
    const s=[C[0],C[1],C[2],C[3],k[0],k[1],k[2],k[3],k[4],k[5],k[6],k[7],n[0],n[1],n[2],n[3]];
    function rot(v,n){return((v<<n)|(v>>>(32-n)))>>>0;}
    function qr(a,b,c,d){s[a]=(s[a]+s[b])>>>0;s[d]=rot(s[d]^s[a],16);s[c]=(s[c]+s[d])>>>0;s[b]=rot(s[b]^s[c],12);s[a]=(s[a]+s[b])>>>0;s[d]=rot(s[d]^s[a],8);s[c]=(s[c]+s[d])>>>0;s[b]=rot(s[b]^s[c],7);}
    for(let i=0;i<20;i+=2){qr(0,4,8,12);qr(1,5,9,13);qr(2,6,10,14);qr(3,7,11,15);qr(0,5,10,15);qr(1,6,11,12);qr(2,7,8,13);qr(3,4,9,14);}
    const o=Buffer.alloc(32);
    [s[0],s[1],s[2],s[3],s[12],s[13],s[14],s[15]].forEach((w,i)=>o.writeUInt32LE(w,i*4));
    return o;
}

function xchacha20Decrypt(key, nonce24, ct) {
    const sub = hchacha20(key, nonce24.slice(0,16));
    const n12 = Buffer.alloc(16,0);
    nonce24.copy(n12,4,16,24);
    const dc = crypto.createDecipheriv("chacha20", sub, n12);
    return Buffer.concat([dc.update(ct)]);
}

// ─── msgpack decode ───────────────────────────────────────────────────────────
function msgpackDecode(buf) {
    let p=0;
    function r() {
        if(p>=buf.length) return null;
        const b=buf[p++];
        if(b===0xc0)return null;if(b===0xc2)return false;if(b===0xc3)return true;
        if((b&0x80)===0)return b;
        if((b&0xe0)===0xa0){const l=b&0x1f;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
        if((b&0xf0)===0x80){const l=b&0x0f;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
        if((b&0xf0)===0x90){const l=b&0x0f;return Array.from({length:l},()=>r());}
        if(b===0xcc)return buf[p++];
        if(b===0xcd){const v=(buf[p]<<8)|buf[p+1];p+=2;return v;}
        if(b===0xce){const v=buf.readUInt32BE(p);p+=4;return v;}
        if(b===0xd9){const l=buf[p++];const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
        if(b===0xda){const l=(buf[p]<<8)|buf[p+1];p+=2;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
        if(b===0xdb){const l=buf.readUInt32BE(p);p+=4;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
        if(b===0xdc){const l=(buf[p]<<8)|buf[p+1];p+=2;return Array.from({length:l},()=>r());}
        if(b===0xde){const l=(buf[p]<<8)|buf[p+1];p+=2;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
        if(b===0xdf){const l=buf.readUInt32BE(p);p+=4;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
        if(b===0xc4){const l=buf[p++];const d=buf.slice(p,p+l);p+=l;return d;}
        if(b===0xc5){const l=(buf[p]<<8)|buf[p+1];p+=2;const d=buf.slice(p,p+l);p+=l;return d;}
        if(b===0xcb){const v=buf.readDoubleBE(p);p+=8;return v;}
        if(b===0xca){const v=buf.readFloatBE(p);p+=4;return v;}
        return `[0x${b.toString(16)}]`;
    }
    try{return r();}catch(e){return {error:e.message};}
}

// ─── cntsw.js patch ───────────────────────────────────────────────────────────
function getPatchedCntsw() {
    let code = fs_mod.readFileSync(path.join(WORK_DIR,"cntsw.js"),"utf8");
    const orig = code;

    // P1: origin check kaldır
    code = code.replace(
        /&&!\(x&&x\[e\(1274\)\]&&y\[e\(1411\)\]!==x\[e\(1274\)\]\)/g, ""
    );
    const p1 = code !== orig;
    if (p1) console.log("  P1: origin check kaldırıldı ✓");

    // P2: bP içinde p(siteKey, "/api/c") çağrısını intercept et
    // → aa değerini window.__pResult'a yaz
    // → K.r değerini window.__Kr'a yaz
    // Pattern: let aa=p(x[e(1314)],e(1329)),ab=u(K.r,aa[e(713)]);
    const p2before = "let aa=p(x[e(1314)],e(1329)),ab=u(K.r,aa[e(713)]);";
    const p2after  = "let aa;try{aa=p(x[e(1314)],e(1329));}catch(_pe){aa=null;console.error('[bP] p() err:'+_pe.message);}window.__pResult=aa;window.__Kr=K.r;let ab=null;try{if(aa&&aa[e(713)])ab=u(K.r,aa[e(713)]);}catch(_ue){console.error('[bP] u() err:'+_ue.message);}window.__abVal=ab;console.log('[bP] abVal:',ab?JSON.stringify(ab).substring(0,120):'null');";
    if (code.includes(p2before)) {
        code = code.replace(p2before, p2after);
        console.log("  P2: bP intercept ✓");
    } else {
        console.warn("  [WARN] P2 bulunamadı");
    }

    // P3: bO içinde an(ag) → window.__msgDecode(ag) || an(ag)
    const p3before = "af=null,ag=bM(ae[e(773)]);if(ag){try{af=an(ag)}catch(ah){}}";
    const p3after  = "af=null,ag=bM(ae[e(773)]);if(ag){try{af=(typeof window.__msgDecode==='function'?window.__msgDecode(ag):null)||an(ag)}catch(ah){}}";
    if (code.includes(p3before)) {
        code = code.replace(p3before, p3after);
        console.log("  P3: bO decode hook ✓");
    } else {
        console.warn("  [WARN] P3 bulunamadı");
    }

    // P4: ab null → throw yerine log + return
    const p4before = "if(!ab){throw new bL(e(1330),e(1290))}";
    const p4after  = "if(!ab){console.log('[bP] ab null');return;}";
    if (code.includes(p4before)) {
        code = code.replace(p4before, p4after);
        console.log("  P4: ab null skip ✓");
    } else {
        console.warn("  [WARN] P4 bulunamadı");
    }

    // P5: ab.p olmayabilir — sadece ab.c.token kontrolü yap
    const p5before = "let ad=ab.p,ak=ab.c;if(!ad||!ak||!ak[e(1331)]){throw new bL(e(1330),e(1290))}";
    const p5after  = "let ad=ab.p,ak=ab.c;if(!ak||!ak[e(1331)]){console.log('[bP] no ab.c.token');throw new bL(e(1330),e(1290));}";
    if (code.includes(p5before)) {
        code = code.replace(p5before, p5after);
        console.log("  P5: ab.p optional ✓");
    } else {
        console.warn("  [WARN] P5 bulunamadı");
    }

    return code;
}

// ─── Lokal sunucu ─────────────────────────────────────────────────────────────
function startServer(patchedCntsw) {
    const port = 19540 + Math.floor(Math.random() * 50);
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            if (urlPath.endsWith("/cntsw.js")) {
                res.writeHead(200, {"Content-Type":"application/javascript","Access-Control-Allow-Origin":"*"});
                res.end(patchedCntsw); return;
            }
            const fp = path.join(WORK_DIR, urlPath==="/"?"challenge.html":urlPath);
            fs_mod.readFile(fp, (err, data) => {
                if (err) { res.writeHead(404); res.end("404"); return; }
                const ext = path.extname(fp);
                const ct = ext===".html"?"text/html":ext===".js"?"application/javascript":"application/octet-stream";
                res.writeHead(200, {"Content-Type":ct,"Access-Control-Allow-Origin":"*"});
                res.end(data);
            });
        });
        server.on("error", reject);
        server.listen(port, "127.0.0.1", () => resolve({server, port}));
    });
}

// ─── HTTP: login tokens ───────────────────────────────────────────────────────
function getLoginTokens(page) {
    return page.evaluate(() => {
        const scripts = [...document.querySelectorAll("script")];
        const get = (re) => { for(const s of scripts){ const m=s.textContent.match(re); if(m) return m[1]; } return null; };
        const pkEl = document.querySelector('input[name="my_post_key"]');
        let csrf = null;
        for(const s of scripts) {
            const m = s.textContent.match(/params:\s*\[([^\]]+)\]/);
            if(m){ try{ csrf=JSON.parse("["+m[1]+"]")[2]||null; }catch(_){} if(csrf) break; }
        }
        return {
            my_post_key:   pkEl ? pkEl.value : null,
            csrf_token:    csrf,
            sitekey:       get(/sitekey:\s*['"]([^'"]+)['"]/),
            cdata:         get(/cdata:\s*['"]([^'"]+)['"]/),
            challengeType: get(/challengeType:\s*['"]([^'"]+)['"]/) || "x_marker",
        };
    });
}

// ─── Ana token üretici ────────────────────────────────────────────────────────
async function generate() {
    const t0 = Date.now();

    const patchedCntsw = getPatchedCntsw();
    const {server, port} = await startServer(patchedCntsw);
    console.log(`  Sunucu: http://127.0.0.1:${port}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-web-security","--allow-running-insecure-content",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
    });

    let my_post_key  = null;
    let csrf_token   = null;
    let continentalToken = null;

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator,"webdriver",{get:()=>false});
        });

        // ── Token yakalayıcılar ───────────────────────────────────────────────
        await page.exposeFunction("__gotToken", t => {
            if (!continentalToken) { console.log("  ✓ VERIFIED token:", t.substring(0,50)+"..."); continentalToken=t; }
        });

        // pResult callback — bP()'den aa (decrypt key) geldi
        const pResultPromise = new Promise(resolve => {
            page.exposeFunction("__onPResult", (aaJSON, krArr) => {
                console.log("  [bP] aa geldi:", aaJSON);
                resolve({ aa: JSON.parse(aaJSON), kr: krArr });
            }).catch(() => {});
        });

        // CDP: Origin override + response body yakala
        const client = await page.target().createCDPSession();
        await client.send("Network.enable");
        await client.send("Fetch.enable", {
            patterns: [{ urlPattern:"https://challenge.patched.to/api/*", requestStage:"Request" }]
        });

        const apiCResponses = [];

        client.on("Fetch.requestPaused", async evt => {
            const {requestId, request} = evt;
            const hdrs = {...request.headers,
                "Origin":"https://patched.to",
                "Referer":"https://patched.to/member.php?action=login",
                "Sec-Fetch-Site":"same-site","Sec-Fetch-Mode":"cors","Sec-Fetch-Dest":"empty"
            };
            await client.send("Fetch.continueRequest", {
                requestId,
                headers: Object.entries(hdrs).map(([n,v])=>({name:n,value:String(v)}))
            }).catch(()=>{});
        });

        const pending = {};
        client.on("Network.requestWillBeSent", evt => {
            const u = evt.request.url;
            if (u.includes("/api/")) {
                pending[evt.requestId] = {url:u, status:null};
                console.log(`  >> ${evt.request.method} ${u}`);
            }
        });
        client.on("Network.responseReceived", evt => {
            const e = pending[evt.requestId];
            if (e) { e.status = evt.response.status; console.log(`  << ${evt.response.status} ${e.url}`); }
        });
        client.on("Network.loadingFinished", async evt => {
            const e = pending[evt.requestId];
            if (!e) return;
            try {
                const r = await client.send("Network.getResponseBody",{requestId:evt.requestId});
                const hex = r.base64Encoded ? Buffer.from(r.body,"base64").toString("hex") : Buffer.from(r.body).toString("hex");
                console.log(`     res: ${hex.substring(0,60)}`);
                if (e.url.includes("/api/c") && e.status===200) {
                    apiCResponses.push(Buffer.from(hex,"hex"));
                }
                if (e.url.includes("/api/q") && e.status===200) {
                    const dec = msgpackDecode(Buffer.from(hex,"hex"));
                    const tok = dec && (dec.token||dec.t||dec.result);
                    if (tok && typeof tok==="string" && tok.length>10) {
                        console.log("  ✓ /api/q token:", tok.substring(0,50)+"...");
                        continentalToken = tok;
                    }
                }
            } catch(_) {}
        });

        // ── 1. Login sayfasını aç ─────────────────────────────────────────────
        console.log("[1] Login sayfası...");
        await page.goto("https://patched.to/member.php?action=login", {waitUntil:"networkidle2",timeout:30000});
        const loginData = await getLoginTokens(page);
        my_post_key = loginData.my_post_key;
        csrf_token  = loginData.csrf_token;
        console.log(`  my_post_key   : ${my_post_key}`);
        console.log(`  _csrf-token   : ${csrf_token ? csrf_token.substring(0,35)+"..." : "null"}`);
        console.log(`  sitekey       : ${loginData.sitekey ? loginData.sitekey.substring(0,25)+"..." : "null"}`);
        console.log(`  challengeType : ${loginData.challengeType}`);

        if (!process.argv.includes("--http-only")) {
            // ── 2. challenge.html aç ─────────────────────────────────────────
            console.log("\n[2] continental-response...");

            // window.__msgDecode inject
            await page.evaluateOnNewDocument(() => {
                window.__msgDecode = function(buf) {
                    if (!(buf instanceof Uint8Array)) buf = new Uint8Array(buf);
                    let p=0; const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
                    function r(){if(p>=buf.length)return null;const b=buf[p++];
                    if(b===0xc0)return null;if(b===0xc2)return false;if(b===0xc3)return true;
                    if((b&0x80)===0)return b;
                    if((b&0xe0)===0xa0){const l=b&0x1f;const s=new TextDecoder().decode(buf.slice(p,p+l));p+=l;return s;}
                    if((b&0xf0)===0x80){const l=b&0x0f;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
                    if((b&0xf0)===0x90){const l=b&0x0f;return Array.from({length:l},()=>r());}
                    if(b===0xcc)return buf[p++];if(b===0xcd){const v=(buf[p]<<8)|buf[p+1];p+=2;return v;}
                    if(b===0xce){const v=dv.getUint32(p);p+=4;return v;}
                    if(b===0xd9){const l=buf[p++];const s=new TextDecoder().decode(buf.slice(p,p+l));p+=l;return s;}
                    if(b===0xda){const l=(buf[p]<<8)|buf[p+1];p+=2;const s=new TextDecoder().decode(buf.slice(p,p+l));p+=l;return s;}
                    if(b===0xdc){const l=(buf[p]<<8)|buf[p+1];p+=2;return Array.from({length:l},()=>r());}
                    if(b===0xde){const l=(buf[p]<<8)|buf[p+1];p+=2;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
                    if(b===0xc4){const l=buf[p++];const d=buf.slice(p,p+l);p+=l;return d;}
                    if(b===0xc5){const l=(buf[p]<<8)|buf[p+1];p+=2;const d=buf.slice(p,p+l);p+=l;return d;}
                    if(b===0xcb){const v=dv.getFloat64(p,false);p+=8;return v;}
                    return null;}
                    try{
                        const result=r();
                        if(result&&typeof result==="object"&&!result.error)
                            console.log("[__msgDecode] ok keys:"+Object.keys(result).join(","));
                        return result;
                    }catch(e){console.log("[__msgDecode] err:"+e.message);return null;}
                };
            });

            // PROXY + mesaj handler
            await page.evaluateOnNewDocument(() => {
                // PROXY_FETCH_REQUEST
                window.addEventListener("message", async e => {
                    if (!e.data || e.data.type !== "PROXY_FETCH_REQUEST") return;
                    const {id, url, body, widgetId} = e.data;
                    try {
                        let bodyBuf;
                        if (body instanceof Uint8Array) { bodyBuf=body; }
                        else if (body && typeof body==="object") { const keys=Object.keys(body).map(Number).sort((a,b)=>a-b); bodyBuf=new Uint8Array(keys.map(k=>body[k])); }
                        else { bodyBuf=new Uint8Array(0); }
                        console.log("[PROXY >>]",url,"len:",bodyBuf.length);
                        const res = await fetch(url,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:bodyBuf,credentials:"include",mode:"cors"});
                        const resBuf = new Uint8Array(await res.arrayBuffer());
                        const contentType = res.headers.get("content-type") || "application/octet-stream";
                        console.log("[PROXY <<]",res.status,"len:",resBuf.length,"ct:",contentType);
                        window.postMessage({type:"PROXY_FETCH_RESPONSE",widgetId,id,status:res.status,contentType,body:resBuf},"*");
                    } catch(err) {
                        console.log("[PROXY ERR]",err.message);
                        window.postMessage({type:"PROXY_FETCH_RESPONSE",widgetId,id,error:{message:err.message}},"*");
                    }
                });

                // VERIFIED + AUTO RETRY SOLVER WITH RESET/EXECUTE
                let hmIdx = 0;
                let rotAngle = 0;
                let isRetrying = false;
                window.addEventListener("message", e => {
                    if (!e.data) return;
                    if (e.data.type==="VERIFIED"&&e.data.token) { window.__gotToken(e.data.token); return; }
                    if (e.data.type==="READY") console.log("[READY]");
                    if (e.data.type==="ERROR"||e.data.type==="CHALLENGE_FAILED") {
                        console.log("[ERR]",JSON.stringify(e.data).substring(0,150));
                        const msg = (e.data.message||"").toLowerCase();
                        if (msg.includes("too many") || msg.includes("5 minutes") || msg.includes("cooldown")) {
                            console.log("[RATELIMIT] 5 dakika bekleme sınırı tetiklendi.");
                            return;
                        }
                        const wid=e.data.widgetId||window.__activeWid;
                        if(wid && !isRetrying) {
                            isRetrying = true;
                            console.log("[RETRY] RESET + EXECUTE...");
                            setTimeout(()=>{ window.postMessage({type:"RESET", widgetId:wid}, "*"); }, 1000);
                            setTimeout(()=>{ isRetrying=false; window.postMessage({type:"EXECUTE", widgetId:wid}, "*"); }, 3500);
                        }
                    }
                    if (e.data.type&&e.data.type.endsWith("_SHOW")) {
                        console.log("[SHOW]",e.data.type);
                        const wid=e.data.widgetId, d=2000;
                        if (e.data.type==="ROTATE_SHOW") {
                            const angle = rotAngle; rotAngle = (rotAngle + 90) % 360;
                            setTimeout(()=>{window.postMessage({type:"ROTATE_ANSWER",widgetId:wid,angle},"*");console.log("[AUTO] ROTATE angle="+angle);},d);
                        }
                        else if (e.data.type==="HEIGHT_MATCH_SHOW") {
                            const idx = hmIdx % 4; hmIdx++;
                            setTimeout(()=>{window.postMessage({type:"HEIGHT_MATCH_ANSWER",widgetId:wid,selectedIndices:[idx]},"*");console.log("[AUTO] HEIGHT_MATCH selectedIndices=["+idx+"]");},d);
                        }
                        else if (e.data.type==="X_MARKER_SHOW") {
                            setTimeout(()=>{window.postMessage({type:"X_MARKER_ANSWER",widgetId:wid,placements:[{x:0.5,y:0.5}]},"*");console.log("[AUTO] X_MARKER");},d);
                        }
                        else if (e.data.type==="SLIDE_SHOW") {
                            setTimeout(()=>{window.postMessage({type:"SLIDE_ANSWER",widgetId:wid,x:0.5},"*");console.log("[AUTO] SLIDE x=0.5");},d);
                        }
                        else if (e.data.type==="GOBANG_SHOW") {
                            setTimeout(()=>{window.postMessage({type:"GOBANG_ANSWER",widgetId:wid,row:0,col:0},"*");console.log("[AUTO] GOBANG");},d);
                        }
                        else if (e.data.type==="SWAP_SHOW"||e.data.type==="EMOJI_SWAP_SHOW") {
                            setTimeout(()=>{window.postMessage({type:e.data.type.replace("_SHOW","_ANSWER"),widgetId:wid,swaps:[],solvedLine:0},"*");console.log("[AUTO] SWAP");},d);
                        }
                    }
                });
            });

            page.on("console", msg => {
                const t = msg.text();
                if (t.startsWith("[PROXY") || t.startsWith("[SHOW]") || t.startsWith("[AUTO]") ||
                    t.startsWith("[ERR]") || t.startsWith("[READY]") || t.startsWith("[bP]") ||
                    t.startsWith("[__msg") || t.startsWith("[decrypt") || t.startsWith("[VERIFIED")) {
                    console.log(" ", t.substring(0,180));
                }
            });

            await page.goto(`http://127.0.0.1:${port}/challenge.html`, {waitUntil:"networkidle2",timeout:15000});

            const widgetId = "w-" + Math.random().toString(36).substring(2,10);
            console.log("  widgetId:", widgetId);

            // CONFIG
            await page.evaluate((wid, sk, cd, ct, pt) => {
                window.__activeWid = wid;
                window.postMessage({
                    type:"CONFIG", widgetId:wid, siteKey:sk, cdata:cd, challengeType:ct,
                    baseUrl:"https://challenge.patched.to",
                    challengeUrl:"https://challenge.patched.to/api/c",
                    verifyUrl:"https://challenge.patched.to/api/q",
                    bridgeVersion:1, parentOrigin:"http://127.0.0.1:"+pt, theme:"auto", size:"normal",
                }, "*");
            }, widgetId, loginData.sitekey, loginData.cdata, loginData.challengeType, port);

            await new Promise(r=>setTimeout(r,1000));

            // EXECUTE
            await page.evaluate(wid => {
                window.postMessage({type:"EXECUTE",widgetId:wid},"*");
            }, widgetId);

            // ── 3. Token bekle ────────────────────────────────────────────────
            console.log("  Token bekleniyor...");
            const deadline = Date.now() + 90000;
            let answerSent = false;

            while (!continentalToken && Date.now() < deadline) {
                await new Promise(r=>setTimeout(r,400));

                // window.__abVal gelince answer gönder (bir kez)
                if (!answerSent) {
                    const abResult = await page.evaluate(() => {
                        const ab = window.__abVal;
                        if (!ab) return null;
                        const c = ab.c;
                        if (!c) return null;
                        return { type: ab.type };
                    }).catch(()=>null);

                    if (abResult && abResult.type) {
                        answerSent = true;
                        console.log("  [ANSWER] Delay 3-6s then send for type:", abResult.type);
                        // Gerçekçi solve time — insan 3-8 saniyede çözer
                        const delay = 3000 + Math.floor(Math.random() * 3000);
                        await new Promise(r => setTimeout(r, delay));
                        await page.evaluate((wid) => {
                            const ab = window.__abVal;
                            if (!ab) return;
                            const type = ab.type;
                            const answers = {
                                "shortest_line": { type:"SHORTEST_LINE_ANSWER", widgetId:wid, solvedLine:0 },
                                "rotate":        { type:"ROTATE_ANSWER",        widgetId:wid, angle:0 },
                                "height_match":  { type:"HEIGHT_MATCH_ANSWER",  widgetId:wid, index:0 },
                                "x_marker":      { type:"X_MARKER_ANSWER",      widgetId:wid, x:0.5, y:0.5 },
                                "slide":         { type:"SLIDE_ANSWER",         widgetId:wid, x:0 },
                                "gobang":        { type:"GOBANG_ANSWER",        widgetId:wid, row:0, col:0 },
                                "swap":          { type:"SWAP_ANSWER",          widgetId:wid, swaps:[] },
                                "emoji_swap":    { type:"EMOJI_SWAP_ANSWER",    widgetId:wid, swaps:[] },
                                "icon":          { type:"ICON_ANSWER",          widgetId:wid, indices:[0] },
                                "line_break":    { type:"LINE_BREAK_ANSWER",    widgetId:wid, index:0 },
                            };
                            const msg = answers[type];
                            if (msg) { window.postMessage(msg,"*"); console.log("[ANSWER SENT]", type); }
                        }, widgetId).catch(()=>{});
                    }
                }
            }
        }

    } finally {
        await browser.close();
        server.close();
    }

    const result = {
        "my_post_key":          my_post_key,
        "_csrf-token":          csrf_token,
        "continental-response": continentalToken,
        "_meta": { elapsed_ms: Date.now()-t0, ts: new Date().toISOString() }
    };

    const sep = "═".repeat(55);
    console.log("\n"+sep);
    console.log("  my_post_key          :", my_post_key);
    console.log("  _csrf-token          :", csrf_token ? csrf_token.substring(0,45)+"..." : "null");
    console.log("  continental-response :", continentalToken ? continentalToken.substring(0,50)+"..." : "null");
    console.log("  elapsed              :", (Date.now()-t0)+"ms");
    console.log(sep);
    console.log("\nJSON:\n"+JSON.stringify(result,null,2));
    return result;
}

(async () => {
    const args = process.argv.slice(2);
    let loops = 1;
    const li = args.indexOf("--loops");
    if (li!==-1&&args[li+1]) loops=parseInt(args[li+1])||1;
    for(let i=0;i<loops;i++){
        if(loops>1) console.log(`\n${"═".repeat(20)} ${i+1}/${loops} ${"═".repeat(20)}`);
        try{ await generate(); }catch(e){ console.error("HATA:",e.message); }
        if(i<loops-1) await new Promise(r=>setTimeout(r,2000));
    }
})();
