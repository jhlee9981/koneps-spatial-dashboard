import zipfile
import xml.etree.ElementTree as ET

def get_samcheok_rows():
    files = {
        '2024': 'data/koneps_2024.xlsx',
        '2025': 'data/koneps_2025.xlsx',
        '2026': 'data/koneps_2026.xlsx'
    }
    for year, fn in files.items():
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
            
            for r in ws_tree.findall(f'.//{ns}row'):
                cells = {}
                for c in r.findall(f'{ns}c'):
                    ref = ''.join([ch for ch in c.get('r') if ch.isalpha()])
                    t = c.get('t')
                    v_el = c.find(f'{ns}v')
                    v = v_el.text if v_el is not None else ''
                    val = sst[int(v)] if t == 's' and v.isdigit() else v
                    cells[ref] = val.strip()
                title = cells.get('H', '')
                instt = cells.get('M', '')
                if '삼척' in title or '삼척' in instt:
                    no = cells.get('E', '')
                    mthd = f"{cells.get('N', '')}/{cells.get('O', '')}"
                    corp = cells.get('AL', '')
                    biz_no = cells.get('AM', '')
                    amt = cells.get('AY', '')
                    print(f"[{year}] {no} | {title} | {mthd} | 업체명: '{corp}' | 사업자: {biz_no} | 계약액: {amt}")

if __name__ == '__main__':
    get_samcheok_rows()
