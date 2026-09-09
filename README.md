# cntsw.js — Deobfuscation Raporu

## Kaynak
- URL: `https://challenge.patched.to/s/c296b4bcca757cce597a015732b00b87/cntsw.js`
- Dosya boyutu: ~170 KB (tek satır, minify + obfuscate edilmiş)
- Wrapper comment: `/*1a477716477c11a55b9*/`

---

## 1. Obfuscation Katmanları

### Katman 1 — Outer Wrapper IIFE
```js
(function(X9Mu, lN) {
    var fKti = "1bcf377";
    // ...tüm kod buraya gömülü...
})(void 0, void 0);
```
Parametre olarak `void 0` geçildiği için X9Mu ve lN hiçbir zaman kullanılmıyor. Salt wrapper, debugging'i zorlaştırmak için.

### Katman 2 — String Encoding (Base91 benzeri custom codec)
Dosyada **2 ayrı IIFE** var, her biri kendi custom base91 decoder'ını içeriyor:

**İlk IIFE (pos ~61):**
- Alphabet: `E,MW8AfL>n7#mG+/h9"xaF;}Cb<XI4:TgR_HJ[c2ts3YB%j6=qoevp^kZQr!DO0~uwiK&1$P{.(Sz@y)|VN]?l5U*\`d`
- Fonksiyon: `b(n)` → `d[n]` stringini decode eder
- Kullanım amacı: MessagePack library stringleri (encode/decode, byteLength vb.)

**İkinci IIFE (pos ~31297):**
- Alphabet: `;)8w\`J?{0E:z_1HRWN&,jOi=dk5}6Qa^]*~|YhDPIc[KMVF/m3.2v>bZy@XSu9L<ex74CtBf$o!T%s#pArq(+lgGn"U`
- Fonksiyon: `e(n)` → `d[n]` stringini decode eder
- **Ana kod bu IIFE içinde** — 4506 adet `e(N)` çağrısı var

### Katman 3 — String Tablosu
`d[]` array'inde **1438 adet** encoded string mevcut. Decoded olanlar:
- Index 0–93: İçerik hash/token gibi görünen rastgele string'ler (integrity token'ları)
- Index 94+: Gerçek JS property adları ve değerleri

---

## 2. Kütüphaneler — Ne Var İçinde?

Decode edilen string'lerden anlaşılan gömülü kütüphaneler:

### 2.1 MessagePack (msgpack) — Tam Embed
```
register, encode, decode, encoders, decoders
builtInEncoders, builtInDecoders, tryToEncode
encodeNil, encodeBoolean, encodeNumber, encodeString
encodeArray, encodeMap, encodeBinary, encodeExtension
decodeSync, decodeAsync, decodeArrayStream, decodeStream
```
İstek/cevap iletişimi için MessagePack binary formatı kullanılıyor. JSON değil.

### 2.2 Noble Hashes (SHA-256/384/512 + BLAKE) — Tam Embed
```
SHA-256, SHA-384, SHA-512
0x428a2f98d728ae22  ← SHA-256 round constant
0x7137449123ef65cd
... (64 adet SHA-256 sabiti)
...
outputLen, blockLen, padOffset, roundClean
digestInto, digest, destroy, create
```
Proof-of-Work (PoW) çözümü için kriptografik hash.

### 2.3 ChaCha20 (stream cipher) — Tam Embed
```
expand 16-byte k
expand 32-byte k
arx: counter overflow
arx: invalid block position
encrypt, decrypt
nonce, tagLength, AAD
cannot encrypt() twice with same key + nonce
```
Network iletişimini şifrelemek için kullanılıyor (challenge/verify API çağrıları).

### 2.4 Continental CAPTCHA Framework — Ana Mantık
Bu asıl ürün. Aşağıdaki bölümler var:

---

## 3. Ana Uygulama Mantığı — "Continental CAPTCHA"

### 3.1 Widget Durumları (State Machine)
```
idle       → Başlangıç
verifying  → "Verifying..."
verified   → "Verification complete"
expired    → "Verification expired"
error      → "Verification failed"
failed     → Kullanıcı yanlış yanıt verdi
```

### 3.2 CSS Selector'lar (Widget DOM yapısı)
```css
.continental-widget
.continental-main
.continental-checkbox
.continental-label
.continental-status
.continental-hint
.continental-progress-bar
.continental-error-banner
#continental-logo
```

