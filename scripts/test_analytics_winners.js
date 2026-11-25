const fs = require('fs');
const { calculateAnalytics } = require('../src/analytics');
const projects = JSON.parse(fs.readFileSync('data/projects.json'));

const res = calculateAnalytics(projects);
console.log('--- Under 500M Top Winners ---');
const winners = res.under500M.topWinners || res.winStats.topWinners;
winners.forEach((w, i) => {
  console.log(`${i+1}. ${w.winner}: under500Count=${w.under500Count}, under500TotalWon=${w.under500TotalWon} (전체: count=${w.count}, totalWon=${w.totalWon})`);
});
