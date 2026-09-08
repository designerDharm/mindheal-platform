import zipfile
import xml.etree.ElementTree as ET

xlsx_path = "scratch/mindheal_testing_plan.xlsx"

try:
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        # Load shared strings
        shared_strings = []
        try:
            ss_xml = zip_ref.read("xl/sharedStrings.xml")
            ss_root = ET.fromstring(ss_xml)
            ns_ss = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for t in ss_root.findall('.//main:t', ns_ss):
                shared_strings.append(t.text)
        except:
            pass

        # RelId to file
        rels_xml = zip_ref.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        sheet_file = None
        for rel in rels_root.findall('.//r:Relationship', ns_rels):
            if rel.attrib.get('Id') == 'rId5': # 00_Read_Me
                sheet_file = "xl/" + rel.attrib.get('Target')
                
        if sheet_file:
            sheet_xml = zip_ref.read(sheet_file)
            sheet_root = ET.fromstring(sheet_xml)
            ns_sheet = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows = sheet_root.findall('.//main:row', ns_sheet)
            
            non_empty_rows = []
            for row in rows:
                row_num = row.attrib.get('r')
                cells = row.findall('main:c', ns_sheet)
                row_cells = []
                for cell in cells:
                    v_elem = cell.find('main:v', ns_sheet)
                    if v_elem is not None:
                        val = v_elem.text
                        t_type = cell.attrib.get('t')
                        if t_type == 's':
                            cell_val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                        else:
                            cell_val = val
                        row_cells.append(cell_val)
                if any(str(c).strip() for c in row_cells):
                    non_empty_rows.append((row_num, row_cells))
                    
            print(f"Total non-empty rows in 00_Read_Me: {len(non_empty_rows)}")
            for idx, (num, cells) in enumerate(non_empty_rows):
                print(f"Row {num}: {cells}")
                
except Exception as e:
    print("Error:", e)
