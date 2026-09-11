const fs = require("fs");
const c = fs.readFileSync("cntsw.js", "utf8");
const iife2 = c.indexOf('(()=>{function a(a){var e=";)8w');
const bP    = c.indexOf("async function bP()");
console.log("iife2:", iife2, "bP:", bP);

// iife2 ile bP arasındaki p tanımları
const segment = c.substring(iife2, bP);
const results = [];
for (const re of [/(?:var|let|const)\s+p\s*=/g, /function p\s*\(/g]) {
    let m;
    while ((m = re.exec(segment)) !== null) {
        results.push({ pos: m.index + iife2, ctx: c.substring(m.index+iife2-10, m.index+iife2+80) });
    }
}
console.log("p defs:", results.length);
results.forEach(d => console.log("  ", d.ctx));
