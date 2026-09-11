/**
 * Gerçek widget iframe URL'ini bul ve aç
 * api.js içinde iframe src'yi encode etmiş olabilir
 */
const https = require("https");
const fs = require("fs");

const SK = "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
const CDATA = "grRMKKFCKhQJfqLmJCsbsN9zGVIQNVO6aYklo8SMttPnlrA8muQf7kClb1IKX8AOa27Ycy2iM4GuvePWpCjInDIE-sSqi7DEhPHJ8dtWHufaegZfZ3jMH0gV41FS1q2i5R4D8F05IkskOTUi";
const WID = "w-" + Math.random().toString(36).substr(2, 8);

// api.js decoded strings içinde iframe URL'ini ara
const ALPHA = `}>J2Nt.^m7IH]uWGqF5lR)"TP<0h?,Kn%@EzD[:bgopj|3wd(C1s;S+{$rBaxYVfZcvyAi\`ek&/!L=M_Q68#4OX9*~U`;
function decode91(str) {
    const c = ALPHA, d = "" + (str || ""), e = d.length, f = [];
    let g = 0, h = 0, j = -1;
    for (let k = 0; k < e; k++) {
        let l = c.indexOf(d[k]);
        if (l === -1) continue;
        if (j < 0) { j = l; }
        else { j += l * 91; g |= j << h; h += (j & 8191) > 88 ? 13 : 14; do { f.push(g & 255); g >>= 8; h -= 8; } while (h > 7); j = -1; }
    }
    if (j > -1) f.push((g | j << h) & 255);
    return Buffer.from(f).toString("utf8");
}

function get(hostname, path, hdrs = {}) {
    return new Promise((res, rej) => {
        const cs = [];
        const req = https.request({ hostname, path, method: "GET", headers: { "User-Agent": "Mozilla/5.0 Chrome/120", ...hdrs } }, r => {
            r.on("data", c => cs.push(c));
            r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(cs).toString("utf8") }));
        });
        req.on("error", rej); req.end();
    });
}

function enc(obj) {
    const b = [];
    function ws(s) { const e = Buffer.from(s, "utf8"); const l = e.length; if (l <= 31) b.push(0xa0 | l); else if (l <= 255) b.push(0xd9, l); else b.push(0xda, (l >> 8) & 0xff, l & 0xff); for (const x of e) b.push(x); }
    function wv(v) { if (v === null) { b.push(0xc0); return; } if (typeof v === "boolean") { b.push(v ? 0xc3 : 0xc2); return; } if (typeof v === "number") { if (Number.isInteger(v) && v >= 0 && v <= 127) { b.push(v); return; } if (Number.isInteger(v) && v >= 0 && v <= 255) { b.push(0xcc, v); return; } if (Number.isInteger(v) && v >= 0 && v <= 65535) { b.push(0xcd, (v >> 8) & 0xff, v & 0xff); return; } b.push(0xcb); const buf = Buffer.allocUnsafe(8); buf.writeDoubleBE(v); for (const x of buf) b.push(x); return; } if (typeof v === "string") { ws(v); return; } if (Array.isArray(v)) { if (v.length <= 15) b.push(0x90 | v.length); else b.push(0xdc, (v.length >> 8) & 0xff, v.length & 0xff); v.forEach(wv); return; } if (typeof v === "object") { const ks = Object.keys(v); if (ks.length <= 15) b.push(0x80 | ks.length); else b.push(0xde, (ks.length >> 8) & 0xff, ks.length & 0xff); ks.forEach(k => { ws(k); wv(v[k]); }); return; } }
    wv(obj); return Buffer.from(b);
}

