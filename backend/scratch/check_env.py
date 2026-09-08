import os

root_dir = "/Users/designerdharm/Public/Old version_psychology website"

for root, dirs, files in os.walk(root_dir):
    # Skip node_modules
    if "node_modules" in dirs:
        dirs.remove("node_modules")
    if ".git" in dirs:
        dirs.remove(".git")
        
    for file in files:
        if file.endswith(".env"):
            path = os.path.join(root, file)
            print(f"Found env file: {path}")
            try:
                with open(path, "r") as f:
                    content = f.read()
                if "FIREBASE" in content or "firebase" in content:
                    print(f"  -> Contains FIREBASE! Length: {len(content)}")
                    # print first few lines of firebase variables
                    for line in content.splitlines():
                        if "FIREBASE" in line or "firebase" in line or "API_KEY" in line:
                            print(f"     {line}")
                else:
                    print(f"  -> No FIREBASE info inside. Length: {len(content)}")
            except Exception as e:
                print(f"  -> Error reading: {e}")
