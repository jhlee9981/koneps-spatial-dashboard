import zipfile
import os
import shutil

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
zip_path = os.path.join(root_dir, 'koneps_spatial_deploy.zip')
deploy_dir = os.path.join(root_dir, 'deploy_files')

include_dirs = ['public', 'data', 'src']
include_files = ['package.json', 'server.js', 'render.yaml', 'README.md', '.gitignore', 'Dockerfile', '.dockerignore']

print("1. Creating deployment zip...")
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in include_files:
        f_path = os.path.join(root_dir, f)
        if os.path.exists(f_path):
            z.write(f_path, f)
            print(f"  Added file: {f}")
            
    for d in include_dirs:
        d_path = os.path.join(root_dir, d)
        for root, dirs, files in os.walk(d_path):
            for file in files:
                if file.endswith('.pyc') or file == '.DS_Store' or 'scratch' in root or '__pycache__' in root:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                z.write(full_path, rel_path)
                print(f"  Added: {rel_path}")

print(f"\n✅ Deployment package created: {zip_path}")
print(f"Size: {os.path.getsize(zip_path) / 1024 / 1024:.2f} MB")

print("\n2. Syncing to deploy_files folder for direct GitHub upload...")
os.makedirs(deploy_dir, exist_ok=True)
for f in include_files:
    src_f = os.path.join(root_dir, f)
    if os.path.exists(src_f):
        shutil.copy2(src_f, os.path.join(deploy_dir, f))

for d in include_dirs:
    src_d = os.path.join(root_dir, d)
    dst_d = os.path.join(deploy_dir, d)
    if os.path.exists(dst_d):
        shutil.rmtree(dst_d)
    shutil.copytree(src_d, dst_d, ignore=shutil.ignore_patterns('*.pyc', '__pycache__', '.DS_Store'))

print("✅ deploy_files folder successfully synced!")

