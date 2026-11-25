import zipfile
import xml.etree.ElementTree as ET
import sys
import os

docx_path = r'c:\Users\Admin\Downloads\조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.3_261110.docx'

if not os.path.exists(docx_path):
    print("File not found:", docx_path)
    sys.exit(1)

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read('word/document.xml')
    tree = ET.fromstring(xml_content)
    
    # Extract all text
    paragraphs = []
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    for p in tree.iter(f'{ns}p'):
        texts = [t.text for t in p.iter(f'{ns}t') if t.text]
        if texts:
            paragraphs.append(''.join(texts))

print(f"Total paragraphs: {len(paragraphs)}")
print("\n--- Summary of operations mentioned ---")
for p in paragraphs:
    if any(k in p for k in ['getBidPblancList', 'Service02', '오퍼레이션', '용역', '물품', '공사', '입찰공고', '파라미터']):
        if len(p) < 200:
            print(p)
