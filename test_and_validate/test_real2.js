const https = require("https");

function msgpackEncode(obj) {
    const bytes = [];
    function writeStr(s) {
        const enc = Buffer.from(s, "utf8"); const len = enc.length;
        if (len<=31) bytes.push(0xa0|len);
        else if (len<=255) bytes.push(0xd9, len);
        else bytes.push(0xda, (len>>8)&0xff, len&0xff);
        for (const b of enc) bytes.push(b);
    }
    function writeVal(v) {
        if (v===null||v===undefined){bytes.push(0xc0);return;}
        if (typeof v==="boolean"){bytes.push(v?0xc3:0xc2);return;}
        if (typeof v==="number"){
            if(Number.isInteger(v)&&v>=0&&v<=127){bytes.push(v);return;}
            if(Number.isInteger(v)&&v>=0&&v<=255){bytes.push(0xcc,v);return;}
            if(Number.isInteger(v)&&v>=0&&v<=65535){bytes.push(0xcd,(v>>8)&0xff,v&0xff);return;}
            bytes.push(0xcb);const buf=Buffer.allocUnsafe(8);buf.writeDoubleBE(v);for(const b of buf)bytes.push(b);return;
        }
        if(typeof v==="string"){writeStr(v);return;}
        if(Array.isArray(v)){
            if(v.length<=15)bytes.push(0x90|v.length);
            else bytes.push(0xdc,(v.length>>8)&0xff,v.length&0xff);
            v.forEach(writeVal);return;
        }
        if(typeof v==="object"){
            const keys=Object.keys(v);
            if(keys.length<=15)bytes.push(0x80|keys.length);
            else bytes.push(0xde,(keys.length>>8)&0xff,keys.length&0xff);
            keys.forEach(k=>{writeStr(k);writeVal(v[k]);});return;
        }
    }
    writeVal(obj);
    return Buffer.from(bytes);
}

function decode(buf) {
    let pos = 0;
    function read() {
        const b = buf[pos++];
        if (b===0xc0) return null;
        if (b===0xc2) return false;
        if (b===0xc3) return true;
        if ((b&0x80)===0) return b;
        if ((b&0xe0)===0xa0) { const len=b&0x1f; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if ((b&0xf0)===0x80) { const len=b&0x0f; const o={}; for(let i=0;i<len;i++){const k=read();o[k]=read();} return o; }
        if ((b&0xf0)===0x90) { const len=b&0x0f; return Array.from({length:len},()=>read()); }
        if (b===0xcc) return buf[pos++];
        if (b===0xcd) { const v=(buf[pos]<<8)|buf[pos+1]; pos+=2; return v; }
        if (b===0xce) { const v=buf.readUInt32BE(pos); pos+=4; return v; }
        if (b===0xd2) { const v=buf.readInt32BE(pos); pos+=4; return v; }
        if (b===0xd9) { const len=buf[pos++]; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if (b===0xda) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if (b===0xdc) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; return Array.from({length:len},()=>read()); }
        if (b===0xde) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; const o={}; for(let i=0;i<len;i++){const k=read();o[k]=read();} return o; }
        if (b===0xc4) { const len=buf[pos++]; const d=buf.slice(pos,pos+len); pos+=len; return {_bin:d.toString("hex"),_b64:d.toString("base64")}; }
        if (b===0xcb) { const v=buf.readDoubleBE(pos); pos+=8; return v; }
        return "[0x"+b.toString(16)+"]";
    }
    try { return read(); } catch(e) { return {error:e.message}; }
}

function post(payload) {
    return new Promise((resolve) => {
        const options = {
            hostname: "challenge.patched.to",
            path: "/api/c",
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": payload.length,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
                "Origin": "https://patched.to",
                "Referer": "https://patched.to/member.php?action=login"
            }
        };
        const req = https.request(options, res => {
            const chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const body = Buffer.concat(chunks);
                resolve({ status: res.statusCode, decoded: decode(body), raw: body.toString("hex") });
            });
        });
        req.on("error", e => resolve({ error: e.message }));
        req.write(payload);
        req.end();
    });
}

async function main() {
    const SK = "MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec";
    const CDATA = "grRMKKFCKhQJfqLmJCsbsN9zGVIQNVO6aYklo8SMttPnlrA8muQf7kClb1IKX8AOa27Ycy2iM4GuvePWpCjInDIE-sSqi7DEhPHJ8dtWHufaegZfZ3jMH0gV41FS1q2i5R4D8F05IkskOTUi";
    const WID = "w-" + Math.random().toString(36).substr(2,8);

    // Deneme 1: sitekey (küçük k)
    console.log("=== Test 1: sitekey (lowercase k) ===");
    let r = await post(msgpackEncode({ sitekey: SK, widgetId: WID }));
    console.log("Status:", r.status, "=>", JSON.stringify(r.decoded));

    await new Promise(res => setTimeout(res, 400));

    // Deneme 2: sitekey + challengeType + cdata
    console.log("\n=== Test 2: sitekey + challengeType + cdata ===");
    r = await post(msgpackEncode({ sitekey: SK, widgetId: WID, challengeType: "x_marker", cdata: CDATA }));
    console.log("Status:", r.status, "=>", JSON.stringify(r.decoded));

    await new Promise(res => setTimeout(res, 400));

    // Deneme 3: sk field
    console.log("\n=== Test 3: sk field ===");
    r = await post(msgpackEncode({ sk: SK, wid: WID }));
    console.log("Status:", r.status, "=>", JSON.stringify(r.decoded));

    await new Promise(res => setTimeout(res, 400));

    // Deneme 4: cnt field (decoded string'lerde cnt=1317 vardı)
    console.log("\n=== Test 4: cnt field ===");
    r = await post(msgpackEncode({ sitekey: SK, widgetId: WID, cnt: 1 }));
    console.log("Status:", r.status, "=>", JSON.stringify(r.decoded));
}

main();
