const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\wdawdawsdawd\\Desktop\\patched.tochecker\\cntsw.js', 'utf8');

// Gerçek decode fonksiyonunu ve d array'ini tam olarak çıkart
// ki kez var c={},d=[ geçiyor mu?
const allMatches = [...content.matchAll(/var c=\{\},d=\[/g)];
console.log('var c={},d=[ occurrences:', allMatches.length);
allMatches.forEach((m, i) => console.log(` match ${i}: pos ${m.index}`));

// Her oluşumda kaç element var?
allMatches.forEach((m, i) => {
    const snippet = content.substring(m.index, m.index + 100);
    console.log(`snippet ${i}:`, snippet.substring(0, 80));
});
