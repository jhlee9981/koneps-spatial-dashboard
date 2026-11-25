import zipfile
import xml.etree.ElementTree as ET
import json
import re
import os

data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')

def load_excel_records(fn):
    with zipfile.ZipFile(fn) as z:
        sst = []
        if 'xl/sharedStrings.xml' in z.namelist():
            s_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            for si in s_tree.findall(f'{ns}si'):
                texts = [t.text for t in si.findall(f'.//{ns}t') if t.text is not None]
                sst.append(''.join(texts))
        
        ws_name = [n for n in z.namelist() if n.startswith('xl/worksheets/')][0]
        ws_tree = ET.fromstring(z.read(ws_name))
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        
        records = []
        for r in ws_tree.findall(f'.//{ns}row'):
            rnum = int(r.get('r'))
            if rnum < 6:
                continue
            cells = {}
            for c in r.findall(f'{ns}c'):
                ref = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                t = c.get('t')
                v_el = c.find(f'{ns}v')
                v = v_el.text if v_el is not None else ''
                if t == 's' and v.isdigit():
                    val = sst[int(v)]
                else:
                    t_el = c.find(f'{ns}t')
                    val = t_el.text if t_el is not None and t_el.text is not None else v
                cells[ref] = val.strip()
            records.append(cells)
        return records

def parse_int(s):
    if not s: return 0
    clean = re.sub(r'[^\d]', '', str(s))
    return int(clean) if clean else 0

def parse_float(s):
    if not s: return None
    clean = re.sub(r'[^\d.]', '', str(s))
    try:
        return float(clean)
    except:
        return None

def format_date(dt_str):
    if not dt_str: return ""
    clean = re.sub(r'[^\d]', '', str(dt_str))
    if len(clean) >= 8:
        return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
    return str(dt_str)

def classify_org_type(agency, so_gwan):
    if so_gwan == '지방정부' or any(k in agency for k in ['시', '군', '구', '도', '특별시', '광역시', '특별자치']):
        if not any(k in agency for k in ['공사', '공단', '진흥원', '연구원', '학교', '대학', '병원']):
            return "지자체"
    if so_gwan == '국가기관' or any(k in agency for k in ['부', '청', '원', '국토지리정보원', '경찰']):
        if not any(k in agency for k in ['공사', '공단', '진흥원', '연구원', '학원', '협회', '관리원']):
            return "국가기관"
    return "공공기관"

def classify_category(title, classify_nm):
    t_lower = (title + " " + classify_nm).lower()
    if any(k in t_lower for k in ['유지보수', '유지관리', '운영', '관리', '위탁', '통합유지', '헬프데스크']):
        return "유지보수/운영"
    if any(k in t_lower for k in ['3차원', '3d', '디지털트윈', '드론', '실내공간', 'lidar', '메타버스']):
        return "디지털트윈/융합"
    if any(k in t_lower for k in ['db', '데이터', '구축', '갱신', '현행화', '수치지도', '정사영상', '전산화', '측량', '지형도', '지하시설물', '상수도', '하수도']):
        return "DB/데이터구축"
    if any(k in t_lower for k in ['시스템', '플랫폼', 'sw', '뷰어', '웹', '개발', '기능보강', '고도화']):
        return "시스템/SW구축"
    if any(k in t_lower for k in ['연구', '기획', '감리', '품질검증', '평가', '컨설팅', '조사', 'isp']):
        return "기획/연구/ISP"
    return "기타"

def extract_themes(title, agency, category):
    themes = []
    t_lower = title.lower()
    if "유지" in t_lower: themes.append("유지관리")
    if "3d" in t_lower or "3차원" in t_lower or "트윈" in t_lower: themes.append("3D디지털트윈")
    if "플랫폼" in t_lower: themes.append("통합플랫폼")
    if "드론" in t_lower or "영상" in t_lower or "항공" in t_lower: themes.append("드론/정사영상")
    if "지하시설물" in t_lower or "상수도" in t_lower or "하수도" in t_lower: themes.append("지하시설물")
    if "db" in t_lower or "데이터" in t_lower or "갱신" in t_lower or "구축" in t_lower: themes.append("DB구축")
    if "웹" in t_lower or "시스템" in t_lower: themes.append("웹/시스템")
    if "보안" in t_lower: themes.append("정보보안")
    if len(themes) == 0: themes.append(category)
    themes.append(agency.split()[-1] if agency else "공간정보")
    return list(dict.fromkeys(themes))

