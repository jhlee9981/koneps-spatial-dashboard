const fs = require('fs');

const projects = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const recurring = JSON.parse(fs.readFileSync('data/recurring_projects.json', 'utf8')).families;
const liveBids = JSON.parse(fs.readFileSync('data/live_bids.json', 'utf8'));

function extractAgencyKeyword(agencyStr) {
  if (!agencyStr) return '';
  const ag = agencyStr.trim();
  const m = ag.match(/([가-힣]{1,5}[시군구])\b/);
  if (m && !ag.match(/^(서울특별시|인천광역시|대전광역시|대구광역시|부산광역시|울산광역시|광주광역시)$/)) {
    return m[1].replace(/[시군구]$/, '');
  }
  if (ag.includes('경상남도') || ag === '경남') return '경상남도';
  if (ag.includes('경상북도') || ag === '경북') return '경상북도';
  if (ag.includes('전라남도') || ag === '전남') return '전라남도';
  if (ag.includes('전라북도') || ag.includes('전북')) return '전북';
  if (ag.includes('충청남도') || ag === '충남') return '충청남도';
  if (ag.includes('충청북도') || ag === '충북') return '충청북도';
  if (ag.includes('강원')) return '강원';
  if (ag.includes('제주')) return '제주';
  if (ag.includes('서울')) return '서울특별시';
  if (ag.includes('인천')) return '인천';
  if (ag.includes('대구')) return '대구';
  if (ag.includes('대전')) return '대전';
  if (ag.includes('부산')) return '부산';
  if (ag.includes('울산')) return '울산';
  if (ag.includes('광주')) return '광주';
  if (ag.includes('세종')) return '세종';
  return ag.replace(/(주식회사|\(주\)|재단법인|사단법인)/g, '').trim();
}

function cleanTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/\[긴급\]|\(긴급\)|\(협상에\s*의한\s*계약\)|\(소액수의\)/g, '')
    .replace(/202[4-7]년도?|25년~26년|2027~2028년도?/g, '')
    .replace(/용역|사업|유지관리|유지보수|구축|운영/g, '')
    .replace(/[^\w가-힣]/g, '')
    .trim();
}

console.log('=== Test Improved Cross Matching on All Live Bids ===');
liveBids.forEach(b => {
  const liveAg = extractAgencyKeyword(b.dminsttNm || b.ntceInsttNm);
  const liveTitle = cleanTitle(b.bidNtceNm);

  // 1. Try finding in projects.json (multi-year 2024~2026)
  const matchedProjects = projects.filter(p => {
    const pAg = extractAgencyKeyword(p.dminsttNm || p.ntceInsttNm);
    if (!liveAg || !pAg || pAg !== liveAg) return false;
    const pTitle = cleanTitle(p.bidNtceNm);
    if (!pTitle || !liveTitle) return false;
    return liveTitle.includes(pTitle) || pTitle.includes(liveTitle);
  });

  // Sort by year desc (2026 -> 2025 -> 2024)
  matchedProjects.sort((a, b) => (b.year || 0) - (a.year || 0));

  if (matchedProjects.length > 0) {
    const latest = matchedProjects[0];
    const winners = matchedProjects.map(p => `${p.year}년: ${p.succBidCorp || '낙찰'} (${p.contractAmt ? (p.contractAmt/1e8).toFixed(1)+'억' : '-'})`);
    console.log(`[MATCH - projects] ${b.bidNtceNm} (${b.dminsttNm})`);
    console.log(`  -> Incumbent: ${latest.succBidCorp} | History: ${winners.join(' | ')}`);
  } else {
    // 2. Try recurring families
    const fam = recurring.find(f => {
      const fAg = extractAgencyKeyword(f.agency);
      if (!liveAg || !fAg || fAg !== liveAg) return false;
      const fTitle = cleanTitle(f.familyName);
      if (!fTitle || !liveTitle) return false;
      return liveTitle.includes(fTitle) || fTitle.includes(liveTitle);
    });

    if (fam) {
      console.log(`[MATCH - recurring] ${b.bidNtceNm} (${b.dminsttNm})`);
      console.log(`  -> Incumbent: ${fam.incumbentCompany} | Fam: ${fam.familyName}`);
    } else {
      console.log(`[NO MATCH - New] ${b.bidNtceNm} (${b.dminsttNm})`);
    }
  }
});
