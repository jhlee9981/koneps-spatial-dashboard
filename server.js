const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { calculateAnalytics } = require('./src/analytics');
const { fetchKonepsBids, fetchBidAttachments, fetchBidJointContract, fetchBidIncentiveRegion, DEFAULT_SERVICE_KEY } = require('./src/konepsClient');
const { loadLiveBids, saveLiveBids, findCrossMatch } = require('./src/liveBidsManager');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const RECURRING_FILE = path.join(__dirname, 'data', 'recurring_projects.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadProjects() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('데이터 파일 읽기 오류:', err);
  }
  return [];
}

function loadRecurringData() {
  try {
    if (fs.existsSync(RECURRING_FILE)) {
      const content = fs.readFileSync(RECURRING_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('계속사업 데이터 파일 읽기 오류:', err);
  }
  return { summary: {}, families: [] };
}

function saveProjects(projects) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('데이터 파일 저장 오류:', err);
    return false;
  }
}

function getLocalIpv4List() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, ip: net.address });
      }
    }
  }
  return ips;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 라우팅
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 1. GET /api/info
    if (pathname === '/api/info' && method === 'GET') {
      const projects = loadProjects();
      const localIps = getLocalIpv4List();
      const under500Count = projects.filter(p => (p.assignBdgtAmt || 0) < 500000000).length;
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        recordCount: projects.length,
        under500Count,
        port: PORT,
        localIps,
        primaryIp: localIps.length > 0 ? localIps[0].ip : 'localhost',
        dateRange: "2026-01-01 ~ 2026-11-24",
        keyword: "공간정보 (5억 미만 중점)"
      }));
      return;
    }

    // 2. GET /api/analytics
    if (pathname === '/api/analytics' && method === 'GET') {
      let projects = loadProjects();
      // query param ?onlyUnder500=true 지원
      if (parsedUrl.query.onlyUnder500 === 'true') {
        projects = projects.filter(p => (p.assignBdgtAmt || 0) < 500000000);
      }
      const analytics = calculateAnalytics(projects);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: analytics }));
      return;
    }

    // 2-1. GET /api/recurring (과거 3개년 계속사업 분석 데이터)
    if (pathname === '/api/recurring' && method === 'GET') {
      const recData = loadRecurringData();
      let families = [...(recData.families || [])];
      const query = parsedUrl.query;

      // 1. 유형 필터 (전체, locked, churn, high_growth, early_2027)
      if (query.filter === 'locked') {
        families = families.filter(f => f.isIncumbentLocked);
      } else if (query.filter === 'churn') {
        families = families.filter(f => f.winnerChangeCount > 0);
      } else if (query.filter === 'high_growth') {
        families = families.filter(f => f.budgetGrowthRate >= 10.0);
      } else if (query.filter === 'early_2027') {
        families = families.filter(f => 
          f.expectedNextNoticeDate.startsWith('2027.01') || 
          f.expectedNextNoticeDate.startsWith('2027.02') || 
          f.expectedNextNoticeDate.startsWith('2027.03')
        );
      }

      // 2. 카테고리 필터
      if (query.category && query.category !== '전체') {
        families = families.filter(f => f.category === query.category);
      }

      // 3. 예산 구간 필터 (5억 미만 필터 지원)
      if (query.under500Only === 'true' || query.tier === '5억 미만') {
        families = families.filter(f => f.isUnder500M);
      } else if (query.tier === '5억 이상') {
        families = families.filter(f => !f.isUnder500M);
      } else if (query.tier && query.tier !== '전체') {
        families = families.filter(f => f.budgetTier === query.tier);
      }

      // 4. 검색어 필터 (사업명, 지자체/기관, 수주업체, 과업키워드)
      if (query.q) {
        const qLower = query.q.toLowerCase().trim();
        families = families.filter(f =>
          (f.familyName && f.familyName.toLowerCase().includes(qLower)) ||
          (f.agency && f.agency.toLowerCase().includes(qLower)) ||
          (f.incumbentCompany && f.incumbentCompany.toLowerCase().includes(qLower)) ||
          (f.strategicAction && f.strategicAction.toLowerCase().includes(qLower))
        );
      }

      // 5. 정렬 (budget_desc, budget_asc, growth_desc, next_date)
      const sort = query.sort || 'growth_desc';
      if (sort === 'budget_desc') {
        families.sort((a, b) => b.total3YrBudget - a.total3YrBudget);
      } else if (sort === 'budget_asc') {
        families.sort((a, b) => a.total3YrBudget - b.total3YrBudget);
      } else if (sort === 'growth_desc') {
        families.sort((a, b) => b.budgetGrowthRate - a.budgetGrowthRate);
      } else if (sort === 'next_date') {
        families.sort((a, b) => a.expectedNextNoticeDate.localeCompare(b.expectedNextNoticeDate));
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        summary: recData.summary || {},
        total: families.length,
        data: families
      }));
      return;
    }

    // 2-2. GET /api/bids/live (현재 접수 중 실시간 OpenAPI 공고)
    if (pathname === '/api/bids/live' && method === 'GET') {
      const rawBids = loadLiveBids();
      const projects = loadProjects();
      const recData = loadRecurringData();
      const recFamilies = recData.families || [];
      const query = parsedUrl.query;
      const now = new Date('2026-11-24T18:00:00+09:00'); // 기준시각 (2026년 실시간 조달청 공고 기준)

      let bids = rawBids.map(b => {
        // D-Day 계산
        let dday = null;
        let ddayText = '접수중';
        if (b.bidClseDt) {
          const closeDate = new Date(b.bidClseDt.replace(' ', 'T'));
          const diffMs = closeDate - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          dday = diffDays;
          if (diffDays < 0) ddayText = '마감';
          else if (diffDays === 0) ddayText = '오늘 마감 (D-Day)';
          else ddayText = `D-${diffDays}`;
        }

        const crossMatch = findCrossMatch(b, projects, recFamilies);

        return {
          ...b,
          dday,
          ddayText,
          crossMatch
        };
      });

      // 1. 5억 미만 필터 기본 적용
      if (query.under500Only !== 'false' && query.tier !== '전체') {
        bids = bids.filter(b => (b.assignBdgtAmt || b.presmptPrce || 0) < 500000000);
      }

      // 2. 예산 구간 필터
      if (query.tier && query.tier !== '전체' && query.tier !== '5억 미만') {
        bids = bids.filter(b => b.budgetTier === query.tier);
      }

      // 3. 카테고리 필터
      if (query.category && query.category !== '전체') {
        bids = bids.filter(b => b.category === query.category);
      }

      // 4. 계약방식 필터
      if (query.noticeType && query.noticeType !== '전체') {
        bids = bids.filter(b => (b.noticeType || "").includes(query.noticeType) || (b.awardMethod || "").includes(query.noticeType));
      }

      // 5. 퀵 필터 (dday3, small, single_corp, matched)
      if (query.quickFilter === 'dday3') {
        bids = bids.filter(b => typeof b.dday === 'number' && b.dday >= 0 && b.dday <= 3);
      } else if (query.quickFilter === 'small') {
        bids = bids.filter(b => (b.assignBdgtAmt || 0) < 50000000);
      } else if (query.quickFilter === 'single_corp') {
        bids = bids.filter(b => (b.assignBdgtAmt || 0) >= 100000000 && (b.assignBdgtAmt || 0) <= 300000000);
      } else if (query.quickFilter === 'matched') {
        bids = bids.filter(b => b.crossMatch && b.crossMatch.matched);
      }

      // 6. 검색어 필터
      if (query.q) {
        const qLower = query.q.toLowerCase().trim();
        bids = bids.filter(b =>
          (b.bidNtceNm && b.bidNtceNm.toLowerCase().includes(qLower)) ||
          (b.dminsttNm && b.dminsttNm.toLowerCase().includes(qLower)) ||
          (b.ntceInsttNm && b.ntceInsttNm.toLowerCase().includes(qLower)) ||
          (b.bidNtceNo && b.bidNtceNo.includes(qLower))
        );
      }

      // 7. 정렬
      const sort = query.sort || 'dday_asc';
      if (sort === 'budget_desc') {
        bids.sort((a, b) => (b.assignBdgtAmt || 0) - (a.assignBdgtAmt || 0));
      } else if (sort === 'budget_asc') {
        bids.sort((a, b) => (a.assignBdgtAmt || 0) - (b.assignBdgtAmt || 0));
      } else if (sort === 'newest') {
        bids.sort((a, b) => (b.bidNtceDt || "").localeCompare(a.bidNtceDt || ""));
      } else {
        // dday_asc: 마감 임박순
        bids.sort((a, b) => {
          const dayA = typeof a.dday === 'number' && a.dday >= 0 ? a.dday : 999;
          const dayB = typeof b.dday === 'number' && b.dday >= 0 ? b.dday : 999;
          return dayA - dayB;
        });
      }

      const totalBudget = bids.reduce((s, b) => s + (b.assignBdgtAmt || b.presmptPrce || 0), 0);
      const dday3Count = rawBids.filter(b => {
        const closeDate = new Date((b.bidClseDt || "").replace(' ', 'T'));
        const diffDays = Math.ceil((closeDate - now) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
      }).length;
      const smallCount = rawBids.filter(b => (b.assignBdgtAmt || 0) < 50000000).length;

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        total: bids.length,
        summary: {
          totalLiveCount: bids.length,
          totalLiveBudget: totalBudget,
          dday3Count,
          smallCount,
          under500Count: rawBids.filter(b => (b.assignBdgtAmt || 0) < 500000000).length
        },
        data: bids
      }));
      return;
    }

    // 2-3. POST /api/bids/refresh (OpenAPI 실시간 공고 갱신)
    if (pathname === '/api/bids/refresh' && method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const serviceKey = body.serviceKey || DEFAULT_SERVICE_KEY;
          if (!serviceKey) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: '공공데이터포털 일반 인증키(serviceKey)가 필요합니다.' }));
            return;
          }

          const fetched = await fetchKonepsBids({
            serviceKey,
            keyword: body.keyword || '공간정보',
            beginDate: body.beginDate || '202410280000',
            endDate: body.endDate || '202411242359',
            maxPages: parseInt(body.maxPages, 10) || 3
          });

          const currentLive = loadLiveBids();
          const liveMap = new Map();
          currentLive.forEach(b => liveMap.set(b.bidNtceNo, b));

          let newCount = 0;
          fetched.forEach(item => {
            const budget = item.assignBdgtAmt || item.presmptPrce || 0;
            if (budget < 500000000) {
              if (!liveMap.has(item.bidNtceNo)) newCount++;
              liveMap.set(item.bidNtceNo, {
                ...item,
                isUnder500M: true,
                budgetTier: budget < 50000000 ? '5천만 미만' : (budget < 100000000 ? '5천만~1억' : (budget < 300000000 ? '1억~3억' : '3억~5억'))
              });
            }
          });

          const merged = Array.from(liveMap.values());
          saveLiveBids(merged);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: `공공데이터포털 실시간 갱신 완료: 총 ${fetched.length}건 중 5억 미만 공고 ${merged.length}건 유지 (신규 ${newCount}건 추가)`,
            newCount,
            total: merged.length
          }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // 2-4. GET /api/bids/cross-match (특정 실시간 공고 크로스 매칭 상세)
    if (pathname === '/api/bids/cross-match' && method === 'GET') {
      const bidNo = parsedUrl.query.bidNo;
      const rawBids = loadLiveBids();
      const target = rawBids.find(b => b.bidNtceNo === bidNo);
      if (!target) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, message: '해당 공고를 찾을 수 없습니다.' }));
        return;
      }

      const projects = loadProjects();
      const recData = loadRecurringData();
      const crossMatch = findCrossMatch(target, projects, recData.families || []);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        bid: target,
        crossMatch
      }));
      return;
    }

    // 2-5. GET /api/bids/attachments (조달청 02 첨부파일 정보조회: 과업지시서, 공고서 등)
    if (pathname === '/api/bids/attachments' && method === 'GET') {
      const bidNtceNo = parsedUrl.query.bidNtceNo;
      const bidNtceOrd = parsedUrl.query.bidNtceOrd || '000';
      if (!bidNtceNo) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'bidNtceNo 파라미터가 필요합니다.' }));
        return;
      }

      try {
        const atchFiles = await fetchBidAttachments({
          bidNtceNo,
          bidNtceOrd,
          serviceKey: parsedUrl.query.serviceKey || DEFAULT_SERVICE_KEY
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          bidNtceNo,
          bidNtceOrd,
          total: atchFiles.length,
          data: atchFiles
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
      return;
    }

    // 2-6. GET /api/bids/joint-contract (조달청 02 공동도급의무지역 정보조회)
    if (pathname === '/api/bids/joint-contract' && method === 'GET') {
      const bidNtceNo = parsedUrl.query.bidNtceNo;
      const bidNtceOrd = parsedUrl.query.bidNtceOrd || '000';
      if (!bidNtceNo) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: 'bidNtceNo 파라미터가 필요합니다.' }));
        return;
      }

      try {
        const jointInfo = await fetchBidJointContract({
          bidNtceNo,
          bidNtceOrd,
          serviceKey: parsedUrl.query.serviceKey || DEFAULT_SERVICE_KEY
        });

        const incentiveInfo = await fetchBidIncentiveRegion({
          bidNtceNo,
          bidNtceOrd,
          serviceKey: parsedUrl.query.serviceKey || DEFAULT_SERVICE_KEY
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          bidNtceNo,
          bidNtceOrd,
          jointContract: jointInfo,
          incentiveRegion: incentiveInfo
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
      return;
    }

    // 3. GET /api/projects
    if (pathname === '/api/projects' && method === 'GET') {
      let projects = loadProjects();
      const query = parsedUrl.query;

      // 5억 미만 필터 기본 지원
      if (query.under500Only === 'true' || query.budgetRange === '5억 미만') {
        projects = projects.filter(p => (p.assignBdgtAmt || 0) < 500000000);
      }

      // 검색어 필터
      if (query.q) {
        const qLower = query.q.toLowerCase().trim();
        projects = projects.filter(p => 
          (p.bidNtceNm && p.bidNtceNm.toLowerCase().includes(qLower)) ||
          (p.dminsttNm && p.dminsttNm.toLowerCase().includes(qLower)) ||
          (p.ntceInsttNm && p.ntceInsttNm.toLowerCase().includes(qLower)) ||
          (p.bidNtceNo && p.bidNtceNo.includes(qLower))
        );
      }

      // 카테고리 필터
      if (query.category && query.category !== '전체') {
        projects = projects.filter(p => p.category === query.category);
      }

      // 기관 유형 필터
      if (query.orgType && query.orgType !== '전체') {
        projects = projects.filter(p => p.orgType === query.orgType);
      }

      // 월별 필터
      if (query.month && query.month !== '전체') {
        projects = projects.filter(p => p.bidNtceDt && p.bidNtceDt.startsWith(query.month));
      }

      // 계약방법 필터
      if (query.contractMethod && query.contractMethod !== '전체') {
        projects = projects.filter(p => p.cntrctCnclsMthdNm === query.contractMethod);
      }

      // 세분화된 예산 구간 필터
      if (query.budgetRange && query.budgetRange !== '전체' && query.budgetRange !== '5억 미만') {
        if (query.budgetRange === '5천만 미만') projects = projects.filter(p => p.assignBdgtAmt < 50000000);
        else if (query.budgetRange === '5천만 ~ 1억') projects = projects.filter(p => p.assignBdgtAmt >= 50000000 && p.assignBdgtAmt < 100000000);
        else if (query.budgetRange === '1억 ~ 3억') projects = projects.filter(p => p.assignBdgtAmt >= 100000000 && p.assignBdgtAmt < 300000000);
        else if (query.budgetRange === '3억 ~ 5억') projects = projects.filter(p => p.assignBdgtAmt >= 300000000 && p.assignBdgtAmt < 500000000);
        else if (query.budgetRange === '5억 이상') projects = projects.filter(p => p.assignBdgtAmt >= 500000000);
      }

      // 정렬
      const sort = query.sort || 'date_desc';
      if (sort === 'budget_desc') projects.sort((a, b) => (b.assignBdgtAmt || 0) - (a.assignBdgtAmt || 0));
      else if (sort === 'budget_asc') projects.sort((a, b) => (a.assignBdgtAmt || 0) - (b.assignBdgtAmt || 0));
      else if (sort === 'date_asc') projects.sort((a, b) => new Date(a.bidNtceDt) - new Date(b.bidNtceDt));
      else projects.sort((a, b) => new Date(b.bidNtceDt) - new Date(a.bidNtceDt));

      // 페이지네이션
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 20;
      const totalCount = projects.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedItems = projects.slice(startIndex, startIndex + limit);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        total: totalCount,
        page,
        limit,
        totalPages,
        data: paginatedItems
      }));
      return;
    }

    // 4. POST /api/koneps/sync (OpenAPI 실시간 연동)
    if (pathname === '/api/koneps/sync' && method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const serviceKey = body.serviceKey;
          if (!serviceKey) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: 'serviceKey가 제공되지 않았습니다.' }));
            return;
          }

          const fetched = await fetchKonepsBids({
            serviceKey,
            keyword: body.keyword || '공간정보',
            beginDate: body.beginDate || '202611010000',
            endDate: body.endDate || '202611242359',
            maxPages: parseInt(body.maxPages, 10) || 3
          });

          const current = loadProjects();
          const existingMap = new Map();
          current.forEach(p => existingMap.set(p.bidNtceNo, p));

          let newCount = 0;
          fetched.forEach(item => {
            if (!existingMap.has(item.bidNtceNo)) {
              newCount++;
            }
            existingMap.set(item.bidNtceNo, item);
          });

          const updatedList = Array.from(existingMap.values());
          saveProjects(updatedList);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: `나라장터 실시간 동기화 완료: ${fetched.length}건 수신 (신규 ${newCount}건 추가)`,
            totalRecords: updatedList.length,
            newCount
          }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // 5. POST /api/projects/import
    if (pathname === '/api/projects/import' && method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(bodyStr);
          const items = Array.isArray(payload) ? payload : (payload.items || []);
          if (items.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, message: '업로드할 데이터가 없습니다.' }));
            return;
          }

          const current = loadProjects();
          const existingMap = new Map();
          current.forEach(p => existingMap.set(p.bidNtceNo, p));
          items.forEach(p => existingMap.set(p.bidNtceNo || String(Date.now() + Math.random()), p));

          const merged = Array.from(existingMap.values());
          saveProjects(merged);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: `${items.length}건 데이터 성공적으로 저장`,
            totalRecords: merged.length
          }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: 'JSON 파싱 오류: ' + err.message }));
        }
      });
      return;
    }

    // 6. POST /api/projects/reset
    if (pathname === '/api/projects/reset' && method === 'POST') {
      const { execSync } = require('child_process');
      const pyExe = 'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe';
      const scriptPath = path.join(__dirname, 'scripts', 'build_all_three_years_data.py');
      try {
        execSync(`"${pyExe}" "${scriptPath}"`, { stdio: 'inherit' });
      } catch (e) {
        console.error('데이터 재생성 오류:', e);
      }
      const refreshed = loadProjects();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: '조달청 나라장터 공식 3개년 실측 데이터(총 419건, 2026년 5억 미만 92건)로 복원되었습니다.',
        totalRecords: refreshed.length
      }));
      return;
    }

    // 7. POST /api/recurring/reset
    if (pathname === '/api/recurring/reset' && method === 'POST') {
      const { execSync } = require('child_process');
      const pyExe = 'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe';
      const scriptPath = path.join(__dirname, 'scripts', 'build_all_three_years_data.py');
      try {
        execSync(`"${pyExe}" "${scriptPath}"`, { stdio: 'inherit' });
      } catch (e) {
        console.error('계속사업 데이터 재생성 오류:', e);
      }
      const recData = loadRecurringData();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: '조달청 3개년 실측 계속사업 93개 패밀리로 복원되었습니다.',
        totalRecords: (recData.families || []).length
      }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: '존재하지 않는 API 엔드포인트입니다.' }));
    return;
  }

  // 정적 파일 서빙
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fErr, fContent) => {
          if (fErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`서버 오류: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpv4List();
  console.log(`=======================================================`);
  console.log(`🚀 [5억 미만 중점] 2026 공간정보 사업 분석 웹 서버 가동`);
  console.log(`-------------------------------------------------------`);
  console.log(`💻 PC 브라우저 접속:     http://localhost:${PORT}`);
  localIps.forEach(net => {
    console.log(`📱 모바일 기기 접속:    http://${net.ip}:${PORT}  (${net.name})`);
  });
  console.log(`=======================================================`);
});
