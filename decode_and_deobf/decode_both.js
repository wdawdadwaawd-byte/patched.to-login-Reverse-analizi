const fs = require("fs");
const c = fs.readFileSync("c:/Users/wdawdawsdawd/Desktop/patched.tochecker/cntsw.js", "utf8");

function m(arr) {
    let r = "";
    for (let i = 0; i < arr.length; i++) r += String.fromCharCode(arr[i]);
    return r;
}

function decodeWith(input, alpha) {
    const d = "" + (input || "");
    const elen = d.length;
    const f = [];
    let g = 0, h = 0, j = -1;
    for (let k = 0; k < elen; k++) {
        const l = alpha.indexOf(d[k]);
        if (l === -1) continue;
        if (j < 0) { j = l; }
        else {
            j += l * 91;
            g |= j << h;
            h += (j & 8191) > 88 ? 13 : 14;
            do { f.push(g & 255); g >>= 8; h -= 8; } while (h > 7);
            j = -1;
        }
    }
    if (j > -1) f.push((g | j << h) & 255);
    return m(f);
}

const alpha1 = 'E,MW8AfL>n7#mG+/h9"xaF;}Cb<XI4:TgR_HJ[c2ts3YB%j6=qoevp^kZQr!DO0~uwiK&1$P{.(Sz@y)|VN]?l5U*`d';
const alpha2 = ';)8w`J?{0E:z_1HRWN&,jOi=dk5}6Qa^]*~|YhDPIc[KMVF/m3.2v>bZy@XSu9L<ex74CtBf$o!T%s#pArq(+lgGn"U';

// d[] parse
const startIdx = c.indexOf("var c={},d=[") + "var c={},d=[".length;
let i = startIdx;
const strings = [];
while (i < c.length) {
    while (i < c.length && (c[i] === " " || c[i] === "\n" || c[i] === "\r")) i++;
    if (c[i] === "]") break;
    if (c[i] === ",") { i++; continue; }
    if (c[i] === '"') {
        i++;
        let str = "";
        while (i < c.length && c[i] !== '"') {
            if (c[i] === "\\") {
                i++;
                if (c[i] === '"') str += '"';
                else if (c[i] === "\\") str += "\\";
                else if (c[i] === "n") str += "\n";
                else if (c[i] === "r") str += "\r";
                else if (c[i] === "t") str += "\t";
                else str += c[i];
            } else {
                str += c[i];
            }
            i++;
        }
        i++;
        strings.push(str);
    } else {
        i++;
    }
}

console.log("Strings parsed:", strings.length);

// Her iki alpha ile decode et, hangisi daha okunabilir?
const results = {};
for (let idx = 0; idx < strings.length; idx++) {
    const r1 = decodeWith(strings[idx], alpha1);
    const r2 = decodeWith(strings[idx], alpha2);
    
    const isReadable1 = r1.length > 0 && [...r1].every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127);
    const isReadable2 = r2.length > 0 && [...r2].every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127);
    
    results[idx] = {
        raw: strings[idx].substring(0, 30),
        alpha1: r1,
        alpha2: r2,
        r1readable: isReadable1,
        r2readable: isReadable2
    };
}

console.log("\n=== ALPHA2 ile okunabilir stringler ===");
let count = 0;
for (const idx in results) {
    const r = results[idx];
    if (r.r2readable && r.alpha2.length >= 3) {
        console.log(idx + ": " + JSON.stringify(r.alpha2));
        count++;
    }
}
console.log("Total readable with alpha2:", count);

fs.writeFileSync("c:/Users/wdawdawsdawd/Desktop/patched.tochecker/both_decoded.json", JSON.stringify(results, null, 2));
console.log("Saved both_decoded.json");
