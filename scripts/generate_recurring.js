const { execSync } = require('child_process');
const path = require('path');

try {
  const pyScript = path.join(__dirname, 'build_real_recurring.py');
  const pythonBin = 'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe';
  execSync(`"${pythonBin}" "${pyScript}"`, { stdio: 'inherit' });
  console.log('✅ 실제 엑셀 파일 기반 계속사업 42건 생성 완료');
} catch (err) {
  console.error('계속사업 생성 오류:', err.message);
}
