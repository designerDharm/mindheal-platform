import json

with open("scratch/bootstrap.json") as f:
    data = json.load(f)

# Locate the sheets/tabs list
# Typically inside data['changes']['workspace']['sheets'] or similar path
# Let's inspect the keys and find it
print("Root keys:", list(data.keys()))

def search_keys(obj, query_key):
    paths = []
    def traverse(o, current_path):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == query_key:
                    paths.append(current_path + [k])
                traverse(v, current_path + [k])
        elif isinstance(o, list):
            for idx, item in enumerate(o):
                traverse(item, current_path + [idx])
    traverse(obj, [])
    return paths

# Let's find any keys named 'name' or 'title' or 'sheetId' or 'gid'
paths = search_keys(data, "sheetId")
print("Paths to sheetId:", paths[:5])

# Let's print out all sheet titles and sheetIds
# Often bootstrapData has a structure like data['bootstrapWidgetData']['allSheetsData']
try:
    sheets = data['actionInfo']['allSheetsData']
    for s in sheets:
        print(f"Sheet Name: {s.get('name')}, GID: {s.get('sheetId')}")
except Exception as e:
    print("Direct search failed, scanning values...")
    # Let's write a generic scanner
    # Let's search inside data['changes']
    pass

# Let's just find and print all dictionaries containing both "name" and "sheetId" or "gid"
results = []
def scan_dicts(o):
    if isinstance(o, dict):
        if "name" in o and ("sheetId" in o or "gid" in o or "id" in o):
            results.append((o.get("name"), o.get("sheetId") or o.get("gid") or o.get("id")))
        for k, v in o.items():
            scan_dicts(v)
    elif isinstance(o, list):
        for item in o:
            scan_dicts(item)

scan_dicts(data)
print("Scanned Sheet Dictionaries:")
for name, sheet_id in set(results):
    print(f"  Name: {name}, ID: {sheet_id}")
