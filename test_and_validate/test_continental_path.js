"use strict";
/**
 * cntsw.js'deki p(siteKey, url) fonksiyonunu izole ederek çalıştır.
 * Node.js global'larını patch edip IIFE2'yi eval'la.
 */
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");

const SK = "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// XChaCha20 (Node.js native chacha20 + HChaCha20 subkey)
function hchacha20(key, n16) {
    const C=[0x61707865,0x3320646e,0x79622d32,0x6b206574];
    function ld(b,i){return(b[i]|b[i+1]<<8|b[i+2]<<16|b[i+3]<<24)>>>0;}
    const k=[],n=[];
    for(let i=0;i<8;i++)k.push(ld(key,i*4));
    for(let i=0;i<4;i++)n.push(ld(n16,i*4));
    const s=[C[0],C[1],C[2],C[3],k[0],k[1],k[2],k[3],k[4],k[5],k[6],k[7],n[0],n[1],n[2],n[3]];
    function rot(v,n){return((v<<n)|(v>>>(32-n)))>>>0;}
    function qr(a,b,c,d){s[a]=(s[a]+s[b])>>>0;s[d]=rot(s[d]^s[a],16);s[c]=(s[c]+s[d])>>>0;s[b]=rot(s[b]^s[c],12);s[a]=(s[a]+s[b])>>>0;s[d]=rot(s[d]^s[a],8);s[c]=(s[c]+s[d])>>>0;s[b]=rot(s[b]^s[c],7);}
    for(let i=0;i<20;i+=2){qr(0,4,8,12);qr(1,5,9,13);qr(2,6,10,14);qr(3,7,11,15);qr(0,5,10,15);qr(1,6,11,12);qr(2,7,8,13);qr(3,4,9,14);}
    const o=Buffer.alloc(32);
    [s[0],s[1],s[2],s[3],s[12],s[13],s[14],s[15]].forEach((w,i)=>o.writeUInt32LE(w,i*4));
    return o;
}
function xchacha20(key,nonce24,ct){
    const sub=hchacha20(key,nonce24.slice(0,16));
    const n12=Buffer.alloc(16,0);nonce24.copy(n12,4,16,24);
    const dc=crypto.createDecipheriv("chacha20",sub,n12);
    return Buffer.concat([dc.update(ct)]);
}

function msgDecode(buf){let p=0;function r(){if(p>=buf.length)return null;const b=buf[p++];if(b===0xc0)return null;if(b===0xc2)return false;if(b===0xc3)return true;if((b&0x80)===0)return b;if((b&0xe0)===0xa0){const l=b&0x1f;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}if((b&0xf0)===0x80){const l=b&0x0f;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}if((b&0xf0)===0x90){const l=b&0x0f;return Array.from({length:l},()=>r());}if(b===0xcc)return buf[p++];if(b===0xcd){const v=(buf[p]<<8)|buf[p+1];p+=2;return v;}if(b===0xce){const v=buf.readUInt32BE(p);p+=4;return v;}if(b===0xd9){const l=buf[p++];const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}if(b===0xda){const l=(buf[p]<<8)|buf[p+1];p+=2;const s=buf.slice(p,p+l).toString("utf8");p+=l;return s;}if(b===0xdc){const l=(buf[p]<<8)|buf[p+1];p+=2;return Array.from({length:l},()=>r());}if(b===0xde){const l=(buf[p]<<8)|buf[p+1];p+=2;const o={};for(let i=0;i<l;i++){const k=r();o[k]=r();}return o;}if(b===0xc4){const l=buf[p++];const d=buf.slice(p,p+l);p+=l;return d;}if(b===0xc5){const l=(buf[p]<<8)|buf[p+1];p+=2;const d=buf.slice(p,p+l);p+=l;return d;}if(b===0xcb){const v=buf.readDoubleBE(p);p+=8;return v;}return null;}try{return r();}catch(e){return{error:e.message};}}

