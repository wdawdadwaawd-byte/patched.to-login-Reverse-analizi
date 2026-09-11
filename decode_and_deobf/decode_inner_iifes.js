/**
 * api.js içindeki iç IIFE'leri decode et.
 * Her iç IIFE'nin ayrı bir base91 alpha ve d[] array'i var.
 * 
 * Yapı:
 *   function N(g){...alpha="~dDTXetjob..."...}  ← decoder 1
 *   function O(b){return N(d[b])}               ← string lookup 1
 *   
 *   function P(g){...alpha="cGF15}$w*3[4~..."...}  ← decoder 2
 *   function Q(b){return P(d[b])}                  ← string lookup 2
 *   
 *   ...
 * 
 * Bunlar farklı scope'larda farklı d[] kullanıyor olabilir,
 * ya da aynı d[] array'inin farklı kısımlarını.
 */
const fs = require("fs");

const raw = fs.readFileSync("api.js.downloaded", "utf8");

// Ana d[] array'i — tek büyük array, tüm decode fonksiyonları bunu paylaşıyor
// Obfuscated IIFE: (function(){...var c={},d=[...];...})()
// ve içinde N,P,R,T gibi ayrı decoder'lar var

// Alpha'ları çıkar — "function X(g){var h=\"<ALPHA>\"" pattern'ı
const alphaRe = /var h="((?:[^"\\]|\\.)*)"/g;
const alphas = [];
let m;
while ((m = alphaRe.exec(raw)) !== null) {
    const alpha = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (alpha.length >= 80) { // base91 alpha ~94 char
        alphas.push({ pos: m.index, alpha });
    }
}
console.log(`Found ${alphas.length} decoder alphas`);
alphas.forEach((a, i) => console.log(`  [${i}] pos=${a.pos} alpha="${a.alpha.substring(0, 20)}..."`));

// base91 decoder
function makeDecoder(alpha) {
    return function(str) {
        const c = alpha;
        const d = "" + (str || "");
        const e = d.length;
        const f = [];
        let g = 0, h = 0, j = -1;
        for (let k = 0; k < e; k++) {
            let l = c.indexOf(d[k]);
            if (l === -1) continue;
            if (j < 0) { j = l; }
            else { j += l * 91; g |= j << h; h += (j & 8191) > 88 ? 13 : 14; do { f.push(g & 255); g >>= 8; h -= 8; } while (h > 7); j = -1; }
        }
        if (j > -1) f.push((g | j << h) & 255);
        return Buffer.from(f).toString("utf8");
    };
}

// Ana d[] — ilk obfuscated IIFE'den
// (d[] string'leri tüm decoder'lar tarafından paylaşılıyor)
const outerDStart = raw.indexOf(",d=[") + 4;
let depth = 0, inStr = false, strChar = "", esc = false, outerDEnd = -1;
for (let i = outerDStart; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") { esc = true; continue; } if (ch === strChar) inStr = false; continue; }
    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]") { if (depth === 0) { outerDEnd = i; break; } depth--; }
}
let dStrings = [];
try { dStrings = JSON.parse(raw.substring(outerDStart - 1, outerDEnd + 1)); } catch (e) {
    console.log("d[] parse error:", e.message);
}
console.log(`\nd[] count: ${dStrings.length}`);

// Her alpha ile tüm d[] string'lerini decode et
// Hangi alpha hangi range'i decode ediyor?
// api.js sonunda: p=window[g(105)][O(106)]+O(107) → O() kullanıyor
// O(N) → N() decoder kullanıyor → alphas[0]

// alphas[0] = ana iç decoder
const alpha0Decoder = makeDecoder(alphas[0] ? alphas[0].alpha : "");

// d[105], d[106], d[107] decode et
for (let idx = 100; idx <= 120; idx++) {
    if (idx < dStrings.length) {
        try {
            const v = alpha0Decoder(dStrings[idx]);
            console.log(`  d[${idx}] alpha0: "${v}"`);
        } catch (_) {}
    }
}

// Tüm alpha'larla "challenge", "patched", "location", "origin" içerenleri bul
console.log("\n=== Anlamlı string'ler (tüm alpha'lar) ===");
const keywords = ["challenge", "patched", "location", "origin", "href", "src", "url", "host", "/c", "widget", "api", "render", "iframe", "https", "//"];

for (const [ai, { alpha }] of alphas.entries()) {
    const decoder = makeDecoder(alpha);
    for (let i = 0; i < dStrings.length; i++) {
        try {
            const v = decoder(dStrings[i]);
            const lower = v.toLowerCase();
            if (keywords.some(k => lower.includes(k)) && v.length > 1 && v.length < 100) {
                console.log(`  alpha[${ai}] d[${i}] = "${v}"`);
            }
        } catch (_) {}
    }
}

// Kısa + anlamlı string'ler (property names)
console.log("\n=== Kısa identifier string'ler (alpha[0]) ===");
const decoder0 = makeDecoder(alphas[0] ? alphas[0].alpha : "");
for (let i = 0; i < Math.min(dStrings.length, 200); i++) {
    try {
        const v = decoder0(dStrings[i]);
        if (v.length > 1 && v.length <= 20 && /^[a-zA-Z0-9_\-\.\/]+$/.test(v)) {
            console.log(`  d[${i}] = "${v}"`);
        }
    } catch (_) {}
}
