(function () {
  const { ipcRenderer, webUtils } = require("electron");
  const Toastify = require("toastify-js");

  // 1. 로그인 체크 (기존 유지)
  let user;
  try {
    const raw = localStorage.getItem('countHubUser');
    user = raw ? JSON.parse(raw) : null;
  } catch (_) { user = null; }

  if (!user || !user.name) {
    window.location.href = '02 login.html';
    return;
  }

  // 파일 경로 저장 변수
  let sellerExcelPath = null;
  let verifyExcelPath = null;
  let inboundExcelPath = null;

  document.addEventListener("DOMContentLoaded", async function () {
    // Drag & drop 기본 동작 방지 (파일 열림 방지)
    const preventWindowDrop = (e) => e.preventDefault();
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    // --- [DB 양식 및 콤보박스 로드 섹션 (기존 동일)] ---
    const btnSelectVerify = document.getElementById('btn-select-verify-file');
    const badgeVerify = document.getElementById('verify-template-badge');
    const btnSelectInbound = document.getElementById('btn-select-inbound-file');
    const badgeInbound = document.getElementById('inbound-template-badge');
    const defaultTemplateStatus = document.getElementById('default-template-status');
    let hasVerifyDefault = false;
    let hasInboundDefault = false;

    function updateDefaultTemplateStatus() {
      if (!defaultTemplateStatus) return;
      defaultTemplateStatus.textContent = (hasVerifyDefault && hasInboundDefault)
        ? '기본양식 적용'
        : '기본양식 적용안됨';
    }

    // 입고검수파일양식 체크 (id = 1)
    try {
      const checkVerify = await ipcRenderer.invoke('check-default-template');
      
      if (checkVerify.ok) {
        console.log("✅ 입고검수파일 양식 준비 완료:", checkVerify.filename);
        if (btnSelectVerify && badgeVerify) {
          btnSelectVerify.classList.add('has-default');
          btnSelectVerify.textContent = `입고검수파일양식 엑셀첨부 (.xlsx .xls)`;
          // badgeVerify.textContent = '( 기본양식 적용  ✅ )';
if (checkVerify.ok) {
    badgeVerify.classList.add('visible'); // CSS의 visibility: visible 적용
    badgeVerify.style.display = 'block';   // 혹시 모르니 display도 block 유지
} else {
    badgeVerify.classList.remove('visible');
}          badgeVerify.classList.remove('no-template');
        }
      } else {
        console.warn("⚠️ 입고검수파일 양식 없음:", checkVerify.error);
        if (badgeVerify) {
          // badgeVerify.textContent = '기본양식 없음';
          // badgeVerify.classList.add('no-template');
if (checkVerify.ok) {
    badgeVerify.classList.add('visible'); // CSS의 visibility: visible 적용
    badgeVerify.style.display = 'block';   // 혹시 모르니 display도 block 유지
} else {
    badgeVerify.classList.remove('visible');
}        }
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
          btnSelectInbound.textContent = `입고파일양식 엑셀첨부 (.xlsx .xls)`;
          // badgeInbound.textContent = '( 기본양식 적용 ✅ )';
if (checkInbound.ok) {
    badgeInbound.classList.add('visible'); // CSS의 visibility: visible 적용
    badgeInbound.style.display = 'block';   // 혹시 모르니 display도 block 유지
} else {
    badgeInbound.classList.remove('visible');
}          badgeInbound.classList.remove('no-template');
        }
      } else {
        console.warn("⚠️ 입고파일 양식 없음:", checkInbound.error);
        if (badgeInbound) {
          // badgeInbound.textContent = '기본양식 없음';
          // badgeInbound.classList.add('no-template');
if (checkVerify.ok) {
    badgeVerify.classList.add('visible'); // CSS의 visibility: visible 적용
    badgeVerify.style.display = 'block';   // 혹시 모르니 display도 block 유지
} else {
    badgeVerify.classList.remove('visible');
}        }
      }
      } catch (err) {
      console.error("입고파일 양식 체크 에러:", err);
      if (badgeInbound) {
        badgeInbound.textContent = '기본양식 없음';
        badgeInbound.classList.add('no-template');
        badgeInbound.style.display = 'inline-block';
      }
    }
    
    const selSeller = document.getElementById("sel-seller");
    const selType = document.getElementById("sel-type");
    const selCenter = document.getElementById("sel-center");
    const selShop = document.getElementById("sel-shop");
    const selTemplateSheet = document.getElementById("sel-template-sheet");
    const dateInput = document.getElementById("dateInput");
    const inputReleaseCenter = document.getElementById("input-release-center");

    // 컬럼 입력 자동 대문자 변환 (모든 관련 인풋에 미리 적용)
    const allInputIds = ["sku", "product-name", "expiry", "lot", "expected-qty"];
    allInputIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", (e) => {
          e.target.value = e.target.value.toUpperCase().slice(0, 1);
        });
      }
    });

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

    loadCombo(selSeller, 'get-sellers');
    loadCombo(selType, 'get-product-types');
    loadCombo(selCenter, 'get-centers');
    loadCombo(selShop, 'get-shops');
    loadCombo(selTemplateSheet, 'get-form');

    const nameToFieldId = { 'SKU': 'sku', '상품명': 'product-name', '유통기한': 'expiry', '로트': 'lot', '수량': 'expected-qty' };

    // 셀러 변경 시 자동 바인딩 로직 (기존 유지)
    selSeller?.addEventListener('change', async function () {
      const sellerCode = this.value.trim();
      if (sellerCode) {
        if (selCenter) selCenter.selectedIndex = 1;
        if (selType) selType.selectedIndex = 1;
        if (selShop) selShop.selectedIndex = 1;        
      }
      if (selTemplateSheet) selTemplateSheet.value = "";
      if (!sellerCode) return;
      try {
        const formResult = await ipcRenderer.invoke('get-form-by-seller', sellerCode);
        if (formResult.ok && formResult.data && selTemplateSheet) {
          selTemplateSheet.value = String(formResult.data.form_code ?? "");
          selTemplateSheet.dispatchEvent(new Event('change'));
        }
      } catch (e) { console.error('컬럼 로드 실패:', e); }
    });

    // 양식지 변경 시 컬럼 바인딩
    selTemplateSheet?.addEventListener('change', async function () {
      const formCode = this.value.trim();
      Object.values(nameToFieldId).forEach(id => { const input = document.getElementById(id); if (input) input.value = ''; });
      if (!formCode) return;
      try {
        const result = await ipcRenderer.invoke('get-form-columns', formCode);
        if (result.ok && result.data) {
          result.data.forEach(row => {
            const fieldId = nameToFieldId[row.name];
            const input = document.getElementById(fieldId);
            if (input) input.value = row.column || '';
          });
        }
      } 
      catch (e) { console.error('컬럼 로드 실패:', e); }
    });

    // 날짜 포맷팅 (기존 유지)
    dateInput?.addEventListener("blur", function() {
      const raw = this.value.replace(/\D/g, "");
      if (raw.length === 8) this.value = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    });

    function isExcelFile(fileName) {
      return /\.(xlsx|xls)$/i.test(fileName || '');
    }

    function setSelectedFile(btn, type, filePath) {
      if (!btn || !filePath) return;
      if (type === 'seller') sellerExcelPath = filePath;
      if (type === 'verify') { verifyExcelPath = filePath; if (badgeVerify) badgeVerify.style.display = 'none'; }
      if (type === 'inbound') { inboundExcelPath = filePath; if (badgeInbound) badgeInbound.style.display = 'none'; }
      btn.textContent = filePath.split('\\').pop();
    }

    // 파일 선택 공통 함수 (기존 유지)
    async function selectFile(btnId, type) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-excel-file');
        if (result.ok) {
          setSelectedFile(btn, type, result.path);
        }
      });
    }

    function extractPathFromDataTransfer(e) {
      if (!e || !e.dataTransfer) return '';
      const uriList = e.dataTransfer.getData("text/uri-list");
      if (uriList && uriList.startsWith("file:///")) {
        try {
          const decoded = decodeURI(uriList.split("\n")[0]).replace(/^file:\/\//i, "");
          return decoded.replace(/\//g, "\\");
        } catch (_) { return ''; }
      }
      const text = e.dataTransfer.getData("text/plain");
      if (text && text.startsWith("file:///")) {
        try {
          const decoded = decodeURI(text).replace(/^file:\/\//i, "");
          return decoded.replace(/\//g, "\\");
        } catch (_) { return ''; }
      }
      return '';
    }

    function enableDragDrop(btnId, type) {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        btn.classList.add("drop-active");
      });

      btn.addEventListener("dragleave", () => {
        btn.classList.remove("drop-active");
      });

      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        btn.classList.remove("drop-active");
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const fileName = file?.name || '';
        const filePath = (webUtils?.getPathForFile ? webUtils.getPathForFile(file) : file?.path) || extractPathFromDataTransfer(e) || '';
        if (!isExcelFile(fileName || filePath)) {
          showToast("엑셀 파일만 가능합니다 (.xlsx, .xls)", true);
          return;
        }
        if (!filePath) {
          showToast("파일 경로를 읽을 수 없습니다. 버튼 클릭으로 첨부해주세요.", true);
          return;
        }
        setSelectedFile(btn, type, filePath);
      });
    }
    selectFile('btn-select-excel', 'seller');
    selectFile('btn-select-verify-file', 'verify');
    selectFile('btn-select-inbound-file', 'inbound');
    enableDragDrop('btn-select-excel', 'seller');
    enableDragDrop('btn-select-verify-file', 'verify');
    enableDragDrop('btn-select-inbound-file', 'inbound');

    // 토스트 알림 공통 함수
    function showToast(msg, isError = false) {
      Toastify({
        text: msg, duration: 3000, gravity: "bottom", position: "right", close: true,
        style: { background: "#ffffff", color: "#333", borderLeft: isError ? "5px solid #ff4d4f" : "5px solid #000", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
      }).showToast();
    }

    // 컬럼 맵핑 수집 함수
    function getColumnMap() {
      return {
        sku: document.getElementById("sku")?.value.trim(),
        productName: document.getElementById("product-name")?.value.trim(),
        expiry: document.getElementById("expiry")?.value.trim(),
        lot: document.getElementById("lot")?.value.trim(),
        qty: document.getElementById("expected-qty")?.value.trim(),
      };
    }

    // --- [1. 입고검수파일 작업 버튼 (기존 기능)] ---
    const btnVerify = document.getElementById("btn-verify");
    btnVerify?.addEventListener("click", async function () {
      if (!sellerExcelPath) {
        showToast("입고예정엑셀파일(패킹리스트)을 먼저 선택해주세요.", true);
        return;
      }
      const columnMap = getColumnMap();
      if (!columnMap.productName || !columnMap.qty) {
        showToast("상품명과 입고예정수량 열을 확인해주세요.", true);
        return;
      }

      btnVerify.disabled = true;
      btnVerify.textContent = "처리 중...";

      const result = await ipcRenderer.invoke("process-verify-file", {
        verifyPath: verifyExcelPath,
        sellerPath: sellerExcelPath,
        sellerName: selSeller?.options[selSeller.selectedIndex]?.text || "",
        shopName: selShop?.options[selShop.selectedIndex]?.text || "",
        releaseCenter: inputReleaseCenter?.value || "",
        dateValue: dateInput?.value || "",
        columnMap,
      });
      btnVerify.disabled = false;
      btnVerify.textContent = "입고검수파일 작업";
      if (result.ok) {
        showToast("검수 완료!\n저장경로: " + result.path);
      } else {
        showToast(result.error, true);
      }
    });

    // --- [2. 입고파일 작업 버튼 (신규 기능 추가)] ---
    const btnProcess = document.getElementById("btn-process");
    btnProcess?.addEventListener("click", async function () {
      // 필수 체크
      if (!sellerExcelPath) {
        showToast("입고예정엑셀파일(패킹리스트)을 먼저 선택해주세요.", true);
        return;
      }

      const columnMap = getColumnMap();
      if (!columnMap.productName || !columnMap.qty) {
        showToast("상품명과 입고예정수량 열을 확인해주세요.", true);
        return;
      }

      btnProcess.disabled = true;
      btnProcess.textContent = "처리 중...";

      try {
        const result = await ipcRenderer.invoke("process-inbound-file", {
          templatePath: inboundExcelPath, // 사용자가 선택한 양식 (없으면 메인에서 DB 양식 로드)
          sellerPath: sellerExcelPath,
          centerData: {
            sellerName: selSeller?.options[selSeller.selectedIndex]?.text || "선택",
            inboundCenter: selCenter?.options[selCenter.selectedIndex]?.text || "선택",
            productType: selType?.options[selType.selectedIndex]?.text || "선택",
            shopName: selShop?.options[selShop.selectedIndex]?.text || "선택",
            dateValue: dateInput?.value || ""
          },
          columnMap
        });

        if (result.ok) {
          showToast("입고파일 작업이 완료되었습니다!\n" + result.path);
        } else {
          showToast(result.error, true);
        }
      } catch (err) {
        showToast("작업 도중 에러가 발생했습니다.", true);
      } finally {
        btnProcess.disabled = false;
        btnProcess.textContent = "입고파일 작업";
      }
    });

  });
})();




