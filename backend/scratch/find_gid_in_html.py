import urllib.request
import re

url = "https://docs.google.com/spreadsheets/d/19Aq0Kz5L5ZQlDt0bV1tei0j-BHwn0y0fHd8Q912JcdY/edit?usp=sharing"

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
    gids = re.findall(r'gid=(\d+)', html)
    sheet_ids = re.findall(r'\"sheetId\":\s*(\d+)', html)
    
    # Also scan for sheet names and their IDs
    # e.g., "id":169534600,"title":"01_Execution_Order"
    sheet_details = re.findall(r'\"id\":\s*(\d+),\s*\"title\":\s*\"([^\"]+)\"', html)
    # E.g. {"id":0,"title":"Sheet1"}
    sheet_details_2 = re.findall(r'\"sheetId\":\s*(\d+),\s*\"title\":\s*\"([^\"]+)\"', html)
    sheet_details_3 = re.findall(r'\"title\":\s*\"([^\"]+)\",\s*\"sheetId\":\s*(\d+)', html)
    sheet_details_4 = re.findall(r'\"title\":\s*\"([^\"]+)\",\s*\"id\":\s*(\d+)', html)

    with open("scratch/gids_output.txt", "w") as f:
        f.write(f"GIDS BY URL: {list(set(gids))}\n")
        f.write(f"SHEETIDS BY KEY: {list(set(sheet_ids))}\n")
        f.write(f"DETAILS 1: {sheet_details}\n")
        f.write(f"DETAILS 2: {sheet_details_2}\n")
        f.write(f"DETAILS 3: {sheet_details_3}\n")
        f.write(f"DETAILS 4: {sheet_details_4}\n")
        
        # Also print any match for sheet names
        f.write("All sheet titles found in page:\n")
        all_titles = re.findall(r'\"title\":\s*\"([^\"]+)\"', html)
        f.write(f"{list(set(all_titles))}\n")

except Exception as e:
    with open("scratch/gids_output.txt", "w") as f:
        f.write(f"Error: {e}\n")
