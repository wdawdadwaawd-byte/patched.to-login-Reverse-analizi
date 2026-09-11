/**
 * cntsw.js — Deobfuscated / Açıklamalı Versiyon
 * Kaynak: https://challenge.patched.to/s/c296b4bcca757cce597a015732b00b87/cntsw.js
 * 
 * Bu dosya "Continental CAPTCHA" widget'ının iframe içinde çalışan kodudur.
 * Orijinal dosya ~170KB, tek satır, custom base91 ile encode edilmiş string tablosu
 * kullanıyor. Aşağıda decode edilmiş halleriyle mantık anlatılmıştır.
 * 
 * Gömülü kütüphaneler:
 *   - @msgpack/msgpack   (binary iletişim)
 *   - @noble/hashes      (SHA-256/384/512 — PoW için)
 *   - @noble/ciphers     (ChaCha20-Poly1305 — şifreleme)
 */

// ============================================================
// BÖLÜM 1: STRING DECODE MEKANİZMASI
// ============================================================

/**
 * Orijinal kod iki katmanlı obfuscation kullanıyor:
 * 
 * 1) d[] array'i (1438 string, custom base91 ile encode edilmiş)
 * 2) e(N) fonksiyonu — d[N] string'ini decode edip cache'liyor
 *    (4506 yerde kullanılıyor)
 * 
 * Örnek:
 *   e(241)  → "type"
 *   e(722)  → "error"
 *   e(746)  → "setState"
 *   e(816)  → "addEventListener"
 */

// e(N) fonksiyonunun decode ettiği önemli string'ler:
// (orijinal kodda bunlar hep e(N) biçiminde geçiyor)
const STRINGS = {
    // Widget DOM selector'ları
    737: ".continental-widget",
    738: ".continental-main",
    739: ".continental-checkbox",
    740: ".continental-label",
    741: ".continental-status",
    742: ".continental-hint",
    743: ".continental-progress-bar",
    744: ".continental-error-banner",
    745: "#continental-logo",

    // Widget state'leri
    751: "idle",
    716: "verifying",
    717: "Verifying...",
    718: "verified",
    719: "Verification complete",
    720: "expired",
    721: "Verification expired",
    722: "error",
    723: "Verification failed",
    766: "failed",

    // postMessage tip'leri (parent ↔ iframe)
    1412: "CONFIG",        // Parent → iframe: başlatma
    1427: "EXECUTE",       // Parent → iframe: verification başlat
    1428: "RESET",         // Parent → iframe: sıfırla
    1429: "BEHAVIOR",      // Parent → iframe: behavior data
    1381: "VERIFIED",      // iframe → parent: başarı + token
    1382: "HIDE_WIDGET",   // iframe → parent: widget gizle
    1388: "SHOW_WIDGET",   // iframe → parent: widget göster
    1384: "CHALLENGE_FAILED",  // iframe → parent: başarısız
    1409: "ERROR",         // iframe → parent: hata
    1383: "retry",
    1426: "READY",         // iframe → parent: hazır
    779: "RESIZE",         // iframe → parent: boyut değişti
    1420: "THEME_CHANGE",
    1286: "PROXY_FETCH_REQUEST",   // iframe → parent: network proxy
    1430: "PROXY_FETCH_RESPONSE",  // parent → iframe: proxy cevabı

    // API endpoint'leri
    1329: "/api/c",        // Challenge alma
    1372: "/api/q",        // Cevap gönderme

    // Challenge tipleri
    1334: "slide",
    1337: "rotate",
    1340: "icon",
    1345: "swap",
    1346: "emoji_swap",
    1347: "shortest_line",
    1349: "x_marker",
    1351: "height_match",
    1354: "line_break",
    1355: "gobang",

    // Hata kodları
    1283: "timeout",
    1293: "network",
    1297: "server",
    1295: "notfound",
    1290: "invalid",
    1299: "auth",
    1301: "ratelimit",
    1303: "rejected",
    1276: "config",
    1373: "verification",

    // Misc
    1204: "simulateDevice",
    1362: "pow",
    1363: "workers",
    1380: "invisible",
};


// ============================================================
// BÖLÜM 2: WIDGET STATE MACHINE
// ============================================================

/**
 * setState(newState) — Widget görsel durumunu günceller
 * 
 * Orijinal: au[e(746)](e(751))  →  setState("idle")
 *           au[e(746)](e(722), errorMsg)  →  setState("error", msg)
 */
