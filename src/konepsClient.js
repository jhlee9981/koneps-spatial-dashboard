/**
 * 공공데이터포털 조달청 나라장터 입찰공고정보서비스02 OpenAPI 클라이언트
 * 공식 엔드포인트: https://apis.data.go.kr/1230000/ad/BidPublicInfoService02
 * 
 * [조달청 서비스 변경 안내 2026-11 반영]
 * 1. BASE URL: https://apis.data.go.kr/1230000/ad/BidPublicInfoService02 (오퍼레이션별 02 접미사)
 * 2. getBidPblancListInfoAtchFileInfo02: 첨부파일(과업지시서, 공고서, 제안요청서 등) 정보조회 분리 오퍼레이션
 * 3. getBidPblancJntcontrctDutyRgnListInfo02: 공동도급의무지역 및 지역의무공동도급비율 정보조회 분리 오퍼레이션
 * 4. getBidPblancIncntvRgnListInfo02: 가산지역 정보조회 분리 오퍼레이션
 * 5. getBidPblancSubsiCnsttyIndstrytyListInfo02: 부공종 정보조회 분리 오퍼레이션
 */

const DEFAULT_SERVICE_KEY = process.env.KONEPS_API_KEY || "eb442978f5cad44e6ccfe882fb7bb09a00fcf662585b7a0adffcfcf55f393cd6";
const BASE_ENDPOINT = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService02";

function inferCategory(title) {
  const t = title || "";
  if (/디지털트윈|3차원|3D|실감모형|LOD|가상공간/.test(t)) return "디지털트윈/융합";
  if (/DB|데이터|측량|전산화|갱신|구축|수치지도|지적|지하매설물|지하시설물/.test(t)) return "DB/데이터구축";
  if (/유지보수|유지관리|운영|위탁운영|모니터링|헬프데스크/.test(t)) return "유지보수/운영";
  if (/연구|기획|전략|ISP|실태조사|방안|평가|타당성/.test(t)) return "기획/연구/ISP";
  return "시스템/SW구축";
}

function inferOrgType(instName) {
  const name = instName || "";
  if (/부$|처$|청$|원$|국토지리정보원|산림청|해양수산부|국토교통부|국방/.test(name)) return "국가기관";
  if (/특별시$|광역시$|특별자치도$|도$|시$|군$|구$|청사/.test(name)) return "지자체";
  if (/공사$|공단$|진흥원$|정보원$|센터$|기술원$|연구원$|협회$/.test(name)) return "공공기관";
  return "공공기관";
}

function inferKeyThemes(title) {
  const themes = [];
  const map = {
    "디지털트윈": /디지털트윈|가상도시/,
    "3D/3차원": /3차원|3D|LOD/,
    "지하시설물": /지하공간|지하시설물|상하수도|가스배관/,
    "지적재조사": /지적|연속지적/,
    "수치지도": /수치지도|국가기본도/,
    "클라우드": /클라우드|네이티브/,
    "자율주행": /자율주행|정밀도로/,
    "스마트시티": /스마트시티|스마트도시/,
    "오픈API/포털": /포털|오픈플랫폼|브이월드|API/,
    "해양/수자원": /해양|수자원|하천|댐/,
    "재난안전": /재난|안전|방재|산불/
  };

  for (const [key, regex] of Object.entries(map)) {
    if (regex.test(title)) {
      themes.push(key);
    }
  }

  if (themes.length === 0) themes.push("공간정보", "GIS");
  return themes;
}

