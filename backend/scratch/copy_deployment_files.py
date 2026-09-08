import os
import shutil

src_root = "/Users/designerdharm/Public/Old version_psychology website"
dest_root = os.path.join(src_root, " for Deployement")

# Clean destination if it exists
if os.path.exists(dest_root):
    shutil.rmtree(dest_root)

os.makedirs(dest_root)

# 1. Copy Frontend Files
frontend_dest = os.path.join(dest_root, "frontend")
os.makedirs(frontend_dest)

frontend_items = ["src", "assets", "index.html", "package.json", "robots.txt", "sitemap.xml"]
for item in frontend_items:
    src_path = os.path.join(src_root, item)
    dest_path = os.path.join(frontend_dest, item)
    if os.path.exists(src_path):
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path)
        else:
            shutil.copy2(src_path, dest_path)

print("Frontend files copied successfully!")

# 2. Copy Backend Files
backend_src = os.path.join(src_root, "backend")
backend_dest = os.path.join(dest_root, "backend")
os.makedirs(backend_dest)

# Walk through backend and copy required items
ignore_backend = ["node_modules", "tests", "scratch", "dist", ".git", "artifacts"]
for item in os.listdir(backend_src):
    if item in ignore_backend:
        continue
    src_path = os.path.join(backend_src, item)
    dest_path = os.path.join(backend_dest, item)
    if os.path.isdir(src_path):
        shutil.copytree(src_path, dest_path)
    else:
        shutil.copy2(src_path, dest_path)

print("Backend files copied successfully!")

# 3. Create Deployment Readme
readme_content = """# MindHeal Ecosystem Deployment Package

This folder contains the clean, ready-to-deploy codebase for the MindHeal ecosystem.

## Structure
* `frontend/`: The static HTML/CSS/JS frontend application.
* `backend/`: The Node.js API backend, database migrations, and seeds.

## Deployment Instructions

### 1. Frontend
Deploy the contents of the `frontend/` folder to any static hosting provider (e.g., Vercel, Netlify, Firebase Hosting, S3).
* Point the API requests to your deployed backend url using the `mindheal-api-base-url` local storage setting.

### 2. Backend
Deploy the contents of the `backend/` folder to a Node.js hosting platform (e.g., Render, Railway, Heroku, AWS).
* Set up a managed PostgreSQL database and configure `DATABASE_URL` in the environment variables.
* Set up Redis and configure `REDIS_URL`.
* Run database migrations using: `npm run db:migrate`.
* Refer to the `backend/deployment-guide.md` or `.env.example` for all required environment variables (JWT keys, Razorpay credentials, SMTP passwords, etc.).
"""

with open(os.path.join(dest_root, "README.md"), "w") as f:
    f.write(readme_content)

print("Deployment README created successfully!")