class ContinentalWidget {
    setState(state, message) {
        const widget = document.querySelector(".continental-widget");
        const checkbox = document.querySelector(".continental-checkbox");
        const label = document.querySelector(".continental-label");
        const status = document.querySelector(".continental-status");
        const hint = document.querySelector(".continental-hint");

        // dataset.state'i güncelle (CSS ile stillendirilir)
        widget.dataset.state = state;

        switch (state) {
            case "idle":
                checkbox.setAttribute("aria-checked", "false");
                checkbox.disabled = false;
                checkbox.classList.remove("verified-phase-check", "verified-phase-label");
                label.textContent = this.strings["label"]; // "I'm not a robot"
                break;

            case "verifying":
                label.textContent = this.strings["verifying"]; // "Verifying..."
                break;

            case "verified":
                label.textContent = this.strings["verified"]; // "Verification complete"
                checkbox.setAttribute("aria-checked", "true");
                break;

            case "expired":
                label.textContent = this.strings["expired"]; // "Verification expired"
                break;

            case "error":
                status.textContent = message || this.strings["error"];
                break;

            case "failed":
                // Retry UI göster
                break;
        }
    }

    // Widget boyutunu parent'a bildir
    notifyResize() {
        const height = document.body.offsetHeight;
        const width = document.body.offsetWidth;
        this.postToParent("RESIZE", { height, width });
    }

    // Theme uygula
    applyTheme(theme) {
        // "auto" ise prefers-color-scheme media query'ye bak
        if (theme === "auto" && window.matchMedia) {
            const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const onChange = (e) => {
                this.postToParent("THEME_CHANGE", {
                    resolved: e.matches ? "dark" : "light"
                });
            };
            if (darkQuery.addEventListener) {
                darkQuery.addEventListener("change", onChange);
            } else if (darkQuery.addListener) {
                darkQuery.addListener(onChange);
            }
        }
    }
}


// ============================================================
// BÖLÜM 3: PARENT ↔ IFRAME MESAJLAŞMA (postMessage bridge)
// ============================================================

/**
 * Widget bir <iframe> içinde çalışıyor.
 * Tüm iletişim window.postMessage ile yapılıyor.
 * 
 * Güvenlik: parentOrigin ile origin validate ediliyor.
 */

// Parent'tan gelen mesajları handle et
window.addEventListener("message", function handleMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object" || !data.type) return;

    // Origin kontrolü — sadece beklenen parent'tan kabul et
    if (config && config.parentOrigin && event.origin !== config.parentOrigin) return;

    switch (data.type) {
        case "CONFIG":
            // Widget başlatma parametreleri
            config = {
                widgetId: data.widgetId,
                baseUrl: data.baseUrl,
                challengeUrl: data.challengeUrl,   // /api/c
                verifyUrl: data.verifyUrl,          // /api/q
                siteKey: data.siteKey,
                theme: data.theme,
                size: data.size || "normal",
                hideLogo: data.hideLogo,
                strings: Object.assign({}, DEFAULT_STRINGS, data.strings || {}),
                workers: data.workers,
                simulateDevice: data.simulateDevice || null,
                bridgeVersion: data.bridgeVersion || 1,
                invisible: data.size === "invisible",
                parentOrigin: data.parentOrigin || event.origin,
                // cdata: custom data (1-255 alfanümerik/_ /-)
                cdata: /^[a-zA-Z0-9_-]{1,255}$/.test(data.cdata) ? data.cdata : null,
                hl: data.hl || null,
            };
            // Widget'ı initialize et
            initializeWidget();
            postToParent("READY", {});
            break;

        case "EXECUTE":
            // Verification başlat
            startVerification();
            break;

        case "RESET":
            resetWidget();
            break;

        case "BEHAVIOR":
            // Mouse/interaction data parent'tan geliyor
            behaviorData = data.data || null;
            break;

        case "PROXY_FETCH_RESPONSE":
            // Network proxy cevabı — widget direkt fetch yapamıyorsa parent üzerinden
            const pending = pendingRequests.get(data.id);
            if (pending) {
                clearTimeout(pending.timeoutId);
                pending.abortCleanup && pending.abortCleanup();
                pending.resolve(data);
                pendingRequests.delete(data.id);
            }
            break;

        default:
            // Challenge cevap tipleri: "GOBANG_ANSWER", "SLIDE_ANSWER" vb.
            // Pattern: /^(.+)_(ANSWER|CANCEL|REFRESH)$/
            const match = data.type.match(/^(.+)_(ANSWER|CANCEL|REFRESH)$/);
            if (match) {
                const challengeType = match[1];   // "GOBANG", "SLIDE" vb.
                const action = match[2];           // "ANSWER", "CANCEL", "REFRESH"
                handleChallengeAction(challengeType, action, data);
            }
            break;
    }
});

