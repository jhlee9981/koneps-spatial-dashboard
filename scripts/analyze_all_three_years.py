import zipfile
import xml.etree.ElementTree as ET
import json
import re

def load_excel_records(fn):
    with zipfile.ZipFile(fn) as z:
        sst = []
        if 'xl/sharedStrings.xml' in z.namelist():
            s_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            for si in s_tree.findall(f'{ns}si'):
                texts = [t.text for t in si.findall(f'.//{ns}t') if t.text is not None]
                sst.append(''.join(texts))
        
        ws_name = [n for n in z.namelist() if n.startswith('xl/worksheets/')][0]
        ws_tree = ET.fromstring(z.read(ws_name))
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        
        records = []
        for r in ws_tree.findall(f'.//{ns}row'):
            rnum = int(r.get('r'))
            if rnum < 6:
                continue
            cells = {}
            for c in r.findall(f'{ns}c'):
                ref = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                t = c.get('t')
                v_el = c.find(f'{ns}v')
                v = v_el.text if v_el is not None else ''
                if t == 's' and v.isdigit():
                    val = sst[int(v)]
                else:
                    t_el = c.find(f'{ns}t')
                    val = t_el.text if t_el is not None and t_el.text is not None else v
                cells[ref] = val.strip()
            records.append(cells)
        return records

if __name__ == '__main__':
    rec24 = load_excel_records('data/koneps_2024.xlsx')
    rec25 = load_excel_records('data/koneps_2025.xlsx')
    rec26 = load_excel_records('data/koneps_2026.xlsx')

    print(f"2024 records: {len(rec24)}")
    print(f"2025 records: {len(rec25)}")
    print(f"2026 records: {len(rec26)}")

    for yr, recs in [('2024', rec24), ('2025', rec25), ('2026', rec26)]:
        found = [r for r in recs if '목재수확' in r.get('H', '') or '산림청' in r.get('M', '')]
        print(f"=== {yr} 산림청/목재수확 ({len(found)}건) ===")
        for f in found:
            print(f"  {f.get('E')}-{f.get('F')} :: {f.get('H')} :: 예산:{f.get('AE')} :: 수주:{f.get('AL')} :: 투찰률:{f.get('AP')}")
