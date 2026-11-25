const { DEFAULT_SERVICE_KEY } = require('../src/konepsClient');

async function testFetch() {
  const t0 = Date.now();
  const operations = [
    { op: "getBidPblancListInfoServcPPSSrch02", workType: "일반용역" },
    { op: "getBidPblancListInfoThngPPSSrch02", workType: "물품" },
    { op: "getBidPblancListInfoCnstwkPPSSrch02", workType: "공사" }
  ];

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const formatDt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  
  const endStr = `${formatDt(now)}2359`;
  const chunks = [];
  for (let i = 0; i < 4; i++) {
    const wEnd = new Date(now);
    wEnd.setDate(wEnd.getDate() - (i * 7));
    const wBgn = new Date(wEnd);
    wBgn.setDate(wBgn.getDate() - 6);
    chunks.push({
      bgn: `${formatDt(wBgn)}0000`,
      end: `${formatDt(wEnd)}2359`
    });
  }

  const tasks = [];
  for (const { op, workType } of operations) {
    for (const chunk of chunks) {
      tasks.push((async () => {
        const url = `https://apis.data.go.kr/1230000/ad/BidPublicInfoService02/${op}?serviceKey=${DEFAULT_SERVICE_KEY}&numOfRows=100&pageNo=1&inqryDiv=1&inqryBgnDt=${chunk.bgn}&inqryEndDt=${chunk.end}&bidNtceNm=${encodeURIComponent('공간정보')}&type=json`;
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const json = await r.json();
          const items = json?.response?.body?.items || [];
          return Array.isArray(items) ? items : (items ? [items] : []);
        } catch (e) {
          return [];
        }
      })());
    }
  }

  const results = await Promise.all(tasks);
  const totalItems = results.flat();
  const uniqueNos = new Set(totalItems.map(it => `${it.bidNtceNo}-${it.bidNtceOrd || '000'}`));
  const dt = Date.now() - t0;

  console.log(`⚡ Concurrently fetched ${tasks.length} requests in ${dt}ms!`);
  console.log(`Total items found: ${totalItems.length}, Unique notices: ${uniqueNos.size}`);
}

testFetch();