// Parent'a mesaj gönder
function postToParent(type, payload) {
    if (!config) return;
    const message = Object.assign({}, payload, {
        type: type,
        widgetId: config.widgetId
    });
    parent.postMessage(message, config.parentOrigin || "*");
}


// ============================================================
// BÖLÜM 4: VERIFICATION AKIŞI
// ============================================================

async function startVerification() {
    setState("verifying");

    try {
        // 1) Challenge al
        const challengeResponse = await fetchChallenge();
        // challengeResponse: { type, difficulty, signature, ... challenge data }

        // 2) Proof of Work çöz
        const powSolution = await solvePoW(challengeResponse);

        // 3) Challenge UI'ı göster
        const answer = await showChallenge(challengeResponse);

        // 4) Cevabı doğrulat
        const result = await verifyAnswer({
            challenge: challengeResponse,
            type: challengeResponse.type,
            answer: answer,
            powSolution: powSolution
        });

        // 5) Başarı → token'ı parent'a gönder
        postToParent("VERIFIED", {
            token: result.token,
            challengeType: challengeResponse.type
        });

    } catch (err) {
        handleVerificationError(err);
    }
}

// Challenge API'ye istek at (POST /api/c)
async function fetchChallenge() {
    const payload = {
        siteKey: config.siteKey,
        widgetId: config.widgetId,
        // Fingerprint data
        // ...
    };

    // MessagePack encode + ChaCha20 ile şifrele
    const encoded = msgpack.encode(payload);

    const response = await proxyFetch(config.challengeUrl || config.baseUrl + "/api/c", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: encoded
    });

    return msgpack.decode(response);
}

// Cevabı doğrulat (POST /api/q)
async function verifyAnswer(data) {
    const payload = msgpack.encode(data);

    const response = await proxyFetch(config.verifyUrl || config.baseUrl + "/api/q", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: payload
    });

    const result = msgpack.decode(response);

    if (!result.token) {
        throw new ContinentalError("Missing result token", "verification");
    }
    return result;
}


// ============================================================
// BÖLÜM 5: PROOF-OF-WORK (PoW)
// ============================================================

/**
 * Server bir hash challenge gönderir.
 * Client, belirli bir prefix üreten nonce'ı bulur.
 * 
 * Desteklenen algoritmalar: SHA-256, SHA-384, SHA-512
 * 
 * Anti-cheat: Server "took" değerini kontrol eder.
 * Çok hızlı çözüm → bot şüphesi.
 * "simulateDevice" modu: bilinen cihaz profili için
 * gerçekçi çözme süresi simüle edilir.
 */
async function solvePoW(challenge) {
    const { algorithm, payload, maxnumber } = challenge;
    const workerCount = config.workers || 1;
    const startTime = performance.now();

    // Worker thread'lerde paralel çalıştır
    const workers = [];
    const rangeSize = Math.ceil(maxnumber / workerCount);

    for (let i = 0; i < workerCount; i++) {
        const start = i * rangeSize;
        const end = Math.min(start + rangeSize, maxnumber);
        workers.push(runWorker({ algorithm, payload, start, end }));
    }

    const solution = await Promise.race(workers);

    if (!solution) {
        throw new Error("Solution not found within range");
    }

    // simulateDevice modu: gerçekçi delay ekle
    if (config.simulateDevice) {
        const profile = DEVICE_PROFILES[config.simulateDevice];
        const targetTime = profile._simSolveTime || 0;
        const realTime = performance.now() - startTime;
        if (realTime < targetTime) {
            const delay = targetTime - realTime + Math.round(Math.random() * 500);
            await sleep(delay);
        }
    }

    return solution;
}


// ============================================================
// BÖLÜM 6: BOT DETECTION — BEHAVIOR ANALYSIS
// ============================================================

/**
 * BehaviorCollector — Kullanıcı etkileşimini toplar
 * 
 * Toplanan veriler /api/c isteğine eklenir (beh: {...})
 * Server-side bu veriler analiz edilir.
 */
