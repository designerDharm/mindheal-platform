import json
import re

with open("scratch/bootstrap.json") as f:
    data = json.load(f)

# Convert whole dict to string to search with regex
json_str = json.dumps(data)

# Find all occurrences of sheet properties like sheet name and ID
# A sheet definition in JSON is usually like: [id, 0, "SheetName"]
# E.g. [0, 0, "01_Execution_Order"]
sheet_defs = re.findall(r'\[(\d+),\s*0,\s*\"([^\"]+)\"\]', json_str)
print("Regex match [id, 0, name]:", sheet_defs)

# Let's search for sheet IDs in other formats
# Google sheets bootstrap data often lists sheet metadata like:
# [id, title, index, ...] or similar list elements
# Let's search for all GIDs and names
gids = {}
for m in re.finditer(r'\"([0-9]{5,})\"', json_str):
    gid = m.group(1)
    # Check if we can find any sheet name near this gid
    start = max(0, m.start() - 100)
    end = min(len(json_str), m.end() + 100)
    chunk = json_str[start:end]
    names = re.findall(r'\"([^\"]+_[^\"]+)\"|\"([0-9]{2}_[^\"]+)\"', chunk)
    if names:
        gids[gid] = names

print("Potential sheet GID mapping chunks:")
for gid, names in gids.items():
    print(f"  GID: {gid} -> {names}")

# Let's print out all sheet titles that we can find by regex
all_sheet_names = re.findall(r'\"([0-9]{2}_[A-Za-z0-9_]+)\"', json_str)
print("Unique potential sheet names in JSON:", sorted(list(set(all_sheet_names))))

# Let's also print any large numbers (sheet IDs)
potential_gids = re.findall(r'\"([0-9]{8,10})\"', json_str)
print("Potential GIDs:", list(set(potential_gids)))
