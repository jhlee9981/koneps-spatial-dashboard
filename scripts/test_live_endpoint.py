import urllib.request
import json

with urllib.request.urlopen('http://localhost:3000/api/bids/live') as r:
    data = json.loads(r.read().decode())
    print('Total live bids (under 500M filtered):', data.get('total'))
    print('Summary:', data.get('summary'))
    print('\n--- Real Live Bids Currently Accepting Submissions ---')
    for b in data.get('data', []):
        cm = b.get('crossMatch', {})
        print(f"[{b.get('ddayText')}] {b.get('bidNtceNo')} | {b.get('assignBdgtAmt'):,}원 | {b.get('dminsttNm')} | {b.get('bidNtceNm')}")
        print(f"   연계: {cm.get('incumbentCompany')} | 추천가: {cm.get('recommendedBid'):,}원 ({cm.get('avgBidRate')}%) | {cm.get('strategicAdvice')[:60]}...")