def extract_core_task_words(title):
    words = set()
    t_clean = re.sub(r'20\d\d년?도?', '', title)
    t_clean = re.sub(r'\[.*?\]|\(.*?\)', '', t_clean)
    tokens = re.findall(r'[가-힣a-zA-Z0-9]+', t_clean)
    stop_words = {'사업', '용역', '구매', '체결', '계약', '대한', '위한', '공고', '재공고', '변경공고', '긴급', '제', '차', '및', '의', '년', '월', '일', '등'}
    for tok in tokens:
        if tok not in stop_words and len(tok) >= 2:
            words.add(tok)
    return words

def calculate_similarity(t1, t2):
    w1 = extract_core_task_words(t1)
    w2 = extract_core_task_words(t2)
    if not w1 or not w2:
        return 0.0
    common = w1.intersection(w2)
    return len(common) / min(len(w1), len(w2))

print("1. Loading raw Excel files...")
rec24 = load_excel_records(os.path.join(data_dir, 'koneps_2024.xlsx'))
rec25 = load_excel_records(os.path.join(data_dir, 'koneps_2025.xlsx'))
rec26 = load_excel_records(os.path.join(data_dir, 'koneps_2026.xlsx'))
print(f"Loaded: 2024 ({len(rec24)}), 2025 ({len(rec25)}), 2026 ({len(rec26)})")

# ==========================================
# 2. Build 3-Year All Projects (2024, 2025, 2026) -> projects.json
# ==========================================
def parse_single_record(r, default_year):
    notice_no = r.get('E', '')
    ord_str = r.get('F', '000')
    full_notice_no = f"{notice_no}-{ord_str}" if ord_str else notice_no
    title = r.get('H', '')
    notice_date = format_date(r.get('I', ''))
    open_date = format_date(r.get('R', ''))
    contract_date = format_date(r.get('AU', ''))
    
    y = default_year
    if notice_date and len(notice_date) >= 4 and notice_date[:4].isdigit():
        y = int(notice_date[:4])
    
    ntce_instt = r.get('K', '')
    dminstt = r.get('M', ntce_instt)
    so_gwan = r.get('AC', '')
    work_type = r.get('B', '일반용역')
    contract_method = r.get('N', '일반경쟁')
    award_method = r.get('O', '')
    classify_nm = r.get('S', '')
    
    budget = parse_int(r.get('AE', '0'))
    presmpt = parse_int(r.get('AF', '0'))
    bsis_amt = parse_int(r.get('AH', '0'))
    sched_price = parse_int(r.get('AI', '0'))
    
    winner_corp = r.get('AL', '')
    winner_biz_no = r.get('AM', '')
    bid_amt = parse_int(r.get('AO', '0'))
    bid_rate = parse_float(r.get('AP', ''))
    contract_amt = parse_int(r.get('AX', '0'))
    contract_no = r.get('AT', '')
    is_success = (r.get('AK') == 'Y') or bool(winner_corp)

    if bid_amt == 0 and contract_amt > 0:
        bid_amt = contract_amt
    if budget == 0 and presmpt > 0:
        budget = int(round(presmpt * 1.1))

    org_type = classify_org_type(dminstt, so_gwan)
    category = classify_category(title, classify_nm)
    
    if budget < 50000000:
        budget_tier = "5천만 미만"
    elif budget < 100000000:
        budget_tier = "5천만~1억"
    elif budget < 300000000:
        budget_tier = "1억~3억"
    elif budget < 500000000:
        budget_tier = "3억~5억"
    else:
        budget_tier = "5억 이상"

    status_label = f"낙찰 완료 ({winner_corp})" if winner_corp else ("개찰 완료" if open_date else "공고 진행")
    themes = extract_themes(title, dminstt, category)

    summary = f"{dminstt}에서 발주한 {title} ({y}년) 공고입니다. 업무구분은 {work_type}이며 계약방식은 {contract_method}입니다. "
    if winner_corp:
        summary += f"개찰 결과 {winner_corp}에서 {bid_amt:,}원(투찰률 {bid_rate if bid_rate else '-'}%)에 최종 낙찰·계약되었습니다."

    return {
        "bidNtceNo": full_notice_no,
        "bidNtceOrd": ord_str,
        "bidNtceNm": title,
        "year": y,
        "ntceInsttNm": ntce_instt,
        "dminsttNm": dminstt,
        "workType": work_type,
        "noticeType": contract_method,
        "orgType": org_type,
        "category": category,
        "assignBdgtAmt": budget,
        "presmptPrce": presmpt,
        "bsisAmt": bsis_amt,
        "schedPrice": sched_price,
        "cntrctCnclsMthdNm": contract_method,
        "awardMethod": award_method,
        "bidNtceDt": notice_date,
        "bidClseDt": open_date if open_date else notice_date,
        "bidStatusLabel": status_label,
        "isSuccessBidded": is_success,
        "succBidAmt": bid_amt,
        "succBidCorp": winner_corp,
        "succBidCorpBizNo": winner_biz_no,
        "bidRate": bid_rate,
        "contractNo": contract_no,
        "contractDt": contract_date,
        "contractAmt": contract_amt,
        "isUnder500M": (budget < 500000000),
        "budgetTier": budget_tier,
        "keyThemes": themes,
        "summary": summary
    }

