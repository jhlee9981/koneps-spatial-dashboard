import urllib.request
import json

base = 'http://localhost:3000'

# 1. Live bids
try:
    with urllib.request.urlopen(f'{base}/api/bids/live') as res:
        live = json.loads(res.read().decode())
        print(f"✅ Live bids API OK: {live.get('totalCount')}건 라이브 사업 로드됨")
        if live.get('items'):
            first = live['items'][0]
            print(f"   샘플: {first.get('bidNtceNm')} | D-{first.get('dDay')} | {first.get('assignBdgtAmt'):,}원 | 매칭: {first.get('crossMatch', {}).get('status')}")
            for it in live['items'][:3]:
                cm = it.get('crossMatch')
                if cm:
                    print(f"   [연계] {it.get('bidNtceNm')} -> 기존수주사: {cm.get('incumbentCompany')} / 추천입찰가: {cm.get('recommendedBidPrice'):,}원")
except Exception as e:
    print('❌ Live bids error:', e)

# 2. Projects
try:
    with urllib.request.urlopen(f'{base}/api/projects') as res:
        pjs = json.loads(res.read().decode())
        print(f"✅ Projects API OK: {len(pjs)}건 계약완료 실적 로드됨")
        forest = [p for p in pjs if 'R26BK01704439' in p.get('bidNtceNo', '')]
        if forest:
            print(f"   산림청 목재수확 검증: {forest[0].get('bidNtceNm')} | 수주사: {forest[0].get('succBidCorp')} | 낙찰가: {forest[0].get('succBidAmt'):,}원 ({forest[0].get('bidRate')}%)")
except Exception as e:
    print('❌ Projects error:', e)

# 3. Recurring
try:
    with urllib.request.urlopen(f'{base}/api/recurring?under500Only=true') as res:
        rec = json.loads(res.read().decode())
        print(f"✅ Recurring under500 API OK: {rec.get('totalCount')}건 5억미만 계속사업 로드됨")
except Exception as e:
    print('❌ Recurring error:', e)
