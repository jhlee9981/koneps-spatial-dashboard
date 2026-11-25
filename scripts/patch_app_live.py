import re

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State variables
state_target = "let selectedProject = null;"
state_replacement = """let selectedProject = null;
let projectViewSource = 'live'; // 'live', 'past', 'all'
let liveBidsData = [];
let currentLiveQuickFilter = 'all';"""
content = content.replace(state_target, state_replacement, 1)

# 2. initApp update: add await fetchLiveBids();
init_target = """    renderDashboard();
    renderProjectsList();"""
init_replacement = """    await fetchLiveBids();
    renderDashboard();
    renderProjectsList();"""
content = content.replace(init_target, init_replacement, 1)

# 3. getFilteredProjects and renderProjectsList replacement
func_pattern = r'function getFilteredProjects\(\) \{[\s\S]*?function filterBudgetRange\(bRange\) \{'

new_funcs = '''function getFilteredProjects() {
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

function filterBudgetRange(bRange) {'''

content = re.sub(func_pattern, new_funcs, content, count=1)

# 4. Add Live Bid Control functions & modal handler functions
live_control_code = '''
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
'''

content += "\n" + live_control_code

# 5. Update openDetailModalById to find in both liveBidsData and allProjects
modal_find_pattern = r'function openDetailModalById\(bidNtceNo\) \{[\s\S]*?const p = allProjects\.find\(item => item\.bidNtceNo === bidNtceNo\);[\s\S]*?if \(p\) openDetailModal\(p\);[\s\S]*?\}'
modal_find_replacement = '''function openDetailModalById(bidNtceNo) {
  let p = liveBidsData.find(item => item.bidNtceNo === bidNtceNo);
  if (p) {
    openDetailModal({ ...p, isLiveNotice: true });
    return;
  }
  p = allProjects.find(item => item.bidNtceNo === bidNtceNo);
  if (p) openDetailModal({ ...p, isLiveNotice: false });
}'''
content = re.sub(modal_find_pattern, modal_find_replacement, content, count=1)

# 6. Update openDetailModal to populate crossMatch box
modal_open_pattern = r'  const winnerBox = document\.getElementById\(\'modal-winner-box\'\);[\s\S]*?if \(p\.isSuccessBidded && p\.succBidCorp\) \{[\s\S]*?winnerBox\.classList\.add\(\'hidden\'\);[\s\S]*?\}'
modal_open_replacement = '''  const winnerBox = document.getElementById('modal-winner-box');
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
  }'''

content = re.sub(modal_open_pattern, modal_open_replacement, content, count=1)

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: public/app.js patched with live bids & cross analysis!")
