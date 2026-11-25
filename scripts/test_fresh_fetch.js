const { fetchKonepsBids, DEFAULT_SERVICE_KEY } = require('../src/konepsClient');

async function test() {
  console.log('Testing fresh fetchKonepsBids...');
  const t0 = Date.now();
  const bids = await fetchKonepsBids({ keyword: '공간정보' });
  const dt = Date.now() - t0;
  console.log(`Fetched ${bids.length} bids in ${dt}ms`);
  const under500 = bids.filter(b => b.isUnder500M);
  console.log(`Under 500M: ${under500.length}`);
  for (const b of under500.slice(0, 5)) {
    console.log(` - [${b.bidNtceNo}] ${b.bidNtceNm} | ${b.dminsttNm} | ${b.assignBdgtAmt?.toLocaleString()}원 | close: ${b.bidClseDt}`);
  }
}

test();
