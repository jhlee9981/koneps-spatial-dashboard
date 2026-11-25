import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

mismatches = []
for fam in d.get('families', []):
    h = {x['year']: x for x in fam.get('history', [])}
    b24 = h.get(2024, {}).get('budget')
    b25 = h.get(2025, {}).get('budget')
    b26 = h.get(2026, {}).get('budget')
    old_rate = fam.get('budgetGrowthRate')
    
    # Correct YoY: compare with b25 if available, else b24
    base = b25 if (b25 and b25 > 0) else (b24 if (b24 and b24 > 0) else b26)
    new_rate = round(((b26 - base) / base) * 100.0, 1) if base and base > 0 else 0.0
    
    if abs(old_rate - new_rate) > 0.1 or (b25 and b26 and ((b26 < b25 and old_rate > 0) or (b26 > b25 and old_rate < 0))):
        mismatches.append({
            'id': fam.get('familyId'),
            'name': fam.get('familyName'),
            'b24': b24,
            'b25': b25,
            'b26': b26,
            'old': old_rate,
            'new': new_rate
        })

print(f"Total families with mismatched growth rates: {len(mismatches)}")
for m in mismatches:
    print(f"\n[{m['id']}] {m['name']}")
    print(f"  2024: {m['b24']:,}원 | 2025: {m['b25']:,}원 | 2026: {m['b26']:,}원")
    print(f"  기존(2024기준 왜곡): {m['old']}%  ===>  수정(전년2025 YoY 기준): {m['new']}%")