### 3.3 Desteklenen CAPTCHA Challenge Tipleri
| Tip | Açıklama | Kullanıcı mesajı |
|-----|----------|------------------|
| `gobang` | Beşli/satır tamamlama bulmacası | "Complete the puzzle" |
| `slide` | Kaydırmalı puzzle parçası | "Slide the puzzle piece" |
| `rotate` | Görüntü döndürme | "Rotate the image" |
| `icon` | Doğru ikonlara tıklama | "Click the target icons" |
| `swap` | Orb'ları takas etme | "Swap the orbs" |
| `emoji_swap` | Emoji eşleştirme | "Match the emojis" |
| `shortest_line` | En kısa çizgiyi bulma | "Click the shortest line" |
| `x_marker` | X pattern eşleştirme | "Match the shape to the X pattern" |
| `height_match` | Yükseklik eşleştirme | "Click the matching target" |
| `line_break` | Kırık çizgiyi bulma | "Find the break in the line" |

### 3.4 API Endpoint'leri
```
POST /api/c   ← Challenge alma (siteKey, widgetId gönderilir)
POST /api/q   ← Cevap gönderme / verification
```

### 3.5 Parent ↔ IFrame Mesajlaşması (postMessage)
Widget bir `<iframe>` içinde çalışıyor. Parent ile mesajlaşma şeması:

**Parent'tan Widget'a:**
| type | Açıklama |
|------|----------|
| `CONFIG` | Widget başlatma parametreleri |
| `EXECUTE` | Verification başlat |
| `RESET` | Sıfırla |
| `BEHAVIOR` | Behavior data gönder |
| `PROXY_FETCH_RESPONSE` | Network proxy cevabı |
| `GOBANG_ANSWER` / `SLIDE_ANSWER` / ... | Kullanıcı cevabı |
| `GOBANG_CANCEL` / `SLIDE_CANCEL` / ... | Kullanıcı iptal |
| `GOBANG_REFRESH` / `SLIDE_REFRESH` / ... | Yenile |

**Widget'tan Parent'a:**
| type | Açıklama |
|------|----------|
| `READY` | Widget hazır |
| `VERIFIED` | Doğrulama başarılı, token içeriyor |
| `ERROR` | Hata kodu ve mesaj |
| `SHOW_WIDGET` | Challenge gösterildi |
| `HIDE_WIDGET` | Widget gizlendi |
| `CHALLENGE_FAILED` | Challenge başarısız |
| `RESIZE` | iframe boyut değişikliği |
| `THEME_CHANGE` | Tema değişikliği (dark/light) |
| `PROXY_FETCH_REQUEST` | Parent'tan network isteği iste |

### 3.6 CONFIG Parametreleri (Parent'tan gelen)
```js
{
    widgetId: "...",
    baseUrl: "...",           // API base URL
    challengeUrl: "...",      // /api/c URL
    verifyUrl: "...",         // /api/q URL
    siteKey: "...",
    theme: "auto"|"light"|"dark",
    size: "normal",
    hideLogo: false,
    strings: { ... },         // Override UI metinleri
    workers: N,               // PoW worker sayısı
    simulateDevice: "...",    // Test için cihaz simülasyonu
    bridgeVersion: 1,
    invisible: boolean,       // Invisible mod
    parentOrigin: "...",
    cdata: "...",             // Custom data (1-255 alfanümerik)
    hl: "...",                // Language hint
    difficulty: N,
    challengeType: "..."
}
```

---

## 4. Bot Detection — Behavior Analizi

### 4.1 Toplanan Mouse/Interaction Verileri
```js
points           // Mouse koordinat history
lastPointTime    // Son point timestamp
enterTime        // Widget'a mouse girişi zamanı
leaveCount       // Widget'tan kaç kez çıkıldı
clickX, clickY   // Click koordinatı
clickDuration    // Click basılı kalma süresi
clickTrusted     // isTrusted eventi mi?
clickButton      // Hangi mouse button
mousedownTime    // Mousedown timestamp
eventSeq         // Event sequence
trustedCount     // Trusted event sayısı
totalCount       // Toplam event sayısı
firstInteractionTime
hoverStartTime
docFocusAtClick  // Click anında document focused mu?
visStateAtClick  // Click anında visibility state
focusChanges     // Focus değişim sayısı
pointerType      // mouse|touch|pen
pressure         // Touch pressure
cdpScreen        // CDP (Chrome DevTools Protocol) screen info
```

