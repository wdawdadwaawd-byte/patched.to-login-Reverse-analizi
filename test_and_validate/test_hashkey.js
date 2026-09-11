"use strict";
/**
 * p(siteKey, "/api/c") key derivation'ı Node.js'de implement et
 * bz = BLAKE2b(salt=ck, key=siteKey, data=url+ua)
 * cv = BLAKE2b(input=y, dkLen=64)
 */
const https  = require("https");
const crypto = require("crypto");
const { blake2b } = require("./node_modules/@noble/hashes/blake2.js");

const SK = "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const enc = new TextEncoder();

// bz(ck, siteKey_bytes, url+ua_bytes)
// ck = lazy BLAKE2b instance (unkeyed, salt=empty) - essentially just a class reference
// → bz = (a, f, g) => new BLAKE2b(a, f).update(g).digest()
// a = ck (config/salt), f = key=siteKey_bytes, g = data
// Trying different interpretations:

function deriveKey(siteKey, path) {
    const skBytes  = enc.encode(siteKey);
    const pathBytes = enc.encode(path);
    const uaBytes  = enc.encode(UA);
    const data     = new Uint8Array([...pathBytes, ...uaBytes]);

    // Interpretation 1: blake2b(key=skBytes, data=path+ua, dkLen=64)
    // bz result → cv → B[32..64]
    try {
        const y1 = blake2b(data, { key: skBytes, dkLen: 64 });
        const B1 = blake2b(y1, { dkLen: 64 });
        return { label: "blake2b(key=sk,data=url+ua)", request: B1.slice(0,32), response: B1.slice(32,64) };
    } catch(e) { console.log("variant1 err:", e.message); }

    return null;
}

