import json

with open("scratch/bootstrap.json") as f:
    data = json.load(f)

# Search for the string "01_Execution_Order" recursively and print the path
def find_string(obj, query, current_path):
    if isinstance(obj, str):
        if query in obj:
            print(f"Found str '{obj}' at path: {current_path}")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if query in str(k):
                print(f"Found key '{k}' at path: {current_path}")
            find_string(v, query, current_path + [k])
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            find_string(item, query, current_path + [idx])

find_string(data, "01_Execution_Order", [])