// 7일 단위 날짜 청크 생성기 (조달청 Open API 조회기간 최대 7일 제한 준수)
function generateDateRanges(beginDateStr, endDateStr) {
  const parseDt = (s) => new Date(
    parseInt(s.substring(0, 4), 10),
    parseInt(s.substring(4, 6), 10) - 1,
    parseInt(s.substring(6, 8), 10)
  );

  const formatDt = (d, isEnd = false) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}${isEnd ? '2359' : '0000'}`;
  };

  const start = parseDt(beginDateStr);
  const end = parseDt(endDateStr);
  const ranges = [];

  let curr = new Date(start);
  while (curr <= end) {
    let next = new Date(curr);
    next.setDate(next.getDate() + 6); // 7일 범위
    if (next > end) next = new Date(end);

    ranges.push({
      bgn: formatDt(curr, false),
      end: formatDt(next, true)
    });

    curr = new Date(next);
    curr.setDate(curr.getDate() + 1);
  }

  return ranges;
}

/**
 * 1. 실시간 공고 목록 조회 (02 오퍼레이션)
 */
async function fetchKonepsBids({
  serviceKey = DEFAULT_SERVICE_KEY,
  keyword = "공간정보",
  beginDate = "202610280000",
  endDate = "202611242359",
  maxPages = 3
}) {
  const cleanKey = (serviceKey || DEFAULT_SERVICE_KEY).trim();
  const allItems = [];
  const seenNoticeNos = new Set();
  
  // 02 서비스 엔드포인트
  const operations = [
    { op: "getBidPblancListInfoServcPPSSrch02", workType: "일반용역" },
    { op: "getBidPblancListInfoThngPPSSrch02", workType: "물품" },
    { op: "getBidPblancListInfoCnstwkPPSSrch02", workType: "공사" }
  ];

  // 최근 35일 7일 단위 청크
  const chunks = generateDateRanges(beginDate, endDate);
  chunks.reverse();

  for (const { op, workType } of operations) {
    const baseUrl = `${BASE_ENDPOINT}/${op}`;

    for (const chunk of chunks.slice(0, 5)) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          serviceKey: cleanKey,
          numOfRows: "100",
          pageNo: String(page),
          inqryDiv: "1",
          inqryBgnDt: chunk.bgn,
          inqryEndDt: chunk.end,
          bidNtceNm: keyword,
          type: "json"
        });

        const targetUrl = `${baseUrl}?${params.toString()}`;
        try {
          const response = await fetch(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
          });

          const rawText = await response.text();
          let data = null;
          try {
            data = JSON.parse(rawText);
          } catch (err) {
            continue;
          }

          if (data?.nkoneps?.com?.response?.ResponseError) {
            continue;
          }

          const body = data?.response?.body;
          if (!body || !body.items) {
            break;
          }

          const items = Array.isArray(body.items) ? body.items : [body.items];
          if (items.length === 0) break;

          for (const item of items) {
            const fullNo = `${item.bidNtceNo || ""}-${item.bidNtceOrd || "000"}`;
            if (seenNoticeNos.has(fullNo)) continue;
            seenNoticeNos.add(fullNo);

            const budget = Number(item.asignBdgtAmt || item.presmptPrce || 0);
            const noticeDt = item.bidNtceDt ? `${item.bidNtceDt.substring(0, 10)} ${item.bidNtceDt.substring(11, 19)}` : "";
            const closeDt = item.bidClseDt ? `${item.bidClseDt.substring(0, 10)} ${item.bidClseDt.substring(11, 19)}` : "";
            const openDt = item.opengDt ? `${item.opengDt.substring(0, 10)} ${item.opengDt.substring(11, 19)}` : "";

            const proj = {
              bidNtceNo: fullNo,
              bidNtceOrd: item.bidNtceOrd || "000",
              bidNtceNm: item.bidNtceNm || "",
              ntceInsttNm: item.ntceInsttNm || "조달청",
              dminsttNm: item.dminsttNm || item.ntceInsttNm || "",
              orgType: inferOrgType(item.dminsttNm || item.ntceInsttNm),
              category: inferCategory(item.bidNtceNm),
              workType: workType,
              noticeType: item.cntrctCnclsMthdNm || "제한경쟁",
              awardMethod: item.sucsfbidMthdNm || "협상에 의한 계약",
              assignBdgtAmt: budget,
              presmptPrce: Number(item.presmptPrce || Math.round(budget / 1.1)),
              bsisAmt: Number(item.bsisAmount || 0),
              bidNtceDt: noticeDt,
              bidClseDt: closeDt,
              opengDt: openDt,
              bidPrcsTypeNm: "입찰공고중",
              bidNtceDtlUrl: item.bidNtceDtlUrl ? item.bidNtceDtlUrl.replace(':8081', '') : `https://www.g2b.go.kr#PNPE027_01?bidPbancNo=${item.bidNtceNo}&bidPbancOrd=${item.bidNtceOrd || '000'}`,
              isSuccessBidded: false,
              succBidAmt: null,
              succBidCorp: null,
              bidRate: null,
              isUnder500M: budget < 500000000,
              budgetTier: budget < 50000000 ? "5천만 미만" : (budget < 100000000 ? "5천만~1억" : (budget < 300000000 ? "1억~3억" : (budget < 500000000 ? "3억~5억" : "5억 이상"))),
              keyThemes: inferKeyThemes(item.bidNtceNm),
              summary: `${item.dminsttNm || item.ntceInsttNm}에서 발주한 ${item.bidNtceNm} 실제 조달청 나라장터 공고입니다.`
            };
            allItems.push(proj);
          }

          if (items.length < 50 || page * 50 >= (body.totalCount || 0)) {
            break;
          }
        } catch (e) {
          console.error(`Error querying ${op}:`, e.message);
        }
      }
    }
  }

  return allItems;
}