parsed_projects = []
for r in rec26:
    parsed_projects.append(parse_single_record(r, 2026))
for r in rec25:
    parsed_projects.append(parse_single_record(r, 2025))
for r in rec24:
    parsed_projects.append(parse_single_record(r, 2024))

# Sort by bidNtceDt descending
parsed_projects.sort(key=lambda p: (p['bidNtceDt'] or '', p['year']), reverse=True)

projects_out = os.path.join(data_dir, 'projects.json')
with open(projects_out, 'w', encoding='utf-8') as f:
    json.dump(parsed_projects, f, ensure_ascii=False, indent=2)

under500_cnt = len([p for p in parsed_projects if p['isUnder500M']])
print(f"✅ projects.json 작성 완료 (3개년): 총 {len(parsed_projects)}건 중 5억 미만 {under500_cnt}건 ({under500_cnt/len(parsed_projects)*100:.1f}%)")
print(f"   - 2026년: {len([p for p in parsed_projects if p['year'] == 2026])}건")
print(f"   - 2025년: {len([p for p in parsed_projects if p['year'] == 2025])}건")
print(f"   - 2024년: {len([p for p in parsed_projects if p['year'] == 2024])}건")

# ==========================================
# 3. Build 3-Year Recurring Families with Strict 1:1 Matching
# ==========================================
used_24 = set()
used_25 = set()
recurring_families = []

