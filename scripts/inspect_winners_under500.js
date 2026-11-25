const fs = require('fs');
const projects = JSON.parse(fs.readFileSync('data/projects.json'));

const under500Winners = {};
const allWinners = {};

projects.forEach(p => {
  if (!p.isSuccessBidded || !p.succBidCorp) return;
  const winner = p.succBidCorp.trim();
  const amt = p.contractAmt || p.succBidAmt || p.assignBdgtAmt || 0;
  const budget = p.assignBdgtAmt || p.presmptPrce || 0;
  const isUnder500 = budget < 500000000;

  if (!allWinners[winner]) allWinners[winner] = { winner, count: 0, totalWon: 0 };
  allWinners[winner].count++;
  allWinners[winner].totalWon += amt;

  if (isUnder500) {
    if (!under500Winners[winner]) under500Winners[winner] = { winner, count: 0, totalWon: 0 };
    under500Winners[winner].count++;
    under500Winners[winner].totalWon += amt;
  }
});

const topUnder500 = Object.values(under500Winners).sort((a, b) => b.count - a.count || b.totalWon - a.totalWon);
console.log('Top 15 Under 500M Winners:');
topUnder500.slice(0, 15).forEach((w, i) => {
  const allW = allWinners[w.winner] || { count: 0, totalWon: 0 };
  console.log((i+1) + '. ' + w.winner + ': ' + w.count + '건, 5억미만합계: ' + (w.totalWon/100000000).toFixed(2) + '억 (전체건수: ' + allW.count + '건, 전체합계: ' + (allW.totalWon/100000000).toFixed(2) + '억)');
});

console.log('\n주식회사 올포랜드:');
console.log('Under 500M:', under500Winners['주식회사 올포랜드']);
console.log('All Tiers:', allWinners['주식회사 올포랜드']);
