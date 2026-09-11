/**
 * API endpoint'lerini bul
 * cntsw.js decoded strings'ten API path'lerini çıkar
 */
const fs = require("fs");
const https = require("https");

// both_decoded.json'dan API path'lerini bul
const both = JSON.parse(fs.readFileSync("both_decoded.json"));
const keys = Object.keys(both);

console.log("=== cntsw.js içinde geçen tüm path/URL string'leri ===");
for (const k of keys) {
    const v = both[k].alpha2 || "";
    if (v.startsWith("/api") || v.startsWith("/j/") || v.startsWith("/s/") || v.startsWith("http") || (v.startsWith("/") && v.length < 20)) {
        if (both[k].r2readable) {
            console.log(`  [${k}] ${JSON.stringify(v)}`);
        }
    }
}

// Tüm alpha2 readable'ları listele (kısa string'ler)
console.log("\n=== Kısa alpha2 readable string'ler (uzunluk < 20) ===");
for (const k of keys) {
    const v = both[k].alpha2 || "";
    if (both[k].r2readable && v.length > 1 && v.length <= 15 && /^[a-zA-Z0-9_\-\/\.]+$/.test(v)) {
        console.log(`  [${k}] ${JSON.stringify(v)}`);
    }
}

// challenge.patched.to üzerindeki başka endpoint'leri dene
const endpoints = [
    "/api/i",      // init
    "/api/init",
    "/api/s",      // session
    "/api/session",
    "/api/v",      // verify
    "/api/t",      // token
    "/api/w",      // widget
    "/api/r",      // render
    "/j/render",
    "/j/widget",
    "/j/session",
    "/v1/challenge",
    "/challenge",
    "/init",
    "/session",
];

function get(path) {
    return new Promise((res, rej) => {
        const cs = [];
        const req = https.request({
            hostname: "challenge.patched.to",
            path,
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "*/*" }
        }, r => {
            r.on("data", c => cs.push(c));
            r.on("end", () => res({ status: r.statusCode, body: Buffer.concat(cs).toString("utf8").substring(0, 100) }));
        });
        req.on("error", e => res({ status: 0, body: e.message })); req.end();
    });
}

console.log("\n=== Endpoint probe ===");
(async () => {
    for (const ep of endpoints) {
        const r = await get(ep);
        if (r.status !== 404) {
            console.log(`  GET ${ep} → HTTP ${r.status}: ${r.body.substring(0, 60)}`);
        } else {
            process.stdout.write(".");
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.log("\nDone");
})().catch(console.error);
