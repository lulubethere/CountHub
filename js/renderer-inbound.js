(function () {
  const { ipcRenderer } = require('electron');

  // 1. 로그인 체크 (즉시 실행)
  let user;
  try {
    const raw = localStorage.getItem('countHubUser');
    user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    user = null;
  }

  if (!user || !user.name) {
    window.location.href = '02 login.html';
    return;
  }

  // 파일 경로 저장 변수 (함수 전체에서 공유)
  let sellerExcelPath = null;
  let verifyExcelPath = null;
  let inboundExcelPath = null;

  document.addEventListener("DOMContentLoaded", async function () {
    // --- [DB 양식 확인 섹션] ---
    console.log("페이지 로드됨 - DB 양식 확인 중...");
    
    // 입고검수파일양식 버튼 및 뱃지
    const btnSelectVerify = document.getElementById('btn-select-verify-file');
    const badgeVerify = document.getElementById('verify-template-badge');
    
    // 입고파일양식 버튼 및 뱃지
    const btnSelectInbound = document.getElementById('btn-select-inbound-file');
    const badgeInbound = document.getElementById('inbound-template-badge');
    
    // 입고검수파일양식 체크 (id = 1)
    try {
      const checkVerify = await ipcRenderer.invoke('check-default-template');
      
      if (checkVerify.ok) {
        console.log("✅ 입고검수파일 양식 준비 완료:", checkVerify.filename);
        if (btnSelectVerify && badgeVerify) {
          btnSelectVerify.classList.add('has-default');
          btnSelectVerify.textContent = `입고검수파일양식 엑셀첨부 (.xlsx .xls) [기본값 사용 가능]`;
          badgeVerify.textContent = '기본양식 적용됨';
          badgeVerify.style.display = 'inline-block';
          badgeVerify.classList.remove('no-template');
        }
      } else {
        console.warn("⚠️ 입고검수파일 양식 없음:", checkVerify.error);
        if (badgeVerify) {
          badgeVerify.textContent = '기본양식 없음';
          badgeVerify.classList.add('no-template');
          badgeVerify.style.display = 'inline-block';
        }
      }
    } catch (err) {
      console.error("입고검수파일 양식 체크 에러:", err);
      if (badgeVerify) {
        badgeVerify.textContent = '기본양식 없음';
        badgeVerify.classList.add('no-template');
        badgeVerify.style.display = 'inline-block';
      }
    }
    
    // 입고파일양식 체크 (id = 2)
    try {
      const checkInbound = await ipcRenderer.invoke('check-inbound-template');
      
      if (checkInbound.ok) {
        console.log("✅ 입고파일 양식 준비 완료:", checkInbound.filename);
        if (btnSelectInbound && badgeInbound) {
          btnSelectInbound.classList.add('has-default');
          btnSelectInbound.textContent = `입고파일양식 엑셀첨부 (.xlsx .xls) [기본값 사용 가능]`;
          badgeInbound.textContent = '기본양식 적용됨';
          badgeInbound.style.display = 'inline-block';
          badgeInbound.classList.remove('no-template');
        }
      } else {
        console.warn("⚠️ 입고파일 양식 없음:", checkInbound.error);
        if (badgeInbound) {
          badgeInbound.textContent = '기본양식 없음';
          badgeInbound.classList.add('no-template');
          badgeInbound.style.display = 'inline-block';
        }
      }
    } catch (err) {
      console.error("입고파일 양식 체크 에러:", err);
      if (badgeInbound) {
        badgeInbound.textContent = '기본양식 없음';
        badgeInbound.classList.add('no-template');
        badgeInbound.style.display = 'inline-block';
      }
    }
    // --- [DB 데이터 로드 섹션] ---
    const selSeller = document.getElementById("sel-seller");
    const selType = document.getElementById("sel-type");
    const selCenter = document.getElementById("sel-center");
    const selShop = document.getElementById("sel-shop");

    // 셀러 컬럼 매핑 정보
    const nameToFieldId = {
      'SKU': 'sku',
      '상품명': 'product-name',
      '유통기한': 'expiry',
      '로트': 'lot',
      '수량': 'expected-qty'
    };

    // 공통 로드 함수
    async function loadCombo(element, channel) {
      if (!element) return;
      try {
        const result = await ipcRenderer.invoke(channel);
        if (result.ok && result.data) {
          element.innerHTML = '<option value="">선택</option>' +
            result.data.map(row => `<option value="${row.code}">${row.name || ''}</option>`).join('');
        }
      } catch (e) { console.error(`${channel} 로드 실패:`, e); }
    }

    // 데이터 초기 로드
    loadCombo(selSeller, 'get-sellers');
    loadCombo(selType, 'get-product-types');
    loadCombo(selCenter, 'get-centers');
    loadCombo(selShop, 'get-shops');

    // 셀러 변경 시 컬럼 자동 바인딩
    selSeller?.addEventListener('change', async function () {
      const sellerCode = this.value.trim();
      
      // 먼저 관련 input 필드들을 모두 초기화 (공란으로)
      Object.values(nameToFieldId).forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) input.value = '';
      });
      
      // 셀러가 선택되지 않았으면 여기서 종료
      if (!sellerCode) return;
      
      try {
        const result = await ipcRenderer.invoke('get-seller-columns', sellerCode);
        if (result.ok && result.data) {
          result.data.forEach(row => {
            const fieldId = nameToFieldId[row.name];
            const input = document.getElementById(fieldId);
            if (input) input.value = row.column || '';
          });
        }
      } catch (e) { console.error('컬럼 로드 실패:', e); }
    });

    // --- [날짜 처리 섹션] ---
    const dateInput = document.getElementById("dateInput");
    dateInput?.addEventListener("blur", function() {
      const raw = this.value.replace(/\D/g, "");
      if (raw.length === 8) {
        this.value = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
      }
    });

    // --- [파일 선택 섹션] ---
    async function selectFile(btnId, type) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-excel-file');
        if (result.ok) {
          if (type === 'seller') sellerExcelPath = result.path;
          if (type === 'verify') {
            verifyExcelPath = result.path;
            // 파일 선택 시 뱃지 숨기기
            const badge = document.getElementById('verify-template-badge');
            if (badge) {
              badge.style.display = 'none';
              badge.classList.remove('no-template');
            }
            btn.classList.remove('has-default');
          }
          if (type === 'inbound') {
            inboundExcelPath = result.path;
            // 파일 선택 시 뱃지 숨기기
            const badge = document.getElementById('inbound-template-badge');
            if (badge) {
              badge.style.display = 'none';
              badge.classList.remove('no-template');
            }
            btn.classList.remove('has-default');
          }
          btn.textContent = result.path.split('\\').pop();
        }
      });
    }

    selectFile('btn-select-excel', 'seller');
    selectFile('btn-select-verify-file', 'verify');
    selectFile('btn-select-inbound-file', 'inbound');

    // --- [검수 작업 실행 섹션] ---
    const btnVerify = document.getElementById("btn-verify");
    btnVerify?.addEventListener("click", async function () {
      if (!sellerExcelPath) {
        alert("셀러 엑셀 파일을 선택해주세요.");
        return;
      }

      const columnMap = {
        sku: document.getElementById("sku")?.value.trim(),
        productName: document.getElementById("product-name")?.value.trim(),
        expiry: document.getElementById("expiry")?.value.trim(),
        lot: document.getElementById("lot")?.value.trim(),
        qty: document.getElementById("expected-qty")?.value.trim(),
      };

      if (!columnMap.sku || !columnMap.qty) {
        alert("SKU와 수량 컬럼(알파벳)을 확인해주세요.");
        return;
      }

      btnVerify.disabled = true;
      btnVerify.textContent = "처리 중...";

      const result = await ipcRenderer.invoke("process-verify-file", {
        verifyPath: verifyExcelPath,
        sellerPath: sellerExcelPath,
        sellerName: selSeller?.options[selSeller.selectedIndex]?.text || "",
        shopName: selShop?.options[selShop.selectedIndex]?.text || "",
        dateValue: dateInput?.value || "",
        columnMap,
      });

      btnVerify.disabled = false;
      btnVerify.textContent = "입고검수파일 작업";

      if (result.ok) {
        alert("완료되었습니다!\n저장경로: " + result.path);
      } else {
        alert("오류: " + result.error);
      }
    });
  });
})();