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
base_url = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService02/getBidPblancListInfoServcPPSSrch02'

# Let's query recent 4 windows of 6 days in 2026 up to today (2026-11-24)
today = datetime.datetime(2026, 11, 24, 23, 59)

all_2026_items = {}

for w in range(5):
    end_dt = today - datetime.timedelta(days=w*6)
    bgn_dt = end_dt - datetime.timedelta(days=5, hours=23, minutes=59)
    
    bgn_str = bgn_dt.strftime('%Y%m%d%H%M')
    end_str = end_dt.strftime('%Y%m%d%H%M')
    
    p = {
        'serviceKey': service_key,
        'inqryDiv': '1',
        'inqryBgnDt': bgn_str,
        'inqryEndDt': end_str,
        'bidNtceNm': '공간정보',
        'numOfRows': 100,
        'pageNo': 1,
        'type': 'json'
    }
    
    url = f"{base_url}?{urllib.parse.urlencode(p)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read().decode())
            body = res.get('response', {}).get('body', {})
            cnt = body.get('totalCount', 0)
            items = body.get('items', [])
            if isinstance(items, dict): items = [items]
            print(f"[{bgn_str} ~ {end_str}] total: {cnt}")
            for it in items:
                no = it.get('bidNtceNo', '') + '-' + it.get('bidNtceOrd', '000')
                all_2026_items[no] = it
    except Exception as e:
        print(f"[{bgn_str} ~ {end_str}] error: {e}")

print(f"\nTotal 2026 items found: {len(all_2026_items)}")
for no, it in all_2026_items.items():
    print(f"[{no}] {it.get('bidNtceDt')} ~ {it.get('bidClseDt')} | {it.get('dminsttNm')} | {it.get('bidNtceNm')} | 예산:{it.get('asignBdgtAmt')}")
