/**
 * continental widget iframe URL'ini GET et → challenge.patched.to cookie'si al
 * Sonra /api/c çağrısını o cookie ile yap
 */
const https = require("https");

const SK = "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
const CDATA = "grRMKKFCKhQJfqLmJCsbsN9zGVIQNVO6aYklo8SMttPnlrA8muQf7kClb1IKX8AOa27Ycy2iM4GuvePWpCjInDIE-sSqi7DEhPHJ8dtWHufaegZfZ3jMH0gV41FS1q2i5R4D8F05IkskOTUi";
const WID = "w-" + Math.random().toString(36).substr(2, 8);

function get(hostname, path, headers = {}) {
    return new Promise((res, rej) => {
        const chunks = [];
        const req = https.request({
            hostname, path, method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 Chrome/120", ...headers }
        }, r => {
            r.on("data", c => chunks.push(c));
            r.on("end", () => res({
                status: r.statusCode,
                headers: r.headers,
                body: Buffer.concat(chunks).toString("utf8")
            }));
        });
        req.on("error", rej);
        req.end();
    });
}

function enc(obj) {
    const b = [];
    function ws(s) { const e = Buffer.from(s, "utf8"); const l = e.length; if (l <= 31) b.push(0xa0 | l); else if (l <= 255) b.push(0xd9, l); else b.push(0xda, (l >> 8) & 0xff, l & 0xff); for (const x of e) b.push(x); }
    function wv(v) {
        if (v === null) { b.push(0xc0); return; }
        if (typeof v === "boolean") { b.push(v ? 0xc3 : 0xc2); return; }
        if (typeof v === "number") { if (Number.isInteger(v) && v >= 0 && v <= 127) { b.push(v); return; } if (Number.isInteger(v) && v >= 0 && v <= 255) { b.push(0xcc, v); return; } if (Number.isInteger(v) && v >= 0 && v <= 65535) { b.push(0xcd, (v >> 8) & 0xff, v & 0xff); return; } b.push(0xcb); const buf = Buffer.allocUnsafe(8); buf.writeDoubleBE(v); for (const x of buf) b.push(x); return; }
        if (typeof v === "string") { ws(v); return; }
        if (Array.isArray(v)) { if (v.length <= 15) b.push(0x90 | v.length); else b.push(0xdc, (v.length >> 8) & 0xff, v.length & 0xff); v.forEach(wv); return; }
        if (typeof v === "object") { const ks = Object.keys(v); if (ks.length <= 15) b.push(0x80 | ks.length); else b.push(0xde, (ks.length >> 8) & 0xff, ks.length & 0xff); ks.forEach(k => { ws(k); wv(v[k]); }); return; }
    }
    wv(obj); return Buffer.from(b);
}

function dec(buf) {
    let p = 0;
    function r() {
        const b = buf[p++];
        if (b === 0xc0) return null; if (b === 0xc2) return false; if (b === 0xc3) return true;
        if ((b & 0x80) === 0) return b;
        if ((b & 0xe0) === 0xa0) { const l = b & 0x1f; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; }
        if ((b & 0xf0) === 0x80) { const l = b & 0x0f; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; }
        if ((b & 0xf0) === 0x90) { const l = b & 0x0f; return Array.from({ length: l }, () => r()); }
        if (b === 0xcc) return buf[p++];
        if (b === 0xcd) { const v = (buf[p] << 8) | buf[p + 1]; p += 2; return v; }
        if (b === 0xce) { const v = buf.readUInt32BE(p); p += 4; return v; }
        if (b === 0xd2) { const v = buf.readInt32BE(p); p += 4; return v; }
        if (b === 0xd9) { const l = buf[p++]; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; }
        if (b === 0xda) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; }
        if (b === 0xdc) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; return Array.from({ length: l }, () => r()); }
        if (b === 0xde) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; }
        if (b === 0xc4) { const l = buf[p++]; const d = buf.slice(p, p + l); p += l; return { _b64: d.toString("base64"), _buf: d }; }
        if (b === 0xcb) { const v = buf.readDoubleBE(p); p += 8; return v; }
        return "[0x" + b.toString(16) + "]";
    }
    try { return r(); } catch (e) { return { error: e.message }; }
}

