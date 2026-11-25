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
 * 지자체 및 발주기관 핵심 키워드 정규화
 */
function extractAgencyKeyword(agencyStr) {
  if (!agencyStr) return '';
  const ag = String(agencyStr).trim();

  // 1. 기초 지자체 (시/군/구) 추출
  const m = ag.match(/([가-힣]{1,5}[시군구])\b/);
  if (m && !ag.match(/^(서울특별시|인천광역시|대전광역시|대구광역시|부산광역시|울산광역시|광주광역시)$/)) {
    return m[1].replace(/[시군구]$/, ''); // 예: "삼척", "성남", "창원", "거제", "파주"
  }

  // 2. 광역 자치단체 정규화
  if (ag.includes('경상남도') || ag === '경남') return '경상남도';
  if (ag.includes('경상북도') || ag === '경북') return '경상북도';
  if (ag.includes('전라남도') || ag === '전남') return '전라남도';
  if (ag.includes('전북특별자치도') || ag.includes('전라북도') || ag === '전북') return '전북';
  if (ag.includes('충청남도') || ag === '충남') return '충청남도';
  if (ag.includes('충청북도') || ag === '충북') return '충청북도';
  if (ag.includes('강원특별자치도') || ag.includes('강원도') || ag === '강원') return '강원';
  if (ag.includes('제주특별자치도') || ag.includes('제주도') || ag === '제주') return '제주';
  if (ag.includes('서울특별시') || ag === '서울') return '서울특별시';
  if (ag.includes('인천광역시') || ag === '인천') return '인천';
  if (ag.includes('대구광역시') || ag === '대구') return '대구';
  if (ag.includes('대전광역시') || ag === '대전') return '대전';
  if (ag.includes('부산광역시') || ag === '부산') return '부산';
  if (ag.includes('울산광역시') || ag === '울산') return '울산';
  if (ag.includes('광주광역시') || ag === '광주') return '광주';
  if (ag.includes('세종특별자치시') || ag === '세종') return '세종';

  // 3. 기타 공공기관
  return ag.replace(/(주식회사|\(주\)|재단법인|사단법인)/g, '').trim();
}

/**
 * 사업명 핵심 비교 문자열 정규화 (연도, 부가 표기 제거)
 */
function cleanTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\[긴급\]|\(긴급\)|\(협상에\s*의한\s*계약\)|\(소액수의\)|\(재공고\)/g, '')
    .replace(/202[4-7]년도?|25년~26년|2027~2028년도?/g, '')
    .replace(/용역|사업|유지관리|유지보수|구축|운영/g, '')
    .replace(/[^\w가-힣]/g, '')
    .trim();
}

/**
 * 실시간 공고 ↔ 과거 3개년 실적 간 크로스 매칭 분석 엔진
 */
