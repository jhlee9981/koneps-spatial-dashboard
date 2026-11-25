const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const zipPath = path.join(rootDir, 'koneps_spatial_deploy.zip');
const deployDir = path.join(rootDir, 'deploy_files');

const includeDirs = ['public', 'data', 'src'];
const includeFiles = ['package.json', 'server.js', 'render.yaml', 'README.md', '.gitignore', 'Dockerfile', '.dockerignore'];

console.log('1. Syncing to deploy_files folder...');
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

for (const f of includeFiles) {
  const srcF = path.join(rootDir, f);
  if (fs.existsSync(srcF)) {
    fs.copyFileSync(srcF, path.join(deployDir, f));
    console.log(`  Synced file: ${f}`);
  }
}

for (const d of includeDirs) {
  const srcD = path.join(rootDir, d);
  const dstD = path.join(deployDir, d);
  if (fs.existsSync(srcD)) {
    fs.cpSync(srcD, dstD, { recursive: true, force: true });
    console.log(`  Synced directory: ${d}`);
  }
}

console.log('2. Creating koneps_spatial_deploy.zip using tar.exe...');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  execSync(`tar -a -c -f "${zipPath}" -C "${deployDir}" .`, { stdio: 'inherit' });
} catch (e) {
  console.log('Falling back to PowerShell Compress-Archive without progress...');
  execSync(`powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path '${deployDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
}

const stats = fs.statSync(zipPath);
console.log(`✅ Deployment package created: ${zipPath}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