// HChaCha20 (for XChaCha20)
function hchacha20(key, nonce16) {
    const C = [0x61707865,0x3320646e,0x79622d32,0x6b206574];
    function ld(b,i){return (b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0;}
    const k=[],n=[];
    for(let i=0;i<8;i++)k.push(ld(key,i*4));
    for(let i=0;i<4;i++)n.push(ld(nonce16,i*4));
    const st=[C[0],C[1],C[2],C[3],k[0],k[1],k[2],k[3],k[4],k[5],k[6],k[7],n[0],n[1],n[2],n[3]];
    function rotl(v,n){return((v<<n)|(v>>>(32-n)))>>>0;}
    function qr(a,b,c,d,s){s[a]=(s[a]+s[b])>>>0;s[d]=rotl(s[d]^s[a],16);s[c]=(s[c]+s[d])>>>0;s[b]=rotl(s[b]^s[c],12);s[a]=(s[a]+s[b])>>>0;s[d]=rotl(s[d]^s[a],8);s[c]=(s[c]+s[d])>>>0;s[b]=rotl(s[b]^s[c],7);}
    for(let i=0;i<20;i+=2){qr(0,4,8,12,st);qr(1,5,9,13,st);qr(2,6,10,14,st);qr(3,7,11,15,st);qr(0,5,10,15,st);qr(1,6,11,12,st);qr(2,7,8,13,st);qr(3,4,9,14,st);}
    const out=Buffer.alloc(32);
    [st[0],st[1],st[2],st[3],st[12],st[13],st[14],st[15]].forEach((w,i)=>out.writeUInt32LE(w,i*4));
    return out;
}

function xchacha20(key, nonce24, ct) {
    const subkey = hchacha20(key, nonce24.slice(0,16));
    const n12 = Buffer.alloc(16,0);
    nonce24.copy(n12,4,16,24);
    const dc = crypto.createDecipheriv("chacha20", subkey, n12);
    return Buffer.concat([dc.update(ct)]);
}

function msgDecode(buf) {
    let p=0;
    function r(){if(p>=buf.length)return null;const b=buf[p++];
    if(b===0xc0)return null;if(b===0xc2)return false;if(b===0xc3)return true;
    if((b&0x80)===0)return b;
    if((b&0xe0)===0xa0){const l=b&0x1f;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
    if((b&0xf0)===0x80){const l=b&0x0f;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
    if((b&0xf0)===0x90){const l=b&0x0f;return Array.from({length:l},()=>r());}
    if(b===0xcc)return buf[p++];if(b===0xcd){const v=(buf[p]<<8)|buf[p+1];p+=2;return v;}
    if(b===0xce){const v=buf.readUInt32BE(p);p+=4;return v;}
    if(b===0xd9){const l=buf[p++];const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
    if(b===0xda){const l=(buf[p]<<8)|buf[p+1];p+=2;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}
    if(b===0xdc){const l=(buf[p]<<8)|buf[p+1];p+=2;return Array.from({length:l},()=>r());}
    if(b===0xde){const l=(buf[p]<<8)|buf[p+1];p+=2;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}
    if(b===0xc4){const l=buf[p++];const d=buf.slice(p,p+l);p+=l;return d;}
    if(b===0xc5){const l=(buf[p]<<8)|buf[p+1];p+=2;const d=buf.slice(p,p+l);p+=l;return d;}
    if(b===0xcb){const v=buf.readDoubleBE(p);p+=8;return v;}
    return `[0x${b.toString(16)}]`;}
    try{return r();}catch(e){return {error:e.message};}
}

function encMsg(obj){const b=[];function ws(s){const e=Buffer.from(s,"utf8");const l=e.length;if(l<=31)b.push(0xa0|l);else if(l<=255)b.push(0xd9,l);else b.push(0xda,(l>>8)&0xff,l&0xff);for(const x of e)b.push(x);}function wv(v){if(v===null){b.push(0xc0);return;}if(typeof v==="number"){if(Number.isInteger(v)&&v>=0&&v<=127){b.push(v);return;}b.push(0xcb);const buf=Buffer.allocUnsafe(8);buf.writeDoubleBE(v);for(const x of buf)b.push(x);return;}if(typeof v==="string"){ws(v);return;}if(typeof v==="object"){const ks=Object.keys(v);b.push(0x80|ks.length);ks.forEach(k=>{ws(k);wv(v[k]);});return;}}wv(obj);return Buffer.from(b);}

// Tüm BLAKE2b variant'larını dene
const skBytes  = enc.encode(SK);
const urlBytes = enc.encode("/api/c");
const uaBytes  = enc.encode(UA);
const data_url_ua = new Uint8Array([...urlBytes, ...uaBytes]);

// Her variant için key
const variants = [];

// Variant A: blake2b(key=skBytes, data=url+ua, dkLen=64) → B = blake2b(y, dkLen=64)
try {
    const y = blake2b(data_url_ua, { key: skBytes, dkLen: 64 });
    const B = blake2b(y, { dkLen: 64 });
    variants.push({ label: "A: bz(key=sk,data=url+ua) → cv(64)", key: Buffer.from(B.slice(32,64)) });
} catch(e) { console.log("A err:", e.message); }

// Variant B: blake2b(data=skBytes+url+ua, dkLen=64) → B = blake2b(y, dkLen=64)
try {
    const inp = new Uint8Array([...skBytes, ...urlBytes, ...uaBytes]);
    const y = blake2b(inp, { dkLen: 64 });
    const B = blake2b(y, { dkLen: 64 });
    variants.push({ label: "B: bz(data=sk+url+ua) → cv(64)", key: Buffer.from(B.slice(32,64)) });
} catch(e) { console.log("B err:", e.message); }

// Variant C: sadece blake2b(sk, dkLen=64) → B[32..64]
try {
    const B = blake2b(skBytes, { dkLen: 64 });
    variants.push({ label: "C: blake2b(sk,64)[32..64]", key: Buffer.from(B.slice(32,64)) });
} catch(e) { console.log("C err:", e.message); }

// Variant D: blake2b(sk+url, dkLen=64) → B[32..64]
try {
    const inp = new Uint8Array([...skBytes, ...urlBytes]);
    const B = blake2b(inp, { dkLen: 64 });
    variants.push({ label: "D: blake2b(sk+url,64)[32..64]", key: Buffer.from(B.slice(32,64)) });
} catch(e) { console.log("D err:", e.message); }

// Variant E: bz(ck, skBytes, url+ua) — ck = empty/undefined salt
// blake2b kütüphanesinde salt parametresi var mı?
try {
    const y = blake2b(data_url_ua, { key: skBytes, salt: new Uint8Array(16), personalization: new Uint8Array(16), dkLen: 64 });
    const B = blake2b(y, { dkLen: 64 });
    variants.push({ label: "E: bz(salt=0,key=sk) → cv(64)", key: Buffer.from(B.slice(32,64)) });
} catch(e) { console.log("E err:", e.message); }

console.log("Variants prepared:", variants.length);

// /api/c isteği
const payload = encMsg({"5":4, k: SK, cnt: null});
const cs = [];
https.request({
    hostname:"challenge.patched.to",path:"/api/c",method:"POST",
    headers:{"Content-Type":"application/octet-stream","Content-Length":payload.length,"User-Agent":UA,"Origin":"https://patched.to"}
},res=>{
    res.on("data",c=>cs.push(c));
    res.on("end",()=>{
        const b=Buffer.concat(cs);
        let p=0;
        function rd(){const by=b[p++];if(by===0xc0)return null;if(by===0xc2)return false;if(by===0xc3)return true;if((by&0x80)===0)return by;if((by&0xe0)===0xa0){const l=by&0x1f;const s=b.slice(p,p+l).toString("utf8");p+=l;return s;}if((by&0xf0)===0x80){const l=by&0x0f;const o={};for(let i=0;i<l;i++){const k=rd();o[k]=rd();}return o;}if(by===0xd9){const l=b[p++];const s=b.slice(p,p+l).toString("utf8");p+=l;return s;}if(by===0xc5){const l=(b[p]<<8)|b[p+1];p+=2;const d=b.slice(p,p+l);p+=l;return d;}if(by===0xc4){const l=b[p++];const d=b.slice(p,p+l);p+=l;return d;}return null;}
        const obj=rd();
        const rBuf=obj?.r;
        if(!rBuf){console.log("r yok");return;}
        console.log("HTTP",res.statusCode,"r len:",rBuf.length);
        const nonce=rBuf.slice(0,24);
        const cipher=rBuf.slice(24);
        console.log("nonce:",nonce.toString("hex"));

        for(const {label,key} of variants){
            try{
                const dec=xchacha20(key,nonce,cipher);
                const decoded=msgDecode(dec);
                const valid=decoded&&typeof decoded==="object"&&!decoded?.error;
                const ks=valid?Object.keys(decoded).join(","):"invalid";
                const mark=valid?"✓":"✗";
                console.log(`${mark} ${label}: first4=${dec.slice(0,4).toString("hex")} keys=[${ks}]`);
                if(valid&&(decoded.p||decoded.c)){
                    console.log(`  → p=${JSON.stringify(decoded.p).substring(0,60)} c=${JSON.stringify(decoded.c).substring(0,60)}`);
                }
            }catch(e){console.log(`✗ ${label}: ${e.message.substring(0,60)}`);}
        }
    });
}).on("error",e=>console.log(e.message)).end(payload);