### 4.2 Bot Detection Sinyalleri
```js
// Navigator/Window özellik kontrolleri
webdriver              ← window.webdriver kontrol
plugins                ← navigator.plugins
"HeadlessChrome|PhantomJS"  ← UA regex
"^cdc_|^__pw_|^__playwright|^__selenium|^__driver"  ← global değişken tespiti
"^([a-zA-Z_$][a-zA-Z0-9_$]{15,})_(Array|Promise|Symbol)$"  ← Playwright/Selenium inject

// Headless tespiti
headless               ← userAgentData brands içinde
crossOriginIsolated
userActivation.hasBeenActive

// Debugger tespiti (Worker thread'de)
"(function(){debugger})()"  ← Timing attack ile debugger tespiti
// Worker kodu (decoded):
self.onmessage = function() {
    var F = (0).constructor.constructor;  // Function constructor
    var r = { e1: 0, e2: 0, e3: 0 };
    try { r.e1 = F("p","var t=p.now();(function(){debugger})();return p.now()-t")(performance) }
    try { r.e2 = F("p","var s=0,i=3;while(i--){var t=p.now();...debugger...;s+=p.now()-t}return s")(performance) }
    try { r.e3 = F("d","var t=d.now();(function(){debugger})();return d.now()-t")(Date) }
    self.postMessage(r);
}
// e1/e2/e3 > 100ms ise debugger açık demek

// Notification permission
Notification.permission === "denied"  ← headless browser sinyali

// Speech synthesis
speechSynthesis.getVoices()  ← bot'larda genelde boş

// Chrome-specific kontroller
chrome.app.runtime
chrome.runtime
```

### 4.3 Edge/Pattern Analizi
Mouse hareketi edge'den mi geliyor (bot) yoksa organik mi diye analiz:
```
_isOnEdge()         // Fare ekran kenarına yakın mı?
_analyzeMousePath() // Hareket doğrusal mı? (bot genelde lineer hareket eder)
_movesFromEdge()    // Edge'den başlayan harekeler
_countEdgeSegments()
_checkHoverPattern()
LEFT, RIGHT, TOP, BOTTOM  // Hangi edge
```

### 4.4 Cihaz Profilleri (Simülasyon / Karşılaştırma için)
Kod, gerçek cihaz karakteristiklerini bilinen profiller ile karşılaştırıyor:

| Profil | UA | GPU |
|--------|-----|-----|
| low-mobile | Samsung SM-A105F, Chrome 120 | Adreno (TM) 504 |
| mid-mobile | Pixel 6, Chrome 120 | Mali-G78 |
| high-mobile | iPhone iOS 17 | Apple GPU |
| tablet | iPad iOS 17 | Apple GPU |
| low-desktop | Windows, Chrome 120 | Intel UHD 620 |
| mid-desktop | Windows, Chrome 120 | NVIDIA RTX 3060 |
| high-desktop | Windows, Chrome 120 | NVIDIA RTX 4080 |
| workstation | Windows, Chrome 120 | NVIDIA RTX 4090 |

`_simSolveTime` ile simüle edilen cihaza göre PoW çözme süresi ayarlanıyor (bot tespitini geçmek için gerçekçi timing).

---

## 5. Proof-of-Work (PoW) Mekanizması

```
algorithm: "SHA-256" | "SHA-384" | "SHA-512"
maxnumber: N           // Arama uzayı üst sınırı
workers: N             // Kaç web worker paralel çalışacak
reportInterval: N      // İlerleme raporlama
```

PoW çözümü:
1. Server `POST /api/c` ile challenge + signature gönderir
2. Client belirtilen algoritmada hash hesaplar, hedefi bulan nonce'ı arar
3. `solveMainThread` veya `Worker` thread'de çalışır
4. Çözüm bulununca `POST /api/q` ile gönderilir
5. Server `took` (çözme süresi) değerini kontrol eder — çok hızlıysa bot sinyali

---

## 6. Fingerprinting Verileri

`/api/c` isteğine şu fingerprint verileri gönderiliyor:

