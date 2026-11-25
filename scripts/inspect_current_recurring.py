import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

families = data.get('families', [])
print(f"Total recurring projects: {len(families)}")
for r in families:
    agency = r.get('agency', '')
    name = r.get('name', '')
    if '공간정보산업진흥원' in agency or '차량' in name or '트렌드' in name or '아이씨티웨이' in str(r):
        print(f"\nID: {r.get('recurringId')} | Title: {name} | Agency: {agency} | 5억미만: {r.get('isUnder500M')}")
        for yr in ['2024', '2025', '2026']:
            h = r.get('history', {}).get(yr, {})
            b = h.get('assignBdgtAmt') or 0
            print(f"  [{yr}] {h.get('noticeNo')} | {h.get('noticeName')} | {b:,}원 | {h.get('succBidCorp')}")

