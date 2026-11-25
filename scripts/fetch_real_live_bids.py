import urllib.request
import urllib.parse
import json
import datetime

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

# We query 4 consecutive 7-day windows up to now
# Current date: 2024-11-24
end_date = datetime.datetime(2024, 11, 24, 23, 59)
now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

operations = [
    ('getBidPblancListInfoServcPPSSrch02', '용역'),
    ('getBidPblancListInfoThngPPSSrch02', '물품'),
    ('getBidPblancListInfoCnstwkPPSSrch02', '공사')
]

keywords = ['공간정보', 'GIS', '디지털트윈', '지하시설물']

all_items = {}

for op, work_type in operations:
    for kw in ['공간정보']: # Focus on 공간정보 first
        for i in range(4): # 4 windows of 7 days = 28 days
            w_end = end_date - datetime.timedelta(days=i*7)
            w_bgn = w_end - datetime.timedelta(days=6, hours=23, minutes=59)
            
            bgn_str = w_bgn.strftime('%Y%m%d%H%M')
            end_str = w_end.strftime('%Y%m%d%H%M')
            
            params = {
                'serviceKey': service_key,
                'numOfRows': 100,
                'pageNo': 1,
                'inqryDiv': '1',
                'inqryBgnDt': bgn_str,
                'inqryEndDt': end_str,
                'bidNtceNm': kw,
                'type': 'json'
            }
            
            url = f"{base_url}/{op}?{urllib.parse.urlencode(params)}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    res = json.loads(r.read().decode('utf-8'))
                    body = res.get('response', {}).get('body', {})
                    total_cnt = body.get('totalCount', 0)
                    items = body.get('items', [])
                    if isinstance(items, dict): # single item wrapped in dict
                        items = [items]
                    print(f"[{work_type}] {kw} | {bgn_str}~{end_str}: total {total_cnt} found")
                    for item in items:
                        no = item.get('bidNtceNo', '') + '-' + item.get('bidNtceOrd', '000')
                        all_items[no] = item
            except Exception as e:
                print(f"Error {op} {bgn_str}: {e}")

print(f"\n==========================================")
print(f"Total unique notices fetched: {len(all_items)}")

# Now let's analyze closing date and budget
live_bids = []
closed_bids = []

for no, item in all_items.items():
    title = item.get('bidNtceNm', '')
    agency = item.get('dminsttNm', item.get('ntceInsttNm', ''))
    clse_dt = item.get('bidClseDt', '')
    budget_raw = item.get('asignBdgtAmt', 0) or item.get('presmptPrce', 0)
    try:
        budget = int(float(budget_raw))
    except:
        budget = 0
    
    # check if closing date is after 2024-11-24 18:00
    is_live = False
    if clse_dt:
        # compare with 2024-11-24 18:00
        # clse_dt format is usually YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
        if clse_dt >= '2024-11-24 18:00':
            is_live = True
    
    under_500 = budget < 500000000 and budget > 0
    
    data = {
        'no': no,
        'title': title,
        'agency': agency,
        'budget': budget,
        'under500': under_500,
        'clseDt': clse_dt,
        'isLive': is_live,
        'item': item
    }
    
    if is_live:
        live_bids.append(data)
    else:
        closed_bids.append(data)

print(f"\n⚡ CURRENTLY LIVE (접수 중): {len(live_bids)}건")
print(f"   - 5억 미만 LIVE: {len([b for b in live_bids if b['under500']])}건")
for b in live_bids:
    print(f"   [{'5억미만' if b['under500'] else '5억이상'}] {b['no']} | {b['clseDt']} | {b['budget']:,}원 | {b['agency']} | {b['title']}")

print(f"\n📊 RECENT NOTICES (마감됨): {len(closed_bids)}건 (5억미만: {len([b for b in closed_bids if b['under500']])}건)")
for b in closed_bids[:10]:
    print(f"   [{'5억미만' if b['under500'] else '5억이상'}] {b['no']} | {b['clseDt']} | {b['budget']:,}원 | {b['agency']} | {b['title']}")
