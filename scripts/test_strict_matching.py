from analyze_all_three_years import load_excel_records
import re

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

def extract_core_task_words(title):
    # Extract substantive nouns related to the task
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
    # Jaccard / Overlap similarity
    return len(common) / min(len(w1), len(w2))

print("Testing Strict Matching across 2024, 2025, 2026...")

used_24 = set()
used_25 = set()
strict_recurring = []

for r26 in rec26:
    ag26 = r26.get('M', '')
    t26 = r26.get('H', '')
    b26 = int(r26.get('AE', '0').replace(',', '')) if r26.get('AE', '0').replace(',', '').isdigit() else 0
    if b26 == 0:
        b26 = int(r26.get('AF', '0').replace(',', '')) if r26.get('AF', '0').replace(',', '').isdigit() else 0

    best_25 = None
    best_score_25 = 0
    for r25 in rec25:
        if r25.get('E') in used_25:
            continue
        if r25.get('M') == ag26:
            score = calculate_similarity(t26, r25.get('H', ''))
            # Budget scale check: within 0.3x ~ 3.0x
            b25 = int(r25.get('AE', '0').replace(',', '')) if r25.get('AE', '0').replace(',', '').isdigit() else 0
            if b25 > 0 and b26 > 0:
                scale_ratio = max(b25, b26) / min(b25, b26)
                if scale_ratio > 3.0: # budget discrepancy too big!
                    score *= 0.2
            if score > best_score_25 and score >= 0.4:
                best_score_25 = score
                best_25 = r25

    best_24 = None
    best_score_24 = 0
    for r24 in rec24:
        if r24.get('E') in used_24:
            continue
        if r24.get('M') == ag26:
            score = calculate_similarity(t26, r24.get('H', ''))
            b24 = int(r24.get('AE', '0').replace(',', '')) if r24.get('AE', '0').replace(',', '').isdigit() else 0
            if b24 > 0 and b26 > 0:
                scale_ratio = max(b24, b26) / min(b24, b26)
                if scale_ratio > 3.0:
                    score *= 0.2
            if score > best_score_24 and score >= 0.4:
                best_score_24 = score
                best_24 = r24

    # Only accept if at least one past year has a solid match (or both)
    if best_25 or best_24:
        if best_25: used_25.add(best_25.get('E'))
        if best_24: used_24.add(best_24.get('E'))
        strict_recurring.append({
            'agency': ag26,
            'title26': t26,
            'b26': b26,
            'w26': r26.get('AL'),
            'm25': best_25,
            'm24': best_24
        })

print(f"Total verified strict recurring projects: {len(strict_recurring)}")
for item in strict_recurring:
    t25_nm = item['m25'].get('H') if item['m25'] else '선행공고 없음 (단년/신규)'
    w25_nm = item['m25'].get('AL') if item['m25'] else '-'
    b25_val = item['m25'].get('AE') if item['m25'] else '-'
    t24_nm = item['m24'].get('H') if item['m24'] else '선행공고 없음 (단년/신규)'
    w24_nm = item['m24'].get('AL') if item['m24'] else '-'
    b24_val = item['m24'].get('AE') if item['m24'] else '-'
    print(f"\n[{item['agency']}] {item['title26']} (2026 예산: {item['b26']:,}원 / 수주: {item['w26']})")
    print(f"  ➡️ 2024: {t24_nm} / 예산:{b24_val} / 수주:{w24_nm}")
    print(f"  ➡️ 2025: {t25_nm} / 예산:{b25_val} / 수주:{w25_nm}")
