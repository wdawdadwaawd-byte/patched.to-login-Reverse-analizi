/**
 * api.js'deki iframe src oluşturma kodunu decode et.
 * Özellikle b(858), b(901..903) ve çevresini çöz.
 */
const fs = require("fs");

// Ana ALPHA (outer IIFE için)
const OUTER_ALPHA = `}>J2Nt.^m7IH]uWGqF5lR)"TP<0h?,Kn%@EzD[:bgopj|3wd(C1s;S+{$rBaxYVfZcvyAi\`ek&/!L=M_Q68#4OX9*~U`;

function decode91(alpha, str) {
    const c = alpha, d = "" + (str || ""), e = d.length, f = [];
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

const raw = fs.readFileSync("api.js.downloaded", "utf8");

// d[] parse
const dStart = raw.indexOf(",d=[") + 4;
let depth = 0, inStr = false, strChar = "", esc = false, dEnd = -1;
for (let i = dStart; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") { esc = true; continue; } if (ch === strChar) inStr = false; continue; }
    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]") { if (depth === 0) { dEnd = i; break; } depth--; }
}
let dStrings = [];
try { dStrings = JSON.parse(raw.substring(dStart - 1, dEnd + 1)); } catch (e) {
    console.log("parse err:", e.message);
}
console.log("d[] count:", dStrings.length);

const decode = (n) => {
    if (n >= dStrings.length) return `d[${n}]`;
    try { return decode91(OUTER_ALPHA, dStrings[n]); } catch { return `?`; }
};

// İframe ile ilgili aralık: 840-1000
console.log("=== d[830..1010] decoded ===");
for (let i = 830; i <= 1010; i++) {
    const v = decode(i);
    if (v.length > 0 && v.length < 80) {
        const p = v.replace(/[^\x20-\x7e]/g, "·");
        console.log(`  b(${i}) = "${p}"`);
    }
}

// Kritik aralık detaylı
console.log("\n=== Kritik string'ler (anlamlı olanlar) ===");
const keywords = ["http", "//", "/", "challenge", "patched", "widget", "frame",
                  "sitekey", "siteKey", "src", "url", "origin", "continental",
                  "cntsw", "?", "=", "&"];
for (let i = 0; i < dStrings.length; i++) {
    const v = decode(i);
    const low = v.toLowerCase();
    if (keywords.some(k => low.includes(k)) && v.length >= 2 && v.length < 100) {
        const p = v.replace(/[^\x20-\x7e]/g, "·");
        if (p.replace(/·/g, "").length >= 2) { // at least 2 printable chars
            console.log(`  b(${i}) = "${p}"`);
        }
    }
}

// b(858) özellikle — bu iframe src başlangıcı
console.log("\n=== b(850..870) ===");
for (let i = 850; i <= 870; i++) {
    const v = decode(i);
    const p = v.replace(/[^\x20-\x7e]/g, "·");
    console.log(`  b(${i}) = "${p}" (len=${v.length})`);
}

// Kod bağlamı: b(858) ile başlayan birleştirmeyi bul
const code = raw.substring(dEnd + 2);
const searchStr = "b(858)";
let codeIdx = 0;
for (let i = 0; i < 3; i++) {
    const idx = code.indexOf(searchStr, codeIdx);
    if (idx < 0) break;
    const ctx = code.substring(Math.max(0, idx - 100), idx + 200).replace(/\n/g, " ");
    console.log(`\n'b(858)' @ ${idx}:\n  ${ctx}`);
    codeIdx = idx + 1;
}

// b(840) bağlamı
const searchStr2 = "b(840)";
codeIdx = 0;
for (let i = 0; i < 3; i++) {
    const idx = code.indexOf(searchStr2, codeIdx);
    if (idx < 0) break;
    const ctx = code.substring(Math.max(0, idx - 80), idx + 200).replace(/\n/g, " ");
    console.log(`\n'b(840)' @ ${idx}:\n  ${ctx}`);
    codeIdx = idx + 1;
}
