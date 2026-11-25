const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

// 1. Patch matchBox in card view
const oldMatchBox = `  const matchBox = (p.isLiveNotice && p.crossMatch && p.crossMatch.matched && p.crossMatch.recommendedBid)
    ? \`<div class="mt-2 p-2 bg-indigo-50 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 leading-snug">
        <span class="font-bold">전년도 수주:</span> \${p.crossMatch.incumbentCompany} 
        <span class="text-emerald-700 font-bold ml-1">(실측 추천 \${formatMoney(p.crossMatch.recommendedBid)})</span>
      </div>\`
    : (p.isLiveNotice && p.crossMatch && !p.crossMatch.matched)
    ? \`<div class="mt-2 p-2 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 leading-snug">
        <span class="font-bold">신규 진입 기회:</span> 기존 고착 사업자 없음 (과거 이력 무)
      </div>\`
    : '';`;

// Normalize newlines for search and replace
const newMatchBox = `  const matchBox = (p.isLiveNotice && p.crossMatch && p.crossMatch.matched)
    ? \`<div class="mt-2 p-2 bg-indigo-50 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 leading-snug">
        <span class="font-bold">전년도 수주:</span> \${p.crossMatch.incumbentCompany} 
        \${p.crossMatch.recommendedBid ? \`<span class="text-emerald-700 font-bold ml-1">(실측 추천 \${formatMoney(p.crossMatch.recommendedBid)})</span>\` : ''}
      </div>\`
    : (p.isLiveNotice && p.crossMatch && !p.crossMatch.matched)
    ? \`<div class="mt-2 p-2 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 leading-snug">
        <span class="font-bold">신규 진입 기회:</span> 기존 고착 사업자 없음 (과거 이력 무)
      </div>\`
    : '';`;

// Replace matchBox regex
code = code.replace(
  /const matchBox = \(p\.isLiveNotice && p\.crossMatch && p\.crossMatch\.matched && p\.crossMatch\.recommendedBid\)[\s\S]*?: '';/,
  newMatchBox.trim()
);

// 2. Patch modal cross analysis
const targetModalOld = /if \(cm\.matched && cm\.recommendedBid && cm\.avgBidRate\) \{[\s\S]*?recRateEl\.innerText = '\(과거 투찰 데이터 없음\)';\s*\}/;

const newModalCode = `    const incumbentEl = document.getElementById('modal-cross-incumbent');
    if (cm.matched && cm.incumbentCompany && cm.incumbentCompany !== '기존 고착 사업자 없음 (신규 기회)') {
      incumbentEl.innerText = cm.incumbentCompany;
      incumbentEl.className = 'text-slate-900 font-extrabold text-xs sm:text-sm';
    } else {
      incumbentEl.innerText = '기존 고착 사업자 없음 (신규 기회)';
      incumbentEl.className = 'text-blue-700 font-bold text-xs sm:text-sm';
    }

    if (cm.matched && cm.recommendedBid && cm.avgBidRate) {
      recPriceEl.innerText = formatMoney(cm.recommendedBid);
      recPriceEl.className = 'text-emerald-700 font-bold text-xs sm:text-sm';
      recRateEl.innerText = \`(실측 \${cm.rateType || '낙찰률'} \${cm.avgBidRate}%)\`;
    } else if (cm.matched) {
      recPriceEl.innerText = '협상계약 (원가/과업 기준 산정)';
      recPriceEl.className = 'text-slate-600 font-semibold text-xs';
      recRateEl.innerText = '(과거 수주 이력 참조)';
    } else {
      // 기존 고착 사업자나 과거 실적이 없는 경우 가짜 데이터 완전 배제
      recPriceEl.innerText = '해당 없음 (신규 사업)';
      recPriceEl.className = 'text-slate-500 font-semibold text-xs';
      recRateEl.innerText = '(과거 투찰 데이터 없음)';
    }`;

code = code.replace(targetModalOld, newModalCode);

fs.writeFileSync('public/app.js', code, 'utf-8');
console.log('✅ public/app.js patched successfully');