function post(hostname, path, payload, headers = {}) {
    return new Promise((res, rej) => {
        const cs = [];
        const req = https.request({
            hostname, path, method: "POST",
            headers: { "Content-Type": "application/octet-stream", "Content-Length": payload.length, ...headers }
        }, r => {
            r.on("data", c => cs.push(c));
            r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(cs) }));
        });
        req.on("error", rej);
        req.write(payload); req.end();
    });
}

async function main() {
    // 1. Widget iframe URL'ini dene: /c/<sitekey>?...
    const widgetPaths = [
        `/c/${SK}?widgetId=${WID}&challengeType=x_marker`,
        `/c?sitekey=${SK}&widgetId=${WID}`,
        `/widget?sitekey=${SK}&widgetId=${WID}`,
        `/s/${SK}/cntsw.js`,  // dosya URL'i
    ];

    console.log("=== Widget URL denemesi ===");
    for (const path of widgetPaths) {
        try {
            const r = await get("challenge.patched.to", path, {
                "Origin": "https://patched.to",
                "Referer": "https://patched.to/member.php?action=login"
            });
            const ck = (r.headers["set-cookie"] || []).map(c => c.split(";")[0]).join(" | ");
            console.log(`  GET ${path.substring(0, 60)} → HTTP ${r.status} | cookies: ${ck || "none"}`);
            if (r.status === 200 && ck) {
                console.log("  → Cookie alındı! /api/c deniyor...");
                const payload = enc({ sitekey: SK, widgetId: WID, challengeType: "x_marker", cdata: CDATA });
                const resp = await post("challenge.patched.to", "/api/c", payload, {
                    "User-Agent": "Mozilla/5.0 Chrome/120",
                    "Origin": "https://patched.to",
                    "Referer": "https://patched.to/member.php?action=login",
                    "Cookie": ck,
                });
                console.log("  /api/c HTTP:", resp.status, "=>", JSON.stringify(dec(resp.body)));
            }
        } catch (e) {
            console.log(`  GET ${path} → ERROR: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 300));
    }

    // 2. /api/c'yi hiç cookie olmadan dene — belki header değil, payload içinde başka şey bekliyor
    console.log("\n=== /api/c payload variasyonları ===");
    const payloads = [
        // sk field adı varyasyonları
        { sk: SK, wid: WID },
        { site_key: SK, widget_id: WID },
        { key: SK, widgetId: WID },
        // sitekey doğrudan URL param olarak gönderilebilir mi?
    ];
    for (const [i, body] of payloads.entries()) {
        const payload = enc(body);
        const r = await post("challenge.patched.to", "/api/c", payload, {
            "User-Agent": "Mozilla/5.0 Chrome/120",
            "Origin": "https://patched.to",
            "Referer": "https://patched.to/member.php?action=login",
        });
        console.log(`  Test ${i + 1} [${Object.keys(body).join(",")}] HTTP=${r.status} =>`, JSON.stringify(dec(r.body)));
        await new Promise(r => setTimeout(r, 300));
    }

    // 3. URL parametresiyle dene
    console.log("\n=== /api/c URL param denemesi ===");
    const urlPayload = enc({ sitekey: SK, widgetId: WID });
    const r2 = await post("challenge.patched.to", `/api/c?sitekey=${encodeURIComponent(SK)}&widgetId=${WID}`, urlPayload, {
        "User-Agent": "Mozilla/5.0 Chrome/120",
        "Origin": "https://patched.to",
        "Referer": "https://patched.to/member.php?action=login",
    });
    console.log(`  URL param HTTP=${r2.status} =>`, JSON.stringify(dec(r2.body)));
}

main().catch(console.error);
