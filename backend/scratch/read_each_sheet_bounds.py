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

        # Load workbook relationship ids
        rels_xml = zip_ref.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        sheet_targets = {}
        for rel in rels_root.findall('.//r:Relationship', ns_rels):
            sheet_targets[rel.attrib.get('Id')] = "xl/" + rel.attrib.get('Target')
            
        # Let's list sheets from workbook.xml
        workbook_xml = zip_ref.read("xl/workbook.xml")
        wb_root = ET.fromstring(workbook_xml)
        ns_wb = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        sheets = wb_root.findall('.//main:sheet', ns_wb)
        sheet_list = []
        for s in sheets:
            name = s.attrib.get('name')
            rel_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            sheet_list.append((name, rel_id))
            
        # We will parse each sheet file and print the first and last test case row
        for name, rel_id in sheet_list:
            # We want to skip Read_Me, Execution_Order, Test_Accounts, Device_Matrix, Bug_Log, QA_Dashboard
            if name in ['00_Read_Me', '01_Execution_Order', '02_Test_Accounts', '03_Device_Matrix', '17_Bug_Log', '18_QA_Dashboard']:
                continue
                
            sheet_file = sheet_targets[rel_id]
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
                    
            print(f"\n--- Sheet: {name} (File: {sheet_file}) ---")
            print(f"Total non-empty rows: {len(non_empty_rows)}")
            if len(non_empty_rows) > 0:
                print("First non-empty row (Row {}): {}".format(non_empty_rows[0][0], non_empty_rows[0][1]))
            if len(non_empty_rows) > 1:
                # Let's print the second row too (often the headers)
                print("Second non-empty row (Row {}): {}".format(non_empty_rows[1][0], non_empty_rows[1][1]))
            if len(non_empty_rows) > 2:
                # First data row
                print("Third non-empty row (Row {}): {}".format(non_empty_rows[2][0], non_empty_rows[2][1]))
            if len(non_empty_rows) > 3:
                # Last data row
                print("Last non-empty row (Row {}): {}".format(non_empty_rows[-1][0], non_empty_rows[-1][1]))
                
except Exception as e:
    print("Error:", e)
