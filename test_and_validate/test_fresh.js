/**
 * Login sayfasından taze sitekey + cookie al, sonra /api/c çağır
 */
const https = require("https");

function enc(obj) {
    const b = [];
    function ws(s) { const e = Buffer.from(s, "utf8"); const l = e.length; if (l <= 31) b.push(0xa0 | l); else if (l <= 255) b.push(0xd9, l); else b.push(0xda, (l >> 8) & 0xff, l & 0xff); for (const x of e) b.push(x); }
    function wv(v) { if (v === null) { b.push(0xc0); return; } if (typeof v === "boolean") { b.push(v ? 0xc3 : 0xc2); return; } if (typeof v === "number") { if (Number.isInteger(v) && v >= 0 && v <= 127) { b.push(v); return; } if (Number.isInteger(v) && v >= 0 && v <= 255) { b.push(0xcc, v); return; } if (Number.isInteger(v) && v >= 0 && v <= 65535) { b.push(0xcd, (v >> 8) & 0xff, v & 0xff); return; } b.push(0xcb); const buf = Buffer.allocUnsafe(8); buf.writeDoubleBE(v); for (const x of buf) b.push(x); return; } if (typeof v === "string") { ws(v); return; } if (Array.isArray(v)) { if (v.length <= 15) b.push(0x90 | v.length); else b.push(0xdc, (v.length >> 8) & 0xff, v.length & 0xff); v.forEach(wv); return; } if (typeof v === "object") { const ks = Object.keys(v); if (ks.length <= 15) b.push(0x80 | ks.length); else b.push(0xde, (ks.length >> 8) & 0xff, ks.length & 0xff); ks.forEach(k => { ws(k); wv(v[k]); }); return; } }
    wv(obj); return Buffer.from(b);
}

function dec(buf) {
    let p = 0;
    function r() { const b = buf[p++]; if (b === 0xc0) return null; if (b === 0xc2) return false; if (b === 0xc3) return true; if ((b & 0x80) === 0) return b; if ((b & 0xe0) === 0xa0) { const l = b & 0x1f; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if ((b & 0xf0) === 0x80) { const l = b & 0x0f; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; } if ((b & 0xf0) === 0x90) { const l = b & 0x0f; return Array.from({ length: l }, () => r()); } if (b === 0xcc) return buf[p++]; if (b === 0xcd) { const v = (buf[p] << 8) | buf[p + 1]; p += 2; return v; } if (b === 0xce) { const v = buf.readUInt32BE(p); p += 4; return v; } if (b === 0xd2) { const v = buf.readInt32BE(p); p += 4; return v; } if (b === 0xd9) { const l = buf[p++]; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if (b === 0xda) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const s = buf.slice(p, p + l).toString("utf8"); p += l; return s; } if (b === 0xdc) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; return Array.from({ length: l }, () => r()); } if (b === 0xde) { const l = (buf[p] << 8) | buf[p + 1]; p += 2; const o = {}; for (let i = 0; i < l; i++) { const k = r(); o[k] = r(); } return o; } if (b === 0xc4) { const l = buf[p++]; const d = buf.slice(p, p + l); p += l; return { _b64: d.toString("base64"), _len: l }; } if (b === 0xcb) { const v = buf.readDoubleBE(p); p += 8; return v; } return "[0x" + b.toString(16) + "]"; }
    try { return r(); } catch (e) { return { error: e.message }; }
}

function getLogin() {
    return new Promise((res, rej) => {
        const chunks = [];
        const req = https.request({
            hostname: "patched.to",
            path: "/member.php?action=login",
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            }
        }, r => {
            r.on("data", c => chunks.push(c));
            r.on("end", () => res({
                status: r.statusCode,
                headers: r.headers,
                body: Buffer.concat(chunks).toString("utf8")
            }));
        });
        req.on("error", rej); req.end();
    });
}

function postApi(payload, cookies) {
    return new Promise((res, rej) => {
        const cs = [];
        const req = https.request({
            hostname: "challenge.patched.to",
            path: "/api/c",
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": payload.length,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Origin": "https://challenge.patched.to",
                "Referer": "https://challenge.patched.to/",
                ...(cookies ? { "Cookie": cookies } : {}),
            }
        }, r => {
            r.on("data", c => cs.push(c));
            r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(cs) }));
        });
        req.on("error", rej); req.write(payload); req.end();
    });
}

async function main() {
    console.log("1. Login sayfasından taze veriler alınıyor...");
    const login = await getLogin();

    const html = login.body;
    const skMatch = html.match(/sitekey:\s*'([^']+)'/);
    const sk = skMatch ? skMatch[1] : "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
    const cdataMatch = html.match(/cdata:\s*'([^']+)'/);
    const cdata = cdataMatch ? cdataMatch[1] : null;
    const ctMatch = html.match(/challengeType:\s*'([^']+)'/);
    const ct = ctMatch ? ctMatch[1] : "x_marker";

    // Login page cookies
    const rawCookies = login.headers["set-cookie"] || [];
    const cookieJar = {};
    for (const c of rawCookies) {
        const [pair] = c.split(";");
        const eqIdx = pair.indexOf("=");
        if (eqIdx > 0) {
            cookieJar[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
        }
    }
    const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");

    console.log(`   siteKey: ${sk.substring(0, 25)}...`);
    console.log(`   ct     : ${ct}`);
    console.log(`   cookies: ${cookieStr || "none"}`);

    const WID = "w-" + Math.random().toString(36).substr(2, 8);

    // Deneme 1: siteKey (büyük K) + cookies
    console.log("\n2. /api/c denemesi — çeşitli Origin header'lar");
    
    const variants = [
        // [payload, origin, referer, label]
        [{ siteKey: sk, widgetId: WID }, "https://patched.to", "https://patched.to/member.php?action=login", "siteKey+patched.to origin"],
        [{ siteKey: sk, widgetId: WID, challengeType: ct, cdata: cdata }, "https://patched.to", "https://patched.to/member.php?action=login", "siteKey+ct+cdata"],
        [{ sitekey: sk, widgetId: WID, challengeType: ct, cdata: cdata }, "https://patched.to", "https://patched.to/member.php?action=login", "sitekey(lower)+ct+cdata"],
        // challenge.patched.to'yu Origin olarak dene
        [{ siteKey: sk, widgetId: WID }, "https://challenge.patched.to", "https://challenge.patched.to/", "siteKey+challenge origin"],
    ];

    for (const [body, origin, referer, label] of variants) {
        const payload = enc(body);
        const cs = [];
        const resp = await new Promise((res, rej) => {
            const req = https.request({
                hostname: "challenge.patched.to",
                path: "/api/c",
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Length": payload.length,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
                    "Accept": "*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Origin": origin,
                    "Referer": referer,
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    "Cookie": cookieStr,
                }
            }, r => {
                r.on("data", c => cs.push(c));
                r.on("end", () => res({ status: r.statusCode, body: Buffer.concat(cs) }));
            });
            req.on("error", rej); req.write(payload); req.end();
        });
        const d = dec(resp.body);
        console.log(`  [${label}] HTTP=${resp.status} => ${JSON.stringify(d)}`);
        await new Promise(r => setTimeout(r, 400));
    }
}

main().catch(e => console.error("HATA:", e.message));
