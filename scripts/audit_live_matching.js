const fs = require('fs');
const { findCrossMatch } = require('../src/liveBidsManager');

const projects = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const recurring = JSON.parse(fs.readFileSync('data/recurring_projects.json', 'utf8')).families;
const liveBids = JSON.parse(fs.readFileSync('data/live_bids.json', 'utf8'));

console.log('=== Current Live Bids Cross Matching Audit ===');
liveBids.forEach(b => {
  const m = findCrossMatch(b, projects, recurring);
  console.log(`[${b.bidNtceNo}] ${b.bidNtceNm} (${b.dminsttNm || b.ntceInsttNm})`);
  console.log(`   Matched: ${m.matched} | Incumbent: ${m.incumbentCompany} | Source: ${m.source} | MatchedTitle: ${m.familyName} (${m.agency})`);
});
