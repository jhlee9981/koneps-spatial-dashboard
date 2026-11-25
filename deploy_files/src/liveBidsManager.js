const fs = require('fs');
const path = require('path');
const { fetchKonepsBids, inferCategory, inferOrgType, inferKeyThemes } = require('./konepsClient');

const LIVE_FILE = path.join(__dirname, '..', 'data', 'live_bids.json');

function loadLiveBids() {
  try {
    if (fs.existsSync(LIVE_FILE)) {
      const raw = fs.readFileSync(LIVE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('live_bids.json 읽기 오류:', err);
  }
  return [];
}

function saveLiveBids(bids) {
  try {
    const dir = path.dirname(LIVE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LIVE_FILE, JSON.stringify(bids, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('live_bids.json 저장 오류:', err);
    return false;
  }
}

/**
 * 실시간 공고 ↔ 과거 3개년 실적 간 크로스 매칭 분석 엔진
 */
function findCrossMatch(liveBid, projects = [], recurringFamilies = []) {
  const title = (liveBid.bidNtceNm || "").toLowerCase();
  const agency = (liveBid.dminsttNm || liveBid.ntceInsttNm || "").toLowerCase();
  const cleanAgency = agency
    .replace(/경기도|강원특별자치도|충청남도|충청북도|전북특별자치도|전라남도|경상북도|경상남도|서울특별시|인천광역시|대전광역시|대구광역시|부산광역시|울산광역시|광주광역시|세종특별자치시/g, '')
    .trim();

  // 1. 계속사업(recurring_projects.json)에서 기관 + 과업 일치 탐색
  for (const fam of recurringFamilies) {
    const famAgency = (fam.agency || "").toLowerCase();
    const famTitle = (fam.familyName || "").toLowerCase();

    const agencyMatched = (cleanAgency.length >= 2 && famAgency.includes(cleanAgency)) || famAgency.includes(cleanAgency);
    if (!agencyMatched) continue;

    // 키워드 매칭
    const keywords = ['유지보수', '유지관리', '데이터베이스', 'db', '수치지도', '지하시설물', '항공', '드론', '스마트', '플랫폼', '모니터링'];
    let matchScore = 0;
    for (const kw of keywords) {
      if (title.includes(kw) && famTitle.includes(kw)) matchScore++;
    }

    if (matchScore >= 1 || (title.includes('유지') && famTitle.includes('유지'))) {
      const h26 = fam.history?.find(h => h.year === 2026);
      const h25 = fam.history?.find(h => h.year === 2025);
      const h24 = fam.history?.find(h => h.year === 2024);

      const pastWinners = [
        h24 ? `${h24.year}년: ${h24.winnerCorp || '선행없음'}` : null,
        h25 ? `${h25.year}년: ${h25.winnerCorp || '선행없음'}` : null,
        h26 ? `${h26.year}년: ${h26.winnerCorp || '선행없음'}` : null
      ].filter(Boolean);

      const incumbent = fam.incumbentCompany || (h26 ? h26.winnerCorp : '기존 사업자');
      const bidRates = [h24?.bidRate, h25?.bidRate, h26?.bidRate].filter(r => typeof r === 'number' && r > 50);
      const avgRate = bidRates.length > 0 ? (bidRates.reduce((a, b) => a + b, 0) / bidRates.length) : null;
      const budget = liveBid.assignBdgtAmt || liveBid.presmptPrce || 0;
      const recommendedBid = avgRate ? Math.round((budget * (avgRate / 100)) / 1000) * 1000 : null;

      return {
        matched: true,
        source: 'recurring',
        familyId: fam.familyId,
        familyName: fam.familyName,
        agency: fam.agency,
        incumbentCompany: incumbent,
        winnerChangeCount: fam.winnerChangeCount || 0,
        isIncumbentLocked: fam.isIncumbentLocked || false,
        pastWinners,
        avgBidRate: avgRate ? Number(avgRate.toFixed(2)) : null,
        recommendedBid,
        pastBudget2026: h26?.budget || fam.total3YrBudget / 3,
        strategicAdvice: fam.isIncumbentLocked
          ? `🔒 '${incumbent}'이 다년간 연속 수주한 독점형 사업입니다. 기존 수행사의 과업 산출물 취약점 분석 및 보완 제안서로 승부하는 것을 추천합니다.`
          : `🎯 최근 사업자 교체(${fam.winnerChangeCount}회)가 발생했던 경쟁 유망 사업입니다. (전년도 수주: ${incumbent}) 제안서 차별화 시 승산이 높습니다.`
      };
    }
  }

  // 2. 2026년 개찰 완료 실적(projects.json)에서 유사 사업 탐색
  const matchedProject = projects.find(p => {
    const pAg = (p.dminsttNm || p.ntceInsttNm || "").toLowerCase();
    const pNm = (p.bidNtceNm || "").toLowerCase();
    if (cleanAgency.length >= 2 && pAg.includes(cleanAgency)) {
      const common = ['유지', 'db', '구축', '플랫폼', 'gis', '시스템'].some(k => title.includes(k) && pNm.includes(k));
      return common;
    }
    return false;
  });

  if (matchedProject) {
    const budget = liveBid.assignBdgtAmt || liveBid.presmptPrce || 0;
    const rate = (typeof matchedProject.bidRate === 'number' && matchedProject.bidRate > 50) ? matchedProject.bidRate : null;
    const recommendedBid = rate ? Math.round((budget * (rate / 100)) / 1000) * 1000 : null;
    return {
      matched: true,
      source: 'project_contract',
      familyId: `PRJ-${matchedProject.bidNtceNo}`,
      familyName: matchedProject.bidNtceNm,
      agency: matchedProject.dminsttNm || matchedProject.ntceInsttNm,
      incumbentCompany: matchedProject.succBidCorp || '낙찰기업',
      winnerChangeCount: 0,
      isIncumbentLocked: false,
      pastWinners: [`2026년 계약: ${matchedProject.succBidCorp || '낙찰기업'} (${matchedProject.contractAmt ? (matchedProject.contractAmt/1e8).toFixed(1)+'억' : '-'})`],
      avgBidRate: rate ? Number(rate) : null,
      recommendedBid,
      pastBudget2026: matchedProject.assignBdgtAmt,
      strategicAdvice: `💡 2026년 동일 지자체 유사 사업 수주사('${matchedProject.succBidCorp}')의 계약금액 및 제안 범위를 벤치마킹하여 투찰가를 산정하세요.`
    };
  }

  // 매칭 없음 -> 신규 발주형 사업 (과거 투찰 데이터가 없으므로 가짜 투찰가 완전 배제)
  return {
    matched: false,
    source: 'none',
    familyId: null,
    familyName: null,
    agency: liveBid.dminsttNm || liveBid.ntceInsttNm,
    incumbentCompany: '기존 고착 사업자 없음 (신규 기회)',
    winnerChangeCount: 0,
    isIncumbentLocked: false,
    pastWinners: [],
    avgBidRate: null,
    recommendedBid: null,
    pastBudget2026: null,
    strategicAdvice: `✨ 직전 3개년간 동일 명칭의 선행 조달 이력이 없는 신규/단년 사업입니다. 기득권 사업자가 없어 모든 응찰자에게 동등한 기회가 열려 있으며, 과거 낙찰 데이터가 없으므로 과업지시서 및 원가계산서 기준 자율 투찰이 필요합니다.`
  };
}

module.exports = {
  loadLiveBids,
  saveLiveBids,
  findCrossMatch
};
