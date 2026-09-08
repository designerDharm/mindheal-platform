import urllib.request
import re
import json

url = "https://docs.google.com/spreadsheets/d/19Aq0Kz5L5ZQlDt0bV1tei0j-BHwn0y0fHd8Q912JcdY/edit?usp=sharing"

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
    # Search for bootstrap data or sheet info
    # Google Sheets page contains "_bootstrapDeferredData" or similar JSON structures containing sheet metadata
    matches = re.findall(r'bootstrapData\s*=\s*({.+?});', html)
    if matches:
        data = json.loads(matches[0])
        print("Found bootstrapData!")
        # Let's save it to inspect
        with open("scratch/bootstrap.json", "w") as f:
            json.dump(data, f, indent=2)
    else:
        # Try finding gid mapping in the script tags
        # E.g. '{"name":"01_Execution_Order","gid":"0"}'
        print("bootstrapData not found by regex, searching alternative patterns...")
        gids = re.findall(r'\"(gid|sheetId)\":\"?(\d+)\"?,\"(name|title)\":\"([^\"]+)\"', html)
        if gids:
            print("Found GIDs directly:")
            for g in gids:
                print(g)
        else:
            # Just print a chunk of the HTML script tags containing sheet names
            print("Searching for sheet names...")
            for m in re.finditer(r'\"name\":\"([^\"]+)\"', html):
                print("Name match:", m.group(1))
except Exception as e:
    print("Error:", e)
