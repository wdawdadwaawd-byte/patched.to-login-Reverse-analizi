const fs = require("fs");
const body = fs.readFileSync("api.js.downloaded", "utf8");

// Tüm string literalleri çıkar (basit extract)
const strs = [];
const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = re.exec(body)) !== null) {
    const s = m[1] !== undefined ? m[1] : m[2];
    if (s.length > 2 && s.length < 200) strs.push(s);
}

// URL-like ve path-like olanlar
console.log("=== URL-like strings ===");
for (const s of strs) {
    if (s.includes("challenge") || s.includes("/api") || s.includes("http") || s.includes("widget") || s.includes("iframe") || s.includes("sitekey") || s.includes("render") || s.includes("src=") || s.includes("?")) {
        const clean = s.replace(/[^\x20-\x7e]/g, "?");
        console.log("  " + JSON.stringify(clean.substring(0, 120)));
    }
}

// api.js'in ana fonksiyon mantığını göster (b() ile şifrelenmiş değil)
// IIFE içindeki fonksiyon çağrıları
console.log("\n=== Fonksiyon yapısı ===");
const fnRe = /function\s+(\w+)\s*\(/g;
while ((m = fnRe.exec(body)) !== null) {
    if (m[1] !== "a" && m[1] !== "b") { // decode fonksiyonlarını atla
        console.log("  function " + m[1]);
    }
}

// iframe ile ilgili kod kısmı
const ifrIdx = body.indexOf("iframe");
if (ifrIdx >= 0) {
    let ctx = body.substring(Math.max(0, ifrIdx - 200), ifrIdx + 400);
    console.log("\n=== iframe context ===");
    console.log(ctx);
}

// window.continental ile ilgili kısım
const contIdx = body.indexOf("continental");
if (contIdx >= 0) {
    let ctx = body.substring(Math.max(0, contIdx - 50), contIdx + 300);
    console.log("\n=== continental context ===");
    console.log(ctx);
}

// postMessage ile ilgili
const pmIdx = body.indexOf("postMessage");
if (pmIdx >= 0) {
    let ctx = body.substring(Math.max(0, pmIdx - 100), pmIdx + 200);
    console.log("\n=== postMessage context ===");
    console.log(ctx);
}

// Tüm b() çağrılarını say
const bCalls = (body.match(/\bb\(\d+\)/g) || []).length;
console.log("\nToplam b() çağrısı:", bCalls);

// b() olmayan kısımları göster (düz JS)
const lines = body.split(";");
const plainLines = lines.filter(l => !l.includes("b(") && l.trim().length > 10 && l.trim().length < 200);
console.log("\n=== b() içermeyen ifadeler (ilk 30) ===");
plainLines.slice(0, 30).forEach(l => console.log("  " + l.trim().substring(0, 100)));
