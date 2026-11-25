import urllib.request
import urllib.parse
import json
import xml.etree.ElementTree as ET
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

def call_api(op, params):
    qs = urllib.parse.urlencode(params)
    url = f"{base_url}/{op}?{qs}"
    print(f"Calling: {url[:100]}... (serviceKey hidden)")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8')
            return content
    except Exception as e:
        print("HTTP Error:", e)
        return None

# Test 1: getBidPblancListInfoServcPPSSrch02 for 2026
now = datetime.datetime.now()
bgn_26 = (now - datetime.timedelta(days=7)).strftime('%Y%m%d0000')
end_26 = now.strftime('%Y%m%d2359')

print(f"\n--- Testing 2026 range: {bgn_26} ~ {end_26} ---")
p26 = {
    'serviceKey': service_key,
    'numOfRows': 20,
    'pageNo': 1,
    'inqryDiv': '1',
    'inqryBgnDt': bgn_26,
    'inqryEndDt': end_26,
    'bidNtceNm': '공간정보',
    'type': 'json'
}
res26 = call_api('getBidPblancListInfoServcPPSSrch02', p26)
print("Res 2026 (first 300 chars):", str(res26)[:300])

# Test 2: If 0 or error, test 2024 range: 202411150000 ~ 202411242359
print(f"\n--- Testing 2024 range: 202411150000 ~ 202411242359 ---")
p24 = {
    'serviceKey': service_key,
    'numOfRows': 20,
    'pageNo': 1,
    'inqryDiv': '1',
    'inqryBgnDt': '202411150000',
    'inqryEndDt': '202411242359',
    'bidNtceNm': '공간정보',
    'type': 'json'
}
res24 = call_api('getBidPblancListInfoServcPPSSrch02', p24)
print("Res 2024 (first 300 chars):", str(res24)[:300])

# Test 3: What about getBidPblancListInfoServc02 (general without PPS search name)?
print(f"\n--- Testing getBidPblancListInfoServc02 (2024) ---")
p_gen = {
    'serviceKey': service_key,
    'numOfRows': 10,
    'pageNo': 1,
    'inqryDiv': '1',
    'inqryBgnDt': '202411230000',
    'inqryEndDt': '202411242359',
    'type': 'json'
}
res_gen = call_api('getBidPblancListInfoServc02', p_gen)
print("Res general 2024 (first 300 chars):", str(res_gen)[:300])
