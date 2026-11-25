import re

with open('public/app.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Check where openModal is defined
# Look for document.getElementById('modal-project-detail') in openModal
target = "document.getElementById('modal-project-detail').classList.remove('hidden');"
replacement = """loadModalAttachments(p.bidNtceNo, p.bidNtceOrd);
  document.getElementById('modal-project-detail').classList.remove('hidden');"""

if target in code:
    code = code.replace(target, replacement, 1)
    print("Found and replaced openModal trigger.")
else:
    print("Target not found in code!")

# 2. Add loadModalAttachments function to the end of app.js
atch_func = """

// =========================================================================
// [조달청 02 OpenAPI 연계] 실시간 첨부파일 및 공동도급 정보 로더
// =========================================================================
async function loadModalAttachments(noticeNo, ord = '000') {
  const atchList = document.getElementById('modal-atch-list');
  const atchBadge = document.getElementById('modal-atch-status-badge');
  const jointBox = document.getElementById('modal-joint-contract-box');
  const jointText = document.getElementById('modal-joint-contract-text');

  if (!atchList) return;

  atchList.innerHTML = '<div class="text-slate-400 text-xs italic">조달청 02 첨부파일을 조회 중입니다...</div>';
  if (atchBadge) {
    atchBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-300';
    atchBadge.innerText = '조회중...';
  }
  if (jointBox) jointBox.classList.add('hidden');

  const cleanNo = (noticeNo || '').split('-')[0];
  const cleanOrd = (ord || '000').split('-').pop();

  try {
    // 1. 첨부파일 조회
    const resAtch = await fetch(`/api/bids/attachments?bidNtceNo=${cleanNo}&bidNtceOrd=${cleanOrd}`);
    if (resAtch.ok) {
      const atchData = await resAtch.json();
      const files = atchData.data || [];

      if (files.length > 0) {
        if (atchBadge) {
          atchBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
          atchBadge.innerText = `${files.length}건 첨부서류 확인`;
        }

        atchList.innerHTML = files.map(f => {
          const isDoc = (f.docType || '').includes('과업') || (f.fileName || '').includes('과업') || (f.fileName || '').includes('규격');
          const isNotice = (f.docType || '').includes('공고') || (f.fileName || '').includes('공고');
          const badgeColor = isDoc 
            ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
            : (isNotice ? 'bg-cyan-100 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-700 border-slate-200');

          return `
            <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-cyan-100 hover:border-cyan-300 transition-colors shadow-2xs">
              <div class="flex items-center space-x-2 truncate mr-2">
                <span class="px-1.5 py-0.5 text-[10px] font-bold rounded border ${badgeColor} shrink-0">${f.docType}</span>
                <span class="truncate text-xs font-medium text-slate-800" title="${f.fileName}">${f.fileName}</span>
              </div>
              <a href="${f.fileUrl}" target="_blank" download class="px-2.5 py-1 text-[11px] font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shrink-0 flex items-center space-x-1 shadow-2xs">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span>다운로드</span>
              </a>
            </div>
          `;
        }).join('');
      } else {
        if (atchBadge) {
          atchBadge.className = 'px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500 border border-slate-200';
          atchBadge.innerText = '별도첨부 없음';
        }
        atchList.innerHTML = `
          <div class="text-xs text-slate-500 p-2.5 bg-white/70 rounded-xl border border-slate-100 flex items-center justify-between">
            <span>나라장터 본문 공고문 또는 전자서명 첨부파일 참조</span>
            <a href="https://www.g2b.go.kr" target="_blank" class="text-cyan-700 underline font-semibold text-[11px]">나라장터 원문보기</a>
          </div>
        `;
      }
    }

    // 2. 공동도급/가산지역 정보 조회
    const resJoint = await fetch(`/api/bids/joint-contract?bidNtceNo=${cleanNo}&bidNtceOrd=${cleanOrd}`);
    if (resJoint.ok) {
      const jointData = await resJoint.json();
      const joints = jointData.jointContract || [];
      const incentives = jointData.incentiveRegion || [];
      
      let infoParts = [];
      if (joints.length > 0) {
        joints.forEach(j => {
          if (j.dutyRgnNm || j.dutyRate) {
            infoParts.push(`의무지역: ${j.dutyRgnNm || '해당지역'} (비율: ${j.dutyRate || '-'}%)`);
          }
        });
      }
      if (incentives.length > 0) {
        incentives.forEach(inc => {
          if (inc.incentiveRgnNm) {
            infoParts.push(`가산지역: ${inc.incentiveRgnNm}`);
          }
        });
      }

      if (infoParts.length > 0 && jointBox && jointText) {
        jointBox.classList.remove('hidden');
        jointText.innerText = infoParts.join(' | ');
      }
    }
  } catch (err) {
    console.error('loadModalAttachments error:', err);
    if (atchList) {
      atchList.innerHTML = '<div class="text-slate-400 text-xs italic">첨부서류 정보를 불러오지 못했습니다.</div>';
    }
  }
}
"""

if 'loadModalAttachments' not in code:
    code += atch_func
    print("Appended loadModalAttachments to app.js.")

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated public/app.js successfully!")