class BehaviorCollector {
    constructor() {
        // Mouse koordinat history
        this.points = [];
        this.lastPointTime = 0;
        this.enterTime = 0;
        this.leaveCount = 0;

        // Click bilgileri
        this.clickX = 0;
        this.clickY = 0;
        this.clickDuration = 0;
        this.clickTrusted = false;  // isTrusted kontrolü — bot'larda false
        this.clickButton = 0;
        this.mousedownTime = 0;

        // Event istatistikleri
        this.eventSeq = [];
        this.trustedCount = 0;   // Gerçek kullanıcı event sayısı
        this.totalCount = 0;     // Tüm event sayısı

        // Diğer
        this.firstInteractionTime = 0;
        this.hoverStartTime = 0;
        this.docFocusAtClick = false;
        this.visStateAtClick = "visible";
        this.focusChanges = 0;
        this.pointerType = "";   // "mouse", "touch", "pen"
        this.pressure = 0;       // Touch pressure

        // İç flagler
        this._firstPointTime = 0;
        this._hadClick = false;
        this._hadPointerDown = false;
        this._hadKeyboard = false;
        this._moveCount = 0;
        this._coalescedEmpty = 0;  // Coalesced event yoksa şüpheli
        this._hadTouch = false;

        // Limitler
        this._MAX_PATH_SAMPLES = 200;
        this._MAX_HOVER_EVENTS = 50;
        this._MAX_CLICKS = 10;
        this._DOC_THROTTLE = 100;     // ms
        this._PATH_THROTTLE = 16;     // ms (~60fps)
        this._HOVER_PROBE_DELAYS = [100, 300, 700, 1500];
        this._FINAL_TIMER_MS = 5000;
        this._GATE_RETRY_MS = 1000;
        this._GATE_MAX_WAIT = 10000;
        this._KEYBOARD_BYPASS = false;  // Keyboard ile bypass izni
    }

    start() {
        this._listeners = [
            ["mouseenter", this._onMouseEnter.bind(this), { passive: true }],
            ["mouseleave", this._onMouseLeave.bind(this), { passive: true }],
            ["mousemove", this._onMouseMove.bind(this), { passive: true }],
            ["pointermove", this._onPointerMove.bind(this), { passive: true }],
            ["pointerdown", this._onPointerDown.bind(this), { passive: true }],
            ["click", this._onClick.bind(this)],
            ["keydown", this._onKeyDown.bind(this), { capture: true }],
            ["touchstart", this._onTouchStart.bind(this), { passive: true }],
            ["visibilitychange", this._onVisibilityChange.bind(this)],
            ["focus", this._onFocus.bind(this)],
            ["blur", this._onBlur.bind(this)],
        ];

        for (const [event, handler, opts] of this._listeners) {
            document.addEventListener(event, handler, opts);
        }
    }

    _onMouseMove(event) {
        const now = performance.now();
        if (now - this.lastPointTime < this._PATH_THROTTLE) return;

        // Coalesced events — gerçek mouse hareketi bunları doldurur
        // Bot'larda genellikle boş gelir
        const coalesced = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
        if (coalesced.length === 0) this._coalescedEmpty++;

        this.points.push({
            x: Math.round(event.clientX),
            y: Math.round(event.clientY),
            t: Math.round(now)
        });
        if (this.points.length > this._MAX_PATH_SAMPLES) {
            this.points.shift();
        }
        this.lastPointTime = now;
        this._moveCount++;
    }

    _onClick(event) {
        this._hadClick = true;
        this.clickTrusted = event.isTrusted;  // Bot dispatch'inde false
        this.clickButton = event.button;
        this.clickX = Math.round(event.offsetX);
        this.clickY = Math.round(event.offsetY);
        this.clickDuration = performance.now() - this.mousedownTime;
        this.docFocusAtClick = document.hasFocus();
        this.visStateAtClick = document.visibilityState;

        // InputDeviceCapabilities — touch simulation tespiti
        if (event.sourceCapabilities) {
            this._clickSourceCaps = event.sourceCapabilities;
        }

        this.trustedCount += event.isTrusted ? 1 : 0;
        this.totalCount++;
    }

    _onKeyDown(event) {
        this._hadKeyboard = true;
        if (event.key === "Enter" || event.key === " ") {
            // Keyboard ile CAPTCHA interaction
            // Orijinal kodda bu da requestVerification'ı tetikleyebilir
        }
        this.trustedCount += event.isTrusted ? 1 : 0;
    }

    // Edge analizi — fare ekranın kenarından mı geliyor?
    // Bot'lar çoğu zaman (0,0)'dan veya ekran kenarından başlar
    _computeEdgeMargins() {
        return {
            LEFT: 0,
            RIGHT: window.innerWidth,
            TOP: 0,
            BOTTOM: window.innerHeight
        };
    }

