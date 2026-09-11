/**
 * api.js içindeki N() = render() fonksiyonunu bul.
 * iframe URL nasıl oluşturuluyor — decode edilmiş b() çağrılarıyla göster.
 */
const fs = require("fs");

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

const raw = fs.readFileSync("api.js.downloaded", "utf8");

// d[] parse
const dStart = raw.indexOf(",d=[") + 4;
let depth = 0, inStr = false, strChar = "", esc = false;
let dEnd = -1;
for (let i = dStart; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
        if (ch === "\\") { esc = true; continue; }
        if (ch === strChar) inStr = false;
        continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]") {
        if (depth === 0) { dEnd = i; break; }
        depth--;
    }
}

let strings = [];
try { strings = JSON.parse(raw.substring(dStart - 1, dEnd + 1)); }
catch (_) {}

const decoded = strings.map((s, i) => { try { return decode91(s); } catch { return "?"; } });
console.log(`d[] count: ${decoded.length}`);

// b(N) → decoded string replace
function replaceB(code) {
    return code.replace(/\bb\((\d+)\)/g, (_, n) => {
        const idx = parseInt(n);
        if (idx >= decoded.length) return `b(${n})`;
        const s = decoded[idx];
        // kısa ve anlamlıysa direkt, uzunsa kısalt
        return s.length < 30 ? `"${s}"` : `"${s.substring(0, 25)}..."`;
    });
}

// d[] sonrasındaki kodu al
const afterD = raw.substring(dEnd + 2); // ]; sonrası
console.log(`Code after d[]: ${afterD.length} chars`);

// render fonksiyonu — "function N(" veya "var N=" ara
const nFuncIdx = afterD.indexOf("function N(");
if (nFuncIdx >= 0) {
    const ctx = replaceB(afterD.substring(nFuncIdx, nFuncIdx + 2000));
    console.log("\n=== function N() ===");
    console.log(ctx);
} else {
    // Alternatif: N= ile başlayan
    const nVarIdx = afterD.search(/\bN\s*=/);
    console.log("N= at:", nVarIdx);
    if (nVarIdx >= 0) {
        console.log(replaceB(afterD.substring(nVarIdx, nVarIdx + 2000)));
    }
}

// window.continental assign'ı bul
const contIdx = afterD.indexOf("window[");
if (contIdx >= 0) {
    const ctx = replaceB(afterD.substring(contIdx, contIdx + 500));
    console.log("\n=== window.continental ===");
    console.log(ctx);
}

// tüm string birleştirmelerinde "challenge" ara
const full = replaceB(afterD);
const challengeIdx = full.indexOf('"challenge"');
if (challengeIdx >= 0) {
    console.log("\n=== 'challenge' context ===");
    console.log(full.substring(Math.max(0, challengeIdx - 100), challengeIdx + 300));
}

// "patched" veya "//" (protocol-relative URL) ara
["//challenge", "https://", "/c/", "/widget", "patched.to"].forEach(needle => {
    let idx = 0;
    while (true) {
        const i = full.indexOf(needle, idx);
        if (i < 0) break;
        console.log(`\n'${needle}' @ ${i}: ${full.substring(Math.max(0, i - 30), i + 100)}`);
        idx = i + 1;
        if (idx > full.length) break;
    }
});