for r26 in rec26:
    notice_no_26 = f"{r26.get('E')}-{r26.get('F', '000')}"
    title_26 = r26.get('H', '')
    agency_26 = r26.get('M', r26.get('K', ''))
    budget_26 = parse_int(r26.get('AE', '0'))
    if budget_26 == 0:
        budget_26 = parse_int(r26.get('AF', '0'))
        if budget_26 > 0: budget_26 = int(round(budget_26 * 1.1))

    # Match in 2025
    best_25 = None
    best_score_25 = 0
    for r25 in rec25:
        if r25.get('E') in used_25:
            continue
        if r25.get('M') == agency_26:
            score = calculate_similarity(title_26, r25.get('H', ''))
            b25 = parse_int(r25.get('AE', '0')) or parse_int(r25.get('AF', '0'))
            if b25 > 0 and budget_26 > 0:
                scale_ratio = max(b25, budget_26) / min(b25, budget_26)
                if scale_ratio > 3.0: # Disallow massive budget scale mismatch (e.g. 24억 vs 5천만)
                    score *= 0.1
            if score > best_score_25 and score >= 0.35:
                best_score_25 = score
                best_25 = r25

    # Match in 2024
    best_24 = None
    best_score_24 = 0
    for r24 in rec24:
        if r24.get('E') in used_24:
            continue
        if r24.get('M') == agency_26:
            score = calculate_similarity(title_26, r24.get('H', ''))
            b24 = parse_int(r24.get('AE', '0')) or parse_int(r24.get('AF', '0'))
            if b24 > 0 and budget_26 > 0:
                scale_ratio = max(b24, budget_26) / min(b24, budget_26)
                if scale_ratio > 3.0:
                    score *= 0.1
            if score > best_score_24 and score >= 0.35:
                best_score_24 = score
                best_24 = r24

    # Require at least one verified matching past year to qualify as a multi-year recurring family
    if not best_25 and not best_24:
        continue

    if best_25: used_25.add(best_25.get('E'))
    if best_24: used_24.add(best_24.get('E'))

    # History 2024
    if best_24:
        b24 = parse_int(best_24.get('AE', '0')) or parse_int(best_24.get('AF', '0'))
        w24 = best_24.get('AL', '') or '미선정'
        r24 = parse_float(best_24.get('AP', ''))
        amt24 = parse_int(best_24.get('AO', '0')) or parse_int(best_24.get('AX', '0'))
        dt24 = format_date(best_24.get('I', '')) or '2024-01-15'
        no24 = f"{best_24.get('E')}-{best_24.get('F', '000')}"
        nm24 = best_24.get('H', '')
        cm24 = best_24.get('N', '일반경쟁')
        is_real_24 = True
        src_note_24 = "2024년 나라장터 실측 투찰·계약내역"
    else:
        # Preceding contract not in scope for 2024
        b24 = int(round(budget_26 * 0.94))
        w24 = '선행공고 없음 (단년/신규)'
        r24 = None
        amt24 = 0
        dt24 = '-'
        no24 = '선행공고 없음'
        nm24 = '2024년 선행사업 없음'
        cm24 = '-'
        is_real_24 = False
        src_note_24 = "2024년 조달 내역 없음"

    # History 2025
    if best_25:
        b25 = parse_int(best_25.get('AE', '0')) or parse_int(best_25.get('AF', '0'))
        w25 = best_25.get('AL', '') or '미선정'
        r25 = parse_float(best_25.get('AP', ''))
        amt25 = parse_int(best_25.get('AO', '0')) or parse_int(best_25.get('AX', '0'))
        dt25 = format_date(best_25.get('I', '')) or '2025-01-15'
        no25 = f"{best_25.get('E')}-{best_25.get('F', '000')}"
        nm25 = best_25.get('H', '')
        cm25 = best_25.get('N', '일반경쟁')
        is_real_25 = True
        src_note_25 = "2025년 나라장터 실측 투찰·계약내역"
    else:
        b25 = int(round(budget_26 * 0.97))
        w25 = '선행공고 없음 (단년/신규)'
        r25 = None
        amt25 = 0
        dt25 = '-'
        no25 = '선행공고 없음'
        nm25 = '2025년 선행사업 없음'
        cm25 = '-'
        is_real_25 = False
        src_note_25 = "2025년 조달 내역 없음"

    # 2026 details
    w26 = r26.get('AL', '') or '미선정'
    r26_rate = parse_float(r26.get('AP', ''))
    amt26 = parse_int(r26.get('AO', '0')) or parse_int(r26.get('AX', '0'))
    dt26 = format_date(r26.get('I', ''))
    no26 = notice_no_26
    nm26 = title_26
    cm26 = r26.get('N', '일반경쟁')

    # Winner churn check
    winner_change_count = 0
    if is_real_24 and is_real_25 and (w24 != w25) and ('미선정' not in [w24, w25]) and ('선행' not in [w24, w25]):
        winner_change_count += 1
    if is_real_25 and (w25 != w26) and ('미선정' not in [w25, w26]) and ('선행' not in [w25, w26]):
        winner_change_count += 1
    elif not is_real_25 and is_real_24 and (w24 != w26) and ('미선정' not in [w24, w26]) and ('선행' not in [w24, w26]):
        winner_change_count += 1

    is_incumbent_locked = (winner_change_count == 0 and w26 not in ['', '미선정', '선행공고 없음 (단년/신규)'])

    # Growth rate (전년 대비 YoY 증감률: 직전 연도인 2025년 실적 우선 비교, 2025년 부재 시 2024년 비교)
    growth_rate = 0.0
    base_b = b25 if (is_real_25 and b25 > 0) else (b24 if (is_real_24 and b24 > 0) else budget_26)
    if base_b > 0:
        growth_rate = round(((budget_26 - base_b) / base_b) * 100.0, 1)

    m_num = dt26[5:7] if len(dt26) >= 7 else "01"
    expected_next = f"2027.{m_num}"
    expected_2027_budget = int(round(budget_26 * 1.04))

    org_type = classify_org_type(agency_26, r26.get('AC', ''))
    category = classify_category(title_26, r26.get('S', ''))

    if budget_26 < 50000000:
        budget_tier = "5천만 미만"
    elif budget_26 < 100000000:
        budget_tier = "5천만~1억"
    elif budget_26 < 300000000:
        budget_tier = "1억~3억"
    elif budget_26 < 500000000:
        budget_tier = "3억~5억"
    else:
        budget_tier = "5억 이상"

    # Strategic Action based on strictly matched ground truth
    if winner_change_count > 0:
        history_str = ""
        if is_real_24: history_str += f"2024년 '{w24}' ➡️ "
        if is_real_25: history_str += f"2025년 '{w25}' ➡️ "
        history_str += f"2026년 '{w26}'"
        strategic_action = f"실제 수주 변동(FACT): 최근 사업자 교체({winner_change_count}회)가 발생한 경쟁 유망 사업입니다. ({history_str}) 기존 사업자의 과업 수행 내역을 정밀 분석하여 {expected_next} 차기 발주 시 수주 가능성 극대화 추천."
    elif is_incumbent_locked:
        strategic_action = f"실제 독점 분석(FACT): 연속으로 '{w26}'이 수주·독점하고 있는 안정형 계속사업입니다. (2026년 배정예산 {budget_26:,}원, 투찰률 {r26_rate if r26_rate else '-'}%) 차기 발주({expected_next}) 전 사전규격공개 검토 및 기능보강 제안으로 복수응찰 구도 전환 필요."
    else:
        strategic_action = f"실제 공고 기반: {agency_26}의 대표 계속사업입니다. 2026년 낙찰사 '{w26}'(낙찰금액 {amt26:,}원)의 과업 범위를 분석하여 차기 발주 대비 권장."

    history = [
        {
            "year": 2024,
            "noticeNo": no24,
            "noticeNm": nm24,
            "noticeDate": dt24,
            "budget": b24 if is_real_24 else None,
            "contractMethod": cm24,
            "winnerCorp": w24,
            "winnerAmt": amt24 if is_real_24 else None,
            "bidRate": r24,
            "isRealSource": is_real_24,
            "sourceNote": src_note_24
        },
        {
            "year": 2025,
            "noticeNo": no25,
            "noticeNm": nm25,
            "noticeDate": dt25,
            "budget": b25 if is_real_25 else None,
            "contractMethod": cm25,
            "winnerCorp": w25,
            "winnerAmt": amt25 if is_real_25 else None,
            "bidRate": r25,
            "isRealSource": is_real_25,
            "sourceNote": src_note_25
        },
        {
            "year": 2026,
            "noticeNo": no26,
            "noticeNm": nm26,
            "noticeDate": dt26,
            "budget": budget_26,
            "contractMethod": cm26,
            "winnerCorp": w26,
            "winnerAmt": amt26,
            "bidRate": r26_rate,
            "isRealSource": True,
            "sourceNote": "2026년 나라장터 실측 투찰·계약내역"
        }
    ]

    recurring_families.append({
        "familyId": f"REC-{notice_no_26}",
        "familyName": title_26,
        "agency": agency_26,
        "orgType": org_type,
        "category": category,
        "typicalNoticeMonth": f"{int(m_num)}월",
        "cycle": "연례 반복 (매년)",
        "expectedNextNoticeDate": expected_next,
        "expected2027Budget": expected_2027_budget,
        "total3YrBudget": (b24 if is_real_24 else 0) + (b25 if is_real_25 else 0) + budget_26,
        "avgBudget": int(round(((b24 if is_real_24 else budget_26) + (b25 if is_real_25 else budget_26) + budget_26) / 3.0)),
        "budgetGrowthRate": growth_rate,
        "isUnder500M": (budget_26 < 500000000),
        "budgetTier": budget_tier,
        "winnerChangeCount": winner_change_count,
        "isIncumbentLocked": is_incumbent_locked,
        "incumbentCompany": w26,
        "riskOpportunityLevel": "사업자 교체 (수주 유망)" if winner_change_count > 0 else ("3년 독점 안정" if is_incumbent_locked else "연례 계속사업"),
        "strategicAction": strategic_action,
        "realKonepsNoticeNo": notice_no_26,
        "realKonepsNoticeDt": dt26,
        "history": history
    })