    _isOnEdge(x, y) {
        const margin = 5; // px
        return (
            x <= margin || x >= window.innerWidth - margin ||
            y <= margin || y >= window.innerHeight - margin
        );
    }

    _movesFromEdge() {
        if (this.points.length === 0) return true;
        const first = this.points[0];
        return this._isOnEdge(first.x, first.y);
    }

    _analyzeMousePath() {
        // Hareket doğrusal mı? (bot genelde düz çizgide hareket eder)
        // Gerçek kullanıcı S-curve, hızlanma/yavaşlama gösterir
        const pts = this.points;
        if (pts.length < 3) return { linear: true };

        let linearCount = 0;
        for (let i = 1; i < pts.length - 1; i++) {
            const dx1 = pts[i].x - pts[i-1].x;
            const dy1 = pts[i].y - pts[i-1].y;
            const dx2 = pts[i+1].x - pts[i].x;
            const dy2 = pts[i+1].y - pts[i].y;
            // Cross product ~ 0 ise doğrusal
            const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
            if (cross < 1) linearCount++;
        }

        return { linearRatio: linearCount / (pts.length - 2) };
    }

    snapshot() {
        return {
            cfg: {
                startedInsideWidget: this.enterTime > 0,
                enteredFromOutside: this._movesFromEdge(),
                initialHoverState: document.querySelector(".continental-widget:hover") !== null,
                isIframeEntry: this.enterTime > 0
            },
            ent: {
                firstPoint: this.points[0] || null,
                mousePathSample: this.points.slice(0, 20),
                hoverEvents: [],
                clicks: this.clickTrusted ? [{
                    x: this.clickX, y: this.clickY,
                    duration: this.clickDuration,
                    trusted: this.clickTrusted,
                    button: this.clickButton
                }] : [],
                mouseEvents: [],
                touchEvents: [],
                inputType: this._hadTouch ? "touch" : "mouse",
                lastMouseSampleTime: this.lastPointTime,
                collectionStartTime: this.enterTime,
                frozenTime: 0
            },
            clk: {
                x: this.clickX,
                y: this.clickY,
                duration: this.clickDuration,
                trusted: this.clickTrusted,
                button: this.clickButton,
                docFocus: this.docFocusAtClick,
                visState: this.visStateAtClick
            },
            hvr: {
                startTime: this.hoverStartTime,
                leaveCount: this.leaveCount
            }
        };
    }
}


// ============================================================
// BÖLÜM 7: DEBUGGER TESPİTİ (Anti-DevTools Worker)
// ============================================================

/**
 * Bir Web Worker başlatılır ve içinde debugger timing testi yapılır.
 * DevTools açıksa debugger statement çalışma süresini uzatır.
 * Bu süre ölçülerek DevTools açık olup olmadığı anlaşılır.
 * 
 * Worker kodu (URL.createObjectURL ile inline):
 */
const DEBUGGER_WORKER_CODE = `
self.onmessage = function() {
    var F = (0).constructor.constructor;  // Function constructor (eval alternatifi)
    var result = { e1: 0, e2: 0, e3: 0 };
    
    // Test 1: performance.now() ile debugger timing
    try {
        result.e1 = F("p", "var t=p.now();(function(){debugger})();return p.now()-t")(performance);
    } catch(x) {}
    
    // Test 2: 3 iterasyonlu ölçüm
    try {
        result.e2 = F("p", "var s=0,i=3;while(i--){var t=p.now();(function(){debugger})();s+=p.now()-t}return s")(performance);
    } catch(x) {}
    
    // Test 3: Date.now() ile
    try {
        result.e3 = F("d", "var t=d.now();(function(){debugger})();return d.now()-t")(Date);
    } catch(x) {}
    
    self.postMessage(result);
};
`;
// Sonuç: e1/e2/e3 > 100ms ise DevTools açık demek → "jsd" fingerprint verisine eklenir


// ============================================================
// BÖLÜM 8: FINGERPRINTING
// ============================================================

/**
 * /api/c isteğine eklenen fingerprint verileri
 */
