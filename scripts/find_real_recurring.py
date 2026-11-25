import zipfile
import xml.etree.ElementTree as ET
import json
import re
import sys, os
sys.path.append(os.path.dirname(__file__))
from analyze_all_three_years import load_excel_records

rec24 = load_excel_records('data/koneps_2024.xlsx')
rec25 = load_excel_records('data/koneps_2025.xlsx')
rec26 = load_excel_records('data/koneps_2026.xlsx')

def normalize_title(title):
    t = re.sub(r'20\d\d년?도?', '', title)
    t = re.sub(r'\d\d년?도?', '', t)
    t = re.sub(r'\[.*?\]', '', t)
    t = re.sub(r'\(.*?\)', '', t)
    t = re.sub(r'\s+', '', t)
    return t

def normalize_agency(ag):
    # remove wide province prefixes to group by municipality
    for p in ['경기도 ', '강원특별자치도 ', '강원도 ', '충청북도 ', '충청남도 ', '전북특별자치도 ', '전라북도 ', '전라남도 ', '경상북도 ', '경상남도 ', '제주특별자치도 ']:
        ag = ag.replace(p, '')
    return ag.strip()

print("Analyzing Recurring Families across 2024, 2025, 2026...")

# Group by (normalized_agency, category_keyword)
agencies_26 = set(r.get('M', '') for r in rec26)
agencies_25 = set(r.get('M', '') for r in rec25)
agencies_24 = set(r.get('M', '') for r in rec24)

common_3yr = agencies_26.intersection(agencies_25).intersection(agencies_24)
print(f"Agencies present in all 3 years: {len(common_3yr)}")

# Let's see some matched projects across all 3 years
matches = []
for r26 in rec26:
    ag26 = r26.get('M', '')
    t26_norm = normalize_title(r26.get('H', ''))
    
    # find match in 2025
    m25 = [r for r in rec25 if r.get('M') == ag26 and (normalize_title(r.get('H', '')) in t26_norm or t26_norm in normalize_title(r.get('H', '')) or '유지' in r.get('H', ''))]
    # find match in 2024
    m24 = [r for r in rec24 if r.get('M') == ag26 and (normalize_title(r.get('H', '')) in t26_norm or t26_norm in normalize_title(r.get('H', '')) or '유지' in r.get('H', ''))]
    
    if m25 and m24:
        matches.append({
            'agency': ag26,
            'title26': r26.get('H'),
            'b26': r26.get('AE'),
            'w26': r26.get('AL'),
            'r26': r26.get('AP'),
            'title25': m25[0].get('H'),
            'b25': m25[0].get('AE'),
            'w25': m25[0].get('AL'),
            'r25': m25[0].get('AP'),
            'title24': m24[0].get('H'),
            'b24': m24[0].get('AE'),
            'w24': m24[0].get('AL'),
            'r24': m24[0].get('AP'),
        })

print(f"Total strong recurring matches across 3 years: {len(matches)}")
for m in matches[:10]:
    b26_val = int(m['b26'].replace(',', '')) if m['b26'].replace(',', '').isdigit() else 0
    print(f"\n[기관: {m['agency']}] (2026 예산: {b26_val:,}원)")
    print(f"  2024: {m['title24']} | 예산:{m['b24']} | 수주:{m['w24']} | 투찰률:{m['r24']}%")
    print(f"  2025: {m['title25']} | 예산:{m['b25']} | 수주:{m['w25']} | 투찰률:{m['r25']}%")
    print(f"  2026: {m['title26']} | 예산:{m['b26']} | 수주:{m['w26']} | 투찰률:{m['r26']}%")
