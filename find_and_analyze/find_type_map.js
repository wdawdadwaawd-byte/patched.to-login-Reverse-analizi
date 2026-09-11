const fs = require("fs");
const code = fs.readFileSync("cntsw.js","utf8");

// Challenge type → numeric mapping nasıl yapılıyor?
// "G[e(251)]=x[e(1318)]" → x.challengeType = "rotate" string
// Ama API "5":4 (sayısal) alıyor
// Bu sayıya dönüşüm nerede?

// challengeType string'lerini ara
const types = {
    "e(1334)": "slide",
    "e(1337)": "rotate", 
    "e(1340)": "icon",
    "e(1345)": "swap",
    "e(1346)": "emoji_swap",
    "e(1347)": "shortest_line",
    "e(1349)": "x_marker",
    "e(1351)": "height_match",
    "e(1354)": "line_break",
    "e(1355)": "gobang",
};

// Her birini arama
for (const [encoded, name] of Object.entries(types)) {
    let idx = 0;
    while (true) {
        const pos = code.indexOf(encoded, idx);
        if (pos < 0) break;
        const ctx = code.substring(Math.max(0, pos-80), pos+100);
        // sayısal değer içeriyorsa göster
        if (/:\s*\d+/.test(ctx) || /===\s*\d+/.test(ctx) || /switch/.test(ctx)) {
            console.log(`${name}(${encoded}) @ ${pos}: ${ctx.substring(0,150)}`);
        }
        idx = pos + 1;
        if (idx > code.length) break;
    }
}

// Direkt G nesne oluşturma kodu
console.log("\n=== G oluşturma ===");
const gIdx = code.indexOf("let G={k:x[e(1314)]");
console.log(code.substring(gIdx - 50, gIdx + 300));

// X fonksiyonu — msgpack encoder
console.log("\n=== X fonksiyonu ===");
const xFuncIdx = code.indexOf("function X(");
if (xFuncIdx >= 0) console.log(code.substring(xFuncIdx, xFuncIdx + 200));

// challengeType numeric değer nerede belirleniyor
// "5" → hangi field?
// G = {k: siteKey, cnt: ..., type: "rotate"} → body: X(G)
// X msgpack encode ediyor → {"k": "MCow...", "cnt": null, "type": "rotate"}
// Ama API {"5": 4, "k": ..., "cnt": null} alıyor
// Demek ki field ismi "type" değil başka bir şey, veya numeric key

// Msgpack'te sayısal key mümkün — e(251) = "type" ama msgpack'te string "type" = "type"
// API "5" field alıyor → bu kesinlikle sayısal key değil, 5 uzunluğundaki string = "angle"?
// "angle" = 5 char!
console.log("\n=== 'angle' arama ===");
const angleIdx = code.indexOf("angle");
if (angleIdx >= 0) console.log("angle @ " + angleIdx + ": " + code.substring(angleIdx-50, angleIdx+100));

// e(1217) = "angle" (cntsw_deobf.js'den)
const e1217idx = code.indexOf("e(1217)");
console.log("\ne(1217) pos:", e1217idx, code.substring(Math.max(0,e1217idx-50), e1217idx+100));