async function collectFingerprint() {
    const fp = {
        // Navigator
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,

        // Screen
        screen: {
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth
        },
        pixelRatio: window.devicePixelRatio,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        },

        // Touch
        touchSupport: {
            maxTouchPoints: navigator.maxTouchPoints,
            touchEvent: "ontouchstart" in window,
            touchPoints: navigator.msMaxTouchPoints || 0
        },

        // Network
        connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
        } : null,

        // WebGL fingerprint
        webgl: getWebGLInfo(),

        // Timezone
        timezone: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offset: new Date().getTimezoneOffset()
        },

        // Feature detection
        features: {
            webWorker: typeof Worker !== "undefined",
            serviceWorker: "serviceWorker" in navigator,
            webCrypto: !!(window.crypto && window.crypto.subtle),
            localStorage: hasFeature("localStorage"),
            sessionStorage: hasFeature("sessionStorage"),
            indexedDB: hasFeature("indexedDB"),
            webGL: hasWebGL("webgl"),
            webGL2: hasWebGL("webgl2"),
            webp: await checkWebP()  // data:image/webp base64 test
        },

        // Canvas fingerprint
        canvasHash: getCanvasHash(),

        // Zaman damgası
        timestamp: Date.now(),

        // Bot detection flags
        nai: {
            webdriver: !!navigator.webdriver,
            plugins: navigator.plugins.length,
            // UA kontrolü
            headlessUA: /HeadlessChrome|PhantomJS/.test(navigator.userAgent),
            // Global değişken enjeksiyon tespiti
            // ^cdc_|^__pw_|^__playwright|^__selenium|^__driver
            injectedVars: checkInjectedVars()
        },

        // Chrome runtime kontrolleri
        ccr: {
            chromeApp: !!(window.chrome && window.chrome.app && window.chrome.app.runtime),
            // Headless userAgentData kontrolü
            headlessUA: checkHeadlessUA(),
            // Notification permission (headless'te genelde "denied")
            notificationPermission: typeof Notification !== "undefined" ? Notification.permission : null,
            // Speech synthesis (bot'larda boş)
            speechVoices: typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices().length : 0,
            // userActivation
            userActivation: navigator.userActivation ? navigator.userActivation.hasBeenActive : null,
            // eventCounts
            eventCounts: !!navigator.userActivation
        },

        // Davranış verisi (BehaviorCollector.snapshot())
        beh: behaviorCollector.snapshot(),

        // Debugger tespiti (Worker sonucu)
        jsd: debuggerTestResult  // { e1, e2, e3 }
    };

    return fp;
}

function getWebGLInfo() {
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) return null;
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        return {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        };
    } catch(e) { return null; }
}

function getCanvasHash() {
    // Canvas fingerprint
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f0f";
        ctx.fillRect(0, 0, 10, 10);
        ctx.fillStyle = "#0ff";
        ctx.font = "14px Arial";
        ctx.fillText("Continental", 2, 10);
        ctx.fillStyle = "#f60";
        ctx.fillRect(5, 5, 10, 10);
        ctx.fillStyle = "#069";
        ctx.fillText("1.1.0", 4, 20);
        // rgba ile de bir şeyler çiz
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillRect(0, 0, 5, 5);
        return canvas.toDataURL();  // hash alınır
    } catch(e) { return null; }
}


// ============================================================
// BÖLÜM 9: HATA SINIFI
// ============================================================

class ContinentalError extends Error {
    constructor(message, type) {
        super(message);
        this.name = "ContinentalError";
        this.type = type;  // timeout, network, server, invalid, auth, ratelimit...
    }
}


// ============================================================
// BÖLÜM 10: CHALLENGE TANIMLARI
// ============================================================

/**
 * Her challenge tipi için gösterilecek fonksiyon ve parametre yapısı:
 */

