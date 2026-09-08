import zipfile
import xml.etree.ElementTree as ET

xlsx_path = "scratch/mindheal_testing_plan.xlsx"

try:
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        # Read workbook.xml to list sheet names and relationship ids
        workbook_xml = zip_ref.read("xl/workbook.xml")
        root = ET.fromstring(workbook_xml)
        
        # XML Namespaces in xlsx
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        sheets = root.findall('.//main:sheet', ns)
        print("Sheets in workbook:")
        for sheet in sheets:
            name = sheet.attrib.get('name')
            sheet_id = sheet.attrib.get('sheetId')
            rel_id = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            print(f"  Name: {name}, SheetID: {sheet_id}, RelID: {rel_id}")
            
except Exception as e:
    print("Failed to read workbook xml:", e)
