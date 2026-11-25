import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

if isinstance(data, dict):
    families = data.get('families', [])
else:
    families = data

print('Total families:', len(families))
for item in families:
    title = item.get('currentTitle') or item.get('title', '')
    if any(k in title for k in ['목재수확', '차량', '트렌드']):
        print('=== TITLE:', title, '===')
        print('ID:', item.get('id'))
        print('isUnder500M:', item.get('isUnder500M'))
        print('History:')
        for h in item.get('history', []):
            yr = h.get('year')
            bg = h.get('budgetAmt')
            wn = h.get('winnerCorp')
            no = h.get('bidNtceNo')
            print(f"  {yr}: budget={bg}, winner={wn}, ntceNo={no}")
