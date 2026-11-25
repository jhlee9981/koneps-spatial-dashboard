new_func = '''function applyRecurringFilters() {
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
}'''

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re
pattern = r'function applyRecurringFilters\(\) \{[\s\S]*?renderRecurringFamiliesList\(families\);\s*\}'
if re.search(pattern, content):
    content = re.sub(pattern, new_func, content, count=1)
    with open('public/app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: applyRecurringFilters patched.")
else:
    print("ERROR: pattern not found.")
