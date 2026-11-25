const fs = require('fs');
const { calculateAnalytics } = require('../src/analytics');
const projects = JSON.parse(fs.readFileSync('data/projects.json'));
const res = calculateAnalytics(projects);

console.log('=== All 3 Years (res.under500M) ===');
console.log('Total Count:', res.under500M.totalCount);
console.log('Total Budget:', (res.under500M.totalBudget/1e8).toFixed(1) + '억');
console.log('Buckets:', res.under500M.buckets.map(b => b.label + ': ' + b.count + '건 (' + (b.budget/1e8).toFixed(1) + '억)'));
console.log('Top Agencies:', res.under500M.topAgencies.slice(0, 5).map(a => a.agency + ': ' + a.count + '건'));

console.log('\n=== 2026 Only ===');
const y26 = res.byYear['2026'].under500M;
console.log('Total Count:', y26.totalCount);
console.log('Total Budget:', (y26.totalBudget/1e8).toFixed(1) + '억');
console.log('Buckets:', y26.buckets.map(b => b.label + ': ' + b.count + '건 (' + (b.budget/1e8).toFixed(1) + '억)'));
console.log('Top Agencies:', y26.topAgencies.slice(0, 5).map(a => a.agency + ': ' + a.count + '건'));

console.log('\n=== 2025 Only ===');
const y25 = res.byYear['2025'].under500M;
console.log('Total Count:', y25.totalCount);
console.log('Total Budget:', (y25.totalBudget/1e8).toFixed(1) + '억');

console.log('\n=== 2024 Only ===');
const y24 = res.byYear['2024'].under500M;
console.log('Total Count:', y24.totalCount);
console.log('Total Budget:', (y24.totalBudget/1e8).toFixed(1) + '억');
