# patched.revere

`challenge.patched.to` üzerinde çalışan **Continental CAPTCHA** widget'ının reverse engineering çalışması.

---

## Hedef

`patched.to` login sayfasında kullanılan Continental CAPTCHA sisteminin nasıl çalıştığını anlamak:
- `api.js` ve `cntsw.js` dosyalarının deobfuscation'ı
- `/api/c` (challenge al) ve `/api/q` (cevap doğrulat) endpoint'lerinin protokolünü çözmek
- Geçerli token üretebilmek

---

## Proje Yapısı

```
patched.revere/
│
├── target_files/          Ham hedef dosyalar
│   ├── api.js.downloaded      İndirilen api.js (obfuscated)
│   ├── cntsw.js               iframe içinde çalışan widget kodu (~170KB, tek satır)
│   ├── challenge.html         Test için lokal widget HTML sayfası
│   └── pasted-text (1).txt    Ham notlar / yapıştırılan içerik
│
├── fetch_and_extract/     Dosya çekme ve ilk parse işlemleri
│   ├── fetch_apijs.js         api.js'i challenge.patched.to'dan HTTPS ile indirir
│   ├── intercept_apijs.js     api.js içindeki b(N) çağrılarını decode edip iframe URL'lerini bulur
│   ├── read_apijs.js          api.js içindeki string'leri, fonksiyon yapısını ve URL'leri listeler
│   ├── extract2.js            cntsw.js içindeki d[] array'inin kaç eleman içerdiğini bulur
│   ├── parse2.js              d[] array'ini karakter bazlı parse eder ve decode eder
│   └── parse3.js              cntsw.js'e __msgDecode hook'u enjekte ederek mesaj akışını yakalar
│
├── decode_and_deobf/      String decode ve deobfuscation katmanı
│   ├── decode.js              cntsw.js IIFE-1 (alpha1) ile tüm d[] string'lerini decode eder
│   ├── decode2.js             IIFE-2 (alpha2, ";)8w..." başlıyor) ile KDF-related string'leri decode eder
│   ├── decoder.js             cntsw.js'i eval ile sandbox'ta çalıştırır, e(N) fonksiyonunu hook'lar
│   ├── decode_api.js          api.js d[] array'ini OUTER_ALPHA ile decode eder, alan isimlerini bulur
│   ├── decode_apijs_full.js   api.js'i tamamen decode eder; sitekey, /api/c bağlamını çıkarır
│   ├── decode_both.js         İki farklı alpha (alpha1/alpha2) ile decode karşılaştırması yapar
│   ├── decode_iframe_url.js   api.js'deki iframe src oluşturan b(N) çağrılarını decode eder
│   ├── decode_inner_iifes.js  api.js içindeki çoklu IIFE decoder'larını (alpha'ları) keşfeder
│   ├── run_decode.js          cntsw.js d[] array'ini eval + wrapper ile decode eder
│   └── cntsw_deobf.js         cntsw.js'in tamamen açıklamalı / deobfuscated versiyonu
│
├── find_and_analyze/      Spesifik değerleri ve yapıları bulma
│   ├── findkey.js             decoded_strings.json içinde siteKey/sk alanlarını arar
│   ├── findkey2.js            both_decoded.json içinde alpha2 ile siteKey varyasyonlarını arar
│   ├── find_apic_call.js      cntsw.js IIFE-2 içindeki p() fonksiyonunu ve /api/c çağrısını bulur
│   ├── find_init_endpoint.js  API endpoint'lerini probe eder; cntsw.js decoded string'lerden path çıkarır
│   ├── find_m_in_iife2.js     IIFE-2 scope'unda msgpack m() fonksiyonunu lokalize eder
│   ├── find_n_func.js         api.js'deki N() = render() fonksiyonunu decode edilmiş b(N) ile gösterir
│   ├── find_render.js         cntsw.js içinde render akışının başladığı p tanımlarını bulur
│   ├── find_sitekey.js        patched.to sayfalarını tarayarak sitekey'i doğrudan HTML'de arar
│   ├── find_type_map.js       challenge type → sayısal değer mapping'ini ve G objesini analiz eder
│   └── sitkey.php             sitekey extraction için PHP yardımcı scripti
│
├── test_and_validate/     /api/c ve /api/q endpoint testleri
│   ├── test_api.js            test-sitekey ile ilk /api/c POST denemesi (msgpack)
│   ├── test_api2.js           Farklı siteKey formatlarını karşılaştırmalı test eder
│   ├── test_api3.js           URL hash'i ve fingerprint ile /api/c denemesi
│   ├── test_continental_path.js  Continental path varyasyonlarını test eder
│   ├── test_fresh.js          Temiz session ile /api/c denemesi
│   ├── test_hashkey.js        BLAKE2b tabanlı KDF (key derivation) varyantlarını test eder; XChaCha20 ile response decrypt dener
│   ├── test_real.js           Gerçek siteKey (MCow...) ile /api/c denemesi
│   └── test_real2.js          Gerçek siteKey + cdata + challengeType kombinasyonlarını test eder
│
├── output_and_results/    Decode çıktıları ve analiz sonuçları
│   ├── decoded_strings.json   cntsw.js IIFE-1 alpha ile decode edilmiş tüm d[] string'leri
│   ├── both_decoded.json      alpha1 ve alpha2 karşılaştırmalı decode sonuçları
│   ├── strings_full.json      Tüm d[] string'leri (ham + decode edilmiş)
│   ├── api_readable.js        api.js içindeki b(N) çağrıları decode edilmiş string'lerle değiştirilmiş
│   └── api_all_decoded.txt    api.js d[] array'inin tüm index → decoded string listesi
│
├── widget_and_token/      Widget çalıştırma ve token üretimi
│   ├── debug_widget.js        Puppeteer ile lokal server üzerinde gerçek widget'ı headless çalıştırır; postMessage akışını ve /api/* trafiğini loglar
│   ├── get_widget_cookie.js   Widget iframe URL'ini GET ederek session cookie almayı dener; /api/c payload varyasyonlarını test eder
│   ├── iframe_approach.js     api.js'deki decoded string'lerden iframe URL'ini bulur; /s/<hash>/ path'lerini probe eder
│   └── token_generator.js     Token üretim implementasyonu
│
└── reports/               Notlar ve raporlar
    ├── DEOBF_RAPOR.md         Deobfuscation bulguları raporu
    └── hata raporu.txt        Hata notları
```

