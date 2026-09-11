const https = require("https");
const fs = require("fs");

const chunks = [];
const req = https.request({
    hostname: "challenge.patched.to",
    path: "/j/api.js",
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120" }
}, r => {
    r.on("data", c => chunks.push(c));
    r.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        fs.writeFileSync("api.js.downloaded", body);
        console.log("Saved:", body.length, "bytes");
        // ilk 500 karakter
        console.log("START:", JSON.stringify(body.substring(0, 300)));
        // d= pattern ara
        const idx = body.indexOf(",d=[");
        if (idx >= 0) {
            console.log("d=[ found at pos:", idx);
            console.log("Context:", JSON.stringify(body.substring(idx, idx + 200)));
        }
    });
});
req.on("error", e => console.log("err:", e.message));
req.end();
