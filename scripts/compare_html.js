const fs = require('fs');
const f1 = fs.readFileSync('public/index.html', 'utf-8').split('\n');
const f2 = fs.readFileSync('deploy_files/public/index.html', 'utf-8').split('\n');
let count = 0;
for (let i = 0; i < Math.max(f1.length, f2.length); i++) {
  if (f1[i] !== f2[i]) {
    count++;
    if (count <= 20) {
      console.log('L' + (i+1) + ':');
      console.log('  public:', f1[i]);
      console.log('  deploy:', f2[i]);
    }
  }
}
console.log('Total different lines:', count);
