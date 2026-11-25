import json
import openpyxl

files = {
    '2026': r'C:\Users\Admin\Downloads\UI-ADOFAA-011R.입찰공고 기업별 투찰 및 계약내역(26년).xlsx',
    '2025': r'C:\Users\Admin\Downloads\UI-ADOFAA-011R.입찰공고 기업별 투찰 및 계약내역(25년).xlsx',
    '2024': r'C:\Users\Admin\Downloads\UI-ADOFAA-011R.입찰공고 기업별 투찰 및 계약내역(24년).xlsx'
}

for year, fpath in files.items():
    wb = openpyxl.load_workbook(fpath, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    print(f"\n==================== {year} EXCEL ({len(rows)-1} rows) ====================")
    print("Header:", header)
    
    found = False
    for i, r in enumerate(rows[1:], 1):
        row_str = ' '.join([str(c) for c in r if c is not None])
        if 'R26BK01704439' in row_str or '목재수확' in row_str:
            found = True
            print(f"Row {i} match:")
            for col_name, val in zip(header, r):
                if val is not None:
                    print(f"  {col_name}: {val}")
    if not found:
        print("No match for R26BK01704439 or 목재수확")

print("\n==================== CURRENT data/recurring_projects.json ====================")
with open('data/recurring_projects.json', 'r', encoding='utf-8') as f:
    rec_data = json.load(f)

for item in rec_data:
    if '목재수확' in item.get('title', '') or 'R26BK01704439' in item.get('id', ''):
        print(json.dumps(item, ensure_ascii=False, indent=2))
