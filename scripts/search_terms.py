import json

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for fam in d['families']:
    txt = json.dumps(fam, ensure_ascii=False)
    for kw in ['목재수확', '지노시스템', '아이씨티웨이', '차량 장기 임차', '트렌드']:
        if kw in txt:
            fid = fam['familyId']
            fnm = fam['familyName']
            ag = fam['agency']
            print(f"Match [{kw}]: {fid} | {fnm} | {ag}")
            for h in fam['history']:
                yr = h['year']
                nm = h['noticeNm']
                wc = h['winnerCorp']
                bg = h['budget']
                print(f"   {yr}: {nm} | {wc} | {bg:,}원")
