const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

// 1. Add currentAnalyticsYear variable
if (!code.includes('let currentAnalyticsYear')) {
  code = code.replace(
    "let currentDashboardYear = 'all';",
    "let currentDashboardYear = 'all';\r\nlet currentAnalyticsYear = 'all'; // 'all', '2026', '2025', '2024'"
  );
}

// 2. Add setAnalyticsYear and renderAnalyticsYearlyTrendChart before renderAnalyticsDeepDive
const helperFunctions = `
// 3-2. 구간별 심층분석 연도 전환
function setAnalyticsYear(year) {
  currentAnalyticsYear = year;
  document.querySelectorAll('.analytics-year-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-white', 'text-[#1543a3]', 'shadow-xs', 'font-bold');
    btn.classList.add('text-[#495057]', 'font-medium');
  });
  const activeBtn = document.getElementById(\`btn-ana-year-\${year}\`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-white', 'text-[#1543a3]', 'shadow-xs', 'font-bold');
    activeBtn.classList.remove('text-[#495057]', 'font-medium');
  }
  const badge = document.getElementById('analytics-scope-badge');
  if (badge) {
    if (year === 'all') badge.innerText = '3개년 종합 (2024~2026년 355건 / 466.1억 원)';
    else if (year === '2026') badge.innerText = '2026년 실측 (92건 / 130.6억 원)';
    else if (year === '2025') badge.innerText = '2025년 실측 (136건 / 174.0억 원)';
    else if (year === '2024') badge.innerText = '2024년 실측 (127건 / 161.5억 원)';
  }
  renderAnalyticsDeepDive();
}

function renderAnalyticsYearlyTrendChart() {
  const ctx = document.getElementById('chart-analytics-yearly-trend')?.getContext('2d');
  if (!ctx || !analyticsData || !analyticsData.yearly) return;

  if (chartInstances['anaYearlyTrend']) chartInstances['anaYearlyTrend'].destroy();

  const years = ['2024', '2025', '2026'];
  const counts = years.map(yr => {
    const item = analyticsData.yearly.find(y => String(y.year) === yr);
    return item ? item.under500Count : 0;
  });
  const budgets = years.map(yr => {
    const item = analyticsData.yearly.find(y => String(y.year) === yr);
    return item ? Number((item.under500Budget / 100000000).toFixed(1)) : 0;
  });

  chartInstances['anaYearlyTrend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['2024년', '2025년', '2026년'],
      datasets: [
        {
          type: 'line',
          label: '5억 미만 합산 예산 (억원)',
          data: budgets,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 3,
          tension: 0.2,
          yAxisID: 'y1',
          pointRadius: 6,
          pointBackgroundColor: '#10b981'
        },
        {
          type: 'bar',
          label: '5억 미만 공고 건수 (건)',
          data: counts,
          backgroundColor: '#1543a3',
          borderRadius: 6,
          yAxisID: 'y',
          maxBarThickness: 50
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.dataset.type === 'line' ? \` 총 예산: \${ctx.parsed.y} 억 원\` : \` 공고 건수: \${ctx.parsed.y} 건\`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          title: { display: true, text: '건수 (건)', font: { size: 10 } },
          grid: { color: '#f1f5f9' },
          beginAtZero: true
        },
        y1: {
          position: 'right',
          title: { display: true, text: '예산 (억원)', font: { size: 10 } },
          grid: { drawOnChartArea: false },
          beginAtZero: true
        }
      }
    }
  });
}
`;

// Insert helperFunctions right before renderAnalyticsDeepDive
code = code.replace(
  '// 4. 구간별 심층 분석 페이지 차트 렌더링 (Deep Dive)',
  helperFunctions.trim() + '\r\n\r\n// 4. 구간별 심층 분석 페이지 차트 렌더링 (Deep Dive)'
);

// 3. Update renderAnalyticsDeepDive to support curScope and curData
const oldRenderAnalytics = `function renderAnalyticsDeepDive() {
  if (!analyticsData || !analyticsData.under500M) return;

  const u = analyticsData.under500M;
  const buckets = u.buckets || [];`;

const newRenderAnalytics = `function renderAnalyticsDeepDive() {
  if (!analyticsData) return;
  const curScope = currentAnalyticsYear || 'all';
  const curData = (analyticsData.byYear && analyticsData.byYear[curScope]) ? analyticsData.byYear[curScope] : analyticsData;
  const u = curData.under500M || analyticsData.under500M;
  if (!u) return;
  const buckets = u.buckets || [];

  // 0) 3개년 연도별 추이 비교 차트 렌더링
  renderAnalyticsYearlyTrendChart();`;

code = code.replace(
  /function renderAnalyticsDeepDive\(\) \{[\s\S]*?const buckets = u\.buckets \|\| \[\];/,
  newRenderAnalytics.trim()
);

// Update orgTypes reference to curData.orgTypes
code = code.replace(
  'if (ctxOrg && analyticsData.orgTypes) {',
  'const orgs = curData.orgTypes || analyticsData.orgTypes || [];\r\n  if (ctxOrg && orgs.length > 0) {'
);
code = code.replace(
  'const orgs = analyticsData.orgTypes;',
  '// orgs already resolved'
);

// Update topThemes reference to curData.topThemes
code = code.replace(
  'if (themesCloud && analyticsData.topThemes) {',
  'const themesList = curData.topThemes || analyticsData.topThemes || [];\r\n  if (themesCloud && themesList.length > 0) {'
);
code = code.replace(
  'themesCloud.innerHTML = analyticsData.topThemes.map(th => `',
  'themesCloud.innerHTML = themesList.map(th => `'
);

// Update winnersList to prefer u.topWinners
code = code.replace(
  'const winnersList = analyticsData.under500M?.topWinners || analyticsData.winStats?.topWinners;',
  'const winnersList = u.topWinners || curData.winStats?.topWinners || analyticsData.under500M?.topWinners || [];'
);

fs.writeFileSync('public/app.js', code, 'utf-8');
console.log('✅ public/app.js successfully patched for multi-year deep dive!');
