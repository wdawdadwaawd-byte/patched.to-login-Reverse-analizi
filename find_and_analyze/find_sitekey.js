const https = require("https");

// patched.to login sayfasını incele - continental widget orada mı?
function fetchPage(hostname, path) {
    return new Promise((resolve) => {
        const options = {
            hostname,
            path,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
                "Accept": "text/html,application/xhtml+xml"
            }
        };
        let data = "";
        const req = https.request(options, res => {
            res.on("data", c => data += c.toString());
            res.on("end", () => resolve({ status: res.statusCode, body: data }));
        });
        req.on("error", e => resolve({ status: 0, error: e.message }));
        req.end();
    });
}

async function main() {
    // Çeşitli sayfalar dene
    const paths = ["/login", "/signup", "/register", "/challenge", "/"];
    for (const p of paths) {
        const r = await fetchPage("patched.to", p);
        if (r.status === 200) {
            // sitekey ara
            const patterns = ["sitekey", "siteKey", "data-sitekey", "continental", "cntsw"];
            const found = patterns.filter(pat => r.body.includes(pat));
            if (found.length > 0) {
                console.log("Path:", p, "| Status:", r.status, "| Found:", found.join(", "));
                // context göster
                found.forEach(f => {
                    const idx = r.body.indexOf(f);
                    console.log("  Context:", r.body.substring(Math.max(0,idx-30), idx+100));
                });
            } else {
                console.log("Path:", p, "| Status:", r.status, "| No CAPTCHA refs");
            }
        } else {
            console.log("Path:", p, "| Status:", r.status);
        }
        await new Promise(r => setTimeout(r, 300));
    }
}
main();
