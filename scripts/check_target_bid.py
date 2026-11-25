import json
import zipfile
import xml.etree.ElementTree as ET

title_query = "2025~2026년 공간정보시스템 통합유지보수 용역"

print("=== 1. Checking data/live_bids.json ===")
with open('data/live_bids.json', 'r', encoding='utf-8') as f:
    live = json.load(f)

for b in live:
    if '통합유지보수' in b.get('bidNtceNm', '') or '남양주' in b.get('bidNtceNm', '') or '2025~2026' in b.get('bidNtceNm', ''):
        print("Live match:")
        print("  NoticeNo:", b.get('bidNtceNo'))
        print("  Title   :", b.get('bidNtceNm'))
        print("  Agency  :", b.get('dminsttNm'))
        print("  NoticeDt:", b.get('bidNtceDt'))
        print("  CloseDt :", b.get('bidClseDt'))
        print("  OpengDt :", b.get('opengDt'))
        print("  D-Day   :", b.get('ddayText'), b.get('dday'))
        print("  Budget  :", b.get('assignBdgtAmt'))

print("\n=== 2. Checking Excel files (2024, 2025, 2026) ===")
from analyze_all_three_years import load_excel_records

for yr in ['2024', '2025', '2026']:
    recs = load_excel_records(f'data/koneps_{yr}.xlsx')
    for r in recs:
        t = r.get('H', '')
        if '2025~2026' in t or '남양주' in t:
            print(f"Excel {yr}: {r.get('E')}-{r.get('F')} | {r.get('M')} | {t} | 공고일:{r.get('I')} | 개찰일:{r.get('R')} | 계약일:{r.get('AU')} | 수주:{r.get('AL')}")
