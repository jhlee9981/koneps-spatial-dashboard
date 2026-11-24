/**
 * 2026 나라장터 공간정보 사업 [5억 미만 중점] 분석 스크립트
 */

// 전역 상태
let allProjects = [];
let analyticsData = null;
let recurringData = null;
let recurringFilteredFamilies = [];
let currentRecurringQuickFilter = 'all';
let serverInfo = { primaryIp: 'localhost', port: 3000 };
let currentTab = 'dashboard';
let currentFilters = {
  q: '',
  category: '전체',
  budgetRange: '5억 미만', // 기본값 5억 미만 중점
  sort: 'date_desc',
  bookmarkOnly: false
};
let pagination = {
  page: 1,
  limit: 15
};
let viewMode = window.innerWidth < 768 ? 'card' : 'table';
let bookmarks = new Set(JSON.parse(localStorage.getItem('koneps_spatial_bookmarks') || '[]'));
let selectedProject = null;
let projectViewSource = 'live'; // 'live', 'past', 'all'
let liveBidsData = [];
let currentLiveQuickFilter = 'all';

// Chart.js 인스턴스 보관
const chartInstances = {};

// 금액 포맷터
function formatMoney(amount) {
  if (!amount || isNaN(amount)) return '0원';
  const val = Number(amount);
  if (val >= 100000000) {
    const eok = Math.floor(val / 100000000);
    const man = Math.round((val % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만 원` : `${eok}억 원`;
  } else if (val >= 10000) {
    const man = Math.round(val / 10000).toLocaleString();
    return `${man}만 원`;
  }
  return `${val.toLocaleString()}원`;
}

function formatRawWon(amount) {
  if (!amount || isNaN(amount)) return '0 원';
  return `${Number(amount).toLocaleString()} 원`;
}

// 예산 구간 태그 뱃지 계산
function getBudgetTier(budget) {
  const b = Number(budget) || 0;
  if (b < 50000000) return { label: '5천만 미만', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (b < 100000000) return { label: '5천만~1억', color: 'bg-teal-100 text-teal-800 border-teal-300' };
  if (b < 300000000) return { label: '1억~3억', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  if (b < 500000000) return { label: '3억~5억', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: '5억 이상', color: 'bg-purple-100 text-purple-800 border-purple-300' };
}

const CATEGORY_COLORS = {
  '시스템/SW구축': { bg: 'bg-blue-100', text: 'text-blue-700', hex: '#3b82f6' },
  'DB/데이터구축': { bg: 'bg-emerald-100', text: 'text-emerald-700', hex: '#10b981' },
  '디지털트윈/융합': { bg: 'bg-purple-100', text: 'text-purple-700', hex: '#8b5cf6' },
  '유지보수/운영': { bg: 'bg-amber-100', text: 'text-amber-700', hex: '#f59e0b' },
  '기획/연구/ISP': { bg: 'bg-slate-100', text: 'text-slate-700', hex: '#64748b' },
  '기타': { bg: 'bg-gray-100', text: 'text-gray-700', hex: '#9ca3af' }
};

// 1. 초기 데이터 로드
async function initApp() {
  try {
    const infoRes = await fetch('/api/info');
    if (infoRes.ok) serverInfo = await infoRes.json();

    const projRes = await fetch('/api/projects?limit=1000');
    if (projRes.ok) {
      const pData = await projRes.json();
      allProjects = pData.data || [];
    }

    const anaRes = await fetch('/api/analytics');
    if (anaRes.ok) {
      const aData = await anaRes.json();
      analyticsData = aData.data || null;
    }

    // 3개년 계속사업 데이터 병렬 로드
    fetch('/api/recurring').then(r => r.json()).then(rData => {
      if (rData.success) {
        recurringData = rData;
        recurringFilteredFamilies = rData.data || [];
      }
    }).catch(err => console.error('계속사업 데이터 사전 로드 오류:', err));

    const badge = document.getElementById('badge-total-count');
    if (badge && analyticsData?.under500M) {
      badge.innerText = `5억미만 ${analyticsData.under500M.totalCount}건`;
    }

    await fetchLiveBids();
    renderDashboard();
    renderProjectsList();
    renderAnalyticsDeepDive();
    setViewMode(viewMode, false);

  } catch (err) {
    console.error('초기화 실패:', err);
  }
}

// 2. 탭 전환 (탭 노출 후 차트 리렌더링 보장)
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
    activeContent.classList.add('active');
  }

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active', 'bg-amber-600', 'text-white');
    btn.classList.add('text-slate-300');
  });
  const desktopBtn = document.getElementById(`desktop-tab-${tabId}`);
  if (desktopBtn) {
    desktopBtn.classList.add('active', 'bg-amber-600', 'text-white');
    desktopBtn.classList.remove('text-slate-300');
  }

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active', 'text-amber-600');
    btn.classList.add('text-slate-400');
  });
  const mobileBtn = document.getElementById(`mobile-tab-${tabId}`);
  if (mobileBtn) {
    mobileBtn.classList.add('active', 'text-amber-600');
    mobileBtn.classList.remove('text-slate-400');
  }

  // 탭 전환 시 화면 크기가 잡힌 후 차트를 확실하게 새로 그리기
  setTimeout(() => {
    if (tabId === 'analytics') {
      renderAnalyticsDeepDive();
    } else if (tabId === 'dashboard') {
      renderDashboard();
    } else if (tabId === 'recurring') {
      renderRecurringPage();
    }
  }, 60);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 3. 5억 미만 중점 대시보드 렌더링
function renderDashboard() {
  if (!analyticsData || !analyticsData.under500M) return;
  const u = analyticsData.under500M;
  const s = analyticsData.summary;

  document.getElementById('kpi-under500-count').innerText = u.totalCount.toLocaleString();
  document.getElementById('kpi-under500-ratio').innerText = `전체 ${s.totalCount}건 중 ${u.countRatio}% 점유`;
  document.getElementById('kpi-under500-budget').innerText = (u.totalBudget / 100000000).toFixed(1);
  document.getElementById('kpi-under500-raw-budget').innerText = `총 ${u.totalBudget.toLocaleString()} 원`;
  document.getElementById('kpi-under500-avg').innerText = (u.avgBudget / 100000000).toFixed(2);
  document.getElementById('kpi-under100-count').innerText = u.under100Count.toLocaleString();
  document.getElementById('kpi-under50-detail').innerText = `5천만 미만 초소액: ${u.under50Count}건`;

  renderUnder500BucketsCards(u.buckets);
  renderUnder500MonthlyChart();
  renderUnder500CategoriesChart(u.categories);
  renderUnder500TopAgenciesChart(u.topAgencies);
  renderUnder500ContractsChart(u.contractMethods);
  renderHighlightUnder500Projects();
}

function renderUnder500BucketsCards(buckets) {
  const container = document.getElementById('under500-buckets-grid');
  if (!container || !buckets) return;

  const bgStyles = [
    { border: 'border-emerald-200', bg: 'bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-800' },
    { border: 'border-teal-200', bg: 'bg-teal-50/50', badge: 'bg-teal-100 text-teal-800' },
    { border: 'border-blue-200', bg: 'bg-blue-50/50', badge: 'bg-blue-100 text-blue-800' },
    { border: 'border-amber-200', bg: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-800' }
  ];

  container.innerHTML = buckets.map((b, idx) => {
    const st = bgStyles[idx] || bgStyles[0];
    const avg = b.count > 0 ? (b.budget / b.count / 100000000).toFixed(2) : '0';
    return `
      <div onclick="filterBudgetRange('${b.label}')" class="p-4 rounded-xl border ${st.border} ${st.bg} hover:shadow-md transition-all cursor-pointer flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-0.5 text-xs font-bold rounded-md ${st.badge}">${b.label}</span>
            <span class="text-xs text-slate-400 font-medium">클릭 시 필터</span>
          </div>
          <div class="text-2xl font-extrabold text-slate-900 mb-1">${b.count} <span class="text-xs font-normal text-slate-500">건</span></div>
          <p class="text-xs text-slate-500 mb-2">${b.desc}</p>
        </div>
        <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <span class="text-slate-400">총 예산</span>
          <span class="font-bold text-slate-800">${(b.budget / 100000000).toFixed(1)}억 (평균 ${avg}억)</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderUnder500MonthlyChart() {
  const ctx = document.getElementById('chart-under500-monthly')?.getContext('2d');
  if (!ctx || !analyticsData.monthly) return;

  if (chartInstances['under500Monthly']) chartInstances['under500Monthly'].destroy();

  const labels = analyticsData.monthly.map(m => m.label);
  const counts = analyticsData.monthly.map(m => m.under500Count || 0);
  const budgets = analyticsData.monthly.map(m => ((m.under500Budget || 0) / 100000000).toFixed(1));

  chartInstances['under500Monthly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: '5억미만 예산(억원)',
          data: budgets,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 3,
          tension: 0.3,
          yAxisID: 'y1',
          pointRadius: 4
        },
        {
          type: 'bar',
          label: '5억미만 공고건수',
          data: counts,
          backgroundColor: '#f59e0b',
          borderRadius: 6,
          yAxisID: 'y',
          maxBarThickness: 32
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
            label: (ctx) => ctx.dataset.type === 'line' ? ` 예산: ${ctx.parsed.y} 억 원` : ` 건수: ${ctx.parsed.y} 건`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          title: { display: true, text: '건수', font: { size: 10 } },
          grid: { color: '#f1f5f9' },
          beginAtZero: true
        },
        y1: {
          position: 'right',
          title: { display: true, text: '억원', font: { size: 10 } },
          grid: { drawOnChartArea: false },
          beginAtZero: true
        }
      }
    }
  });
}

