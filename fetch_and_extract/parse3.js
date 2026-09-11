const fs = require("fs");
let code = fs.readFileSync("cntsw.js","utf8");
code = code.replace(/&&!\(x&&x\[e\(1274\)\]&&y\[e\(1411\)\]!==x\[e\(1274\)\]\)/g,"");
const before = code;
const patched = code.replace(
    /af=null,ag=bM\(ae\[e\(773\)\]\);if\(ag\)\{try\{af=an\(ag\)\}catch\(ah\)\{\}\}/g,
    "af=null,ag=bM(ae[e(773)]);if(ag){try{af=(typeof window.__msgDecode==='function'?window.__msgDecode(ag):null)||an(ag)}catch(ah){}}"
);
console.log("changed:", patched !== before);
console.log("__msgDecode occurrences:", (patched.match(/window\.__msgDecode/g)||[]).length);
if(patched !== before) {
    const idx = patched.indexOf("window.__msgDecode");
    console.log("context:", patched.substring(idx-30, idx+80));
}
