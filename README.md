# [REVERSE] Continental CAPTCHA (patched.to) - Reverse Engineering & Token Generator Projesi

Selamlar CheatGlobal ailesi,

Bu projede `patched.to` login ve challenge ekranında kullanılan **Continental CAPTCHA** widget'ının kaynak kodları, şifreleme algoritmaları ve parent-iframe iletişim protokolü tamamen tersine mühendislik (reverse engineering) uygulanarak deobfuscate edilmiş ve incelenmiştir.

Projeyi açık kaynak olarak toplulukla paylaşıyorum; ilgilenen ve geliştirmek isteyen arkadaşlar inceleyebilir, solver kısmını tamamlayıp token üretebilir.

---

## 📌 Proje Şu Anda Ne Yapıyor?

1. **Tam Deobfuscation:**
   - `api.js` ve `cntsw.js` (widget iframe'i) dosyalarındaki custom base91 şifreli string tabloları ve çift katmanlı IIFE yapısı çözüldü (`STRINGS` tablosu tamamen döküldü).
   - Proje içindeki `cntsw_deobf.js` dosyasında widget mantığı satır satır okunabilir hale getirildi.

2. **Protokol & API Çözümü:**
   - Parent sayfa ile iframe arasındaki `postMessage` mimarisi çözüldü (`CONFIG`, `READY`, `EXECUTE`, `PROXY_FETCH_REQUEST`, `PROXY_FETCH_RESPONSE` vb.).
   - `/api/c` (Challenge alma) ve `/api/q` (Cevap doğrulama / Token alma) endpoint'lerinin MessagePack ve XChaCha20-Poly1305 tabanlı iletişim akışı ortaya çıkarıldı.
   - `token_generator.js` içinde yerel bir HTTP sunucu açılarak origin kontrolü patch'lenmiş widget ayağa kaldırılıyor ve Puppeteer ile login token'ları (`my_post_key`, `_csrf-token`, `sitekey`, `cdata`, `challengeType`) dinamik olarak çekiliyor.

---

## ⚠️ Şu An Neden Token Üretmiyor? (Eksik / Çalışmayan Kısım)

Script şu an çalıştırıldığında `/api/c` endpoint'inden challenge'ı çekip akışı başlatabilse de **geçerli bir `continental-response` token'ı üretemiyor**. Bunun temel sebepleri:

1. **Puzzle / Challenge Çözücüsü (Solver) Yok:**
   - Sistem `rotate`, `slide`, `x_marker`, `height_match`, `swap`, `shortest_line`, `gobang` gibi görsel bulmacalar sunuyor.
   - Mevcut kodda puzzle görseli analiz edilmiyor; bunun yerine dummy/sabit koordinat ve açılar (örneğin `angle: 0`, `x: 0.5, y: 0.5`) gönderiliyor. Sunucu da cevabı reddediyor (`CHALLENGE_FAILED`).

2. **Gelişmiş Bot & Davranış Tespiti (BehaviorCollector):**
   - `cntsw.js` içerisinde çok katı anti-bot kontrolleri var:
     - Fare hareket analizi (doğrusallık oranı, hız, pencere kenarından giriş kontrolü `_movesFromEdge`).
     - Sentetik `isTrusted` click kontrolleri.
     - Web Worker içinde `debugger` timing gecikme testi (otomasyon araçlarını yakalamak için).
     - Canvas & WebGL donanım fingerprint'leri.
   - Standart Puppeteer/headless tarayıcılar sunucu tarafından flagleniyor.

3. **Rate Limit / 5 Dakika Cooldown:**
   - 2-3 yanlış veya bot benzeri denemeden sonra IP adresine 5 dakikalık geçici blokaj (cooldown) atılıyor.

---

## 🛠️ Token Üretmesi İçin Neler Gerekiyor?

Projeyi çalışan tam otomatik bir Token Generator'a dönüştürmek isteyenlerin eklemesi gerekenler:

1. **Görsel İşleme / AI Solver (En Önemlisi):**
   - Gelen bulmaca tipine göre OpenCV, Canvas piksel analizi veya küçük bir CNN/YOLO modeliyle doğru cevabın bulunması:
     - *Rotate:* Görselin doğru açısını tespit etme.
     - *Slide:* Puzzle parçasının oturacağı boşluğun X koordinatını bulma.
     - *Height Match / Shortest Line / X Marker:* Hedef koordinatları tespit etme.
2. **Doğal Fare & İnsan Davranışı Simülasyonu:**
   - Farenin widget'a dışarıdan girmesi, Bezier eğrileriyle doğal hareket ve gerçekçi tıklama süresi (3-6 saniye insan düşünme payı) eklenmesi.
   - Tıklamaların CDP (Chrome DevTools Protocol) seviyesinde donanım event'i gibi gönderilmesi.
3. **Anti-Detect / Stealth:**
   - Puppeteer yerine `puppeteer-extra-plugin-stealth` veya patch'li undetected tarayıcı profili kullanılması; Web Worker timing ve webdriver sızıntılarının kapatılması.
4. **Proxy Desteği:**
   - Rate limit'e takılmamak için her istekte konut tipi (residential) proxy rotasyonu.
5. **(İsteğe Bağlı) Pure-HTTP Çözüm:**
   - Tarayıcıyı tamamen devreden çıkarıp; KDF (BLAKE2b) + XChaCha20 + MsgPack + PoW (Proof of Work) işlemlerini doğrudan Node.js/Python ile çalıştırarak milisaniyeler içinde token almak.

---

## 📂 Dosya Yapısı

- `decode_and_deobf/cntsw_deobf.js`: Deobfuscate edilmiş, açıklamalı tam widget kaynak kodu.
- `output_and_results/decoded_strings.json`: Çözülen 1400+ şifreli string listesi.
- `token_generator.js`: Local bridge, patch enjeksiyonu ve Puppeteer token akışı.
- `test_and_validate/`: `/api/c` ve KDF test scriptleri.
