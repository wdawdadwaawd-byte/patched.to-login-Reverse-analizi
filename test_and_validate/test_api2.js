const https = require("https");

function msgpackEncode(obj) {
    const bytes = [];
    function writeStr(s) {
        const encoded = Buffer.from(s, "utf8");
        const len = encoded.length;
        if (len <= 31) bytes.push(0xa0 | len);
        else if (len <= 255) bytes.push(0xd9, len);
        else bytes.push(0xda, (len >> 8) & 0xff, len & 0xff);
        for (const b of encoded) bytes.push(b);
    }
    function writeVal(v) {
        if (v === null || v === undefined) { bytes.push(0xc0); return; }
        if (typeof v === "boolean") { bytes.push(v ? 0xc3 : 0xc2); return; }
        if (typeof v === "number") {
            if (Number.isInteger(v) && v >= 0 && v <= 127) { bytes.push(v); return; }
            if (Number.isInteger(v) && v >= 0 && v <= 255) { bytes.push(0xcc, v); return; }
            if (Number.isInteger(v) && v >= 0 && v <= 65535) { bytes.push(0xcd, (v>>8)&0xff, v&0xff); return; }
            bytes.push(0xcb);
            const buf = Buffer.allocUnsafe(8); buf.writeDoubleBE(v);
            for (const b of buf) bytes.push(b);
            return;
        }
        if (typeof v === "string") { writeStr(v); return; }
        if (Array.isArray(v)) {
            if (v.length <= 15) bytes.push(0x90 | v.length);
            else bytes.push(0xdc, (v.length>>8)&0xff, v.length&0xff);
            v.forEach(writeVal);
            return;
        }
        if (typeof v === "object") {
            const keys = Object.keys(v);
            if (keys.length <= 15) bytes.push(0x80 | keys.length);
            else bytes.push(0xde, (keys.length>>8)&0xff, keys.length&0xff);
            keys.forEach(k => { writeStr(k); writeVal(v[k]); });
            return;
        }
    }
    writeVal(obj);
    return Buffer.from(bytes);
}

function decode(buf) {
    let pos = 0;
    function read() {
        const b = buf[pos++];
        if (b === 0xc0) return null;
        if (b === 0xc2) return false;
        if (b === 0xc3) return true;
        if ((b & 0x80) === 0) return b;
        if ((b & 0xe0) === 0xa0) { const len=b&0x1f; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if ((b & 0xf0) === 0x80) { const len=b&0x0f; const o={}; for(let i=0;i<len;i++){const k=read();o[k]=read();} return o; }
        if ((b & 0xf0) === 0x90) { const len=b&0x0f; return Array.from({length:len},()=>read()); }
        if (b===0xcc) return buf[pos++];
        if (b===0xcd) { const v=(buf[pos]<<8)|buf[pos+1]; pos+=2; return v; }
        if (b===0xce) { const v=buf.readUInt32BE(pos); pos+=4; return v; }
        if (b===0xd9) { const len=buf[pos++]; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if (b===0xda) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; const s=buf.slice(pos,pos+len).toString("utf8"); pos+=len; return s; }
        if (b===0xdc) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; return Array.from({length:len},()=>read()); }
        if (b===0xde) { const len=(buf[pos]<<8)|buf[pos+1]; pos+=2; const o={}; for(let i=0;i<len;i++){const k=read();o[k]=read();} return o; }
        if (b===0xc4) { const len=buf[pos++]; const d=buf.slice(pos,pos+len); pos+=len; return {_bin:d.toString("hex"),_len:len}; }
        if (b===0xcb) { const v=buf.readDoubleBE(pos); pos+=8; return v; }
        return "[0x"+b.toString(16)+"]";
    }
    try { return read(); } catch(e) { return {error:e.message}; }
}

async function tryPost(siteKey, label) {
    return new Promise((resolve) => {
        const payload = msgpackEncode({ siteKey, widgetId: "w-001" });
        const options = {
            hostname: "challenge.patched.to",
            path: "/api/c",
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": payload.length,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
                "Origin": "https://challenge.patched.to",
            }
        };
        const req = https.request(options, res => {
            const chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const body = Buffer.concat(chunks);
                const decoded = decode(body);
                console.log("[" + label + "] status=" + res.statusCode + " => " + JSON.stringify(decoded));
                resolve(decoded);
            });
        });
        req.on("error", e => { console.log("[" + label + "] error:", e.message); resolve(null); });
        req.write(payload);
        req.end();
    });
}

async function main() {
    // Farklı siteKey formatlarını dene
    await tryPost("c296b4bcca757cce597a015732b00b87", "hash-from-url");
    await new Promise(r => setTimeout(r, 500));
    await tryPost("patched.to", "domain");
    await new Promise(r => setTimeout(r, 500));
    await tryPost("1", "minimal");
}

main();