```js
{
    userAgent,
    screen: { availWidth, availHeight, colorDepth, pixelDepth },
    pixelRatio,
    viewport: { width, height },
    touchSupport: { maxTouchPoints, touchEvent, touchPoints },
    connection: { effectiveType, downlink, rtt, saveData },
    webgl: { vendor, renderer },
    hardwareConcurrency,
    deviceMemory,
    platform,
    timezone: { timezone, offset },
    language, languages,
    cookieEnabled,
    doNotTrack,
    features: {
        webWorker, serviceWorker, webCrypto,
        localStorage, sessionStorage, indexedDB,
        webGL, webGL2, webp
    },
    timestamp,
    canvasHash,   // Canvas fingerprint
    webglHash,    // WebGL fingerprint
    beh: {...},   // Behavior data (mouse movements etc.)
    adb: {...},   // Ad blocker tespiti
    nai: {...},   // Navigator integrity
    jsd: {...},   // JS debugger tespiti
    ccr: {...}    // Chrome runtime kontrolleri
}
```

---

## 7. Hata Yönetimi

| Hata Kodu | Mesaj | Açıklama |
|-----------|-------|----------|
| `timeout` | "Request timed out" | PoW veya API timeout |
| `network` | "Connection failed" | Ağ hatası |
| `server` | "Server unavailable" | 5xx HTTP |
| `notfound` | "Service not found" | 404 |
| `invalid` | "Invalid response" | Response format yanlış |
| `auth` | "Access denied" / "Too many requests" | Rate limit |
| `ratelimit` | "Too many requests. Please try again later" | 429 |
| `rejected` | "Request failed" | Generic |
| `config` | "Parent bridge not configured" | Widget yanlış init |
| `verification` | "Missing result token" | Token yok |
| `solution` | debugger detected? | Özel durum |

---

## 8. Güvenlik Gözlemleri

1. **Anti-debug Worker**: Bir Worker thread'de `debugger` statement timing'i ölçülüyor. DevTools açıksa e1/e2/e3 değerleri yüksek çıkacak ve challenge başarısız olabilir.

2. **Proxy Fetch**: Widget kendi fetch yapmak yerine parent frame'den proxy request yapıyor (`PROXY_FETCH_REQUEST` → parent → `PROXY_FETCH_RESPONSE`). Bu iframe'in network erişimini sınırlandıran CSP'leri bypass etmek için.

3. **MessagePack şifreli iletişim**: Challenge ve verify API'leri JSON değil, MessagePack + ChaCha20 kullanıyor. Plain-text sniffing'i zorlaştırıyor.

4. **Timing attack**: Server `took` değerini doğruluyor. Çok hızlı çözüm (bot) veya çok yavaş (fake delay) tespit ediliyor. `_simSolveTime` ile bilinen cihaz profilleri karşılaştırması yapılıyor.

5. **Origin validation**: `parentOrigin` ile sadece beklenen origin'den mesaj kabul ediliyor.

6. **cdata validation**: `^[a-zA-Z0-9_-]{1,255}$` — strict regex.

7. **İlk 93 string'ler**: Hash/nonce gibi görünen bu string'ler muhtemelen build-time integrity token'ları veya lisans key'leri. Runtime'da karşılaştırılabilir.

---

## 9. Özet

`cntsw.js`, **patched.to** platformunun "Continental" adlı CAPTCHA/bot-detection sisteminin iframe widget kodudur.

**Ne yapar:**
- Kullanıcı etkileşimini (mouse, keyboard, touch) toplar
- Browser fingerprint'i çıkarır
- Headless/bot/debugger tespiti yapar
- Server'dan puzzle challenge alır (slide, rotate, gobang vb.)
- Proof-of-Work hesaplar
- Tüm veriyi MessagePack + ChaCha20 ile şifreli gönderir
- Sonucu parent frame'e postMessage ile iletir

**Kullanılan kütüphaneler (gömülü):**
- `@msgpack/msgpack` — binary serialization
- `@noble/hashes` (sha256/384/512, blake) — PoW hashing
- `@noble/ciphers` (chacha20-poly1305) — iletişim şifreleme

**Obfuscation yöntemi:**
- Custom base91 codec ile 1438 string encode edilmiş
- İki ayrı IIFE, iki ayrı alphabet kullanıyor
- Tüm property/method isimleri `e(N)` lookup ile gizlenmiş (4506 çağrı)
- Tek satır, minified
