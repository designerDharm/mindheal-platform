import zipfile
import xml.etree.ElementTree as ET

xlsx_path = "scratch/mindheal_testing_plan.xlsx"

try:
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        # 1. Load shared strings
        shared_strings = []
        try:
            ss_xml = zip_ref.read("xl/sharedStrings.xml")
            ss_root = ET.fromstring(ss_xml)
            # Find all <t> elements
            # Namespaces
            ns_ss = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for t in ss_root.findall('.//main:t', ns_ss):
                shared_strings.append(t.text)
        except Exception as e:
            print("Shared strings not found or error:", e)
            
        print(f"Loaded {len(shared_strings)} shared strings.")
        
        # 2. Parse sheet2.xml (01_Execution_Order)
        # Let's inspect which file represents 01_Execution_Order
        # RelID points to the file. Let's find workbook rels
        rels_xml = zip_ref.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        sheet_file = None
        for rel in rels_root.findall('.//r:Relationship', ns_rels):
            if rel.attrib.get('Id') == 'rId6': # RelID for 01_Execution_Order
                sheet_file = "xl/" + rel.attrib.get('Target')
                
        print("01_Execution_Order file path inside zip:", sheet_file)
        
        if sheet_file:
            sheet_xml = zip_ref.read(sheet_file)
            sheet_root = ET.fromstring(sheet_xml)
            ns_sheet = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows = sheet_root.findall('.//main:row', ns_sheet)
            print(f"Total rows in 01_Execution_Order: {len(rows)}")
            
            # Print the first 100 rows
            for row in rows[:100]:
                row_num = row.attrib.get('r')
                cells = row.findall('main:c', ns_sheet)
                row_cells = []
                for cell in cells:
                    cell_ref = cell.attrib.get('r')
                    cell_val = ""
                    v_elem = cell.find('main:v', ns_sheet)
                    if v_elem is not None:
                        val = v_elem.text
                        t_type = cell.attrib.get('t')
                        if t_type == 's': # shared string
                            cell_val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                        else:
                            cell_val = val
                    row_cells.append((cell_ref, cell_val))
                print(f"Row {row_num}: {row_cells}")
                
except Exception as e:
    print("Failed to read sheet content:", e)
