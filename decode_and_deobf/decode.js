// cntsw.js dosyasını yükle ve string tablosunu çöz
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\cntsw.js', 'utf8');

// String decode fonksiyonu (dosyadan alındı)
function decodeStr(input) {
    var c = "E,MW8AfL>n7#mG+/h9\"xaF;}Cb<XI4:TgR_HJ[c2ts3YB%j6=qoevp^kZQr!DO0~uwiK&1$P{.(Sz@y)|VN]?l5U*`d";
    var d = "" + (input || "");
    var e = d.length;
    var f = [];
    var g = 0;
    var h = 0;
    var j = -1;
    
    function n(v) { return v; }
    function m(arr) {
        var result = '';
        for (var i = 0; i < arr.length; i++) {
            result += String.fromCharCode(arr[i]);
        }
        return result;
    }
    
    for (var k = 0; k < e; k++) {
        var l = c.indexOf(d[k]);
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
    if (j > -1) {
        f.push((g | j << h) & 255);
    }
    return m(f);
}

// d[] array'ini dosyadan extract et (regex ile)
const dArrayMatch = content.match(/var c=\{\},d=\[([\s\S]*?)\];/);
if (!dArrayMatch) {
    console.log("d[] array bulunamadi!");
    process.exit(1);
}

// d[] içeriğini parse et
const dContent = dArrayMatch[1];
const strings = [];
let inStr = false;
let str = '';
let escaped = false;
let quote = '';

for (let i = 0; i < dContent.length; i++) {
    const ch = dContent[i];
    if (!inStr) {
        if (ch === '"' || ch === "'") {
            inStr = true;
            quote = ch;
            str = '';
        }
    } else {
        if (escaped) {
            if (ch === 'n') str += '\n';
            else if (ch === 'r') str += '\r';
            else if (ch === 't') str += '\t';
            else str += ch;
            escaped = false;
        } else if (ch === '\\') {
            escaped = true;
        } else if (ch === quote) {
            inStr = false;
            strings.push(str);
        } else {
            str += ch;
        }
    }
}

console.log('Toplam string sayisi:', strings.length);

// Tüm stringleri decode et ve indexleriyle yazdır
const decoded = {};
for (let i = 0; i < strings.length; i++) {
    try {
        const result = decodeStr(strings[i]);
        decoded[i] = result;
    } catch(ex) {
        decoded[i] = '[DECODE_ERROR]';
    }
}

// lk 100 ve sonraki önemli kısımları göster
const keys = Object.keys(decoded);
console.log('\n=== lk 100 decoded string ===');
for (let i = 0; i < Math.min(100, keys.length); i++) {
    console.log(i + ': ' + JSON.stringify(decoded[i]));
}

// JSON olarak kaydet
fs.writeFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\decoded_strings.json', JSON.stringify(decoded, null, 2));
console.log('\nDecoded strings JSON kaydedildi: decoded_strings.json');