function renderUnder500CategoriesChart(cats) {
  const ctx = document.getElementById('chart-under500-categories')?.getContext('2d');
  if (!ctx || !cats) return;

  if (chartInstances['under500Cats']) chartInstances['under500Cats'].destroy();

  const labels = cats.map(c => c.category);
  const counts = cats.map(c => c.count);
  const bgColors = cats.map(c => CATEGORY_COLORS[c.category]?.hex || '#9ca3af');

  chartInstances['under500Cats'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}건 (${(cats[ctx.dataIndex].budget / 100000000).toFixed(1)}억원)`
          }
        }
      }
    }
  });

  const legendList = document.getElementById('under500-category-legend-list');
  if (legendList) {
    legendList.innerHTML = cats.map(c => `
      <div class="flex items-center justify-between p-1 rounded hover:bg-slate-50">
        <div class="flex items-center space-x-1 truncate">
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${CATEGORY_COLORS[c.category]?.hex || '#999'}"></span>
          <span class="truncate text-slate-700 font-medium">${c.category}</span>
        </div>
        <span class="text-slate-500 font-bold ml-1">${c.count}건</span>
      </div>
    `).join('');
  }
}

function renderUnder500TopAgenciesChart(agencies) {
  const ctx = document.getElementById('chart-under500-top-agencies')?.getContext('2d');
  if (!ctx || !agencies) return;

  if (chartInstances['under500Agencies']) chartInstances['under500Agencies'].destroy();

  const top = agencies.slice(0, 8);
  const labels = top.map(a => a.agency);
  const counts = top.map(a => a.count);

  chartInstances['under500Agencies'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        maxBarThickness: 18
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x} 건 발주 (예산 ${(top[ctx.dataIndex].budget / 100000000).toFixed(1)}억원)`
          }
        }
      },
      scales: {
        x: { grid: { color: '#f1f5f9' }, beginAtZero: true },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderUnder500ContractsChart(contracts) {
  const ctx = document.getElementById('chart-under500-contracts')?.getContext('2d');
  if (!ctx || !contracts) return;

  if (chartInstances['under500Contracts']) chartInstances['under500Contracts'].destroy();

  const labels = contracts.map(c => c.method);
  const counts = contracts.map(c => c.count);

  chartInstances['under500Contracts'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}건 (${contracts[ctx.dataIndex].ratio}%)`
          }
        }
      }
    }
  });
}

function renderHighlightUnder500Projects() {
  const container = document.getElementById('highlight-under500-grid');
  if (!container) return;

  const highlights = allProjects
    .filter(p => p.assignBdgtAmt >= 300000000 && p.assignBdgtAmt < 500000000)
    .slice(0, 3);

  container.innerHTML = highlights.map(p => {
    const tier = getBudgetTier(p.assignBdgtAmt);
    const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['기타'];
    return `
      <div onclick="openDetailModalById('${p.bidNtceNo}')" class="p-4 rounded-xl border border-amber-200/80 bg-amber-50/30 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${tier.color}">
              ${tier.label}
            </span>
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-md ${color.bg} ${color.text}">
              ${p.category}
            </span>
          </div>
          <h4 class="font-bold text-slate-800 text-sm mb-1.5 line-clamp-2 hover:text-amber-600 transition-colors">
            ${p.bidNtceNm}
          </h4>
          <p class="text-xs text-slate-500 mb-3">${p.dminsttNm || p.ntceInsttNm} · ${p.cntrctCnclsMthdNm}</p>
        </div>
        <div class="pt-2 border-t border-amber-200/50 flex items-center justify-between">
          <span class="text-xs text-slate-400">배정예산</span>
          <span class="text-sm font-extrabold text-amber-600">${formatMoney(p.assignBdgtAmt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// 4. 구간별 심층 분석 페이지 차트 렌더링 (Deep Dive)
function renderAnalyticsDeepDive() {
  if (!analyticsData || !analyticsData.under500M) return;

  const u = analyticsData.under500M;
  const buckets = u.buckets || [];

  // 1) 4대 구간별 종합 비교 차트 (chart-tier-comparison)
  const ctxTier = document.getElementById('chart-tier-comparison')?.getContext('2d');
  if (ctxTier && buckets.length > 0) {
    if (chartInstances['tierComp']) chartInstances['tierComp'].destroy();

    const labels = buckets.map(b => b.label);
    const counts = buckets.map(b => b.count);
    const budgets = buckets.map(b => ((b.budget || 0) / 100000000).toFixed(1));

    chartInstances['tierComp'] = new Chart(ctxTier, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: '합산 예산 (억원)',
            data: budgets,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            borderWidth: 3,
            tension: 0.3,
            yAxisID: 'y1',
            pointRadius: 5
          },
          {
            type: 'bar',
            label: '공고 건수 (건)',
            data: counts,
            backgroundColor: ['#6ee7b7', '#2dd4bf', '#60a5fa', '#f59e0b'],
            borderRadius: 8,
            yAxisID: 'y',
            maxBarThickness: 45
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
              label: (ctx) => ctx.dataset.type === 'line' ? ` 총 예산: ${ctx.parsed.y} 억 원` : ` 공고 건수: ${ctx.parsed.y} 건`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            position: 'left',
            title: { display: true, text: '건수', font: { size: 10 } },
            grid: { color: '#f1f5f9' },
            beginAtZero: true
          },
          y1: {
            position: 'right',
            title: { display: true, text: '억원', font: { size: 10 } },
            grid: { drawOnChartArea: false },
            beginAtZero: true
          }
        }
      }
    });
  }

  // 2) 5억 미만 계약 방식 차트 (chart-contract-methods)
  const ctxContract = document.getElementById('chart-contract-methods')?.getContext('2d');
  if (ctxContract && u.contractMethods) {
    if (chartInstances['deepContract']) chartInstances['deepContract'].destroy();

    const cms = u.contractMethods;
    const labels = cms.map(c => c.method);
    const counts = cms.map(c => c.count);

    chartInstances['deepContract'] = new Chart(ctxContract, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}건 (${cms[ctx.dataIndex].ratio}%)`
            }
          }
        }
      }
    });

    const cmList = document.getElementById('contract-methods-list');
    if (cmList) {
      cmList.innerHTML = cms.map(c => `
        <div class="flex justify-between py-1 border-b border-slate-50 text-xs">
          <span class="text-slate-600 font-medium">${c.method}</span>
          <span class="text-slate-900 font-bold">${c.count}건 (${c.ratio}%) · ${(c.budget / 100000000).toFixed(1)}억</span>
        </div>
      `).join('');
    }
  }

  // 3) 5억 미만 수요기관 분포 차트 (chart-org-types)
  const ctxOrg = document.getElementById('chart-org-types')?.getContext('2d');
  if (ctxOrg && analyticsData.orgTypes) {
    if (chartInstances['deepOrg']) chartInstances['deepOrg'].destroy();

    const orgs = analyticsData.orgTypes;
    chartInstances['deepOrg'] = new Chart(ctxOrg, {
      type: 'doughnut',
      data: {
        labels: orgs.map(o => o.orgType),
        datasets: [{
          data: orgs.map(o => o.count),
          backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#94a3b8'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed}건 (${(orgs[ctx.dataIndex].budget / 100000000).toFixed(1)}억원)`
            }
          }
        }
      }
    });

    const orgList = document.getElementById('org-types-list');
    if (orgList) {
      orgList.innerHTML = orgs.map(o => `
        <div class="flex justify-between py-1 border-b border-slate-50 text-xs">
          <span class="text-slate-600 font-medium">${o.orgType}</span>
          <span class="text-slate-800 font-bold">${o.count}건 (${(o.budget / 100000000).toFixed(1)}억원)</span>
        </div>
      `).join('');
    }
  }

  // 4) 5억 미만 최다 발주 지자체 순위 차트 (chart-analytics-agencies)
  const ctxAgencies = document.getElementById('chart-analytics-agencies')?.getContext('2d');
  if (ctxAgencies && u.topAgencies) {
    if (chartInstances['deepAgencies']) chartInstances['deepAgencies'].destroy();

    const top10 = u.topAgencies.slice(0, 10);
    const labels = top10.map(a => a.agency);
    const counts = top10.map(a => a.count);

    chartInstances['deepAgencies'] = new Chart(ctxAgencies, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: '#f59e0b',
          borderRadius: 6,
          maxBarThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x}건 발주 (총 예산 ${(top10[ctx.dataIndex].budget / 100000000).toFixed(1)}억 원)`
            }
          }
        },
        scales: {
          x: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { stepSize: 1 } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // 5) 빈출 키워드 클라우드
  const themesCloud = document.getElementById('themes-cloud-container');
  if (themesCloud && analyticsData.topThemes) {
    themesCloud.innerHTML = analyticsData.topThemes.map(th => `
      <button onclick="searchTheme('${th.theme}')" class="px-3 py-1.5 rounded-xl border border-slate-200/60 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-400 text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
        <span>#${th.theme}</span>
        <span class="text-[10px] bg-white px-1.5 py-0.2 rounded-full font-mono text-amber-700">${th.count}</span>
      </button>
    `).join('');
  }

  // 6) 수주 기업 현황 테이블
  const winTbody = document.getElementById('analytics-winners-body');
  if (winTbody && analyticsData.winStats?.topWinners) {
    winTbody.innerHTML = analyticsData.winStats.topWinners.map((w, idx) => `
      <tr class="hover:bg-amber-50/30 transition-colors">
        <td class="py-2.5 px-3 font-semibold text-slate-400 font-mono">${idx + 1}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${w.winner}</td>
        <td class="py-2.5 px-3 text-center text-slate-700 font-semibold">${w.under500Count || w.count} 건</td>
        <td class="py-2.5 px-3 text-right font-extrabold text-amber-700">${formatMoney(w.totalWon)}</td>
      </tr>
    `).join('');
  }
}

function searchTheme(theme) {
  switchTab('projects');
  if (searchInput) searchInput.value = theme;
  currentFilters.q = theme;
  document.getElementById('btn-clear-search')?.classList.remove('hidden');
  pagination.page = 1;
  renderProjectsList();
}

// 5. 사업 목록 렌더링 & 필터링
function getFilteredProjects() {
  let list = [];

  if (projectViewSource === 'live') {
    list = liveBidsData.map(b => ({ ...b, isLiveNotice: true }));
    if (currentLiveQuickFilter === 'dday3') {
      list = list.filter(b => typeof b.dday === 'number' && b.dday >= 0 && b.dday <= 3);
    } else if (currentLiveQuickFilter === 'small') {
      list = list.filter(b => (b.assignBdgtAmt || 0) < 50000000);
    } else if (currentLiveQuickFilter === 'single_corp') {
      list = list.filter(b => (b.assignBdgtAmt || 0) >= 100000000 && (b.assignBdgtAmt || 0) <= 300000000);
    } else if (currentLiveQuickFilter === 'matched') {
      list = list.filter(b => b.crossMatch && b.crossMatch.matched);
    }
  } else if (projectViewSource === 'past') {
    list = allProjects.map(p => ({ ...p, isLiveNotice: false }));
  } else {
    // all
    list = [
      ...liveBidsData.map(b => ({ ...b, isLiveNotice: true })),
      ...allProjects.map(p => ({ ...p, isLiveNotice: false }))
    ];
  }

  const bRange = currentFilters.budgetRange;
  if (bRange === '5억 미만') list = list.filter(p => (p.assignBdgtAmt || 0) < 500000000);
  else if (bRange === '5천만 미만') list = list.filter(p => (p.assignBdgtAmt || 0) < 50000000);
  else if (bRange === '5천만 ~ 1억') list = list.filter(p => p.assignBdgtAmt >= 50000000 && p.assignBdgtAmt < 100000000);
  else if (bRange === '1억 ~ 3억') list = list.filter(p => p.assignBdgtAmt >= 100000000 && p.assignBdgtAmt < 300000000);
  else if (bRange === '3억 ~ 5억') list = list.filter(p => p.assignBdgtAmt >= 300000000 && p.assignBdgtAmt < 500000000);
  else if (bRange === '5억 이상') list = list.filter(p => p.assignBdgtAmt >= 500000000);

  if (currentFilters.q) {
    const q = currentFilters.q.toLowerCase().trim();
    list = list.filter(p => 
      (p.bidNtceNm && p.bidNtceNm.toLowerCase().includes(q)) ||
      (p.dminsttNm && p.dminsttNm.toLowerCase().includes(q)) ||
      (p.ntceInsttNm && p.ntceInsttNm.toLowerCase().includes(q)) ||
      (p.bidNtceNo && p.bidNtceNo.includes(q))
    );
  }

  if (currentFilters.category !== '전체') {
    list = list.filter(p => p.category === currentFilters.category);
  }

  if (currentFilters.bookmarkOnly) {
    list = list.filter(p => bookmarks.has(p.bidNtceNo));
  }

  const sort = currentFilters.sort;
  if (sort === 'budget_desc') list.sort((a, b) => (b.assignBdgtAmt || 0) - (a.assignBdgtAmt || 0));
  else if (sort === 'budget_asc') list.sort((a, b) => (a.assignBdgtAmt || 0) - (b.assignBdgtAmt || 0));
  else if (sort === 'date_asc') list.sort((a, b) => new Date(a.bidNtceDt) - new Date(b.bidNtceDt));
  else if (sort === 'dday_asc') {
    list.sort((a, b) => {
      const dayA = typeof a.dday === 'number' && a.dday >= 0 ? a.dday : (a.isLiveNotice ? 99 : 999);
      const dayB = typeof b.dday === 'number' && b.dday >= 0 ? b.dday : (b.isLiveNotice ? 99 : 999);
      return dayA - dayB;
    });
  } else {
    list.sort((a, b) => new Date(b.bidNtceDt) - new Date(a.bidNtceDt));
  }

  return list;
}

function renderProjectsList() {
  const filtered = getFilteredProjects();
  const totalFilteredCount = filtered.length;
  const totalFilteredBudget = filtered.reduce((acc, cur) => acc + (Number(cur.assignBdgtAmt) || 0), 0);

  document.getElementById('search-filtered-count').innerText = totalFilteredCount.toLocaleString();
  document.getElementById('search-filtered-budget').innerText = formatMoney(totalFilteredBudget);

  const emptyState = document.getElementById('empty-state');
  const tableContainer = document.getElementById('table-view-container');
  const cardContainer = document.getElementById('card-view-container');
  const paginationControls = document.getElementById('pagination-controls');

  if (totalFilteredCount === 0) {
    emptyState.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    cardContainer.classList.add('hidden');
    paginationControls.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  paginationControls.classList.remove('hidden');

  const totalPages = Math.ceil(totalFilteredCount / pagination.limit) || 1;
  if (pagination.page > totalPages) pagination.page = totalPages;
  const startIdx = (pagination.page - 1) * pagination.limit;
  const pageItems = filtered.slice(startIdx, startIdx + pagination.limit);

  document.getElementById('page-indicator').innerText = `${pagination.page} / ${totalPages} 페이지 (총 ${totalFilteredCount}건)`;
  document.getElementById('btn-prev-page').disabled = pagination.page <= 1;
  document.getElementById('btn-next-page').disabled = pagination.page >= totalPages;

  const tbody = document.getElementById('projects-table-body');
  tbody.innerHTML = pageItems.map(p => {
    const isBookmarked = bookmarks.has(p.bidNtceNo);
    const tier = getBudgetTier(p.assignBdgtAmt);
    const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['기타'];

    let statusBadge = '';
    if (p.isLiveNotice) {
      if (typeof p.dday === 'number' && p.dday <= 1 && p.dday >= 0) {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">⏰ ${p.ddayText}</span>`;
      } else if (typeof p.dday === 'number' && p.dday <= 3 && p.dday >= 0) {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">⏰ ${p.ddayText}</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">⚡ ${p.ddayText}</span>`;
      }
    } else {
      statusBadge = p.isSuccessBidded
        ? `<span class="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">낙찰완료</span>`
        : `<span class="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">개찰완료</span>`;
    }

    const livePill = p.isLiveNotice
      ? `<span class="px-1.5 py-0.2 rounded bg-cyan-600 text-white font-bold text-[9px]">LIVE</span>`
      : `<span class="px-1.5 py-0.2 rounded bg-slate-600 text-white font-bold text-[9px]">실적</span>`;

    const matchPill = p.crossMatch && p.crossMatch.matched
      ? `<span class="ml-1 px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold text-[9px]" title="전년도 수주사: ${p.crossMatch.incumbentCompany}">💡 ${p.crossMatch.incumbentCompany ? p.crossMatch.incumbentCompany.slice(0, 6) : '전년매칭'}</span>`
      : '';

    return `
      <tr class="hover:bg-amber-50/40 transition-colors cursor-pointer" onclick="openDetailModalById('${p.bidNtceNo}')">
        <td class="py-3 px-4 text-center" onclick="event.stopPropagation()">
          <button onclick="toggleBookmark('${p.bidNtceNo}', event)" class="text-slate-300 hover:text-amber-500 transition-colors">
            <svg class="w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
          </button>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="flex items-center space-x-1 mb-0.5">
            ${livePill}
            <span class="font-mono text-xs text-slate-600 font-bold">${p.bidNtceNo}</span>
          </div>
          <span class="text-[11px] text-slate-400">${p.bidNtceDt ? p.bidNtceDt.substring(0, 10) : ''}</span>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
            <span class="px-1.5 py-0.2 text-[10px] font-bold rounded border ${tier.color}">${tier.label}</span>
            <span class="font-bold text-slate-800 hover:text-amber-600 transition-colors line-clamp-1">${p.bidNtceNm}</span>
            ${matchPill}
          </div>
          <div class="flex items-center space-x-1.5">
            ${(p.keyThemes || []).slice(0, 3).map(th => `<span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">${th}</span>`).join('')}
            ${p.bidClseDt ? `<span class="text-[10px] text-rose-500 font-medium">마감: ${p.bidClseDt.substring(5, 16)}</span>` : ''}
          </div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="text-slate-800 font-bold block">${p.dminsttNm || p.ntceInsttNm}</span>
          <span class="text-[11px] text-slate-400">${p.orgType}</span>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="text-xs text-slate-700 font-medium block">${p.cntrctCnclsMthdNm || p.noticeType}</span>
          <span class="px-1.5 py-0.2 text-[10px] font-semibold rounded ${color.bg} ${color.text}">${p.category}</span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <span class="font-extrabold text-amber-700 text-sm">${formatMoney(p.assignBdgtAmt)}</span>
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join('');

  cardContainer.innerHTML = pageItems.map(p => {
    const isBookmarked = bookmarks.has(p.bidNtceNo);
    const tier = getBudgetTier(p.assignBdgtAmt);
    const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['기타'];

    let statusBadge = '';
    if (p.isLiveNotice) {
      if (typeof p.dday === 'number' && p.dday <= 1 && p.dday >= 0) {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">⏰ ${p.ddayText}</span>`;
      } else if (typeof p.dday === 'number' && p.dday <= 3 && p.dday >= 0) {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">⏰ ${p.ddayText}</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">⚡ ${p.ddayText}</span>`;
      }
    } else {
      statusBadge = p.isSuccessBidded
        ? `<span class="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">낙찰완료</span>`
        : `<span class="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">개찰완료</span>`;
    }

    const livePill = p.isLiveNotice
      ? `<span class="px-1.5 py-0.2 rounded bg-cyan-600 text-white font-bold text-[10px]">LIVE 접수중</span>`
      : `<span class="px-1.5 py-0.2 rounded bg-slate-600 text-white font-bold text-[10px]">과거 실적</span>`;

    const matchBox = (p.isLiveNotice && p.crossMatch && p.crossMatch.matched)
      ? `<div class="mt-2 p-2 bg-indigo-50 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 leading-snug">
           <span class="font-bold">💡 전년도 수주:</span> ${p.crossMatch.incumbentCompany} 
           <span class="text-emerald-700 font-bold ml-1">(추천 ${formatMoney(p.crossMatch.recommendedBid)})</span>
         </div>`
      : '';

    return `
      <div onclick="openDetailModalById('${p.bidNtceNo}')" class="bg-white rounded-2xl p-4 border ${p.isLiveNotice ? 'border-cyan-200 hover:border-cyan-400' : 'border-slate-200/80 hover:border-amber-400'} shadow-sm transition-all cursor-pointer flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-1.5 flex-wrap gap-1">
              ${livePill}
              <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${tier.color}">${tier.label}</span>
              <span class="px-1.5 py-0.5 text-[10px] font-semibold rounded ${color.bg} ${color.text}">${p.category}</span>
            </div>
            <button onclick="toggleBookmark('${p.bidNtceNo}', event)" class="p-1 text-slate-300 hover:text-amber-500">
              <svg class="w-5 h-5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </button>
          </div>

          <h4 class="font-bold text-slate-900 text-sm mb-1.5 leading-snug line-clamp-2 hover:text-amber-600 transition-colors">
            ${p.bidNtceNm}
          </h4>

          <div class="text-xs text-slate-500 mb-2 flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-slate-700">${p.dminsttNm || p.ntceInsttNm}</span>
            <span class="text-slate-300">·</span>
            <span class="text-slate-500">${p.cntrctCnclsMthdNm || p.noticeType}</span>
            ${p.bidClseDt ? `<span class="text-rose-500 text-[11px] font-semibold">마감: ${p.bidClseDt.substring(5, 16)}</span>` : ''}
          </div>

          ${matchBox}
        </div>

        <div class="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 block">배정예산</span>
            <span class="text-base font-extrabold text-amber-700">${formatMoney(p.assignBdgtAmt)}</span>
          </div>
          <div>
            ${statusBadge}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterBudgetRange(bRange) {
  currentFilters.budgetRange = bRange;
  document.querySelectorAll('.filter-budget-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-budget') === bRange);
    if (btn.getAttribute('data-budget') === bRange) {
      btn.classList.add('bg-amber-200/80', 'text-amber-900', 'font-bold');
    } else {
      btn.classList.remove('bg-amber-200/80', 'text-amber-900', 'font-bold');
    }
  });
  pagination.page = 1;
  renderProjectsList();
}

function toggleUnder500MOnly() {
  if (currentFilters.budgetRange === '5억 미만') {
    filterBudgetRange('전체');
    const txtEl = document.getElementById('banner-toggle-text');
    if (txtEl) txtEl.innerText = '5억 미만 모드 켜기';
    if (typeof setRecurringBudgetMode === 'function') setRecurringBudgetMode('all');
  } else {
    filterBudgetRange('5억 미만');
    const txtEl = document.getElementById('banner-toggle-text');
    if (txtEl) txtEl.innerText = '✓ 5억 미만 전용 필터 적용 중';
    if (typeof setRecurringBudgetMode === 'function') setRecurringBudgetMode('under500');
  }
}

function filterCategory(cat) {
  currentFilters.category = cat;
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cat') === cat);
  });
  pagination.page = 1;
  renderProjectsList();
}

