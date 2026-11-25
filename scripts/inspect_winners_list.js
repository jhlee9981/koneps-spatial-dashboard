const fs = require('fs');
const projects = JSON.parse(fs.readFileSync('data/projects.json'));

const under500 = projects.filter(p => (p.assignBdgtAmt || p.presmptPrce || 0) < 500000000 && p.isSuccessBidded && p.succBidCorp);

const corpMap = {};
under500.forEach(p => {
  const c = p.succBidCorp.trim();
  if (!corpMap[c]) corpMap[c] = { name: c, count: 0, totalWon: 0, projects: [] };
  corpMap[c].count++;
  corpMap[c].totalWon += (p.contractAmt || p.succBidAmt || p.assignBdgtAmt || 0);
  corpMap[c].projects.push({ year: p.year, title: p.bidNtceNm, amt: p.contractAmt || p.succBidAmt || p.assignBdgtAmt });
});

const sorted = Object.values(corpMap).sort((a, b) => b.count - a.count || b.totalWon - a.totalWon);
console.log('Total unique winners in <5억: ' + sorted.length);

console.log('\nAll Winners in <5억:');
sorted.forEach((w, i) => {
  console.log((i+1) + '. ' + w.name + ': ' + w.count + '건 (' + (w.totalWon/1e8).toFixed(2) + '억)');
});
