"use strict";
const http      = require("http");
const https     = require("https");
const fs_mod    = require("fs");
const path      = require("path");
const puppeteer = require("puppeteer");

const WORK_DIR = __dirname;
const PORT     = 19548;

function getPatchedCntsw() {
    let code = fs_mod.readFileSync(path.join(WORK_DIR, "cntsw.js"), "utf8");
    const orig = code;

    // DOĞRU PATCH: &&!(origin check) kaldır — mesaj işlemeyi açık bırak
    code = code.replace(
        /&&!\(x&&x\[e\(1274\)\]&&y\[e\(1411\)\]!==x\[e\(1274\)\]\)/g,
        ""
    );
    console.log("origin patch:", code !== orig ? "OK" : "FAILED");

    return code;
}

function startServer(patchedCntsw) {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            if (urlPath.endsWith("/cntsw.js")) {
                res.writeHead(200, { "Content-Type": "application/javascript", "Access-Control-Allow-Origin": "*" });
                res.end(patchedCntsw);
                return;
            }
            const filePath = path.join(WORK_DIR, urlPath === "/" ? "challenge.html" : urlPath);
            fs_mod.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end("404"); return; }
                const ext = path.extname(filePath);
                const ct = ext === ".html" ? "text/html" : ext === ".js" ? "application/javascript" : "text/plain";
                res.writeHead(200, { "Content-Type": ct, "Access-Control-Allow-Origin": "*" });
                res.end(data);
            });
        });
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function fetchConfig() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        https.request({
            hostname: "patched.to", path: "/member.php?action=login", method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "text/html" }
        }, res => {
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const html = Buffer.concat(chunks).toString("utf8");
                const skM = html.match(/sitekey:\s*['"]([^'"]+)['"]/);
                const cdM = html.match(/cdata:\s*['"]([^'"]+)['"]/);
                const ctM = html.match(/challengeType:\s*['"]([^'"]+)['"]/);
                resolve({
                    sitekey:       skM ? skM[1] : null,
                    cdata:         cdM ? cdM[1] : null,
                    challengeType: ctM ? ctM[1] : "x_marker",
                });
            });
        }).on("error", reject).end();
    });
}

(async () => {
    const patchedCntsw = getPatchedCntsw();
    const server = await startServer(patchedCntsw);
    const config = await fetchConfig();
    console.log("\nconfig:", config);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
               "--disable-blink-features=AutomationControlled"],
        ignoreDefaultArgs: ["--enable-automation"],
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120");
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // console logları
    page.on("console", msg => {
        const t = msg.type();
        const text = msg.text().substring(0, 250);
        if (t === "error") console.log(`[JS ERR] ${text}`);
        else console.log(`[LOG] ${text}`);
    });
    page.on("pageerror", err => console.log("[PAGE ERR]", err.message.substring(0, 200)));

    // postMessage gönderilen
    await page.evaluateOnNewDocument(() => {
        const orig = window.postMessage.bind(window);
        window.postMessage = function(data, target) {
            console.log("[MSG OUT]", JSON.stringify(data).substring(0, 150));
            return orig(data, target);
        };
        window.addEventListener("message", e => {
            console.log("[MSG IN]", e.origin, JSON.stringify(e.data).substring(0, 150));
            if (e.data && e.data.type === "VERIFIED") console.log("[VERIFIED]", e.data.token);
            if (e.data && e.data.type === "ERROR")    console.log("[ERROR]", JSON.stringify(e.data));
            if (e.data && e.data.type === "READY")    console.log("[READY]", JSON.stringify(e.data));
        });
    });

    // Network
    const client = await page.target().createCDPSession();
    await client.send("Network.enable");
    const pending = {};
    client.on("Network.requestWillBeSent", evt => {
        const u = evt.request.url;
        if (u.includes("/api/") || u.includes("127.0.0.1")) {
            pending[evt.requestId] = { url: u, status: null };
            const body = evt.request.postData ? Buffer.from(evt.request.postData,"binary").toString("hex").substring(0,60) : "";
            console.log(`[>> ${evt.request.method}] ${u.substring(0,80)}${body?" body:"+body:""}`);
        }
    });
    client.on("Network.responseReceived", evt => {
        if (pending[evt.requestId]) {
            pending[evt.requestId].status = evt.response.status;
            console.log(`[<< ${evt.response.status}] ${pending[evt.requestId].url.substring(0,80)}`);
        }
    });
    client.on("Network.loadingFinished", async evt => {
        const e = pending[evt.requestId];
        if (!e || !e.url.includes("/api/")) return;
        try {
            const r = await client.send("Network.getResponseBody", { requestId: evt.requestId });
            const hex = r.base64Encoded ? Buffer.from(r.body,"base64").toString("hex") : Buffer.from(r.body).toString("hex");
            console.log(`[API BODY] ${e.url.substring(0,50)} → ${hex.substring(0,120)}`);
        } catch(_) {}
    });

    console.log("\n--- sayfa açılıyor ---");
    await page.goto(`http://127.0.0.1:${PORT}/challenge.html`, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));

    const widgetId = "w-dbg1";

    console.log("\n--- CONFIG ---");
    await page.evaluate((cfg, port) => {
        window.postMessage({
            type:          "CONFIG",
            widgetId:      cfg.widgetId,
            siteKey:       cfg.sitekey,
            cdata:         cfg.cdata,
            challengeType: cfg.challengeType,
            baseUrl:       "https://challenge.patched.to",
            challengeUrl:  "https://challenge.patched.to/api/c",
            verifyUrl:     "https://challenge.patched.to/api/q",
            bridgeVersion: 1,
            parentOrigin:  "http://127.0.0.1:" + port,
            theme: "auto", size: "normal",
        }, "*");
    }, { widgetId, ...config }, PORT);

    await new Promise(r => setTimeout(r, 1500));

    // READY geldi mi?
    const state1 = await page.evaluate(() => document.querySelector(".continental-widget")?.dataset?.state);
    console.log("state after CONFIG:", state1);

    console.log("\n--- EXECUTE ---");
    await page.evaluate(wid => {
        window.postMessage({ type: "EXECUTE", widgetId: wid }, "*");
    }, widgetId);

    // 20 sn izle
    await new Promise(r => setTimeout(r, 20000));

    const final = await page.evaluate(() => ({
        state:  document.querySelector(".continental-widget")?.dataset?.state,
        status: document.querySelector(".continental-status")?.textContent,
        error:  document.querySelector(".continental-error-banner")?.textContent,
    }));
    console.log("\n--- FINAL STATE ---", final);

    await browser.close();
    server.close();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