function dec(buf) {
    let p = 0;
    function r() { const b = buf[p++]; if (b === 0xc0) return null; if (b === 0xc2) return false; if (b === 0xc3) return true; if ((b & 0x80) === 0) return b; if ((b & 0xe0) === 0xa0) { const l = b & 0x1f; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if ((b & 0xf0) === 0x80) { const l = b & 0x0f; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; } if ((b & 0xf0) === 0x90) { const l = b & 0x0f; return Array.from({ length: l }, () => r()); } if (b === 0xcc) return buf[p++]; if (b === 0xcd) { const v = (buf[p] << 8) | buf[p + 1]; p += 2; return v; } if (b === 0xce) { const v = buf.readUInt32BE(p); p += 4; return v; } if (b === 0xd9) { const l = buf[p++]; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if (b === 0xda) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if (b === 0xdc) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; return Array.from({ length: l }, () => r()); } if (b === 0xde) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; } if (b === 0xc4) { const l = buf[p++]; const d = buf.slice(p, p + l); p += l; return { _b64: d.toString("base64") }; } if (b === 0xcb) { const v = buf.readDoubleBE(p); p += 8; return v; } return "[0x" + b.toString(16) + "]"; }
    try { return r(); } catch (e) { return { error: e.message }; }
}

function post(hostname, path, payload, hdrs = {}) {
    return new Promise((res, rej) => {
        const cs = [];
        const req = https.request({ hostname, path, method: "POST", headers: { "Content-Type": "application/octet-stream", "Content-Length": payload.length, ...hdrs } }, r => {
            r.on("data", c => cs.push(c));
            r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(cs) }));
        });
        req.on("error", rej); req.write(payload); req.end();
    });
}