function toggleBookmarkOnly() {
  currentFilters.bookmarkOnly = !currentFilters.bookmarkOnly;
  const btn = document.getElementById('btn-filter-bookmark');
  if (btn) {
    if (currentFilters.bookmarkOnly) {
      btn.classList.add('bg-amber-500', 'text-white', 'border-amber-500');
      btn.classList.remove('bg-amber-50', 'text-amber-700');
    } else {
      btn.classList.remove('bg-amber-500', 'text-white', 'border-amber-500');
      btn.classList.add('bg-amber-50', 'text-amber-700');
    }
  }
  pagination.page = 1;
  renderProjectsList();
}

function applyFilters() {
  currentFilters.sort = document.getElementById('select-sort')?.value || 'date_desc';
  pagination.page = 1;
  renderProjectsList();
}

function setViewMode(mode, rerender = true) {
  viewMode = mode;
  const tableContainer = document.getElementById('table-view-container');
  const cardContainer = document.getElementById('card-view-container');
  const btnTable = document.getElementById('btn-view-table');
  const btnCard = document.getElementById('btn-view-card');

  if (mode === 'card') {
    tableContainer.classList.add('hidden');
    cardContainer.classList.remove('hidden');
    btnCard?.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    btnTable?.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
  } else {
    cardContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    btnTable?.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    btnCard?.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
  }
}

