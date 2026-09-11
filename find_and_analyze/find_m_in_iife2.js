const fs = require("fs");
const code = fs.readFileSync("cntsw.js", "utf8");

const iife2 = code.indexOf('(()=>{function a(a){var e=";)8w');
console.log("IIFE2 pos:", iife2);

const mInIife2 = code.indexOf("function m(", iife2);
console.log("m in IIFE2 pos:", mInIife2);
if (mInIife2 > 0) console.log("m:", code.substring(mInIife2, mInIife2 + 200));

// an() scope'unda m
const anPos = code.indexOf("function an(g){", iife2);
console.log("an pos:", anPos);
// an'dan geriye giderek m'yi bul
const mBeforeAn = code.lastIndexOf("function m(", anPos);
console.log("m before an:", mBeforeAn, code.substring(mBeforeAn, mBeforeAn + 150));
