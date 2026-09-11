/**
 * İndirilen api.js'i tamamen decode et,
 * sitekey / /api/c çağrısının payload formatını bul
 */
const fs = require("fs");

const ALPHA = `}>J2Nt.^m7IH]uWGqF5lR)"TP<0h?,Kn%@EzD[:bgopj|3wd(C1s;S+{$rBaxYVfZcvyAi\`ek&/!L=M_Q68#4OX9*~U`;

function decode91(str) {
    const c = ALPHA;
    const d = "" + (str || "");
    const e = d.length;
    const f = [];
    let g = 0, h = 0, j = -1;
    for (let k = 0; k < e; k++) {
        let l = c.indexOf(d[k]);
        if (l === -1) continue;
        if (j < 0) { j = l; }
        else {
            j += l * 91;
            g |= j << h;
            h += (j & 8191) > 88 ? 13 : 14;
            do { f.push(g & 255); g >>= 8; h -= 8; } while (h > 7);
            j = -1;
        }
    }
    if (j > -1) f.push((g | j << h) & 255);
    return Buffer.from(f).toString("utf8");
}

const body = fs.readFileSync("api.js.downloaded", "utf8");

// d=[ ... ] array'ini bul
const dStart = body.indexOf(",d=[") + 4;
const dEnd = body.indexOf("];", dStart);
const dRaw = body.substring(dStart, dEnd);

// String'leri parse et (JSON array gibi)
let strings;
try {
    strings = JSON.parse("[" + dRaw + "]");
} catch (e) {
    // Manuel parse
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

console.log(`Toplam string: ${strings.length}`);

// Tümünü decode et
const decoded = strings.map((s, i) => {
    try { return { i, s: decode91(s) }; }
    catch (e) { return { i, s: `[ERR:${e.message}]` }; }
});

// Anlamlı olanları göster
const keywords = [
    "sitekey", "widgetId", "widget_id", "widget-id",
    "/api/", "api/c", "api/q",
    "challenge", "cdata", "site_key", "site-key",
    "signature", "nonce", "response", "token",
    "algorithm", "SHA", "Content-Type", "octet",
    "POST", "GET", "fetch", "missing",
    "render", "execute", "verify", "reset",
    "CONFIG", "EXECUTE", "VERIFIED",
    "parentOrigin", "bridgeVersion",
];

console.log("\n=== Anlamlı String'ler ===");
for (const { i, s } of decoded) {
    const lower = s.toLowerCase();
    const hit = keywords.some(k => lower.includes(k.toLowerCase()));
    if (hit) {
        console.log(`  [${i}] ${JSON.stringify(s)}`);
    }
}

// Tüm decode'ları kaydet
const out = decoded.map(({ i, s }) => `[${String(i).padStart(4)}] ${JSON.stringify(s)}`).join("\n");
fs.writeFileSync("api_all_decoded.txt", out);
console.log("\nTümü api_all_decoded.txt'e kaydedildi");

// Ayrıca: decode edilmiş kod içinde sitekey kelimesini ara
const replaced = body.replace(/b\((\d+)\)/g, (_, n) => {
    const idx = parseInt(n);
    return decoded[idx] ? JSON.stringify(decoded[idx].s) : `b(${n})`;
});
// "/api/c" çevresini bul
const apiCIdx = replaced.indexOf('"/api/c"');
if (apiCIdx >= 0) {
    console.log("\n=== /api/c context ===");
    console.log(replaced.substring(Math.max(0, apiCIdx - 300), apiCIdx + 300));
}
const sitekeyIdx = replaced.indexOf('"sitekey"');
if (sitekeyIdx >= 0) {
    console.log("\n=== sitekey context ===");
    console.log(replaced.substring(Math.max(0, sitekeyIdx - 200), sitekeyIdx + 200));
}