function findCrossMatch(liveBid, projects = [], recurringFamilies = []) {
  const liveAg = extractAgencyKeyword(liveBid.dminsttNm || liveBid.ntceInsttNm);
  const liveTitle = cleanTitle(liveBid.bidNtceNm);
  const rawTitle = liveBid.bidNtceNm || '';
  const budget = liveBid.assignBdgtAmt || liveBid.presmptPrce || 0;

  if (!liveAg || !liveTitle || liveTitle.length < 2) {
    return createEmptyMatch(liveBid);
  }

  // 1. 과거 3개년 조달청 계약실적 데이터셋(projects.json: 2024~2026)에서 동일 기관 + 동일 사업 정밀 탐색
  const matchedProjects = projects.filter(p => {
    const pAg = extractAgencyKeyword(p.dminsttNm || p.ntceInsttNm);
    if (!pAg || pAg !== liveAg) return false;

    const pTitle = cleanTitle(p.bidNtceNm);
    if (!pTitle || pTitle.length < 2) return false;

    // 제목이 서로 상호 포함되거나 주요 핵심어 일치
    return liveTitle.includes(pTitle) || pTitle.includes(liveTitle);
  });

  if (matchedProjects.length > 0) {
    // 최신 연도순 정렬 (2026 -> 2025 -> 2024)
    matchedProjects.sort((a, b) => (b.year || 0) - (a.year || 0));

    const latest = matchedProjects[0];
    const incumbent = latest.succBidCorp || '확인됨';

    // 수주 이력 생성 (연도별 수주사 및 계약금액)
    const pastWinners = matchedProjects.map(p => {
      const amtStr = p.contractAmt ? (p.contractAmt / 100000000).toFixed(1) + '억' : (p.assignBdgtAmt ? (p.assignBdgtAmt / 100000000).toFixed(1) + '억' : '-');
      return `${p.year}년: ${p.succBidCorp || '낙찰'} (${amtStr})`;
    });

    // 실측 투찰률 계산
    const validRates = matchedProjects.map(p => p.bidRate).filter(r => typeof r === 'number' && r > 50);
    const avgRate = validRates.length > 0 ? Number((validRates.reduce((a, b) => a + b, 0) / validRates.length).toFixed(2)) : null;
    const recommendedBid = avgRate ? Math.round((budget * (avgRate / 100)) / 1000) * 1000 : null;

    const isLocked = matchedProjects.length >= 2 && matchedProjects.every(p => p.succBidCorp === incumbent);

    return {
      matched: true,
      source: 'project_contract',
      familyId: `PRJ-${latest.bidNtceNo}`,
      familyName: latest.bidNtceNm,
      agency: liveBid.dminsttNm || liveBid.ntceInsttNm,
      incumbentCompany: incumbent,
      winnerChangeCount: isLocked ? 0 : 1,
      isIncumbentLocked: isLocked,
      pastWinners,
      avgBidRate: avgRate,
      recommendedBid,
      pastBudget2026: latest.assignBdgtAmt,
      strategicAdvice: isLocked
        ? `'${incumbent}'이 과거 연속 수주해 온 사업입니다. 기존 수행사의 과업 산출물 취약점 분석 및 맞춤형 기술 제안으로 승부하는 것을 추천합니다.`
        : `과거 실적 연계 분석 결과 최근 수주사('${incumbent}')의 계약금액 및 제안 범위를 벤치마킹하여 적정 투찰가를 산정하세요.`
    };
  }

  // 2. 계속사업 패밀리(recurring_projects.json)에서 엄격한 기관 + 과업 일치 탐색
  const matchedFamily = recurringFamilies.find(fam => {
    const fAg = extractAgencyKeyword(fam.agency);
    if (!fAg || fAg !== liveAg) return false;

    const fTitle = cleanTitle(fam.familyName);
    if (!fTitle || fTitle.length < 2) return false;

    return liveTitle.includes(fTitle) || fTitle.includes(liveTitle);
  });

  if (matchedFamily) {
    const h26 = matchedFamily.history?.find(h => h.year === 2026);
    const h25 = matchedFamily.history?.find(h => h.year === 2025);
    const h24 = matchedFamily.history?.find(h => h.year === 2024);

    const pastWinners = [
      h24 ? `${h24.year}년: ${h24.winnerCorp || '선행없음'}` : null,
      h25 ? `${h25.year}년: ${h25.winnerCorp || '선행없음'}` : null,
      h26 ? `${h26.year}년: ${h26.winnerCorp || '선행없음'}` : null
    ].filter(Boolean);

    const incumbent = matchedFamily.incumbentCompany || (h26 ? h26.winnerCorp : '기존 사업자');
    const bidRates = [h24?.bidRate, h25?.bidRate, h26?.bidRate].filter(r => typeof r === 'number' && r > 50);
    const avgRate = bidRates.length > 0 ? Number((bidRates.reduce((a, b) => a + b, 0) / bidRates.length).toFixed(2)) : null;
    const recommendedBid = avgRate ? Math.round((budget * (avgRate / 100)) / 1000) * 1000 : null;

    return {
      matched: true,
      source: 'recurring',
      familyId: matchedFamily.familyId,
      familyName: matchedFamily.familyName,
      agency: matchedFamily.agency,
      incumbentCompany: incumbent,
      winnerChangeCount: matchedFamily.winnerChangeCount || 0,
      isIncumbentLocked: matchedFamily.isIncumbentLocked || false,
      pastWinners,
      avgBidRate: avgRate,
      recommendedBid,
      pastBudget2026: h26?.budget || matchedFamily.total3YrBudget / 3,
      strategicAdvice: matchedFamily.isIncumbentLocked
        ? `'${incumbent}'이 다년간 연속 수주한 독점형 사업입니다. 기존 수행사의 과업 산출물 취약점 분석 및 보완 제안서로 승부하는 것을 추천합니다.`
        : `최근 사업자 교체(${matchedFamily.winnerChangeCount}회)가 발생했던 경쟁 유망 사업입니다. (전년도 수주: ${incumbent}) 제안서 차별화 시 승산이 높습니다.`
    };
  }

  // 3. 매칭 없음 -> 신규 발주형 사업 (과거 투찰 데이터가 없으므로 가짜 투찰가 완전 배제)
  return createEmptyMatch(liveBid);
}

function createEmptyMatch(liveBid) {
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
    strategicAdvice: '직전 3개년간 동일 명칭의 선행 조달 이력이 없는 신규/단년 사업입니다. 기득권 사업자가 없어 모든 응찰자에게 동등한 기회가 열려 있으며, 과거 낙찰 데이터가 없으므로 과업지시서 및 원가계산서 기준 자율 투찰이 필요합니다.'
  };
}

module.exports = {
  loadLiveBids,
  saveLiveBids,
  findCrossMatch,
  extractAgencyKeyword,
  cleanTitle
};
