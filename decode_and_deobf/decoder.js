const fs = require('fs');
const code = fs.readFileSync('cntsw.js', 'utf8');

const iife2Start = code.indexOf(';)8w');
const secondIIFE = code.substring(iife2Start - 100);

const alphaIdx = secondIIFE.indexOf('var e="');
const alphaEnd = secondIIFE.indexOf('",f=');
const alphabet = secondIIFE.substring(alphaIdx + 7, alphaEnd);

const dIdx = secondIIFE.indexOf(',d=[');
const dStart = dIdx + 4;
const dEnd = secondIIFE.indexOf('];', dStart);
const rawD = secondIIFE.substring(dStart, dEnd);

console.log("alphabet len:", alphabet.length);
console.log("rawD len:", rawD.length);

const strings = eval('[' + rawD + ']');
console.log("strings count:", strings.length);

function e(n) {
    const input = strings[n];
    if (input === undefined) return undefined;
    let g = 0, h = 0, j = -1, f = [];
    for (let k = 0; k < input.length; k++) {
        let l = alphabet.indexOf(input[k]);
        if (l === -1) continue;
        if (j < 0) {
            j = l;
        } else {
            j += l * 91;
            g |= j << h;
            h += (j & 8191) > 88 ? 13 : 14;
            do {
                f.push(g & 255);
                g >>= 8;
                h -= 8;
            } while (h > 7);
            j = -1;
        }
    }
    if (j > -1) f.push((g | j << h) & 255);
    return String.fromCharCode(...f);
}

const indices = [
    311, 313, 713, 722, 773, 1077, 1274, 1277, 1288, 1289, 1290, 1305, 1306, 1307, 1311, 1312, 1314, 1320, 1321, 1322, 1323, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336, 1356, 1357, 1358, 1359, 1360, 1361, 1362, 1363, 1364, 1365
];

indices.forEach(idx => {
    console.log(`${idx} : ${JSON.stringify(e(idx))}`);
});