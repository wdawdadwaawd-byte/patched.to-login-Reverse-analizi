const fs = require('fs');
const vm = require('vm');

const content = fs.readFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\cntsw.js', 'utf8');

// IIFE pattern: (function(X9Mu,lN){...})(void 0,void 0)  - dışarıdan geliyor
// çteki IIFE'yi çalıştır ve e() fonksiyonunu hook et

// Yaklaşım: kod içinde e(N) fonksiyonu string decode için kullanılıyor
// e fonksiyonu ile tüm indexleri resolve et

// Önce kodu sandbox'ta çalıştır ama e() override et
const strings = {};

// ç IIFE'yi bul
// Pattern: (()=>{function a(a){...}function b(b){...}var c={},d=[...
// Bu IIFE içinde b() fonksiyonu cache'li decoder

// Kodu wrap'le ve b fonksiyonunu export et
const wrappedCode = `
(function() {
    function n(v) { return v; }
    function m(arr) {
        let result = '';
        for (let i = 0; i < arr.length; i++) result += String.fromCharCode(arr[i]);
        return result;
    }
    
    function a(input) {
        var c = "E,MW8AfL>n7#mG+/h9\\"xaF;}Cb<XI4:TgR_HJ[c2ts3YB%j6=qoevp^kZQr!DO0~uwiK&1$P{.(Sz@y)|VN]?l5U*\`d";
        var d = "" + (input || "");
        var e = d.length, f = [], g = 0, h = 0, j = -1;
        for (var k = 0; k < e; k++) {
            var l = c.indexOf(d[k]);
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
    
    return a;
})()
`;

const decodeFunc = eval(wrappedCode);

// d array'ini parse et
const content2 = fs.readFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\cntsw.js', 'utf8');
const match = content2.match(/var c=\{\},d=\[([\s\S]*?)\];/);
if (!match) { console.log('No match'); process.exit(1); }

// Proper JSON-like array parse
const arrStr = '[' + match[1] + ']';
let dArr;
try {
    // eval'da parse et (zaten JS string array)
    dArr = eval(arrStr);
} catch(e) {
    console.log('Parse error:', e.message);
    // fallback: regex split
    dArr = [];
}

console.log('Array length:', dArr.length);

// Decode et ve kaydet
const result = {};
for (let i = 0; i < dArr.length; i++) {
    try {
        result[i] = decodeFunc(dArr[i]);
    } catch(e) {
        result[i] = '[ERR: ' + e.message + ']';
    }
}

// nsan tarafından okunabilir kısımları bul
console.log('\n=== TÜM DECODED STRINGS (ilk 200) ===');
const keys = Object.keys(result);
for (let i = 0; i < Math.min(200, keys.length); i++) {
    const v = result[keys[i]];
    if (v && v.length > 0 && v.charCodeAt(0) > 31) {
        console.log(keys[i] + ':\t' + JSON.stringify(v));
    }
}

fs.writeFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\strings_full.json', JSON.stringify(result, null, 2));
console.log('\nKaydedildi: strings_full.json, toplam:', keys.length);