/**
 * 2. [신규 02 오퍼레이션] getBidPblancListInfoAtchFileInfo02 (첨부파일정보조회)
 * 과업지시서, 제안요청서, 공고서 원문 다운로드 URL 추출
 */
async function fetchBidAttachments({ bidNtceNo, bidNtceOrd = "000", serviceKey = DEFAULT_SERVICE_KEY }) {
  const cleanKey = (serviceKey || DEFAULT_SERVICE_KEY).trim();
  const cleanNo = (bidNtceNo || "").split("-")[0];
  const cleanOrd = (bidNtceOrd || "000").split("-").pop();

  const url = `${BASE_ENDPOINT}/getBidPblancListInfoAtchFileInfo02?` + new URLSearchParams({
    serviceKey: cleanKey,
    inqryDiv: "2",
    bidNtceNo: cleanNo,
    bidNtceOrd: cleanOrd,
    type: "json",
    numOfRows: "20",
    pageNo: "1"
  }).toString();

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const data = JSON.parse(text);
    const body = data?.response?.body;
    if (!body || !body.items) return [];

    const items = Array.isArray(body.items) ? body.items : [body.items];
    return items.map(item => ({
      sno: item.atchSno,
      docType: item.atchDocDivNm || "첨부파일",
      fileName: item.atchFileNm || "첨부파일",
      fileUrl: item.atchFileUrl || "",
      noticeDt: item.ntceNticeDt || ""
    }));
  } catch (err) {
    console.error(`fetchBidAttachments error for ${bidNtceNo}:`, err.message);
    return [];
  }
}

/**
 * 3. [신규 02 오퍼레이션] getBidPblancJntcontrctDutyRgnListInfo02 (공동도급의무지역 정보조회)
 * 지역의무공동도급비율 및 공동도급의무지역명 조회
 */
async function fetchBidJointContract({ bidNtceNo, bidNtceOrd = "000", serviceKey = DEFAULT_SERVICE_KEY }) {
  const cleanKey = (serviceKey || DEFAULT_SERVICE_KEY).trim();
  const cleanNo = (bidNtceNo || "").split("-")[0];
  const cleanOrd = (bidNtceOrd || "000").split("-").pop();

  const url = `${BASE_ENDPOINT}/getBidPblancJntcontrctDutyRgnListInfo02?` + new URLSearchParams({
    serviceKey: cleanKey,
    inqryDiv: "2",
    bidNtceNo: cleanNo,
    bidNtceOrd: cleanOrd,
    type: "json",
    numOfRows: "10",
    pageNo: "1"
  }).toString();

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const data = JSON.parse(text);
    const body = data?.response?.body;
    if (!body || !body.items) return [];

    const items = Array.isArray(body.items) ? body.items : [body.items];
    return items.map(item => ({
      dutyRgnNm: item.jntcontrctDutyRgnNm || "",
      dutyRate: item.rgnDutyJntcontrctRt || ""
    }));
  } catch (err) {
    console.error(`fetchBidJointContract error for ${bidNtceNo}:`, err.message);
    return [];
  }
}

/**
 * 4. [신규 02 오퍼레이션] getBidPblancIncntvRgnListInfo02 (가산지역 정보조회)
 */
async function fetchBidIncentiveRegion({ bidNtceNo, bidNtceOrd = "000", serviceKey = DEFAULT_SERVICE_KEY }) {
  const cleanKey = (serviceKey || DEFAULT_SERVICE_KEY).trim();
  const cleanNo = (bidNtceNo || "").split("-")[0];
  const cleanOrd = (bidNtceOrd || "000").split("-").pop();

  const url = `${BASE_ENDPOINT}/getBidPblancIncntvRgnListInfo02?` + new URLSearchParams({
    serviceKey: cleanKey,
    inqryDiv: "2",
    bidNtceNo: cleanNo,
    bidNtceOrd: cleanOrd,
    type: "json",
    numOfRows: "10",
    pageNo: "1"
  }).toString();

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const data = JSON.parse(text);
    const body = data?.response?.body;
    if (!body || !body.items) return [];

    const items = Array.isArray(body.items) ? body.items : [body.items];
    return items.map(item => ({
      incentiveRgnNm: item.incntvRgnNm || ""
    }));
  } catch (err) {
    console.error(`fetchBidIncentiveRegion error for ${bidNtceNo}:`, err.message);
    return [];
  }
}

module.exports = {
  fetchKonepsBids,
  fetchBidAttachments,
  fetchBidJointContract,
  fetchBidIncentiveRegion,
  inferCategory,
  inferOrgType,
  inferKeyThemes,
  DEFAULT_SERVICE_KEY,
  BASE_ENDPOINT
};
