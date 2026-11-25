# 나라장터 공간정보 입찰공고 분석 및 실시간 대시보드 (2026)

조달청 나라장터(KONEPS) 실측 투찰·계약 데이터와 최신 `BidPublicInfoService02` OpenAPI를 실시간 연동하여 공간정보(5억 미만 중점) 사업을 다각도로 분석하고 모니터링하는 풀스택 웹 플랫폼입니다.

---

## 🚀 주요 기능
1. **5억 미만 중점 대시보드**: 5억 미만 공간정보 사업의 비중, 예산 분포, 지자체/기관별 발주 동향 시각화
2. **실시간 라이브 공고 (OpenAPI 02)**: 현재 접수 중인 최신 2026년 실시간 공고 실시간 조회, 첨부파일(과업지시서/공고문) 즉시 다운로드, 지역의무 공동도급 비율 조회
3. **과거 3개년 계속사업 분석**: 2024~2026년 3개년 연례 계속사업 패밀리 추적, 사업자 교체(수주 기회) 및 독점 현황, 차기 발주 예상일정 분석
4. **사업 목록 & 구간별 심층분석**: 5천만 미만 ~ 5억 이상 구간별 통계 및 전수 검색 필터링

---

## 🛠 로컬 실행 방법

```bash
# 1. 의존성 설치 (기본 Node.js 네이티브 모듈 활용으로 추가 설치 불필요)
npm install

# 2. 로컬 서버 시작
npm start
```
* 웹 브라우저 접속: `http://localhost:3000`

---

## ☁️ Render.com 무료 클라우드 배포 가이드

본 프로젝트는 **Render.com** 무료 플랜(Free Tier)에서 100% 동작하도록 최적화되어 있습니다.

### 방법 1: Render 웹 콘솔에서 배포
1. 본 저장소를 GitHub에 Push합니다.
2. [Render Dashboard](https://dashboard.render.com/) 접속 ➡️ **[New +]** ➡️ **[Web Service]** 클릭
3. GitHub 저장소 선택 후 아래와 같이 입력:
   * **Name**: `koneps-spatial-dashboard` (또는 원하는 이름)
   * **Region**: `Singapore` (한국과 가장 가까워 속도 우수)
   * **Branch**: `main`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
4. **Environment Variables (환경 변수)** 추가:
   * `KONEPS_API_KEY`: `[공공데이터포털에서 발급받은 본인의 일반 인증키 입력]` (Render 대시보드 환경변수에 안전하게 등록)
5. **[Create Web Service]** 클릭! (약 1~2분 후 `https://xxxx.onrender.com` 무료 주소 발급)

### 💡 무료 슬립 모드(Cold Start) 방지 팁
* Render 무료 플랜은 15분간 접속이 없으면 대기 상태로 전환됩니다.
* [UptimeRobot](https://uptimerobot.com) (무료)에 가입하여 발급받은 웹 URL을 10분 주기 HTTP 모니터로 등록해두면 24시간 잠들지 않고 즉시 응답합니다.
