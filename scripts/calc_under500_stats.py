import json
with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
under = [f for f in d['families'] if f['isUnder500M']]
over = [f for f in d['families'] if not f['isUnder500M']]

total_3yr = sum(f['total3YrBudget'] for f in under)
total_26 = sum(f['history'][2]['budget'] for f in under)
churn = len([f for f in under if f['winnerChangeCount'] > 0])
locked = len([f for f in under if f['isIncumbentLocked']])
early = len([f for f in under if any(m in f['expectedNextNoticeDate'] for m in ['01', '02', '03'])])

print(f"Under 500M: {len(under)}건")
print(f"  3Yr Total: {total_3yr:,}원 ({total_3yr/1e8:.1f}억원)")
print(f"  2026 Total: {total_26:,}원 ({total_26/1e8:.1f}억원)")
print(f"  Churn: {churn}건")
print(f"  Locked: {locked}건")
print(f"  Early 2027: {early}건")
