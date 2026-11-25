import urllib.request
import urllib.parse
import json

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

test_bid_no = '20241126517' # 광주광역시 공간정보시스템
test_ord = '000'

# Test 1: getBidPblancListInfoAtchFileInfo02 (첨부파일정보조회)
p_atch = {
    'serviceKey': service_key,
    'inqryDiv': '2',
    'bidNtceNo': test_bid_no,
    'bidNtceOrd': test_ord,
    'type': 'json'
}
url_atch = f"{base_url}/getBidPblancListInfoAtchFileInfo02?{urllib.parse.urlencode(p_atch)}"
print("1. Calling getBidPblancListInfoAtchFileInfo02...")
try:
    req = urllib.request.Request(url_atch, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        res = json.loads(r.read().decode())
        print(json.dumps(res, ensure_ascii=False, indent=2)[:1000])
except Exception as e:
    print("Atch error:", e)

# Test 2: getBidPblancJntcontrctDutyRgnListInfo02 (공동도급의무지역 정보조회)
p_jnt = {
    'serviceKey': service_key,
    'inqryDiv': '2',
    'bidNtceNo': test_bid_no,
    'bidNtceOrd': test_ord,
    'type': 'json'
}
url_jnt = f"{base_url}/getBidPblancJntcontrctDutyRgnListInfo02?{urllib.parse.urlencode(p_jnt)}"
print("\n2. Calling getBidPblancJntcontrctDutyRgnListInfo02...")
try:
    req = urllib.request.Request(url_jnt, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        res = json.loads(r.read().decode())
        print(json.dumps(res, ensure_ascii=False, indent=2)[:1000])
except Exception as e:
    print("Joint error:", e)
