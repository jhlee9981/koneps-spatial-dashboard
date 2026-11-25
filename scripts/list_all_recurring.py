import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

fams = d.get('families', [])
for i, fam in enumerate(fams):
    fid = fam.get('familyId')
    fn = fam.get('familyName')
    ag = fam.get('agency')
    b26 = fam.get('history', [{}, {}, {}])[2].get('budget', 0)
    print(f"[{i:02d}] {fid} | {ag} | {fn[:35]} | 2026: {b26:,}원")
