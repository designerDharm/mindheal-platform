with open(".env", "r") as f:
    lines = f.readlines()

print(f"Total lines read from backend/.env: {len(lines)}")
for idx, line in enumerate(lines):
    print(f"Line {idx+1}: {repr(line)}")
