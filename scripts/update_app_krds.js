const fs = require('fs');

let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Remove all emoji characters directly using regex
// Replace specific emoji contexts with clean Korean government text
code = code.replace(/⏰ \$\{p\.ddayText\}/g, '${p.ddayText}');
code = code.replace(/⚡ \$\{p\.ddayText\}/g, '${p.ddayText}');
code = code.replace(/💡 \$\{p\.crossMatch/g, '전년: ${p.crossMatch');
code = code.replace(/💡 전년도 수주:/g, '전년도 수주:');
code = code.replace(/✨ 신규 진입 기회:/g, '신규 진입 기회:');

code = code.replace(/🏆 실제 개찰 낙찰 확인/g, '실제 개찰 낙찰');
code = code.replace(/📢 2027년도 조기발주 입찰접수 중/g, '2027년도 조기발주 접수중');
code = code.replace(/🎯 사업자 교체/g, '사업자 교체');
code = code.replace(/📈 전년대비 증액/g, '전년대비 증액');
code = code.replace(/📉 전년대비 감액/g, '전년대비 감액');
code = code.replace(/🔄 연례 계속사업/g, '연례 계속사업');
code = code.replace(/2024 ➡️ 2025 ➡️ 2026/g, '2024 ~ 2026');
code = code.replace(/<span class="text-amber-600 font-bold text-sm shrink-0">💡<\/span>/g, '');
code = code.replace(/💡/g, '');
code = code.replace(/📈/g, '');
code = code.replace(/📉/g, '');
code = code.replace(/🎯/g, '');
code = code.replace(/🏆/g, '');
code = code.replace(/📢/g, '');
code = code.replace(/🔄/g, '');
code = code.replace(/⚡/g, '');
code = code.replace(/⏰/g, '');
code = code.replace(/⭐/g, '');
code = code.replace(/✨/g, '');
code = code.replace(/📋/g, '');
code = code.replace(/📥/g, '');
code = code.replace(/✅/g, '');
code = code.replace(/❌/g, '');
code = code.replace(/🔒/g, '');
code = code.replace(/🤝/g, '');
code = code.replace(/🔀/g, '');
code = code.replace(/🏛️/g, '');
code = code.replace(/📝/g, '');
code = code.replace(/🏢/g, '');
code = code.replace(/🏷️/g, '');
code = code.replace(/✓ /g, '');

// Clean any double spaces caused by emoji removal
code = code.replace(/  +/g, ' ');

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Finished updating public/app.js - all emojis purged.');
