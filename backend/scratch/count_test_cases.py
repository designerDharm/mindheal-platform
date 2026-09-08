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

        # Load workbook relationships
        rels_xml = zip_ref.read("xl/_rels/workbook.xml.rels")
        rels_root = ET.fromstring(rels_xml)
        ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        sheet_targets = {}
        for rel in rels_root.findall('.//r:Relationship', ns_rels):
            sheet_targets[rel.attrib.get('Id')] = "xl/" + rel.attrib.get('Target')
            
        # List sheets from workbook.xml
        workbook_xml = zip_ref.read("xl/workbook.xml")
        wb_root = ET.fromstring(workbook_xml)
        ns_wb = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        sheets = wb_root.findall('.//main:sheet', ns_wb)
        sheet_list = []
        for s in sheets:
            name = s.attrib.get('name')
            rel_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            sheet_list.append((name, rel_id))
            
        total_test_cases = 0
        sheet_counts = {}
        
        for name, rel_id in sheet_list:
            # We only count sheets with test cases: 04_Public_Website to 16_Backend_Integrations
            if name in ['00_Read_Me', '01_Execution_Order', '02_Test_Accounts', '03_Device_Matrix', '17_Bug_Log', '18_QA_Dashboard']:
                continue
                
            sheet_file = sheet_targets[rel_id]
            sheet_xml = zip_ref.read(sheet_file)
            sheet_root = ET.fromstring(sheet_xml)
            ns_sheet = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows = sheet_root.findall('.//main:row', ns_sheet)
            test_case_count = 0
            
            for row in rows:
                row_num = int(row.attrib.get('r'))
                # Test cases start on row 4 and onwards
                if row_num < 4:
                    continue
                    
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
                
                # Check if this row represents an actual test case by verifying if it has a Test ID in the first column
                if row_cells and str(row_cells[0]).strip() and not str(row_cells[0]).startswith("Test ID"):
                    test_case_count += 1
            
            sheet_counts[name] = test_case_count
            total_test_cases += test_case_count
            
        print("Test Case Counts per Sheet:")
        for name, count in sheet_counts.items():
            print(f"  {name}: {count} test cases")
        print(f"\nTotal Test Cases: {total_test_cases}")
        
except Exception as e:
    print("Error:", e)