---

## Teknik Bulgular

### Obfuscation Yapısı

**api.js** (outer IIFE):
- `OUTER_ALPHA = }>J2Nt.^m7IH]...` ile base91 encode edilmiş d[] string tablosu
- `b(N)` → `d[N]`'i decode eder
- `render()` fonksiyonu bir `<iframe>` oluşturur; `src` base URL + siteKey hash + query parametreleri

**cntsw.js** (iframe içindeki widget):
- İki katmanlı obfuscation: IIFE-1 (alpha1) ve IIFE-2 (alpha2 = `;)8w...`)
- `e(N)` → d[N]'i decode eder (4506 kullanım, 1438 string)
- Gömülü kütüphaneler: `@msgpack/msgpack`, `@noble/hashes`, `@noble/ciphers`

### Protokol

```
parent page
    └─► window.continental.render(siteKey, container, options)
            │
            └─► <iframe src="https://challenge.patched.to/c/<hash>?widgetId=...">
                    │  (postMessage bridge)
                    ├─► CONFIG  → widget başlatma
                    ├─► EXECUTE → verification başlat
                    │
                    ├─── POST /api/c (msgpack + ChaCha20)  ← challenge al
                    │    payload: { sitekey, widgetId, cdata, beh, ... }
                    │
                    └─── POST /api/q (msgpack)              ← cevap doğrulat
                         response: { token }
                              │
                              └─► postMessage VERIFIED { token }
```

### API

| Endpoint | Method | Encoding | Açıklama |
|----------|--------|----------|----------|
| `/api/c` | POST | MessagePack + XChaCha20 | Challenge al |
| `/api/q` | POST | MessagePack | Cevap gönder, token al |

**`/api/c` payload alanları:**
```json
{
  "sitekey": "MCowBQYDK2VwAyEA...",
  "widgetId": "w-xxxxxxxx",
  "cdata": "...",
  "beh": { /* BehaviorCollector.snapshot() */ },
  "ts": 1234567890
}
```

**Challenge tipleri:** `slide`, `rotate`, `icon`, `swap`, `emoji_swap`, `shortest_line`, `x_marker`, `height_match`, `line_break`, `gobang`

### Key Derivation

`/api/c` response'u XChaCha20-Poly1305 ile şifreli gelir.
Key türetme: `BLAKE2b(key=siteKey, data=url+userAgent, dkLen=64)` → 64 byte → `[32..64]` response key olarak kullanılır.

### Bot Detection

- `BehaviorCollector`: mouse path, click isTrusted, coalesced events, edge margin analizi
- Debugger timing testi (Web Worker içinde `performance.now()` + `debugger`)
- Canvas/WebGL fingerprint, navigator.webdriver, headless UA tespiti
- `simulateDevice` modu: bilinen cihaz profillerine göre PoW çözme süresi simülasyonu

---

## Kullanılan Sitekey

```
MCowBQYDK2VwAyEAh9U4pnLe55svXLJExCzVwVA0fE0m82tgyfYbz6Sm0ec
```
(patched.to/member.php?action=login sayfasından alındı)

---

## Kurulum

```bash
npm install
```

Gerekli paketler: `puppeteer`, `@noble/hashes`, `@noble/ciphers`

---

## Çalıştırma Sırası

```bash
# 1. api.js'i indir
node fetch_and_extract/fetch_apijs.js

# 2. String tablosunu decode et
node decode_and_deobf/decode_apijs_full.js

# 3. Endpoint analizi
node find_and_analyze/find_init_endpoint.js

# 4. /api/c testleri
node test_and_validate/test_real.js

# 5. Gerçek widget ile test (puppeteer gerekli)
node widget_and_token/debug_widget.js
```
