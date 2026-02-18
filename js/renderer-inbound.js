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
          if (type === 'verify') verifyExcelPath = result.path;
          if (type === 'inbound') inboundExcelPath = result.path;
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
      if (!sellerExcelPath || !verifyExcelPath) {
        alert("셀러 엑셀과 검수 양식 파일을 모두 선택해주세요.");
        return;
      }

      const columnMap = {
        sku: document.getElementById("sku")?.value.trim(),
        productName: document.getElementById("product-name")?.value.trim(),
        expiry: document.getElementById("expiry")?.value.trim(),
        lot: document.getElementById("lot")?.value.trim(),
        qty: document.getElementById("expected-qty")?.value.trim()
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
        columnMap
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