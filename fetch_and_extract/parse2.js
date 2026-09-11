const fs = require('fs');

function decodeStr(input) {
    const c = 'E,MW8AfL>n7#mG+/h9"xaF;}Cb<XI4:TgR_HJ[c2ts3YB%j6=qoevp^kZQr!DO0~uwiK&1$P{.(Sz@y)|VN]?l5U*`d';
    const d = "" + (input || "");
    const e = d.length;
    const f = [];
    let g = 0, h = 0, j = -1;
    for (let k = 0; k < e; k++) {
        const l = c.indexOf(d[k]);
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
    let r = '';
    for (let i = 0; i < f.length; i++) r += String.fromCharCode(f[i]);
    return r;
}

// Manuel string array parse - karakter bazlı
const content = fs.readFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\cntsw.js', 'utf8');
const startIdx = content.indexOf('var c={},d=[') + 'var c={},d=['.length;

// ] bulana kadar oku (karmaşık string içerdiği için dikkatli)
let i = startIdx;
const strings = [];
while (i < content.length) {
    // whitespace skip
    while (i < content.length && (content[i] === ' ' || content[i] === '\n' || content[i] === '\r')) i++;
    
    if (content[i] === ']') break; // array bitti
    if (content[i] === ',') { i++; continue; } // separator
    
    if (content[i] === '"') {
        i++; // skip opening quote
        let str = '';
        while (i < content.length && content[i] !== '"') {
            if (content[i] === '\\') {
                i++;
                if (content[i] === '"') str += '"';
                else if (content[i] === '\\') str += '\\';
                else if (content[i] === 'n') str += '\n';
                else if (content[i] === 'r') str += '\r';
                else if (content[i] === 't') str += '\t';
                else str += content[i];
            } else {
                str += content[i];
            }
            i++;
        }
        i++; // skip closing quote
        strings.push(str);
    } else {
        i++;
    }
}

console.log('Parsed strings count:', strings.length);

// Decode et
const decoded = {};
let readableCount = 0;
for (let idx = 0; idx < strings.length; idx++) {
    const r = decodeStr(strings[idx]);
    decoded[idx] = r;
    if (r && r.length > 0 && r.split('').every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127)) {
        readableCount++;
    }
}

console.log('Readable ASCII strings:', readableCount);
console.log('\n=== Önemli/Okunabilir Strings ===');
for (let idx = 0; idx < strings.length; idx++) {
    const v = decoded[idx];
    if (v && v.length >= 2) {
        const isReadable = v.split('').every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127);
        if (isReadable) {
            console.log(idx + ':\t' + JSON.stringify(v));
        }
    }
}

fs.writeFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\strings_full.json', JSON.stringify(decoded, null, 2));
console.log('\nKaydedildi!');
