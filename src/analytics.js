/**
 * 나라장터 공간정보 사업 데이터 분석 및 통계 집계 엔진
 * [3개년(2024, 2025, 2026) 통합 & 5억 미만 중점 분석 세그먼트]
 */

function calculateSingleSet(projects, scopeYear = 'all') {
  if (!projects || projects.length === 0) {
    return {
      summary: { totalCount: 0, totalBudget: 0, avgBudget: 0, maxBudget: 0, maxBudgetTitle: '', successCount: 0, pendingCount: 0, successRatio: 0, uniqueAgencies: 0 },
      under500M: { totalCount: 0, totalBudget: 0, avgBudget: 0, countRatio: 0, budgetRatio: 0, under100Count: 0, under50Count: 0, buckets: [], categories: [], topAgencies: [], contractMethods: [] },
      monthly: [],
      categories: [],
      orgTypes: [],
      topAgencies: { byBudget: [], byCount: [], under500M: [] },
      budgetRanges: [],
      contractMethods: [],
      topThemes: [],
      winStats: { awardedCount: 0, avgSuccRate: 0, topWinners: [] }
    };
  }

  const totalCount = projects.length;
  let totalBudget = 0;
  let maxBudgetProj = null;
  let successCount = 0;
  let totalSuccRateSum = 0;
  let succRateCount = 0;

  // 5억 미만 전용 집계 변수
  let under500Count = 0;
  let under500Budget = 0;
  let under100Count = 0; // 1억 미만 소액
  let under50Count = 0;  // 5천만 미만 초소액 수의

  const under500Buckets = [
    { label: "5천만 미만", min: 0, max: 50000000, count: 0, budget: 0, desc: "초소액 / 수의계약 중심" },
    { label: "5천만 ~ 1억", min: 50000000, max: 100000000, count: 0, budget: 0, desc: "소액 입찰 / 기초 유지보수" },
    { label: "1억 ~ 3억", min: 100000000, max: 300000000, count: 0, budget: 0, desc: "지자체 표준 GIS 기능보강" },
    { label: "3억 ~ 5억", min: 300000000, max: 500000000, count: 0, budget: 0, desc: "핵심 중소기업 타깃 프로젝트" }
  ];

  const monthMap = {};
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, '0');
    monthMap[key] = {
      month: key,
      label: `${m}월`,
      count: 0,
      budget: 0,
      under500Count: 0,
      under500Budget: 0,
      y2024Count: 0,
      y2025Count: 0,
      y2026Count: 0,
      y2024Budget: 0,
      y2025Budget: 0,
      y2026Budget: 0
    };
  }

  const catMap = {};
  const under500CatMap = {};
  const orgMap = {};
  const agencyMap = {};
  const under500AgencyMap = {};
  const contractMap = {};
  const under500ContractMap = {};
  const themeMap = {};
  const winnerMap = {};

  const budgetBuckets = [
    { label: "5천만 미만", min: 0, max: 50000000, count: 0, budget: 0 },
    { label: "5천만 ~ 1억", min: 50000000, max: 100000000, count: 0, budget: 0 },
    { label: "1억 ~ 3억", min: 100000000, max: 300000000, count: 0, budget: 0 },
    { label: "3억 ~ 5억", min: 300000000, max: 500000000, count: 0, budget: 0 },
    { label: "5억 이상", min: 500000000, max: Infinity, count: 0, budget: 0 }
  ];

  projects.forEach(p => {
    const budget = Number(p.assignBdgtAmt) || 0;
    totalBudget += budget;

    const isUnder500M = budget < 500000000;
    if (isUnder500M) {
      under500Count += 1;
      under500Budget += budget;
      if (budget < 100000000) under100Count += 1;
      if (budget < 50000000) under50Count += 1;

      // 5억 미만 세부 구간 집계
      for (const b of under500Buckets) {
        if (budget >= b.min && budget < b.max) {
          b.count += 1;
          b.budget += budget;
          break;
        }
      }

      // 5억 미만 카테고리
      const c = p.category || "기타";
      if (!under500CatMap[c]) under500CatMap[c] = { category: c, count: 0, budget: 0 };
      under500CatMap[c].count += 1;
      under500CatMap[c].budget += budget;

      // 5억 미만 발주기관
      const ag = p.dminsttNm || p.ntceInsttNm || "미상";
      if (!under500AgencyMap[ag]) under500AgencyMap[ag] = { agency: ag, count: 0, budget: 0, orgType: p.orgType };
      under500AgencyMap[ag].count += 1;
      under500AgencyMap[ag].budget += budget;

      // 5억 미만 계약방법
      const mthd = p.cntrctCnclsMthdNm || "기타";
      if (!under500ContractMap[mthd]) under500ContractMap[mthd] = { method: mthd, count: 0, budget: 0 };
      under500ContractMap[mthd].count += 1;
      under500ContractMap[mthd].budget += budget;
    }

    if (!maxBudgetProj || budget > maxBudgetProj.assignBdgtAmt) {
      maxBudgetProj = p;
    }

    // 월별 통계
    const dt = p.bidNtceDt ? p.bidNtceDt.substring(0, 10) : '';
    const yr = p.year || (dt ? parseInt(dt.substring(0, 4), 10) : 2026);
    const mStr = dt && dt.length >= 7 ? dt.substring(5, 7) : '01';

    if (monthMap[mStr]) {
      monthMap[mStr].count += 1;
      monthMap[mStr].budget += budget;
      if (isUnder500M) {
        monthMap[mStr].under500Count += 1;
        monthMap[mStr].under500Budget += budget;
        if (yr === 2024) {
          monthMap[mStr].y2024Count += 1;
          monthMap[mStr].y2024Budget += budget;
        } else if (yr === 2025) {
          monthMap[mStr].y2025Count += 1;
          monthMap[mStr].y2025Budget += budget;
        } else if (yr === 2026) {
          monthMap[mStr].y2026Count += 1;
          monthMap[mStr].y2026Budget += budget;
        }
      }
    }

    // 전체 카테고리
    const cat = p.category || "기타";
    if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, budget: 0 };
    catMap[cat].count += 1;
    catMap[cat].budget += budget;

    // 기관유형
    const orgType = p.orgType || "기타";
    if (!orgMap[orgType]) orgMap[orgType] = { orgType, count: 0, budget: 0 };
    orgMap[orgType].count += 1;
    orgMap[orgType].budget += budget;

    // 발주/수요기관
    const agency = p.dminsttNm || p.ntceInsttNm || "미상";
    if (!agencyMap[agency]) agencyMap[agency] = { agency, count: 0, budget: 0, orgType };
    agencyMap[agency].count += 1;
    agencyMap[agency].budget += budget;

    // 계약방법
    const method = p.cntrctCnclsMthdNm || "기타";
    if (!contractMap[method]) contractMap[method] = { method, count: 0, budget: 0 };
    contractMap[method].count += 1;
    contractMap[method].budget += budget;

    // 전체 예산 구간
    for (const bucket of budgetBuckets) {
      if (budget >= bucket.min && (budget < bucket.max || bucket.max === Infinity)) {
        bucket.count += 1;
        bucket.budget += budget;
        break;
      }
    }

    // 테마 키워드
    if (Array.isArray(p.keyThemes)) {
      p.keyThemes.forEach(th => {
        if (!themeMap[th]) themeMap[th] = { theme: th, count: 0, budget: 0, isUnder500M };
        themeMap[th].count += 1;
        themeMap[th].budget += budget;
      });
    }

    // 낙찰 통계
    if (p.isSuccessBidded) {
      successCount += 1;
      const rateVal = Number(p.bidRate);
      if (rateVal && rateVal >= 50 && rateVal <= 110) {
        totalSuccRateSum += rateVal;
        succRateCount += 1;
      } else if (p.succBidAmt && budget > 0) {
        const rate = (p.succBidAmt / budget) * 100;
        totalSuccRateSum += rate;
        succRateCount += 1;
      }
      if (p.succBidCorp) {
        const winner = p.succBidCorp.trim();
        const amt = p.contractAmt || p.succBidAmt || budget || 0;
        if (!winnerMap[winner]) {
          winnerMap[winner] = {
            winner,
            count: 0,
            totalWon: 0,
            under500Count: 0,
            under500TotalWon: 0
          };
        }
        winnerMap[winner].count += 1;
        winnerMap[winner].totalWon += amt;
        if (isUnder500M) {
          winnerMap[winner].under500Count += 1;
          winnerMap[winner].under500TotalWon += amt;
        }
      }
    }
  });

  const avgBudget = totalCount > 0 ? Math.round(totalBudget / totalCount) : 0;
  const avgUnder500Budget = under500Count > 0 ? Math.round(under500Budget / under500Count) : 0;
  const avgSuccRate = succRateCount > 0 ? (totalSuccRateSum / succRateCount).toFixed(1) : 0;

  const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  const categories = Object.values(catMap).map(c => ({
    ...c,
    ratio: Number(((c.budget / (totalBudget || 1)) * 100).toFixed(1)),
    countRatio: Number(((c.count / totalCount) * 100).toFixed(1))
  })).sort((a, b) => b.budget - a.budget);

  const under500Categories = Object.values(under500CatMap).map(c => ({
    ...c,
    ratio: Number(((c.budget / (under500Budget || 1)) * 100).toFixed(1)),
    countRatio: Number(((c.count / under500Count) * 100).toFixed(1))
  })).sort((a, b) => b.count - a.count);

  const orgTypes = Object.values(orgMap).map(o => ({
    ...o,
    ratio: Number(((o.budget / (totalBudget || 1)) * 100).toFixed(1))
  })).sort((a, b) => b.budget - a.budget);

  const topAgenciesByCount = Object.values(agencyMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topUnder500Agencies = Object.values(under500AgencyMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const contractMethods = Object.values(contractMap)
    .map(c => ({
      ...c,
      ratio: Number(((c.count / totalCount) * 100).toFixed(1))
    }))
    .sort((a, b) => b.count - a.count);

  const under500ContractMethods = Object.values(under500ContractMap)
    .map(c => ({
      ...c,
      ratio: Number(((c.count / under500Count) * 100).toFixed(1))
    }))
    .sort((a, b) => b.count - a.count);

  const topThemes = Object.values(themeMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 5억 미만 사업 기준 주요 수주 기업 (5억 미만 수주 건수 및 5억 미만 수주 금액 기준 랭킹)
  const topUnder500Winners = Object.values(winnerMap)
    .filter(w => w.under500Count > 0)
    .sort((a, b) => b.under500Count - a.under500Count || b.under500TotalWon - a.under500TotalWon)
    .slice(0, 10);

  // 전체 사업 기준 수주 기업 (전체 건수 및 전체 수주 금액 기준 랭킹)
  const topWinnersAll = Object.values(winnerMap)
    .sort((a, b) => b.count - a.count || b.totalWon - a.totalWon)
    .slice(0, 10);

  const topWinners = topUnder500Winners;

  return {
    scopeYear,
    summary: {
      totalCount,
      totalBudget,
      avgBudget,
      maxBudget: maxBudgetProj ? maxBudgetProj.assignBdgtAmt : 0,
      maxBudgetTitle: maxBudgetProj ? maxBudgetProj.bidNtceNm : '',
      successCount,
      pendingCount: totalCount - successCount,
      successRatio: Number(((successCount / totalCount) * 100).toFixed(1)),
      uniqueAgencies: Object.keys(agencyMap).length
    },
    // 5억 미만 중점 분석 세그먼트
    under500M: {
      totalCount: under500Count,
      totalBudget: under500Budget,
      avgBudget: avgUnder500Budget,
      countRatio: Number(((under500Count / totalCount) * 100).toFixed(1)),
      budgetRatio: Number(((under500Budget / totalBudget) * 100).toFixed(1)),
      under100Count,
      under50Count,
      buckets: under500Buckets,
      categories: under500Categories,
      topAgencies: topUnder500Agencies,
      contractMethods: under500ContractMethods,
      topWinners: topUnder500Winners
    },
    monthly,
    categories,
    orgTypes,
    topAgencies: {
      byBudget: Object.values(agencyMap).sort((a, b) => b.budget - a.budget).slice(0, 10),
      byCount: topAgenciesByCount,
      under500M: topUnder500Agencies
    },
    budgetRanges: budgetBuckets,
    contractMethods,
    topThemes,
    winStats: {
      awardedCount: successCount,
      avgSuccRate: Number(avgSuccRate),
      topWinners: topUnder500Winners,
      topWinnersAll
    }
  };
}

function calculateAnalytics(projects) {
  if (!projects || projects.length === 0) {
    return calculateSingleSet([]);
  }

  const allResult = calculateSingleSet(projects, 'all');

  const p2024 = projects.filter(p => p.year === 2024 || (p.bidNtceDt && p.bidNtceDt.startsWith('2024')));
  const p2025 = projects.filter(p => p.year === 2025 || (p.bidNtceDt && p.bidNtceDt.startsWith('2025')));
  const p2026 = projects.filter(p => p.year === 2026 || (p.bidNtceDt && p.bidNtceDt.startsWith('2026')));

  const res2024 = calculateSingleSet(p2024, '2024');
  const res2025 = calculateSingleSet(p2025, '2025');
  const res2026 = calculateSingleSet(p2026, '2026');

  const yearlyComparison = [
    {
      year: 'all',
      label: '3개년 종합',
      totalCount: allResult.summary.totalCount,
      totalBudget: allResult.summary.totalBudget,
      under500Count: allResult.under500M.totalCount,
      under500Budget: allResult.under500M.totalBudget,
      under500Ratio: allResult.under500M.countRatio,
      avgUnder500Budget: allResult.under500M.avgBudget,
      buckets: allResult.under500M.buckets
    },
    {
      year: '2026',
      label: '2026년',
      totalCount: res2026.summary.totalCount,
      totalBudget: res2026.summary.totalBudget,
      under500Count: res2026.under500M.totalCount,
      under500Budget: res2026.under500M.totalBudget,
      under500Ratio: res2026.under500M.countRatio,
      avgUnder500Budget: res2026.under500M.avgBudget,
      buckets: res2026.under500M.buckets
    },
    {
      year: '2025',
      label: '2025년',
      totalCount: res2025.summary.totalCount,
      totalBudget: res2025.summary.totalBudget,
      under500Count: res2025.under500M.totalCount,
      under500Budget: res2025.under500M.totalBudget,
      under500Ratio: res2025.under500M.countRatio,
      avgUnder500Budget: res2025.under500M.avgBudget,
      buckets: res2025.under500M.buckets
    },
    {
      year: '2024',
      label: '2024년',
      totalCount: res2024.summary.totalCount,
      totalBudget: res2024.summary.totalBudget,
      under500Count: res2024.under500M.totalCount,
      under500Budget: res2024.under500M.totalBudget,
      under500Ratio: res2024.under500M.countRatio,
      avgUnder500Budget: res2024.under500M.avgBudget,
      buckets: res2024.under500M.buckets
    }
  ];

  return {
    ...allResult,
    yearly: yearlyComparison,
    byYear: {
      'all': allResult,
      '2026': res2026,
      '2025': res2025,
      '2024': res2024
    }
  };
}

module.exports = { calculateAnalytics, calculateSingleSet };
