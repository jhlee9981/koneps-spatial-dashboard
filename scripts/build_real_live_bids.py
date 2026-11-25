import urllib.request
import urllib.parse
import json
import datetime
import re
import os

def get_service_key():
    k = os.environ.get('KONEPS_API_KEY')
    if k: return k
    env_f = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_f):
        with open(env_f, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('KONEPS_API_KEY='):
                    return line.strip().split('=', 1)[1].strip('"\'')
    return ''

service_key = get_service_key()
base_url = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService02'

data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')

# 1. Fetch live notices from KONEPS API for 2026 (current year)
# Current time: 2026-11-24 18:00:00
now_dt = datetime.datetime(2026, 11, 24, 18, 0, 0)
current_time_str = "2026-11-24 18:00:00"

operations = [
    ('getBidPblancListInfoServcPPSSrch02', '일반용역'),
    ('getBidPblancListInfoThngPPSSrch02', '물품'),
    ('getBidPblancListInfoCnstwkPPSSrch02', '공사')
]

raw_notices = {}

print("1. Querying KONEPS OpenAPI for '공간정보' in 2026...")
for op, w_type in operations:
    for i in range(5): # 5 windows of 6 days = 30 days (avoid > 7 days error)
        w_end = datetime.datetime(2026, 11, 24, 23, 59) - datetime.timedelta(days=i*6)
        w_bgn = w_end - datetime.timedelta(days=5, hours=23, minutes=59)
        
        bgn_str = w_bgn.strftime('%Y%m%d%H%M')
        end_str = w_end.strftime('%Y%m%d%H%M')
        
        params = {
            'serviceKey': service_key,
            'numOfRows': 100,
            'pageNo': 1,
            'inqryDiv': '1',
            'inqryBgnDt': bgn_str,
            'inqryEndDt': end_str,
            'bidNtceNm': '공간정보',
            'type': 'json'
        }
        
        url = f"{base_url}/{op}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                res = json.loads(r.read().decode('utf-8'))
                body = res.get('response', {}).get('body', {})
                items = body.get('items', [])
                if isinstance(items, dict):
                    items = [items]
                for item in items:
                    item['workType'] = w_type
                    no = item.get('bidNtceNo', '') + '-' + item.get('bidNtceOrd', '000')
                    raw_notices[no] = item
        except Exception as e:
            print(f"Error {op} {bgn_str}: {e}")

print(f"Fetched {len(raw_notices)} unique 2026 notices from KONEPS.")

# 2. Load historical databases for Cross-Matching
recurring_path = os.path.join(data_dir, 'recurring_projects.json')
with open(recurring_path, 'r', encoding='utf-8') as f:
    rec_data = json.load(f)
recurring_families = rec_data.get('families', [])

projects_path = os.path.join(data_dir, 'projects.json')
with open(projects_path, 'r', encoding='utf-8') as f:
    hist_projects = json.load(f)

# Helper functions
def classify_category(title):
    t = title.lower()
    if any(k in t for k in ['유지보수', '유지관리', '운영', '관리', '위탁', '통합유지']):
        return "유지보수/운영"
    if any(k in t for k in ['3차원', '3d', '디지털트윈', '드론', '정사영상', '실내공간']):
        return "디지털트윈/융합"
    if any(k in t for k in ['db', '데이터', '구축', '갱신', '현행화', '수치지도', '전산화', '지하시설물']):
        return "DB/데이터구축"
    if any(k in t for k in ['시스템', '플랫폼', 'sw', '개발', '클라우드', '인프라']):
        return "시스템/SW구축"
    if any(k in t for k in ['연구', '기획', '감리', '컨설팅', '조사', 'isp']):
        return "기획/연구/ISP"
    return "기타"

def classify_org_type(agency):
    if any(k in agency for k in ['시', '군', '구', '도', '특별시', '광역시', '특별자치']):
        if not any(k in agency for k in ['공사', '공단', '진흥원', '연구원', '학교', '대학', '병원']):
            return "지자체"
    if any(k in agency for k in ['부', '청', '원', '국토지리정보원', '경찰']):
        if not any(k in agency for k in ['공사', '공단', '진흥원', '연구원']):
            return "국가기관"
    return "공공기관"

def extract_themes(title, agency):
    themes = []
    t = title.lower()
    if "유지" in t or "운영" in t: themes.append("유지보수")
    if "3d" in t or "3차원" in t: themes.append("3D/디지털트윈")
    if "클라우드" in t: themes.append("클라우드")
    if "플랫폼" in t: themes.append("공간정보플랫폼")
    if "지하시설물" in t or "상수도" in t or "하수도" in t: themes.append("지하시설물")
    if "db" in t or "데이터" in t or "갱신" in t: themes.append("DB구축")
    
    ag_short = agency.split()[-1] if agency else "공간정보"
    themes.append(ag_short)
    return list(dict.fromkeys(themes))

def calculate_dday(clse_dt_str):
    if not clse_dt_str:
        return 0, "마감"
    try:
        clse_clean = clse_dt_str[:10]
        clse_date = datetime.datetime.strptime(clse_clean, "%Y-%m-%d").date()
        today = datetime.date(2026, 11, 24)
        diff = (clse_date - today).days
        if diff < 0:
            return diff, "마감"
        elif diff == 0:
            return 0, "D-Day (오늘마감)"
        else:
            return diff, f"D-{diff}"
    except:
        return 0, "마감"

# 3. Process Live Bids
live_bids = []

for no, raw in raw_notices.items():
    title = raw.get('bidNtceNm', '').strip()
    agency = raw.get('dminsttNm', raw.get('ntceInsttNm', '')).strip()
    ntce_agency = raw.get('ntceInsttNm', agency).strip()
    
    b_val = raw.get('asignBdgtAmt') or raw.get('presmptPrce') or 0
    try:
        budget = int(float(b_val))
    except:
        budget = 0
    
    presmpt = raw.get('presmptPrce') or 0
    try:
        presmpt = int(float(presmpt))
    except:
        presmpt = int(round(budget / 1.1)) if budget > 0 else 0
        
    bsis_amt = raw.get('bsisAmount') or 0
    try:
        bsis_amt = int(float(bsis_amt))
    except:
        bsis_amt = 0
        
    clse_dt = raw.get('bidClseDt', '')
    ntce_dt = raw.get('bidNtceDt', '')
    openg_dt = raw.get('opengDt', '')
    
    # Filter: ONLY keep bids whose bidClseDt is in future (>= 2026-11-24 18:00)
    if not clse_dt or clse_dt < current_time_str:
        continue # Skip closed bids!
        
    dday, dday_text = calculate_dday(clse_dt)
    
    is_under500 = (budget < 500000000) and (budget > 0)
    
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

    category = classify_category(title)
    org_type = classify_org_type(agency)
    work_type = raw.get('workType', '일반용역')
    notice_type = raw.get('cntrctCnclsMthdNm', '일반경쟁')
    award_method = raw.get('sucsfbidMthdNm', '협상에 의한 계약')
    detail_url = raw.get('bidNtceDtlUrl') or f"https://www.g2b.go.kr:8081/ep/invitation/publish/bidInfoDtl.do?bidno={raw.get('bidNtceNo')}&bidseq={raw.get('bidNtceOrd','000')}"

    # Cross-Match Engine
    matched = False
    cross_match = {
        "matched": False,
        "source": "none",
        "familyId": None,
        "familyName": None,
        "agency": agency,
        "incumbentCompany": "기존 고착 사업자 없음 (신규 기회)",
        "winnerChangeCount": 0,
        "isIncumbentLocked": False,
        "pastWinners": [],
        "avgBidRate": 90.5,
        "recommendedBid": int(round(budget * 0.905)) if budget > 0 else 0,
        "pastBudget2026": None,
        "strategicAdvice": "✨ 직전 3년간 고착 사업자가 없는 신규/경쟁 진입 기회 공고입니다. 과업요청서 요구사항을 충실히 반영한 차별화된 제안서 작성을 추천합니다."
    }

    # 1) Try recurring families
    for fam in recurring_families:
        f_agency = fam.get('agency', '')
        f_name = fam.get('familyName', '')
        
        ag_match = (agency in f_agency or f_agency in agency)
        if not ag_match:
            c1 = re.findall(r'[가-힣]+(?:시|군|구)', agency)
            c2 = re.findall(r'[가-힣]+(?:시|군|구)', f_agency)
            if c1 and c2 and set(c1) & set(c2):
                ag_match = True
                
        if ag_match:
            w1 = set(re.findall(r'[가-힣]{2,}', title)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2024년', '2025년', '2026년', '2027년'}
            w2 = set(re.findall(r'[가-힣]{2,}', f_name)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2024년', '2025년', '2026년', '2027년'}
            common = w1 & w2
            if len(common) >= 1 or ('유지' in title and '유지' in f_name):
                matched = True
                inc = fam.get('incumbentCompany') or '기존수행사'
                cross_match = {
                    "matched": True,
                    "source": "recurring",
                    "familyId": fam.get('familyId'),
                    "familyName": fam.get('familyName'),
                    "agency": fam.get('agency'),
                    "incumbentCompany": inc,
                    "winnerChangeCount": fam.get('winnerChangeCount', 0),
                    "isIncumbentLocked": fam.get('isIncumbentLocked', False),
                    "pastWinners": [f"2026년 계약사: {inc}"],
                    "avgBidRate": 91.5 if '협상' in award_method else 87.745,
                    "recommendedBid": int(round(budget * (0.915 if '협상' in award_method else 0.87745))),
                    "pastBudget": fam.get('avgBudget'),
                    "strategicAdvice": fam.get('strategicAction', f"실제 계속사업 연계: 기존 수주사 '{inc}'의 2026년 수행 내역 및 과업요청서 요구사항을 정밀 분석하여 차별화된 제안을 권장합니다.")
                }
                break

    # 2) If not in recurring, check historical 2026 projects
    if not matched:
        for hp in hist_projects:
            hp_agency = hp.get('dminsttNm', '')
            hp_title = hp.get('bidNtceNm', '')
            if (agency in hp_agency or hp_agency in agency) and hp.get('succBidCorp'):
                w1 = set(re.findall(r'[가-힣]{2,}', title)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2026년', '2027년'}
                w2 = set(re.findall(r'[가-힣]{2,}', hp_title)) - {'공간정보', '시스템', '용역', '사업', '통합', '유지', '관리', '보수', '2026년', '2027년'}
                if len(w1 & w2) >= 1:
                    matched = True
                    rate = hp.get('bidRate') or (91.5 if '협상' in award_method else 87.745)
                    cross_match = {
                        "matched": True,
                        "source": "contract_history",
                        "familyId": None,
                        "familyName": hp_title,
                        "agency": hp_agency,
                        "incumbentCompany": hp.get('succBidCorp'),
                        "winnerChangeCount": 0,
                        "isIncumbentLocked": True,
                        "pastWinners": [f"2026년 실측 수주사: {hp.get('succBidCorp')}"],
                        "avgBidRate": rate,
                        "recommendedBid": int(round(budget * (rate / 100.0))),
                        "pastBudget": hp.get('assignBdgtAmt'),
                        "strategicAdvice": f"실측 조달 계약 연계(FACT): 2026년 직전 선행 사업({hp_title[:20]}...)에서 '{hp.get('succBidCorp')}'이(가) 투찰률 {rate}%로 낙찰받았습니다. 기존 사업자 산출물 대비 개선 제안으로 공략하세요."
                    }
                    break

    live_bids.append({
        "bidNtceNo": no,
        "bidNtceOrd": raw.get('bidNtceOrd', '000'),
        "bidNtceNm": title,
        "ntceInsttNm": ntce_agency,
        "dminsttNm": agency,
        "orgType": org_type,
        "category": category,
        "workType": work_type,
        "noticeType": notice_type,
        "awardMethod": award_method,
        "assignBdgtAmt": budget,
        "presmptPrce": presmpt,
        "bsisAmt": bsis_amt,
        "bidNtceDt": ntce_dt,
        "bidClseDt": clse_dt,
        "opengDt": openg_dt,
        "bidPrcsTypeNm": "입찰공고중",
        "bidNtceDtlUrl": detail_url,
        "isSuccessBidded": False,
        "succBidAmt": None,
        "succBidCorp": None,
        "bidRate": None,
        "isUnder500M": is_under500,
        "budgetTier": budget_tier,
        "keyThemes": extract_themes(title, agency),
        "summary": f"{agency}에서 발주한 {title} 공고입니다. 업무구분은 {work_type}이며 계약방식은 {notice_type}({award_method})입니다.",
        "dday": dday,
        "ddayText": dday_text,
        "crossMatch": cross_match
    })

# Sort by D-Day ascending (urgent first)
live_bids.sort(key=lambda x: (x['dday'] if x['dday'] >= 0 else 999, -x['assignBdgtAmt']))

out_file = os.path.join(data_dir, 'live_bids.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(live_bids, f, ensure_ascii=False, indent=2)

under500_cnt = len([b for b in live_bids if b['isUnder500M']])
print(f"\n✅ Successfully saved {len(live_bids)} REAL 2026 live bids to data/live_bids.json!")
print(f"   - 5억 미만 실시간 공고: {under500_cnt}건 ({under500_cnt/len(live_bids)*100:.1f}%)")
print(f"   - 5억 이상 공고: {len(live_bids) - under500_cnt}건")
