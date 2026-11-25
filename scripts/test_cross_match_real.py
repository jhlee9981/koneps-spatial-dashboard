import json
import re

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    rec_data = json.load(f)
families = rec_data.get('families', [])

with open('data/projects.json', 'r', encoding='utf-8') as f:
    projects = json.load(f)

# Load fetched real bids from task-1347 output or run fetch
import fetch_real_live_bids

print(f"\n================ CROSS MATCHING REAL LIVE BIDS ================")
for b in fetch_real_live_bids.live_bids:
    title = b['title']
    agency = b['agency']
    budget = b['budget']
    
    # Try match in recurring families
    best_match = None
    best_score = 0
    for fam in families:
        f_agency = fam.get('agency', '')
        f_name = fam.get('familyName', '')
        
        # agency matching
        ag_matched = False
        if agency in f_agency or f_agency in agency:
            ag_matched = True
        else:
            # check city name like 김해시, 화성시, 파주시, 성남시, 용인시, 울산광역시, 창원시
            city = re.findall(r'[가-힣]+(?:시|군|구)', agency)
            f_city = re.findall(r'[가-힣]+(?:시|군|구)', f_agency)
            if city and f_city and set(city) & set(f_city):
                ag_matched = True
        
        if ag_matched:
            # check title similarity
            w1 = set(re.findall(r'[가-힣]{2,}', title)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2024년', '2025년', '2026년'}
            w2 = set(re.findall(r'[가-힣]{2,}', f_name)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2024년', '2025년', '2026년'}
            sim = len(w1 & w2) / max(len(w1 | w2), 1)
            score = 0.5 + sim
            if score > best_score:
                best_score = score
                best_match = fam
    
    if best_match and best_score >= 0.5:
        inc = best_match.get('incumbentCompany')
        print(f"🎯 MATCHED: {title[:30]} ({agency})")
        print(f"   -> 패밀리: {best_match.get('familyName')[:30]}")
        print(f"   -> 기존 사업자: {inc} / 위험·기회: {best_match.get('riskOpportunityLevel')}")
        print(f"   -> 전략 제언: {best_match.get('strategicAction')[:70]}...")
    else:
        print(f"✨ NEW/SINGLE: {title[:30]} ({agency}) -> 기존 사업자 고착 없음 (신규 기회)")
