import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

families = data.get('families', []) if isinstance(data, dict) else data
print(f"Total families in recurring_projects.json: {len(families)}")
for i, fam in enumerate(families):
    title = fam.get('currentTitle') or fam.get('title')
    inst = fam.get('orderInst') or fam.get('clientOrg')
    h_years = [h.get('year') for h in fam.get('history', [])]
    b26 = None
    for h in fam.get('history', []):
        if h.get('year') == '2026':
            b26 = (h.get('budgetAmt'), h.get('winnerCorp'))
    print(f"[{i+1}] {inst} | {title} | 2026: {b26} | Years: {h_years}")