const CHALLENGE_HANDLERS = {
    "gobang": {
        instruction: "Complete the puzzle",
        show: "GOBANG_SHOW",
        params: ["board"],            // Tahta dizisi
        extractAnswer: (data) => ({ row: data.row, col: data.col }),
        errorMsg: "Wrong position. Try again"
    },
    "slide": {
        instruction: "Slide the puzzle piece",
        show: "SLIDE_SHOW",
        params: ["bgImage", "pieceImage", "pieceX", "pieceY", "pieceWidth", "pieceHeight", "bgWidth", "bgHeight"],
        extractAnswer: (data) => ({ x: data.x }),
        errorMsg: "Wrong position. Try again"
    },
    "rotate": {
        instruction: "Rotate the image",
        show: "ROTATE_SHOW",
        params: ["masterImage", "thumbImage", "masterSize", "thumbDiameter"],
        extractAnswer: (data) => ({ angle: data.angle }),
        errorMsg: "Wrong angle. Try again"
    },
    "icon": {
        instruction: "Click the target icons",
        show: "ICON_SHOW",
        params: ["mainImage", "promptImage", "targetCount", "imageWidth", "imageHeight"],
        extractAnswer: (data) => ({ clicks: data.clicks }),
        errorMsg: "Wrong icons. Try again"
    },
    "swap": {
        instruction: "Swap the orbs",
        show: "SWAP_SHOW",
        params: ["orbTypes", "maxSwaps"],
        extractAnswer: (data) => ({ swaps: data.swaps, solvedLine: data.solvedLine }),
        errorMsg: "No matching row. Try again"
    },
    "emoji_swap": {
        instruction: "Match the emojis",
        show: "EMOJI_SWAP_SHOW",
        params: ["sheet"],
        extractAnswer: (data) => ({ swaps: data.swaps, solvedLine: data.solvedLine }),
        errorMsg: "No matching line. Try again"
    },
    "shortest_line": {
        instruction: "Click the shortest line",
        show: "SHORTEST_LINE_SHOW",
        params: ["images", "roundCount"],
        extractAnswer: (data) => ({ placements: data.placements }),
        errorMsg: "Wrong line. Try again"
    },
    "x_marker": {
        instruction: "Match the shape to the X pattern",
        show: "X_MARKER_SHOW",
        params: ["question"],
        extractAnswer: (data) => ({ placements: data.placements }),
        errorMsg: "Wrong placement. Try again"
    },
    "height_match": {
        instruction: "Click the matching target",
        show: "HEIGHT_MATCH_SHOW",
        params: ["targetHeights", "peakHeight"],
        extractAnswer: (data) => ({ selectedIndices: data.selectedIndices }),
        errorMsg: "Wrong target. Try again"
    },
    "line_break": {
        instruction: "Find the break in the line",
        show: "LINE_BREAK_SHOW",
        params: ["image"],
        extractAnswer: (data) => ({ x: data.x, y: data.y }),
        errorMsg: "Wrong spot. Try again"
    }
};


// ============================================================
// BÖLÜM 11: GÜVENLİK KONTROLLERİ
// ============================================================

/**
 * Headless browser / bot tespiti için yapılan kontroller:
 */
function checkInjectedVars() {
    // Playwright, Selenium, WebDriver inject ettiği global değişkenler
    const pattern = /^cdc_|^__pw_|^__playwright|^__selenium|^__driver/;
    const longPattern = /^([a-zA-Z_$][a-zA-Z0-9_$]{15,})_(Array|Promise|Symbol)$/;

    const injected = Object.getOwnPropertyNames(window).filter(key =>
        pattern.test(key) || longPattern.test(key)
    );
    return injected.length > 0;
}

function checkHeadlessUA() {
    // chrome.runtime brands içinde "HeadlessChrome" var mı?
    if (navigator.userAgentData && navigator.userAgentData.brands) {
        return navigator.userAgentData.brands.some(b =>
            b.brand === "HeadlessChrome" || b.brand.toLowerCase().includes("headless")
        );
    }
    return /HeadlessChrome/.test(navigator.userAgent);
}

function isNativeFunction(fn) {
    // toString ile native code kontrolü
    try {
        const s = Function.prototype.toString.call(fn);
        return s.indexOf("[native code]") !== -1;
    } catch(e) { return false; }
}

// Kritik fonksiyonların override edilip edilmediğini kontrol et
function checkNativeFunctions() {
    const toCheck = [
        [Date, "Date"],
        [performance, "performance"],
        [Math, "Math"],
        [window.crypto, "Crypto"],
        [Navigator.prototype, "Navigator"],
        [HTMLDocument.prototype, "HTMLDocument"]
    ];
    // Her birinin toString'i native code içermeli
    // Override edilmişse bot/anti-detection araç
}

/**
 * Timezone/locale tabanlı kontroller:
 * 
 * "^en-GB|^en-IE|^en-GH|^en-GM|^pt-GW|^pt-ST|^fr-SN|^fr-ML|^fr-CI|^fr-BF|^is"
 * 
 * Bu regex bazı ülke/dil kombinasyonlarını işaretliyor (fraud tespiti için kullanılabilir)
 */


// ============================================================
// BÖLÜM 12: NETWORK — PROXY FETCH
// ============================================================

/**
 * Widget direkt fetch yapamıyorsa (CSP kısıtlamaları) parent üzerinden proxy kullanır:
 * 
 * 1. Widget → parent: postMessage("PROXY_FETCH_REQUEST", { url, method, headers, body })
 * 2. Parent → network → sonuç alır
 * 3. Parent → widget: postMessage("PROXY_FETCH_RESPONSE", { id, status, body })
 */
