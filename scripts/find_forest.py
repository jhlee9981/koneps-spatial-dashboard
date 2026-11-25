import zipfile
import xml.etree.ElementTree as ET

for year, fpath in [('2026', 'data/koneps_2026.xlsx'), ('2025', 'data/koneps_2025.xlsx'), ('2024', 'data/koneps_2024.xlsx')]:
    with zipfile.ZipFile(fpath) as z:
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
        
        print(f"\n=== {year} 산림청 PROJECTS ===")
        for r in ws_tree.findall(f'.//{ns}row'):
            rnum = int(r.get('r'))
            if rnum < 6: continue
            cells = {}
            for c in r.findall(f'{ns}c'):
                ref = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                t = c.get('t')
                v_el = c.find(f'{ns}v')
                v = v_el.text if v_el is not None else ''
                if t == 's' and v.isdigit(): val = sst[int(v)]
                else:
                    t_el = c.find(f'{ns}t')
                    val = t_el.text if t_el is not None and t_el.text is not None else v
                cells[ref] = val.strip()
            
            agency = cells.get('M', '')
            title = cells.get('H', '')
            no = cells.get('E', '') + '-' + cells.get('F', '')
            winner = cells.get('AL', '')
            budget = cells.get('AE', '')
            amt = cells.get('AX', '')
            if '산림' in agency or '산림' in title or '목재' in title or '지노시스템' in winner:
                print(f"[{year}] {no} | {agency} | {title} | 배정:{budget} | 수주:{winner} | 계약:{amt}")