total_families = len(recurring_families)
total_3yr_sum = sum(f['total3YrBudget'] for f in recurring_families)
total_2026_sum = sum(f['history'][2]['budget'] for f in recurring_families)
locked_count = len([f for f in recurring_families if f['isIncumbentLocked']])
churn_count = len([f for f in recurring_families if f['winnerChangeCount'] > 0])
high_growth_count = len([f for f in recurring_families if f['budgetGrowthRate'] >= 8.0])
early_2027_count = len([f for f in recurring_families if f['expectedNextNoticeDate'].startswith('2027.01') or f['expectedNextNoticeDate'].startswith('2027.02') or f['expectedNextNoticeDate'].startswith('2027.03')])

category_stats = {}
for f in recurring_families:
    c = f['category']
    if c not in category_stats:
        category_stats[c] = {"count": 0, "budget2026": 0}
    category_stats[c]['count'] += 1
    category_stats[c]['budget2026'] += f['history'][2]['budget']

yearly_trend = [
    {"year": 2024, "totalBudget": sum((f['history'][0]['budget'] or 0) for f in recurring_families)},
    {"year": 2025, "totalBudget": sum((f['history'][1]['budget'] or 0) for f in recurring_families)},
    {"year": 2026, "totalBudget": sum(f['history'][2]['budget'] for f in recurring_families)}
]

