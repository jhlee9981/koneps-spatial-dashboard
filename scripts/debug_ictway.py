from analyze_all_three_years import load_excel_records
import os

rec24 = load_excel_records('data/koneps_2024.xlsx')
rec25 = load_excel_records('data/koneps_2025.xlsx')
rec26 = load_excel_records('data/koneps_2026.xlsx')

print("=== 아이씨티웨이 주식회사 수주 내역 ===")
for yr, recs in [('2024', rec24), ('2025', rec25), ('2026', rec26)]:
    found = [r for r in recs if '아이씨티웨이' in r.get('AL', '')]
    print(f"[{yr}] {len(found)}건:")
    for f in found:
        print(f"  공고: {f.get('E')}-{f.get('F')} / 공고명: {f.get('H')} / 수요기관: {f.get('M')} / 배정예산: {f.get('AE')} / 계약금액: {f.get('AX')}")

print("\n=== 공간정보산업진흥원 발주 내역 ===")
for yr, recs in [('2024', rec24), ('2025', rec25), ('2026', rec26)]:
    found = [r for r in recs if '공간정보산업진흥원' in r.get('M', '')]
    print(f"[{yr}] {len(found)}건:")
    for f in found:
        print(f"  공고: {f.get('E')}-{f.get('F')} / 공고명: {f.get('H')} / 배정예산: {f.get('AE')} / 수주: {f.get('AL')}")
