import zipfile
import xml.etree.ElementTree as ET

def get_headers(fn):
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
        r5 = None
        for r in ws_tree.findall(f'.//{ns}row'):
            if r.get('r') == '5':
                r5 = r
                break
        cells = {}
        for c in r5.findall(f'{ns}c'):
            ref = ''.join([ch for ch in c.get('r') if ch.isalpha()])
            t = c.get('t')
            v_el = c.find(f'{ns}v')
            v = v_el.text if v_el is not None else ''
            if t == 's' and v.isdigit():
                val = sst[int(v)]
            else:
                val = v
            cells[ref] = val
        return cells

h24 = get_headers('data/koneps_2024.xlsx')
h25 = get_headers('data/koneps_2025.xlsx')
h26 = get_headers('data/koneps_2026.xlsx')
print('2024 headers == 2025 headers:', h24 == h25)
print('2024 headers == 2026 headers:', h24 == h26)
for k, v in h26.items():
    print(f'{k}: {v}')
