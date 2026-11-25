const fs = require('fs');
const { calculateAnalytics } = require('../src/analytics');
const projects = JSON.parse(fs.readFileSync('data/projects.json'));
const res = calculateAnalytics(projects);

['all', '2026', '2025', '2024'].forEach(yr => {
  const d = res.byYear[yr];
  console.log('=== Year: ' + yr + ' ===');
  console.log('under500 count:', d.under500M.totalCount);
  console.log('under500 budget:', (d.under500M.totalBudget/1e8).toFixed(1) + '억');
  console.log('top Agencies (3):', d.under500M.topAgencies.slice(0, 3).map(a => a.agency + '(' + a.count + '건)'));
  console.log('top Themes (3):', d.topThemes.slice(0, 3).map(t => t.theme + '(' + t.count + ')'));
  console.log('top Winners (3):', d.under500M.topWinners.slice(0, 3).map(w => w.winner + '(' + w.under500Count + '건/' + (w.under500TotalWon/1e8).toFixed(1) + '억)'));
});