async function main() {
    // api.js'deki decoded stringleri oku
    const apiDecoded = fs.readFileSync("api_all_decoded.txt", "utf8");
    console.log("api.js decoded strings (ilk 52):  tamam");

    // 1. /s/<sitekey_hash> path'ini dene — cntsw.js URL'i c296b4bc... hash'ı içeriyor
    // Asıl soru: api.js hangi iframe URL'ini yaratıyor?
    // api.js içinde b(N) çağrıları iframe src ve temel URL'leri gösteriyor
    // api.js'i oku ve içindeki string kullanımlarını bul
    const apiBody = fs.readFileSync("api.js.downloaded", "utf8");

    // Decoded d[] array'ini api.js'e uygula — b(N) → decoded[N] ile replace et
    const dStart = apiBody.indexOf(",d=[") + 4;
    const dEnd = apiBody.indexOf("];", dStart);
    const dRaw = apiBody.substring(dStart, dEnd);
    let strings;
    try { strings = JSON.parse("[" + dRaw + "]"); }
    catch (e) {
        strings = [];
        let inStr = false, cur = "", esc = false, q = null;
        for (let i = 0; i < dRaw.length; i++) {
            const ch = dRaw[i];
            if (esc) { cur += ch; esc = false; continue; }
            if (ch === "\\") { esc = true; cur += ch; continue; }
            if (!inStr && (ch === '"' || ch === "'")) { inStr = true; q = ch; cur = ""; continue; }
            if (inStr && ch === q) { strings.push(cur); inStr = false; cur = ""; continue; }
            if (inStr) cur += ch;
        }
    }

    const decoded = strings.map(s => { try { return decode91(s); } catch { return "?"; } });

    // api.js'de "iframe" kelimesini ara ve çevresini göster
    const iframeIdx = apiBody.indexOf("iframe");
    if (iframeIdx >= 0) {
        console.log("\n=== iframe context ===");
        let ctx = apiBody.substring(Math.max(0, iframeIdx - 100), iframeIdx + 200);
        // b(N) → decoded değerleriyle değiştir
        ctx = ctx.replace(/b\((\d+)\)/g, (_, n) => `"${decoded[parseInt(n)] || "?"}" `);
        console.log(ctx);
    }

    // api.js'de "src" ara
    const srcIdx = apiBody.indexOf(".src=");
    if (srcIdx >= 0) {
        console.log("\n=== .src= context ===");
        let ctx = apiBody.substring(Math.max(0, srcIdx - 50), srcIdx + 300);
        ctx = ctx.replace(/b\((\d+)\)/g, (_, n) => `"${decoded[parseInt(n)] || "?"}" `);
        console.log(ctx);
    }

    // Tüm .src= yerlerini bul
    console.log("\n=== All .src assignments ===");
    let pos = 0;
    while (true) {
        const idx = apiBody.indexOf("src", pos);
        if (idx < 0) break;
        pos = idx + 1;
        let ctx = apiBody.substring(Math.max(0, idx - 20), idx + 100);
        if (ctx.includes("b(") || ctx.includes("challenge") || ctx.includes("/s/") || ctx.includes("iframe")) {
            ctx = ctx.replace(/b\((\d+)\)/g, (_, n) => `"${decoded[parseInt(n)] || "?"}" `);
            console.log(`  pos=${idx}: ${ctx.replace(/\n/g, " ").substring(0, 120)}`);
        }
    }

    // 2. /s/<widgetId> path'i var mı?
    console.log("\n=== /s/ endpoint denemesi ===");
    const sPaths = [
        `/s?sitekey=${SK}&widgetId=${WID}&challengeType=x_marker`,
        `/s/${WID}`,
        `/widget/${WID}`,
    ];
    for (const path of sPaths) {
        const r = await get("challenge.patched.to", path, {
            "Origin": "https://patched.to",
            "Referer": "https://patched.to/member.php?action=login"
        });
        const ck = (r.headers["set-cookie"] || []).map(c => c.split(";")[0]).join(" | ");
        console.log(`  GET ${path.substring(0, 60)} HTTP=${r.status} cookies: ${ck || "none"} body: ${r.body.substring(0, 60)}`);
        await new Promise(r => setTimeout(r, 300));
    }

    // 3. /api/c'yi GET ile dene
    console.log("\n=== GET /api/c ===");
    const r3 = await get("challenge.patched.to", `/api/c?sitekey=${encodeURIComponent(SK)}&widgetId=${WID}`, {
        "Origin": "https://patched.to"
    });
    console.log(`  HTTP=${r3.status} body: ${r3.body.substring(0, 100)}`);

    // 4. Content-Type: application/json ile dene
    console.log("\n=== /api/c application/json ===");
    const jsonPayload = Buffer.from(JSON.stringify({ sitekey: SK, widgetId: WID, challengeType: "x_marker", cdata: CDATA }));
    const r4 = await post("challenge.patched.to", "/api/c", jsonPayload, {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Chrome/120",
        "Origin": "https://patched.to",
        "Referer": "https://patched.to/member.php?action=login",
    });
    console.log(`  HTTP=${r4.status} body hex: ${r4.body.toString("hex")}`);
    try { console.log("  JSON parse:", JSON.parse(r4.body.toString())); } catch (_) { }

    // 5. cntsw.js URL'ini doğrulayan hash ile aynı path'e bak
    // cntsw.js URL'i: /s/c296b4bcca757cce597a015732b00b87/cntsw.js
    // Belki /s/c296b4.../index.html veya sadece /s/c296b4... gibi bir widget page var
    console.log("\n=== cntsw hash path ===");
    const HASH = "c296b4bcca757cce597a015732b00b87";
    const hashPaths = [
        `/s/${HASH}`,
        `/s/${HASH}/`,
        `/s/${HASH}/index.html`,
        `/s/${HASH}/widget`,
    ];
    for (const path of hashPaths) {
        const r = await get("challenge.patched.to", path, {
            "Origin": "https://patched.to",
            "Referer": "https://patched.to/member.php?action=login"
        });
        const ck = (r.headers["set-cookie"] || []).map(c => c.split(";")[0]).join(" | ");
        console.log(`  GET ${path} HTTP=${r.status} cookies: ${ck || "none"} body: ${r.body.substring(0, 80)}`);
        await new Promise(r => setTimeout(r, 300));
    }
}

main().catch(console.error);
