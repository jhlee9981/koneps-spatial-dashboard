import json
import shutil
import zipfile
import os

with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data.get('data', []):
    if item.get('familyId') == 'REC-R26BK01257020-000':
        print('Found Samcheok family!')
        item['winnerChangeCount'] = 0
        item['isIncumbentLocked'] = True
        item['riskOpportunityLevel'] = '기존 사업자 고착 (2년 연속 수주)'
        item['strategicAction'] = "삼척시는 공간정보 유지보수를 SW부문과 HW부문으로 분리 발주합니다. 본 사업(SW)은 '주식회사 커넥트플로우'(사업자: 110-86-19912)가 2025~2026년 2년 연속 수의시담으로 전담 수주 중입니다. (※ HW 유지관리는 '(주)새올정보기술'이 별도 계약)"
        if len(item.get('history', [])) > 0 and item['history'][0]['year'] == 2024:
            item['history'][0]['noticeNm'] = '2025년 삼척시 공간정보시스템(HW) 유지보수 용역 (참고: HW별도발주)'
            item['history'][0]['sourceNote'] = "참고: 삼척시는 HW((주)새올정보기술)와 SW(주식회사 커넥트플로우)를 분리 발주"

with open('data/recurring_projects.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Copy to deploy_files
shutil.copy2('data/recurring_projects.json', 'deploy_files/data/recurring_projects.json')

print('Updated recurring_projects.json successfully and synced to deploy_files.')
