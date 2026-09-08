import urllib.request

url = "https://docs.google.com/spreadsheets/d/19Aq0Kz5L5ZQlDt0bV1tei0j-BHwn0y0fHd8Q912JcdY/export?format=xlsx"

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
)

try:
    with urllib.request.urlopen(req) as response:
        content = response.read()
    with open("scratch/mindheal_testing_plan.xlsx", "wb") as f:
        f.write(content)
    print("XLSX DOWNLOAD SUCCESSFUL!")
except Exception as e:
    print("XLSX DOWNLOAD FAILED:", e)
