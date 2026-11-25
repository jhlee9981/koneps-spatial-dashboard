const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

const start = code.indexOf('// 6) 수주 기업 현황 테이블');
const end = code.indexOf('function searchTheme');

if (start === -1 || end === -1) {
  console.error('Boundaries not found!', { start, end });
  process.exit(1);
}

const replacement = `// 6) 수주 기업 현황 테이블 (5억 미만 중점 분석)
  const winTbody = document.getElementById('analytics-winners-body');
  const winnersList = analyticsData.under500M?.topWinners || analyticsData.winStats?.topWinners;
  if (winTbody && winnersList) {
    winTbody.innerHTML = winnersList.map((w, idx) => {
      const underCount = w.under500Count !== undefined ? w.under500Count : w.count;
      const underAmount = w.under500TotalWon !== undefined ? w.under500TotalWon : w.totalWon;
      const hasOtherTiers = w.count && w.count > underCount;
      return \`
        <tr class="hover:bg-amber-50/30 transition-colors">
          <td class="py-2.5 px-3 font-semibold text-slate-400 font-mono">\${idx + 1}</td>
          <td class="py-2.5 px-3 font-bold text-slate-800">\${w.winner}</td>
          <td class="py-2.5 px-3 text-center text-slate-700 font-semibold">\${underCount} 건</td>
          <td class="py-2.5 px-3 text-right">
            <span class="font-extrabold text-amber-700">\${formatMoney(underAmount)}</span>
            \${hasOtherTiers ? \`<span class="block text-[10px] text-slate-400 font-normal">(전체 합계: \${w.count}건 / \${formatMoney(w.totalWon)})</span>\` : ''}
          </td>
        </tr>
      \`;
    }).join('');
  }
}

`;

code = code.substring(0, start) + replacement + code.substring(end);
fs.writeFileSync('public/app.js', code, 'utf-8');
console.log('✅ Successfully replaced winners section in public/app.js');
