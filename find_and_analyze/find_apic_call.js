const fs = require("fs");
const c = fs.readFileSync("cntsw.js", "utf8");
const iife2 = c.indexOf("(()=>{function a(a){var e=\";)8w");
console.log("IIFE2 pos:", iife2);

const pInIife2 = c.indexOf("function p(", iife2);
console.log("p in iife2 pos:", pInIife2);
if (pInIife2 > 0) console.log("p def:", c.substring(pInIife2, pInIife2 + 200));

// aa=p cagrisinin near context
const aaIdx = c.indexOf(",ab=u(K.r,");
console.log("ab=u context:", c.substring(Math.max(0, aaIdx - 300), aaIdx + 100));