// 검색어 Debounce
const searchInput = document.getElementById('input-search');
let searchTimeout = null;
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('btn-clear-search')?.classList.toggle('hidden', val.length === 0);

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilters.q = val;
      pagination.page = 1;
      renderProjectsList();
    }, 200);
  });
}

function clearSearch() {
  if (searchInput) searchInput.value = '';
  document.getElementById('btn-clear-search')?.classList.add('hidden');
  currentFilters.q = '';
  pagination.page = 1;
  renderProjectsList();
}

function resetAllFilters() {
  clearSearch();
  filterCategory('전체');
  filterBudgetRange('5억 미만');
  if (currentFilters.bookmarkOnly) toggleBookmarkOnly();
  if (document.getElementById('select-sort')) document.getElementById('select-sort').value = 'date_desc';
  applyFilters();
}

function changePage(delta) {
  pagination.page += delta;
  renderProjectsList();
  document.getElementById('projects-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 북마크
function toggleBookmark(bidNtceNo, e) {
  if (e) e.stopPropagation();
  if (bookmarks.has(bidNtceNo)) bookmarks.delete(bidNtceNo);
  else bookmarks.add(bidNtceNo);

  localStorage.setItem('koneps_spatial_bookmarks', JSON.stringify(Array.from(bookmarks)));
  renderProjectsList();
  if (selectedProject && selectedProject.bidNtceNo === bidNtceNo) updateModalBookmarkBtn();
}

function toggleCurrentBookmark() {
  if (!selectedProject) return;
  toggleBookmark(selectedProject.bidNtceNo);
}

function updateModalBookmarkBtn() {
  if (!selectedProject) return;
  const isBookmarked = bookmarks.has(selectedProject.bidNtceNo);
  const textEl = document.getElementById('modal-bookmark-text');
  if (textEl) textEl.innerText = isBookmarked ? '관심 해제' : '관심 등록';
}

// 상세 모달
function openDetailModalById(bidNtceNo) {
  let p = liveBidsData.find(item => item.bidNtceNo === bidNtceNo);
  if (p) {
    openDetailModal({ ...p, isLiveNotice: true });
    return;
  }
  p = allProjects.find(item => item.bidNtceNo === bidNtceNo);
  if (p) openDetailModal({ ...p, isLiveNotice: false });
}

function openDetailModal(p) {
  selectedProject = p;
  const modal = document.getElementById('modal-project-detail');
  if (!modal) return;

  const tier = getBudgetTier(p.assignBdgtAmt);
  const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['기타'];

  document.getElementById('modal-title').innerText = p.bidNtceNm;
  document.getElementById('modal-tier-badge').innerText = tier.label;
  document.getElementById('modal-tier-badge').className = `px-2 py-0.5 text-xs font-bold rounded-full ${tier.color}`;
  document.getElementById('modal-category-badge').innerText = p.category;
  document.getElementById('modal-category-badge').className = `px-2 py-0.5 text-xs font-semibold rounded-full ${color.bg} ${color.text}`;
  document.getElementById('modal-contract-badge').innerText = p.cntrctCnclsMthdNm || '일반경쟁';

  document.getElementById('modal-budget').innerText = `${formatMoney(p.assignBdgtAmt)} (${formatRawWon(p.assignBdgtAmt)})`;
  document.getElementById('modal-presmpt').innerText = formatRawWon(p.presmptPrce);
  document.getElementById('modal-dminstt').innerText = p.dminsttNm || p.ntceInsttNm;
  document.getElementById('modal-ntceinstt').innerText = p.ntceInsttNm;
  document.getElementById('modal-bidno').innerText = `${p.bidNtceNo}-${p.bidNtceOrd}`;
  document.getElementById('modal-contract').innerText = p.cntrctCnclsMthdNm || '협상에 의한 계약';
  document.getElementById('modal-noticedt').innerText = p.bidNtceDt || '-';
  document.getElementById('modal-closedt').innerText = p.bidClseDt || '-';
  document.getElementById('modal-summary').innerText = p.summary || '상세 과업 내용은 나라장터 공고문을 참조하십시오.';

  const winnerBox = document.getElementById('modal-winner-box');
  const crossBox = document.getElementById('modal-cross-analysis-box');

  if (p.isLiveNotice) {
    if (winnerBox) winnerBox.classList.add('hidden');
    if (crossBox) {
      crossBox.classList.remove('hidden');
      const cm = p.crossMatch || {};
      document.getElementById('modal-cross-incumbent').innerText = cm.incumbentCompany || '기존 고착 사업자 없음 (신규 기회)';
      document.getElementById('modal-cross-recommended-price').innerText = formatMoney(cm.recommendedBid);
      document.getElementById('modal-cross-avg-rate').innerText = `(평균낙찰률 ${cm.avgBidRate || 91.5}%)`;
      const histEl = document.getElementById('modal-cross-history');
      if (histEl) {
        histEl.innerHTML = (cm.pastWinners && cm.pastWinners.length > 0)
          ? cm.pastWinners.map(w => `<div class="flex items-center space-x-1.5"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span><span>${w}</span></div>`).join('')
          : '<span class="text-slate-400">직전 3개년 동일 명칭 수주 이력 없음 (신규 진입 최적)</span>';
      }
      document.getElementById('modal-cross-advice').innerText = cm.strategicAdvice || '기존 사업자 기득권이 없어 적극 응찰을 추천합니다.';
      const matchBadge = document.getElementById('modal-cross-match-badge');
      if (matchBadge) {
        matchBadge.className = cm.matched
          ? 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300'
          : 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300';
        matchBadge.innerText = cm.matched ? '과거 실적 연계 완료' : '신규 기회 사업';
      }
    }
  } else {
    if (crossBox) crossBox.classList.add('hidden');
    if (p.isSuccessBidded && p.succBidCorp) {
      winnerBox.classList.remove('hidden');
      document.getElementById('modal-winner-corp').innerText = p.succBidCorp;
      document.getElementById('modal-winner-amt').innerText = formatMoney(p.succBidAmt);
    } else {
      winnerBox.classList.add('hidden');
    }
  }

  const themesContainer = document.getElementById('modal-themes');
  if (themesContainer) {
    themesContainer.innerHTML = (p.keyThemes || []).map(th => `
      <span class="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-md font-medium">#${th}</span>
    `).join('');
  }

  const linkEl = document.getElementById('modal-link-koneps');
  if (linkEl) {
    // 8081 포트 제거 및 차세대 나라장터 딥링크 적용
    let targetUrl = `https://www.g2b.go.kr#PNPE027_01?bidPbancNo=${p.bidNtceNo}&bidPbancOrd=${p.bidNtceOrd || '000'}`;
    if (p.bidNtceDtlUrl && !p.bidNtceDtlUrl.includes(':8081')) {
      targetUrl = p.bidNtceDtlUrl;
    }
    linkEl.href = targetUrl;
  }

  updateModalBookmarkBtn();
  loadModalAttachments(p.bidNtceNo, p.bidNtceOrd);
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('modal-open'), 10);
  document.body.style.overflow = 'hidden';
}

// 공고번호 원클릭 복사
function copyBidNo() {
  if (!selectedProject) return;
  const no = selectedProject.bidNtceNo;
  navigator.clipboard.writeText(no).then(() => {
    const textEl = document.getElementById('btn-copy-bidno-text');
    if (textEl) {
      textEl.innerText = '복사 완료!';
      setTimeout(() => { textEl.innerText = '복사'; }, 1500);
    }
    showToast(`📋 공고번호 [${no}]가 클립보드에 복사되었습니다!`);
  }).catch(() => {
    prompt('공고번호를 복사하세요:', no);
  });
}

function closeDetailModal(e) {
  const modal = document.getElementById('modal-project-detail');
  if (!modal) return;
  modal.classList.remove('modal-open');
  setTimeout(() => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }, 200);
}

