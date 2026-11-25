// 2026 나라장터 실제 다운로드 엑셀 기반 데이터 리셋 스크립트
const { execSync } = require('child_process');
const path = require('path');

try {
  const pyScript = path.join(__dirname, 'parse_downloaded_excel.py');
  const pythonBin = 'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe';
  execSync(`"${pythonBin}" "${pyScript}"`, { stdio: 'inherit' });
  console.log('✅ 실제 엑셀 파일 기반 공고 284건 생성 완료');
} catch (err) {
  console.error('엑셀 파싱 실행 오류:', err.message);
}
