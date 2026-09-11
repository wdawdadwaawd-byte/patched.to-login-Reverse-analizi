/**
 * api.js'in /api/c'den önce hangi endpoint'e gittiğini bul.
 * Tüm challenge.patched.to HTTP trafiğini simüle ederek
 * Proxy tarzında her endpoint'e bakarız.
 *
 * api.js, render() çağrısıyla:
 *  1. Bir iframe oluşturuyor
 *  2. iframe src'yi https://challenge.patched.to/... olarak set ediyor
 *  3. Bu GET isteğiyle session/cookie alınıyor
 *  4. İframe içinde cntsw.js çalışıyor → /api/c POST
 *
 * iframe URL'ini bulmak için api.js içindeki b() çağrılarını
 * Cloudflare/Node.js ile patch ederek çalıştırmayı dene.
 */
const https = require("https");
const fs = require("fs");

// api.js'i al ve önemli kısımları bul
const apiJs = fs.readFileSync("api.js.downloaded", "utf8");

// ALPHA
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

// d[] parse
const dStart = apiJs.indexOf(",d=[") + 4;
const dEnd   = apiJs.indexOf("];", dStart);
let strings  = [];
try { strings = JSON.parse("[" + apiJs.substring(dStart, dEnd) + "]"); } catch (_) {}

const decoded = strings.map(s => { try { return decode91(s); } catch { return "?"; } });

// api.js içinde b(N) → decoded[N] ile replace et
const readable = apiJs.replace(/\bb\((\d+)\)/g, (_, n) => {
    const idx = parseInt(n);
    const s = decoded[idx] || "?";
    return JSON.stringify(s);
});

// iframe ile ilgili kısımları bul
console.log("=== iframe src belirleme ===");
const lines = readable.split("\n");
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes("iframe") || l.includes(".src") || l.includes("challenge.") || l.includes("https://")) {
        console.log(`  L${i}: ${l.trim().substring(0, 150)}`);
    }
}

// readable kodu dosyaya kaydet
fs.writeFileSync("api_readable.js", readable);
console.log("\napi_readable.js kaydedildi (" + readable.length + " bytes)");

// İçinde "https" geçen satırları göster
console.log("\n=== HTTPS URL'leri ===");
const httpsRe = /https?:\/\/[^"'\s]+/g;
let m;
while ((m = httpsRe.exec(readable)) !== null) {
    const url = m[0].replace(/\\"/g, "").trim();
    if (!url.includes("fontawesome") && !url.includes("example")) {
        console.log("  " + url.substring(0, 100));
    }
}

// String birleştirme pattern'ları: "https://"+... veya `//`+b(N)
const concatRe = /"\/\/"|\+"\/\/"|challenge|patched/g;
while ((m = concatRe.exec(readable)) !== null) {
    const ctx = readable.substring(Math.max(0, m.index - 50), m.index + 100);
    console.log("\n  concat ctx: " + ctx.replace(/\n/g, " ").substring(0, 150));
}
