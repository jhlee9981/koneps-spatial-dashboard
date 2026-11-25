import urllib.request
import json

base = 'http://localhost:3000'

for no in ['R26BK01259276', 'R26BK01265069', 'R25BK00934017']:
    url = f"{base}/api/bids/attachments?bidNtceNo={no}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            res = json.loads(r.read().decode())
            print(f"✅ {no}: {res.get('total')} attachments")
            for f in res.get('data', []):
                print(f"   [{f.get('docType')}] {f.get('fileName')}")
    except Exception as e:
        print(f"❌ {no} error:", e)

# Test joint contract
url_joint = f"{base}/api/bids/joint-contract?bidNtceNo=R26BK01259276"
try:
    with urllib.request.urlopen(url_joint, timeout=10) as r:
        res = json.loads(r.read().decode())
        print(f"\n✅ Joint contract response: {res}")
except Exception as e:
    print(f"❌ Joint error:", e)
