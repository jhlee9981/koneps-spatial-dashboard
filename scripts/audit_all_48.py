import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

families = d.get('families', [])
print(f"Total families: {len(families)}")
under500 = [f for f in families if f.get('isUnder500M')]
over500 = [f for f in families if not f.get('isUnder500M')]
print(f"Under 500M: {len(under500)} families")
print(f"Over 500M: {len(over500)} families")

print("\n--- Summary of ALL 48 Families ---")
for i, fam in enumerate(families, 1):
    fid = fam.get('familyId')
    name = fam.get('familyName')
    ag = fam.get('agency')
    tier = fam.get('budgetTier')
    is_under = fam.get('isUnder500M')
    history = fam.get('history', [])
    years = [h.get('year') for h in history]
    budgets = [f"{h.get('year')}:{h.get('budget')//10000000}억" if h.get('budget') else f"{h.get('year')}:0" for h in history]
    winners = [f"{h.get('year')}:{h.get('winnerCorp')}" for h in history]
    print(f"{i:2d}. [{'5억미만' if is_under else '5억이상'}] {tier:8s} | {ag:15s} | {name[:30]:30s} | {', '.join(budgets)} | {', '.join(winners)}")