winner_stats = {}
for f in recurring_families:
    w = f['incumbentCompany']
    if w and w not in ['미선정', '선행공고 없음 (단년/신규)']:
        if w not in winner_stats:
            winner_stats[w] = {"name": w, "projectCount": 0, "total2026Budget": 0}
        winner_stats[w]['projectCount'] += 1
        winner_stats[w]['total2026Budget'] += f['history'][2]['budget']

top_winners = sorted(list(winner_stats.values()), key=lambda x: x['total2026Budget'], reverse=True)[:10]

recurring_data = {
    "summary": {
        "totalFamilies": total_families,
        "total3YrSum": total_3yr_sum,
        "total2026Sum": total_2026_sum,
        "lockedCount": locked_count,
        "lockedRatio": round((locked_count / total_families) * 100.0, 1) if total_families > 0 else 0,
        "churnCount": churn_count,
        "churnRatio": round((churn_count / total_families) * 100.0, 1) if total_families > 0 else 0,
        "highGrowthCount": high_growth_count,
        "early2027Count": early_2027_count,
        "categoryStats": category_stats,
        "yearlyTrend": yearly_trend,
        "topWinners": top_winners,
        "dataSourceNote": f"조달청 나라장터 공식 3개년 실측 투찰·계약 데이터 (2024년 {len(rec24)}건, 2025년 {len(rec25)}건, 2026년 {len(rec26)}건) 기반 1:1 과업일치 정밀 연계"
    },
    "families": recurring_families
}

rec_out = os.path.join(data_dir, 'recurring_projects.json')
with open(rec_out, 'w', encoding='utf-8') as f:
    json.dump(recurring_data, f, ensure_ascii=False, indent=2)

print(f"✅ recurring_projects.json 정밀 작성 완료: 총 {total_families}개 계속사업 패밀리")
print(f"  • 사업자 교체 패밀리: {churn_count}개 ({churn_count/total_families*100:.1f}%)")
print(f"  • 독점 지속 패밀리: {locked_count}개 ({locked_count/total_families*100:.1f}%)")
print(f"  • 5억 미만 계속사업: {len([f for f in recurring_families if f['isUnder500M']])}개")
