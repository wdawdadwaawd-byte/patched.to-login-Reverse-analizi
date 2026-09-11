"use strict";
const fs = require("fs");
const code = fs.readFileSync("cntsw.js", "utf8");

// IIFE2 alphabet
const iife2Idx = code.indexOf('";)8w`J?{0E');
const block = code.substring(iife2Idx - 10, iife2Idx + 100);
const alphaMatch = block.match(/"(;[^"]{89,92})"/);
const ALPHA = alphaMatch ? alphaMatch[1] : null;

// Ortak d[] parse
const dArrayStart = code.indexOf('c={},d=[') + 8;
let pos = dArrayStart;
const strings = [];
let inStr = false, strChar = "", esc = false, cur = "";
while (pos < code.length) {
    const ch = code[pos];
    if (esc) { cur += (ch==='n'?'\n':ch==='r'?'\r':ch==='t'?'\t':ch); esc=false; pos++; continue; }
    if (inStr) { if(ch==="\\"){esc=true;pos++;continue;} if(ch===strChar){strings.push(cur);inStr=false;cur="";pos++;continue;} cur+=ch;pos++;continue; }
    if(ch==='"'||ch==="'"){inStr=true;strChar=ch;cur="";pos++;continue;}
    if(ch==="]") break;
    pos++;
}

function decode(n) {
    const str = strings[n];
    if (!str) return `?${n}`;
    const f=[];let g=0,h=0,j=-1;
    for(let k=0;k<str.length;k++){const l=ALPHA.indexOf(str[k]);if(l===-1)continue;if(j<0){j=l;}else{j+=l*91;g|=j<<h;h+=(j&8191)>88?13:14;do{f.push(g&255);g>>=8;h-=8;}while(h>7);j=-1;}}
    if(j>-1)f.push((g|j<<h)&255);
    return Buffer.from(f).toString("utf8").replace(/[\x00-\x08\x0e-\x1f\x7f-\x9f]/g,"·");
}

// Key derivation için gerekli index'ler
const targets = [250,251,252,253,254,268,680,681,682,683,684,685,686,687,688,689,690,691,692,693,694,695,696,697,698,699,700,701,702,703,704,705,706,707,708,709,710,711,712,713,714,715];
console.log("=== KDF-related strings ===");
targets.forEach(i => { const v=decode(i); if(v&&v.length<50) console.log(`  e(${i}) = ${JSON.stringify(v)}`); });

// p(k,p) fonksiyonunun tam içeriği
console.log("\n=== p(k,p) function ===");
const pFuncIdx = code.lastIndexOf("function p(k,p)");
console.log(code.substring(pFuncIdx, pFuncIdx+300));

// s() fonksiyonu - /api/q için encrypt
console.log("\n=== s() function ===");
const sFuncIdx = code.indexOf("function s(k,p)");
if(sFuncIdx>=0) console.log(code.substring(sFuncIdx, sFuncIdx+200));

// bz bul
console.log("\n=== bz search ===");
["bz(","=bz","bz="].forEach(pattern => {
    const idx = code.lastIndexOf(pattern);
    if(idx>=0) console.log(`${pattern} @ ${idx}: ${code.substring(Math.max(0,idx-30),idx+100)}`);
});