// 6. 엑셀 내보내기
function exportToExcel() {
  const filtered = getFilteredProjects();
  if (filtered.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const exportData = filtered.map(p => ({
    '공고번호': `${p.bidNtceNo}-${p.bidNtceOrd}`,
    '공고명': p.bidNtceNm,
    '예산구간': getBudgetTier(p.assignBdgtAmt).label,
    '수요기관': p.dminsttNm || p.ntceInsttNm,
    '공고기관': p.ntceInsttNm,
    '사업분류': p.category,
    '배정예산(원)': p.assignBdgtAmt,
    '계약체결방법': p.cntrctCnclsMthdNm,
    '공고일시': p.bidNtceDt,
    '마감일시': p.bidClseDt,
    '낙찰여부': p.isSuccessBidded ? '낙찰완료' : '진행중',
    '수주업체': p.succBidCorp || '',
    '나라장터URL': p.bidNtceDtlUrl
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '5억미만_공간정보사업_2026');

  const filename = `나라장터_5억미만_공간정보사업_${new Date().toISOString().substring(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// 7. 엑셀 파일 업로드
function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); }
function handleFileDrop(e) {
  e.preventDefault(); e.stopPropagation();
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) processUploadedFile(files[0]);
}
function handleFileSelect(e) {
  const files = e.target.files;
  if (files && files.length > 0) processUploadedFile(files[0]);
}

function processUploadedFile(file) {
  const statusEl = document.getElementById('file-upload-status');
  if (statusEl) statusEl.innerText = `파일 처리 중: ${file.name}...`;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(firstSheet);

      const parsedProjects = rawJson.map((row, idx) => {
        const title = row['공고명'] || row['입찰공고명'] || `공간정보 사업 ${idx+1}`;
        const budget = Number(row['배정예산'] || row['배정예산(원)'] || row['추정금액'] || 0);
        return {
          bidNtceNo: String(row['공고번호'] || Date.now() + idx),
          bidNtceOrd: "00",
          bidNtceNm: title,
          ntceInsttNm: row['공고기관'] || '지자체',
          dminsttNm: row['수요기관'] || '지자체',
          orgType: '지자체',
          category: '시스템/SW구축',
          assignBdgtAmt: budget,
          presmptPrce: Math.round(budget / 1.1),
          cntrctCnclsMthdNm: row['계약방법'] || '협상에 의한 계약',
          bidNtceDt: '2026-01-01 10:00:00',
          bidClseDt: '2026-01-31 17:00:00',
          bidNtceDtlUrl: 'https://www.g2b.go.kr',
          isSuccessBidded: false,
          succBidAmt: null,
          succBidCorp: null,
          keyThemes: ['공간정보', '5억미만'],
          summary: `${title} 엑셀 수기 업로드`
        };
      });

      const uploadRes = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedProjects)
      });
      const resData = await uploadRes.json();
      if (resData.success) {
        if (statusEl) statusEl.innerText = `성공! ${parsedProjects.length}건이 등록되었습니다.`;
        setTimeout(() => location.reload(), 1000);
      }
    } catch (err) {
      if (statusEl) statusEl.innerText = `오류: ${err.message}`;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function resetDefaultDataset() {
  if (!confirm('조달청 나라장터 공식 3개년(2024~2026년) 실측 투찰·계약 데이터셋(총 419건, 2026년 5억 미만 92건)으로 복원하시겠습니까?')) return;
  try {
    const res = await fetch('/api/projects/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      location.reload();
    }
  } catch (err) {
    alert('리셋 실패: ' + err.message);
  }
}

// 모바일 QR 모달
function openQrModal() {
  const modal = document.getElementById('modal-qr');
  if (!modal) return;
  const port = serverInfo.port || 3000;
  const ip = serverInfo.primaryIp || window.location.hostname;
  const mobileUrl = `http://${ip}:${port}`;

  document.getElementById('qr-url-text').innerText = mobileUrl;
  const qrImg = document.getElementById('qr-code-img');
  if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}`;

  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('modal-open'), 10);
  document.body.style.overflow = 'hidden';
}

function closeQrModal() {
  const modal = document.getElementById('modal-qr');
  if (!modal) return;
  modal.classList.remove('modal-open');
  setTimeout(() => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }, 200);
}

// 플로팅 토스트 알림창
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 pointer-events-none transition-all duration-300 opacity-0 whitespace-pre-line text-center';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');

  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 3500);
}

// 나라장터 바로가기 (공고명 자동 복사 후 나라장터 새창 열기)
function openKonepsWithClipboard() {
  if (!selectedProject) return;
  const title = selectedProject.bidNtceNm;

  navigator.clipboard.writeText(title).then(() => {
    showToast(`📋 공고명이 클립보드에 복사되었습니다!\n"${title}"\n나라장터 검색창에 붙여넣기(Ctrl+V)하세요.`);
  }).catch(() => {
    showToast(`나라장터로 이동합니다. 검색어: "${title}"`);
  });

  setTimeout(() => {
    window.open('https://www.g2b.go.kr', '_blank');
  }, 400);
}

// 구글/포털에서 공고문 원문 검색
function openPortalSearch() {
  if (!selectedProject) return;
  const q = encodeURIComponent(`site:g2b.go.kr "${selectedProject.bidNtceNm}"`);
  window.open(`https://www.google.com/search?q=${q}`, '_blank');
}

window.addEventListener('resize', () => {
  if (window.innerWidth < 768 && viewMode !== 'card') {
    setViewMode('card', false);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// ============================================================================
// 과거 3개년(2024~2026) 계속사업 심층분석 & 2027 수주 공략 기능 모듈
// ============================================================================

let currentRecurringBudgetMode = 'under500'; // 'under500' (37건) or 'all' (48건)

async function fetchRecurringDataIfNeeded() {
  if (!recurringData) {
    try {
      const res = await fetch('/api/recurring');
      if (res.ok) {
        recurringData = await res.json();
        recurringFilteredFamilies = recurringData.data || [];
      }
    } catch (err) {
      console.error('계속사업 데이터 로드 실패:', err);
    }
  }
}

async function renderRecurringPage() {
  await fetchRecurringDataIfNeeded();
  if (!recurringData) return;

  const summary = recurringData.summary || {};

  // KPI 요소 업데이트
  updateRecurringKpis();

  // 차트 렌더링
  renderRecurringTrendChart(summary.yearlyTrend);
  renderRecurringMarketChart(summary.topWinners);

  // 리스트 렌더링
  applyRecurringFilters();
}

function setRecurringBudgetMode(mode) {
  currentRecurringBudgetMode = mode;

  const btnUnder500 = document.getElementById('btn-rec-mode-under500');
  const btnAll = document.getElementById('btn-rec-mode-all');
  const tierEl = document.getElementById('rec-select-tier');
  const badgeEl = document.getElementById('rec-current-mode-badge');

  if (mode === 'under500') {
    if (btnUnder500) {
      btnUnder500.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-emerald-600 text-white flex items-center space-x-1.5';
    }
    if (btnAll) {
      btnAll.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
    }
    if (tierEl && (tierEl.value === '전체' || tierEl.value === '5억 이상')) {
      tierEl.value = '5억 미만';
    }
    if (badgeEl) {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold';
      badgeEl.innerHTML = '현재: <strong>⭐ 5억 미만 중점 계속사업 (37건)</strong> 표시 중';
    }
  } else {
    if (btnUnder500) {
      btnUnder500.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
    }
    if (btnAll) {
      btnAll.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-slate-900 text-white flex items-center space-x-1.5';
    }
    if (tierEl && tierEl.value === '5억 미만') {
      tierEl.value = '전체';
    }
    if (badgeEl) {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-semibold';
      badgeEl.innerHTML = '현재: <strong>📋 전체 계속사업 (48건)</strong> 표시 중';
    }
  }

  updateRecurringKpis();
  applyRecurringFilters();
}

function onRecurringTierChange() {
  const tierEl = document.getElementById('rec-select-tier');
  if (!tierEl) return;
  const val = tierEl.value;

  if (val === '5억 미만') {
    currentRecurringBudgetMode = 'under500';
  } else if (val === '전체' || val === '5억 이상') {
    currentRecurringBudgetMode = 'all';
  }

  const btnUnder500 = document.getElementById('btn-rec-mode-under500');
  const btnAll = document.getElementById('btn-rec-mode-all');
  const badgeEl = document.getElementById('rec-current-mode-badge');

  if (currentRecurringBudgetMode === 'under500') {
    if (btnUnder500) btnUnder500.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-emerald-600 text-white flex items-center space-x-1.5';
    if (btnAll) btnAll.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
    if (badgeEl) {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold';
      badgeEl.innerHTML = '현재: <strong>⭐ 5억 미만 중점 계속사업 (37건)</strong> 표시 중';
    }
  } else {
    if (btnUnder500) btnUnder500.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5';
    if (btnAll) btnAll.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-slate-900 text-white flex items-center space-x-1.5';
    if (badgeEl) {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-semibold';
      badgeEl.innerHTML = '현재: <strong>📋 전체 계속사업 (48건)</strong> 표시 중';
    }
  }

  updateRecurringKpis();
  applyRecurringFilters();
}

function updateRecurringKpis() {
  if (!recurringData || !recurringData.data) return;
  const allFamilies = recurringData.data;
  const targetFamilies = (currentRecurringBudgetMode === 'under500')
    ? allFamilies.filter(f => f.isUnder500M)
    : allFamilies;

  const totalCount = targetFamilies.length;
  const total3YrSum = targetFamilies.reduce((s, f) => s + (f.total3YrBudget || 0), 0);
  const total2026Sum = targetFamilies.reduce((s, f) => {
    const y26 = f.history && f.history[2] ? f.history[2].budget : 0;
    return s + (y26 || 0);
  }, 0);
  const churnCount = targetFamilies.filter(f => f.winnerChangeCount > 0).length;
  const churnRatio = totalCount > 0 ? ((churnCount / totalCount) * 100).toFixed(1) : 0;
  const earlyCount = targetFamilies.filter(f =>
    f.expectedNextNoticeDate.startsWith('2027.01') ||
    f.expectedNextNoticeDate.startsWith('2027.02') ||
    f.expectedNextNoticeDate.startsWith('2027.03')
  ).length;

  const countEl = document.getElementById('kpi-rec-total-count');
  if (countEl) countEl.innerText = totalCount;

  const scopeDescEl = document.getElementById('kpi-rec-scope-desc');
  if (scopeDescEl) {
    scopeDescEl.innerText = (currentRecurringBudgetMode === 'under500')
      ? '5억 미만 37건 (중소기업 최적)'
      : '전체 48건 (5억미만 37건 + 5억이상 11건)';
  }

  const budgetEl = document.getElementById('kpi-rec-total-budget');
  if (budgetEl) budgetEl.innerText = (total3YrSum / 100000000).toFixed(1);

  const budget2026El = document.getElementById('kpi-rec-2026-budget');
  if (budget2026El) budget2026El.innerText = `2026년 당해 ${(total2026Sum / 100000000).toFixed(1)}억 원`;

  const churnCountEl = document.getElementById('kpi-rec-churn-count');
  if (churnCountEl) churnCountEl.innerText = churnCount;

  const churnRatioEl = document.getElementById('kpi-rec-churn-ratio');
  if (churnRatioEl) churnRatioEl.innerText = `전체의 ${churnRatio}% (수주 진입 유망)`;

  const earlyEl = document.getElementById('kpi-rec-early2027-count');
  if (earlyEl) earlyEl.innerText = earlyCount;

  // 퀵 필터 칩 뱃지 카운트 업데이트
  const bAll = document.getElementById('badge-rec-all-count');
  if (bAll) bAll.innerText = totalCount;
  const bChurn = document.getElementById('badge-rec-churn-count');
  if (bChurn) bChurn.innerText = churnCount;
  const bLocked = document.getElementById('badge-rec-locked-count');
  if (bLocked) bLocked.innerText = targetFamilies.filter(f => f.isIncumbentLocked).length;
  const bGrowth = document.getElementById('badge-rec-growth-count');
  if (bGrowth) bGrowth.innerText = targetFamilies.filter(f => f.budgetGrowthRate >= 10.0).length;
  const bEarly = document.getElementById('badge-rec-early-count');
  if (bEarly) bEarly.innerText = earlyCount;
}

function renderRecurringTrendChart(yearlyTrend) {
  const ctx = document.getElementById('chart-recurring-trend')?.getContext('2d');
  if (!ctx || !yearlyTrend) return;

  if (chartInstances['recTrend']) chartInstances['recTrend'].destroy();

  const labels = yearlyTrend.map(y => `${y.year}년`);
  const budgets = yearlyTrend.map(y => Number((y.totalBudget / 100000000).toFixed(1)));

  chartInstances['recTrend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: '예산 성장선 (억원)',
          data: budgets,
          borderColor: '#10b981',
          borderWidth: 3,
          pointBackgroundColor: '#059669',
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: '3개년 계속사업 총 예산 (억원)',
          data: budgets,
          backgroundColor: ['#cbd5e1', '#94a3b8', '#059669'],
          borderRadius: 8,
          maxBarThickness: 45,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} 억 원`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          title: { display: true, text: '총 예산(억원)', font: { size: 10 } },
          grid: { color: '#f1f5f9' },
          beginAtZero: true,
          suggestedMax: 100
        }
      }
    }
  });
}

function renderRecurringMarketChart(topWinners) {
  const ctx = document.getElementById('chart-recurring-market')?.getContext('2d');
  if (!ctx || !topWinners) return;

  if (chartInstances['recMarket']) chartInstances['recMarket'].destroy();

  const sliced = topWinners.slice(0, 6);
  const labels = sliced.map(w => w.name.replace('(주)', '').replace('주식회사', ''));
  const budgets = sliced.map(w => Number((w.total2026Budget / 100000000).toFixed(1)));
  const counts = sliced.map(w => w.projectCount);

  chartInstances['recMarket'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '2026 수주규모 (억원)',
        data: budgets,
        backgroundColor: [
          '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b'
        ],
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` 2026 수주액: ${ctx.parsed.x} 억원 (${counts[ctx.dataIndex]}건)`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          title: { display: true, text: '수주금액 (억원)', font: { size: 10 } },
          beginAtZero: true
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: 'bold' } }
        }
      }
    }
  });
}

function setRecurringQuickFilter(type) {
  currentRecurringQuickFilter = type;

  // 칩 버튼 스타일 업데이트
  document.querySelectorAll('.rec-filter-btn').forEach(btn => {
    btn.classList.remove('bg-slate-900', 'text-white');
    btn.classList.add('bg-slate-100', 'text-slate-700');
  });

  const activeBtn = document.getElementById(`rec-filter-${type}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-slate-900', 'text-white');
    activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
  }

  applyRecurringFilters();
}

function applyRecurringFilters() {
  if (!recurringData || !recurringData.data) return;

  let families = [...recurringData.data];

  // 0. 예산 구간 / 5억 미만 필터
  const tierEl = document.getElementById('rec-select-tier');
  const tierVal = tierEl ? tierEl.value : '5억 미만';

  if (tierVal === '5억 미만') {
    families = families.filter(f => f.isUnder500M);
  } else if (tierVal === '5억 이상') {
    families = families.filter(f => !f.isUnder500M);
  } else if (tierVal !== '전체') {
    families = families.filter(f => f.budgetTier === tierVal);
  } else {
    if (currentRecurringBudgetMode === 'under500') {
      families = families.filter(f => f.isUnder500M);
    }
  }

  // 1. 빠른 필터
  if (currentRecurringQuickFilter === 'churn') {
    families = families.filter(f => f.winnerChangeCount > 0);
  } else if (currentRecurringQuickFilter === 'locked') {
    families = families.filter(f => f.isIncumbentLocked);
  } else if (currentRecurringQuickFilter === 'high_growth') {
    families = families.filter(f => f.budgetGrowthRate >= 10.0);
  } else if (currentRecurringQuickFilter === 'early_2027') {
    families = families.filter(f =>
      f.expectedNextNoticeDate.startsWith('2027.01') ||
      f.expectedNextNoticeDate.startsWith('2027.02') ||
      f.expectedNextNoticeDate.startsWith('2027.03')
    );
  }

  // 2. 카테고리 필터
  const catEl = document.getElementById('rec-select-category');
  if (catEl && catEl.value !== '전체') {
    families = families.filter(f => f.category === catEl.value);
  }

  // 3. 검색어 필터
  const searchEl = document.getElementById('rec-search-input');
  if (searchEl && searchEl.value.trim()) {
    const q = searchEl.value.toLowerCase().trim();
    families = families.filter(f =>
      (f.familyName && f.familyName.toLowerCase().includes(q)) ||
      (f.agency && f.agency.toLowerCase().includes(q)) ||
      (f.incumbentCompany && f.incumbentCompany.toLowerCase().includes(q)) ||
      (f.strategicAction && f.strategicAction.toLowerCase().includes(q))
    );
  }

  // 4. 정렬
  const sortEl = document.getElementById('rec-select-sort');
  const sortVal = sortEl ? sortEl.value : 'growth_desc';
  if (sortVal === 'budget_desc') {
    families.sort((a, b) => b.total3YrBudget - a.total3YrBudget);
  } else if (sortVal === 'budget_asc') {
    families.sort((a, b) => a.total3YrBudget - b.total3YrBudget);
  } else if (sortVal === 'next_date') {
    families.sort((a, b) => a.expectedNextNoticeDate.localeCompare(b.expectedNextNoticeDate));
  } else {
    families.sort((a, b) => b.budgetGrowthRate - a.budgetGrowthRate);
  }

  recurringFilteredFamilies = families;

  const countEl = document.getElementById('rec-filtered-count');
  if (countEl) countEl.innerText = families.length;

  renderRecurringFamiliesList(families);
}

function renderRecurringFamiliesList(families) {
  const container = document.getElementById('recurring-families-container');
  if (!container) return;

  if (families.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
        <div class="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-sm font-bold text-slate-700">조건에 일치하는 계속사업이 없습니다.</p>
        <p class="text-xs text-slate-400 mt-1">검색어나 필터 조건을 재설정해 보세요.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = families.map(f => {
    // 뱃지 상태 판단
    let statusBadgeHtml = '';
    if (f.riskOpportunityLevel === '실제 낙찰 확인 사업') {
      statusBadgeHtml = `
        <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1 shadow-2xs">
          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>🏆 실제 개찰 낙찰 확인 (${f.incumbentCompany})</span>
        </span>
      `;
    } else if (f.riskOpportunityLevel === '입찰 진행 중 사업') {
      statusBadgeHtml = `
        <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-800 border border-blue-200 flex items-center space-x-1">
          <svg class="w-3.5 h-3.5 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>📢 2027년도 조기발주 입찰접수 중</span>
        </span>
      `;
    } else if (f.winnerChangeCount > 0) {
      statusBadgeHtml = `
        <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span>🎯 사업자 교체 (${f.winnerChangeCount}회) · 수주기회 유망</span>
        </span>
      `;
    } else if (f.budgetGrowthRate >= 12.0) {
      statusBadgeHtml = `
        <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
          <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          <span>📈 예산 급증 (+${f.budgetGrowthRate}%)</span>
        </span>
      `;
    } else {
      statusBadgeHtml = `
        <span class="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center space-x-1">
          <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span>🔄 연례 계속사업</span>
        </span>
      `;
    }

    const catBadge = CATEGORY_COLORS[f.category] || { bg: 'bg-slate-100', text: 'text-slate-700' };

    const y24 = f.history[0];
    const y25 = f.history[1];
    const y26 = f.history[2];

    const isWinnerChanged25 = (y25.winnerCorp !== y24.winnerCorp);
    const isWinnerChanged26 = (y26.winnerCorp !== y25.winnerCorp);

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all space-y-4">
        <!-- 상단 헤더: 기관명, 카테고리, 상태 뱃지, 타이틀 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-800 text-white font-mono">${f.familyId}</span>
              <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>조달청 3개년 실측 투찰·계약</span>
              </span>
              <span class="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-800">${f.agency}</span>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-lg ${catBadge.bg} ${catBadge.text}">${f.category}</span>
              ${f.isUnder500M ? '<span class="px-2 py-0.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">5억 미만</span>' : '<span class="px-2 py-0.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700">5억 이상</span>'}
              ${statusBadgeHtml}
            </div>
            <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">${f.familyName}</h3>
          </div>

          <!-- 2027년 재발주 일정 뱃지 -->
          <div class="shrink-0 flex sm:flex-col items-center sm:items-end justify-between bg-purple-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border border-purple-100 sm:border-0">
            <div class="text-[11px] text-purple-700 font-semibold flex items-center space-x-1">
              <svg class="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>차기 재발주 예상</span>
            </div>
            <div class="text-sm font-extrabold text-purple-900 mt-0.5">
              ${f.expectedNextNoticeDate}
              <span class="text-xs text-purple-600 font-medium">(${formatMoney(f.expected2027Budget)} 추정)</span>
            </div>
          </div>
        </div>

        <!-- 3개년 수주 이력 타임라인 (2024 ➡️ 2025 ➡️ 2026) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
          <!-- 2024년 -->
          <div class="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500 pb-1.5 border-b border-slate-100">
              <div class="flex items-center space-x-1">
                ${y24.isRealSource 
                  ? '<span class="px-2 py-0.5 bg-slate-700 text-white font-bold rounded text-[10px]">2024년 실측</span>' 
                  : '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 font-medium rounded text-[10px]">2024년 (선행없음)</span>'}
              </div>
              <span class="text-[11px] text-slate-400 font-mono">${y24.noticeDate}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">배정예산</span>
              <span class="text-sm font-bold ${y24.budget ? 'text-slate-900' : 'text-slate-400'}">${y24.budget ? formatMoney(y24.budget) : '-'}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">수주기업</span>
              <span class="text-xs font-bold ${y24.isRealSource ? 'text-slate-800' : 'text-slate-400'}">${y24.winnerCorp}</span>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 pt-1">
              <span>투찰률: <strong class="text-slate-700 font-semibold">${y24.bidRate ? y24.bidRate + '%' : '-'}</strong></span>
              <span class="font-mono text-slate-400 text-[10px]">${y24.noticeNo}</span>
            </div>
          </div>

          <!-- 2025년 -->
          <div class="bg-white p-3 rounded-xl border ${isWinnerChanged25 ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200/80'} shadow-2xs space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500 pb-1.5 border-b border-slate-100">
              <div class="flex items-center space-x-1">
                ${y25.isRealSource 
                  ? '<span class="px-2 py-0.5 bg-slate-700 text-white font-bold rounded text-[10px]">2025년 실측</span>' 
                  : '<span class="px-2 py-0.5 bg-slate-100 text-slate-500 font-medium rounded text-[10px]">2025년 (선행없음)</span>'}
              </div>
              <span class="text-[11px] text-slate-400 font-mono">${y25.noticeDate}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">배정예산</span>
              <span class="text-sm font-bold ${y25.budget ? 'text-slate-900' : 'text-slate-400'}">${y25.budget ? formatMoney(y25.budget) : '-'}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">수주기업</span>
              <div class="flex items-center space-x-1">
                ${isWinnerChanged25 && y25.isRealSource ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 rounded">교체</span>' : ''}
                <span class="text-xs font-bold ${isWinnerChanged25 && y25.isRealSource ? 'text-emerald-700 font-extrabold' : (y25.isRealSource ? 'text-slate-800' : 'text-slate-400')}">${y25.winnerCorp}</span>
              </div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 pt-1">
              <span>투찰률: <strong class="text-slate-700 font-semibold">${y25.bidRate ? y25.bidRate + '%' : '-'}</strong></span>
              <span class="font-mono text-slate-400 text-[10px]">${y25.noticeNo}</span>
            </div>
          </div>

          <!-- 2026년 -->
          <div class="bg-white p-3 rounded-xl border border-emerald-400 ring-2 ring-emerald-100 shadow-2xs space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500 pb-1.5 border-b border-slate-100">
              <div class="flex items-center space-x-1">
                <span class="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px]">2026년 실측</span>
              </div>
              <span class="text-[11px] text-slate-500 font-mono font-medium">${y26.noticeDate}</span>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">배정예산</span>
              <div class="flex items-baseline space-x-1">
                <span class="text-sm font-extrabold text-amber-700">${formatMoney(y26.budget)}</span>
                <span class="text-[10px] font-bold ${f.budgetGrowthRate >= 0 ? 'text-emerald-600' : 'text-red-500'}">
                  (▲+${f.budgetGrowthRate}%)
                </span>
              </div>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-[11px] text-slate-400">수주기업</span>
              <div class="flex items-center space-x-1">
                ${isWinnerChanged26 ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 rounded">교체</span>' : ''}
                <span class="text-xs font-extrabold ${isWinnerChanged26 ? 'text-emerald-700' : 'text-slate-900'}">${y26.winnerCorp}</span>
              </div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 pt-1">
              <span>투찰률: <strong class="text-slate-800 font-bold">${y26.bidRate ? y26.bidRate + '%' : '-'}</strong></span>
              <span class="font-mono text-emerald-700 font-bold bg-emerald-50 px-1 rounded">${y26.noticeNo}</span>
            </div>
          </div>
        </div>

        <!-- 하단: 수주 공략 가이드 & 빠른 액션 버튼 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div class="flex items-start space-x-2 text-xs text-slate-700 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 flex-1">
            <span class="text-amber-600 font-bold text-sm shrink-0">💡</span>
            <div class="leading-relaxed">
              <strong class="font-bold text-amber-900">수주 공략 제언:</strong> ${f.strategicAction}
            </div>
          </div>

          <div class="shrink-0 flex items-center space-x-2">
            <button onclick="copyTextToClipboard('${y26.noticeNm}')" class="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center space-x-1">
              <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              <span>공고명 복사</span>
            </button>
            <button onclick="openRecurringKoneps('${y26.noticeNm}')" class="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition-all flex items-center space-x-1">
              <span>나라장터 검색</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function copyTextToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`📋 클립보드에 복사되었습니다!\n"${text}"`);
  }).catch(() => {
    showToast(`복사 완료: "${text}"`);
  });
}

function openRecurringKoneps(title) {
  navigator.clipboard.writeText(title).then(() => {
    showToast(`📋 공고명이 클립보드에 자동 복사되었습니다!\n나라장터 검색창에 붙여넣기(Ctrl+V)하세요.`);
  }).catch(() => {});
  setTimeout(() => {
    window.open('https://www.g2b.go.kr', '_blank');
  }, 350);
}

// 계속사업 3개년 데이터 CSV 다운로드
function exportRecurringToExcel() {
  if (!recurringFilteredFamilies || recurringFilteredFamilies.length === 0) {
    showToast('다운로드할 계속사업 데이터가 없습니다.');
    return;
  }

  const headers = [
    '계속사업ID', '계속사업명', '수요기관', '기관유형', '카테고리', '예산구간',
    '2024예산(원)', '2024수주사', '2024낙찰률(%)',
    '2025예산(원)', '2025수주사', '2025낙찰률(%)',
    '2026예산(원)', '2026수주사', '2026낙찰률(%)',
    '3개년누적예산(원)', '예산증가율(%)', '사업자교체횟수', '독점여부',
    '2027예상발주월', '2027추정예산(원)', '수주공략제언'
  ];

  const rows = recurringFilteredFamilies.map(f => {
    const y24 = f.history[0];
    const y25 = f.history[1];
    const y26 = f.history[2];
    return [
      `"${f.familyId}"`,
      `"${(f.familyName || '').replace(/"/g, '""')}"`,
      `"${(f.agency || '').replace(/"/g, '""')}"`,
      `"${f.orgType}"`,
      `"${f.category}"`,
      `"${f.budgetTier}"`,
      y24.budget,
      `"${y24.winnerCorp}"`,
      y24.bidRate,
      y25.budget,
      `"${y25.winnerCorp}"`,
      y25.bidRate,
      y26.budget,
      `"${y26.winnerCorp}"`,
      y26.bidRate,
      f.total3YrBudget,
      f.budgetGrowthRate,
      f.winnerChangeCount,
      f.isIncumbentLocked ? '3년독점' : '사업자교체',
      `"${f.expectedNextNoticeDate}"`,
      f.expected2027Budget,
      `"${(f.strategicAction || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `2024_2026_공간정보_계속사업_분석_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 3개년 계속사업 분석 엑셀(CSV) 파일이 다운로드되었습니다.');
}


// ============================================================================
// 실시간 라이브 입찰공고 & 과거 수주 실적 통합 관제 모듈
// ============================================================================

async function fetchLiveBids() {
  try {
    const res = await fetch('/api/bids/live');
    if (res.ok) {
      const data = await res.json();
      liveBidsData = data.data || [];
      const summary = data.summary || {};

      // 상단 배너 뱃지 업데이트
      const bLive = document.getElementById('badge-live-count');
      if (bLive) bLive.innerText = liveBidsData.length;
      const bPast = document.getElementById('badge-past-count');
      if (bPast) bPast.innerText = allProjects.filter(p => (p.assignBdgtAmt || 0) < 500000000).length;
      const bCombined = document.getElementById('badge-all-combined-count');
      if (bCombined) bCombined.innerText = liveBidsData.length + allProjects.filter(p => (p.assignBdgtAmt || 0) < 500000000).length;

      // 라이브 서머리 스트립 업데이트
      const sCount = document.getElementById('strip-live-count');
      if (sCount) sCount.innerText = summary.totalLiveCount || liveBidsData.length;
      const sBudget = document.getElementById('strip-live-budget');
      if (sBudget && summary.totalLiveBudget) sBudget.innerText = (summary.totalLiveBudget / 100000000).toFixed(1);
      const sDday = document.getElementById('strip-live-dday3');
      if (sDday) sDday.innerText = summary.dday3Count || 0;
      const sSmall = document.getElementById('strip-live-small');
      if (sSmall) sSmall.innerText = summary.smallCount || 0;

      // 퀵 칩 카운트 업데이트
      const pAll = document.getElementById('badge-live-pill-all');
      if (pAll) pAll.innerText = liveBidsData.length;
      const pDday3 = document.getElementById('badge-live-pill-dday3');
      if (pDday3) pDday3.innerText = summary.dday3Count || 0;
      const pSmall = document.getElementById('badge-live-pill-small');
      if (pSmall) pSmall.innerText = summary.smallCount || 0;
      const pSingle = document.getElementById('badge-live-pill-single');
      if (pSingle) pSingle.innerText = liveBidsData.filter(b => (b.assignBdgtAmt || 0) >= 100000000 && (b.assignBdgtAmt || 0) <= 300000000).length;
      const pMatched = document.getElementById('badge-live-pill-matched');
      if (pMatched) pMatched.innerText = liveBidsData.filter(b => b.crossMatch && b.crossMatch.matched).length;
    }
  } catch (err) {
    console.error('실시간 라이브 공고 로드 실패:', err);
  }
}

function setProjectViewSource(source) {
  projectViewSource = source;

  const btnLive = document.getElementById('btn-project-mode-live');
  const btnPast = document.getElementById('btn-project-mode-past');
  const btnAll = document.getElementById('btn-project-mode-all');
  const liveStrip = document.getElementById('live-bids-summary-strip');
  const liveChips = document.getElementById('live-quick-filters');

  // 버튼 스타일 초기화
  [btnLive, btnPast, btnAll].forEach(b => {
    if (b) {
      b.className = 'px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center space-x-1.5';
    }
  });

  if (source === 'live') {
    if (btnLive) btnLive.className = 'px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm bg-cyan-600 text-white flex items-center space-x-1.5';
    if (liveStrip) liveStrip.classList.remove('hidden');
    if (liveChips) liveChips.classList.remove('hidden');
  } else if (source === 'past') {
    if (btnPast) btnPast.className = 'px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm bg-amber-600 text-white flex items-center space-x-1.5';
    if (liveStrip) liveStrip.classList.add('hidden');
    if (liveChips) liveChips.classList.add('hidden');
  } else {
    if (btnAll) btnAll.className = 'px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm bg-slate-700 text-white flex items-center space-x-1.5';
    if (liveStrip) liveStrip.classList.remove('hidden');
    if (liveChips) liveChips.classList.remove('hidden');
  }

  pagination.page = 1;
  renderProjectsList();
}

function setLiveQuickFilter(filter) {
  currentLiveQuickFilter = filter;
  document.querySelectorAll('.live-chip').forEach(btn => {
    const isAct = btn.getAttribute('data-live-filter') === filter;
    btn.classList.toggle('active', isAct);
    if (isAct) {
      btn.className = 'live-chip active shrink-0 px-3 py-1 rounded-full border border-cyan-300 text-cyan-900 bg-cyan-100 font-bold';
    } else {
      btn.className = 'live-chip shrink-0 px-3 py-1 rounded-full border border-slate-200 text-slate-700';
    }
  });
  pagination.page = 1;
  renderProjectsList();
}

function openOpenApiKeyModal() {
  const modal = document.getElementById('modal-openapi-key');
  if (!modal) return;
  const savedKey = localStorage.getItem('koneps_openapi_key') || '';
  const keyInput = document.getElementById('input-openapi-servicekey');
  if (keyInput) keyInput.value = savedKey;
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('modal-open'), 10);
}

function closeOpenApiKeyModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('modal-openapi-key');
  if (!modal) return;
  modal.classList.remove('modal-open');
  setTimeout(() => modal.classList.add('hidden'), 200);
}

async function executeOpenApiRefresh() {
  const keyInput = document.getElementById('input-openapi-servicekey');
  const serviceKey = keyInput ? keyInput.value.trim() : '';
  if (!serviceKey) {
    alert('공공데이터포털 일반 인증키(ServiceKey)를 입력해주세요.');
    return;
  }

  localStorage.setItem('koneps_openapi_key', serviceKey);

  const statusEl = document.getElementById('openapi-refresh-status');
  const btn = document.getElementById('btn-submit-openapi-refresh');
  if (statusEl) {
    statusEl.innerText = '⏳ 나라장터 조달청 서버에서 최신 공간정보 5억 미만 공고를 수신하는 중입니다...';
    statusEl.classList.remove('hidden');
  }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/bids/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceKey,
        keyword: document.getElementById('input-openapi-keyword')?.value || '공간정보',
        maxPages: parseInt(document.getElementById('select-openapi-pages')?.value || '3', 10)
      })
    });
    const result = await res.json();
    if (result.success) {
      if (statusEl) statusEl.innerText = `✅ ${result.message}`;
      await fetchLiveBids();
      renderProjectsList();
      setTimeout(() => closeOpenApiKeyModal(), 1200);
    } else {
      if (statusEl) statusEl.innerText = `❌ 오류: ${result.message}`;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = `❌ 통신 실패: ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function restoreDefaultLiveBids() {
  await fetchLiveBids();
  renderProjectsList();
  closeOpenApiKeyModal();
}


// =========================================================================
// [조달청 02 OpenAPI 연계] 실시간 첨부파일 및 공동도급 정보 로더
// =========================================================================
async function loadModalAttachments(noticeNo, ord = '000') {
  const atchList = document.getElementById('modal-atch-list');
  const atchBadge = document.getElementById('modal-atch-status-badge');
  const jointBox = document.getElementById('modal-joint-contract-box');
  const jointText = document.getElementById('modal-joint-contract-text');

  if (!atchList) return;

  atchList.innerHTML = '<div class="text-slate-400 text-xs italic">조달청 02 첨부파일을 조회 중입니다...</div>';
  if (atchBadge) {
    atchBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-300';
    atchBadge.innerText = '조회중...';
  }
  if (jointBox) jointBox.classList.add('hidden');

  const cleanNo = (noticeNo || '').split('-')[0];
  const cleanOrd = (ord || '000').split('-').pop();

  try {
    // 1. 첨부파일 조회
    const resAtch = await fetch(`/api/bids/attachments?bidNtceNo=${cleanNo}&bidNtceOrd=${cleanOrd}`);
    if (resAtch.ok) {
      const atchData = await resAtch.json();
      const files = atchData.data || [];

      if (files.length > 0) {
        if (atchBadge) {
          atchBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
          atchBadge.innerText = `${files.length}건 첨부서류 확인`;
        }

        atchList.innerHTML = files.map(f => {
          const isDoc = (f.docType || '').includes('과업') || (f.fileName || '').includes('과업') || (f.fileName || '').includes('규격');
          const isNotice = (f.docType || '').includes('공고') || (f.fileName || '').includes('공고');
          const badgeColor = isDoc 
            ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
            : (isNotice ? 'bg-cyan-100 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-700 border-slate-200');

          return `
            <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-cyan-100 hover:border-cyan-300 transition-colors shadow-2xs">
              <div class="flex items-center space-x-2 truncate mr-2">
                <span class="px-1.5 py-0.5 text-[10px] font-bold rounded border ${badgeColor} shrink-0">${f.docType}</span>
                <span class="truncate text-xs font-medium text-slate-800" title="${f.fileName}">${f.fileName}</span>
              </div>
              <a href="${f.fileUrl}" target="_blank" download class="px-2.5 py-1 text-[11px] font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shrink-0 flex items-center space-x-1 shadow-2xs">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span>다운로드</span>
              </a>
            </div>
          `;
        }).join('');
      } else {
        if (atchBadge) {
          atchBadge.className = 'px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500 border border-slate-200';
          atchBadge.innerText = '별도첨부 없음';
        }
        atchList.innerHTML = `
          <div class="text-xs text-slate-500 p-2.5 bg-white/70 rounded-xl border border-slate-100 flex items-center justify-between">
            <span>나라장터 본문 공고문 또는 전자서명 첨부파일 참조</span>
            <a href="https://www.g2b.go.kr" target="_blank" class="text-cyan-700 underline font-semibold text-[11px]">나라장터 원문보기</a>
          </div>
        `;
      }
    }

    // 2. 공동도급/가산지역 정보 조회
    const resJoint = await fetch(`/api/bids/joint-contract?bidNtceNo=${cleanNo}&bidNtceOrd=${cleanOrd}`);
    if (resJoint.ok) {
      const jointData = await resJoint.json();
      const joints = jointData.jointContract || [];
      const incentives = jointData.incentiveRegion || [];
      
      let infoParts = [];
      if (joints.length > 0) {
        joints.forEach(j => {
          if (j.dutyRgnNm || j.dutyRate) {
            infoParts.push(`의무지역: ${j.dutyRgnNm || '해당지역'} (비율: ${j.dutyRate || '-'}%)`);
          }
        });
      }
      if (incentives.length > 0) {
        incentives.forEach(inc => {
          if (inc.incentiveRgnNm) {
            infoParts.push(`가산지역: ${inc.incentiveRgnNm}`);
          }
        });
      }

      if (infoParts.length > 0 && jointBox && jointText) {
        jointBox.classList.remove('hidden');
        jointText.innerText = infoParts.join(' | ');
      }
    }
  } catch (err) {
    console.error('loadModalAttachments error:', err);
    if (atchList) {
      atchList.innerHTML = '<div class="text-slate-400 text-xs italic">첨부서류 정보를 불러오지 못했습니다.</div>';
    }
  }
}
