import os

src_path = "/Users/designerdharm/Public/psychology website/backend/.env"
dest_path = "/Users/designerdharm/Public/Old version_psychology website/backend/.env"

if os.path.exists(src_path):
    with open(src_path, "r") as f:
        content = f.read()
    
    # Let's map FIREBASE_WEB_* to FIREBASE_* for client sdk compatibility
    lines = content.splitlines()
    mapped_lines = []
    has_client_vars = False
    
    for line in lines:
        mapped_lines.append(line)
        if "FIREBASE_WEB_" in line:
            # Add a mapped copy without the _WEB_ part
            newline = line.replace("FIREBASE_WEB_", "FIREBASE_")
            mapped_lines.append(newline)
            has_client_vars = True

    # Also let's make sure allowed origins includes 4000/4173 etc
    final_content = "\n".join(mapped_lines)
    
    with open(dest_path, "w") as f:
        f.write(final_content)
    
    print("SUCCESS: Copied and mapped env file successfully!")
else:
    print("ERROR: Source env file not found at:", src_path)