async function proxyFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestId = generateUUID();
        const timeout = 30000;

        const timeoutId = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new ContinentalError("Request timed out", "timeout"));
        }, timeout);

        pendingRequests.set(requestId, {
            timeoutId,
            resolve: (response) => {
                clearTimeout(timeoutId);
                if (response.status >= 500) {
                    reject(new ContinentalError("Server unavailable", "server"));
                } else if (response.status === 404) {
                    reject(new ContinentalError("Service not found", "notfound"));
                } else if (response.status === 403) {
                    reject(new ContinentalError("Access denied", "auth"));
                } else if (response.status === 429) {
                    reject(new ContinentalError("Too many requests. Please try again later", "ratelimit"));
                } else if (response.status !== 200) {
                    reject(new ContinentalError("Request failed", "rejected"));
                } else {
                    resolve(response.body);
                }
            },
            reject
        });

        postToParent("PROXY_FETCH_REQUEST", {
            id: requestId,
            url,
            method: options.method || "GET",
            headers: options.headers || {},
            body: options.body
        });
    });
}


// ============================================================
// BÖLÜM 13: DEFAULT STRINGS (Lokalizasyon)
// ============================================================

const DEFAULT_STRINGS = {
    label: "I'm not a robot",
    verifying: "Verifying...",
    verified: "Verification complete",
    expired: "Verification expired",
    error: "Verification failed",
    errorNetwork: "Connection failed",
    errorTimeout: "Request timed out",
    errorInvalid: "Invalid response",
    errorServer: "Server unavailable",
    errorNotFound: "Service not found",
    hintRetry: "Click to retry",

    // Challenge talimatları (challengeType göre set edilir)
    gobang: "Complete the puzzle",
    slide: "Slide the puzzle piece",
    rotate: "Rotate the image",
    icon: "Click the target icons",
    swap: "Swap the orbs",
    emoji_swap: "Match the emojis",
    shortest_line: "Click the shortest line",
    x_marker: "Match the shape to the X pattern",
    height_match: "Click the matching target",
    line_break: "Find the break in the line",

    // Hata mesajları (yanlış cevap)
    gobang_error: "Wrong position. Try again",
    rotate_error: "Wrong angle. Try again",
    slide_error: "Wrong position. Try again",
    swap_error: "No matching row. Try again",
    emoji_swap_error: "No matching line. Try again",
    shortest_line_error: "Wrong line. Try again",
    x_marker_error: "Wrong placement. Try again",
    height_match_error: "Wrong target. Try again",
    line_break_error: "Wrong spot. Try again",
    icon_error: "Wrong icons. Try again"
};


// ============================================================
// BÖLÜM 14: WIDGET RESET / ABORT
// ============================================================

function resetWidget() {
    // Tüm pending operasyonları iptal et
    if (abortController) {
        abortController.abort();
    }

    // Pending request'leri temizle
    pendingRequests.forEach((pending, id) => {
        clearTimeout(pending.timeoutId);
        pending.abortCleanup && pending.abortCleanup();
        pending.reject(new ContinentalError("Aborted", "aborted"));
        pendingRequests.delete(id);
    });

    // Challenge UI'larını kapat
    const CHALLENGE_TYPES = [
        "GOBANG", "SLIDE", "ROTATE", "ICON", "SWAP",
        "EMOJI_SWAP", "SHORTEST_LINE", "X_MARKER", "HEIGHT_MATCH", "LINE_BREAK"
    ];
    CHALLENGE_TYPES.forEach(type => {
        // Her challenge için CLOSE eventi
        postToParent(type + "_CLOSE", {});
    });

    // State'i sıfırla
    setState("idle");
    updateProgress(0);
    config.challengeToken = null;
}


// ============================================================
// GEREKSİNİM: window.crypto.subtle (HTTPS zorunlu)
// ============================================================

// Son satır: HTTPS kontrolü
if (!window.crypto || !window.crypto.subtle) {
    setState("error", "Secure context required (HTTPS)");
}

/**
 * Bu dosya HTTPS bağlamı gerektiriyor çünkü:
 * - window.crypto.subtle (WebCrypto API) sadece HTTPS'de çalışır
 * - PoW için SHA hash'leme bu API'yi kullanır
 * - HTTP'de sayfa açılırsa widget "error" state'ine geçer
 */