function encMsg(obj){const b=[];function ws(s){const e=Buffer.from(s,"utf8");const l=e.length;if(l<=31)b.push(0xa0|l);else if(l<=255)b.push(0xd9,l);else b.push(0xda,(l>>8)&0xff,l&0xff);for(const x of e)b.push(x);}function wv(v){if(v===null){b.push(0xc0);return;}if(typeof v==="number"){if(Number.isInteger(v)&&v>=0&&v<=127){b.push(v);return;}b.push(0xcb);const buf=Buffer.allocUnsafe(8);buf.writeDoubleBE(v);for(const x of buf)b.push(x);return;}if(typeof v==="string"){ws(v);return;}if(typeof v==="object"){const ks=Object.keys(v);b.push(0x80|ks.length);ks.forEach(k=>{ws(k);wv(v[k]);});return;}}wv(obj);return Buffer.from(b);}

// cntsw.js'den p(k,p) ve bz fonksiyonunu extract et, Node.js'de eval ile çalıştır
const code = fs.readFileSync("cntsw.js", "utf8");

// p(k,p) fonksiyonu pos 120838
// Bu fonksiyon bz, ck, cv, navigator.userAgent kullanıyor
// Aynı IIFE scope'undaki ilgili kısımları çıkar ve eval et

// navigator mock et
global.navigator = { userAgent: UA };
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
global.Uint8Array  = Uint8Array;
global.crypto      = require("crypto").webcrypto;

let derivedKey = null;

try {
    // cntsw.js'deki ikinci IIFE'yi çalıştır ama sadece key derivation'a ihtiyacımız var
    // İkinci IIFE'nin başından p(k,p) tanımına kadar olan kısım + çağrı
    
    // p(k,p) fonksiyonunun scope'undaki bağımlılıkları bul:
    // bz, ck, cv, by, ci, bw, bx tanımları
    
    const pFuncIdx = code.lastIndexOf("function p(k,p)");
    const pFuncEnd = code.indexOf("function s(k,p)", pFuncIdx);
    const pFuncBody = code.substring(pFuncIdx, pFuncEnd); // p(k,p) tam body
    
    // bz tanımı
    const bzIdx = code.indexOf("bz=(a,f,g)=>{");
    // bz'den geriye doğru by, bi, etc. tanımları var
    // bz tanımının bulunduğu bölümü al
    const bzSectionEnd = code.indexOf(";bz[", bzIdx) + 50;
    const bzDef = code.substring(Math.max(0, bzIdx - 5000), bzSectionEnd);
    
    // cv tanımı
    const cvIdx = code.indexOf(",cv=");
    const cvDef = code.substring(cvIdx + 1, cvIdx + 200);
    
    // ck tanımı
    const ckIdx = code.lastIndexOf(",ck=");
    const ckDef = code.substring(ckIdx + 1, ckIdx + 100);
    
    // bu parçaları bir arada çalıştır
    const runCode = `
    "use strict";
    function n(...args) { for(const f of args) f(); }
    function h(obj, key, val) { obj[key] = val; }
    const m = (arr) => {
        // msgpack decode
        let buf = typeof arr === 'string' ? Buffer.from(arr) : Buffer.from(arr);
        try {
            return require('@msgpack/msgpack').decode(buf);
        } catch(e) {
            // fallback: just return null
            return null;
        }
    };
    ` + bzDef + `
    ` + cvDef + `
    ` + ckDef + `
    ` + pFuncBody + `
    module.exports = function(sk, path) {
        return p(sk, path);
    };
    `;
    
    console.log("bz section len:", bzDef.length);
    console.log("ck def:", ckDef.substring(0, 80));
    
    // Yerine daha basit bir şey dene: p fonksiyonunu ve bağımlılıklarını izole et
    // Bunun yerine directly cntsw.js'i module olarak eval et
    
    // En basit: cntsw.js içindeki p() fonksiyonunu bul ve Puppeteer'da çağır
    // Bu analizi Puppeteer'da token_generator.js'de yapalım
    console.log("Analiz tamamlandı. Puppeteer'da p() çağrısı intercepti gerekiyor.");
    
} catch(e) {
    console.log("Extract err:", e.message.substring(0,80));
}

// Sonuç: p(k,p) çalıştırmak için Puppeteer'da window.__pResult yakalamamız gerekiyor
// token_generator.js'e eklenecek patch:
console.log(`
PATCH SNIPPET (token_generator.js'e eklenecek):
bP fonksiyonundaki 'let aa=p(x[e(1314)],e(1329))' satırını intercept et:
  → window.__aaResult = aa; ile expose et
Sonra __aaResult.response değerini kullanarak Node.js'de xchacha20 decrypt yap.
`);
