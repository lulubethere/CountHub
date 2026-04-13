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
      const isApplied = hasVerifyDefault && hasInboundDefault;
      defaultTemplateStatus.textContent = isApplied
        ? '기본양식 적용'
        : '기본양식 미적용';
      defaultTemplateStatus.classList.toggle('status-applied', isApplied);
      defaultTemplateStatus.classList.toggle('status-missing', !isApplied);
    }

    // 입고검수파일양식 체크 (id = 1)
    try {
      const checkVerify = await ipcRenderer.invoke('check-default-template');
      
      if (checkVerify.ok) {
        console.log("✅ 입고검수파일 양식 준비 완료:", checkVerify.filename);
        hasVerifyDefault = true;
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
        hasVerifyDefault = false;
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
      updateDefaultTemplateStatus();
      } catch (err) {
      console.error("입고검수파일 양식 체크 에러:", err);
      hasVerifyDefault = false;
      updateDefaultTemplateStatus();
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
        hasInboundDefault = true;
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
        hasInboundDefault = false;
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
      updateDefaultTemplateStatus();
      } catch (err) {
      console.error("입고파일 양식 체크 에러:", err);
      hasInboundDefault = false;
      updateDefaultTemplateStatus();
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
    const btnReset = document.getElementById("btn-reset");
    const btnSettings = document.getElementById("btn-settings");
    const settingsModal = document.getElementById("settings-modal");
    const settingsModalCard = document.querySelector(".modal-card");
    const settingsModalClose = document.getElementById("settings-modal-close");
    const settingsModalBackdrop = document.getElementById("settings-modal-backdrop");
    const btnDefaultInbound = document.getElementById("btn-default-inbound");
    const btnDefaultVerify = document.getElementById("btn-default-verify");
    const btnDefaultInboundDelete = document.getElementById("btn-default-inbound-delete");
    const btnDefaultVerifyDelete = document.getElementById("btn-default-verify-delete");
    const defaultInboundName = document.getElementById("default-inbound-name");
    const defaultVerifyName = document.getElementById("default-verify-name");
    const dbTabs = Array.from(document.querySelectorAll(".db-tab"));
    const dbList = document.getElementById("db-list");
    const dbBtnAdd = document.getElementById("db-btn-add");
    const settingsSave = document.getElementById("settings-save");
    const settingsCancel = document.getElementById("settings-cancel");
    const dbAddModal = document.getElementById("db-add-modal");
    const dbAddModalCard = document.querySelector(".mini-modal-card");
    const dbAddInput = document.getElementById("db-add-input");
    const dbAddConfirm = document.getElementById("db-add-confirm");
    const dbAddCancel = document.getElementById("db-add-cancel");
    const confirmModal = document.getElementById("confirm-modal");
    const confirmTitle = document.getElementById("confirm-title");
    const confirmMessage = document.getElementById("confirm-message");
    const confirmCancel = document.getElementById("confirm-cancel");
    const confirmOk = document.getElementById("confirm-ok");
    let confirmResolve = null;
    const settingsNavItems = Array.from(document.querySelectorAll(".settings-nav-item"));
    const settingsSections = Array.from(document.querySelectorAll(".settings-section"));
    const selFormColumns = document.getElementById("sel-form-columns");
    const colSku = document.getElementById("col-sku");
    const colName = document.getElementById("col-name");
    const colExpiry = document.getElementById("col-expiry");
    const colLot = document.getElementById("col-lot");
    const colQty = document.getElementById("col-qty");
    let currentDbTab = "seller";
    let currentDbItems = [];
    let currentDbDirty = false;
    let dragIndex = null;
    let pendingDbDeletes = new Set();
    let pendingTemplateChanges = { inboundPath: null, verifyPath: null };
    let pendingTemplateDeletes = { inbound: false, verify: false };
    let currentFormCode = "";
    let columnDirty = false;

    btnReset?.addEventListener("click", () => {
      window.location.reload();
    });

    const openSettingsModal = () => {
      if (!settingsModal) return;
      settingsModal.classList.add("is-open");
      settingsModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setTemplateName(defaultVerifyName, "");
      setTemplateName(defaultInboundName, "");
      if (btnDefaultVerifyDelete) btnDefaultVerifyDelete.style.display = "none";
      if (btnDefaultInboundDelete) btnDefaultInboundDelete.style.display = "none";
      pendingDbDeletes = new Set();
      pendingTemplateChanges = { inboundPath: null, verifyPath: null };
      pendingTemplateDeletes = { inbound: false, verify: false };
      setDbDirty(false);
      loadDefaultTemplateStatus();
      activateSettingsSection("db");
      loadDbList(currentDbTab);
      loadFormOptions();
      settingsModalCard?.focus();
    };

    const closeSettingsModal = () => {
      if (!settingsModal) return;
      settingsModal.classList.remove("is-open");
      settingsModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };

    btnSettings?.addEventListener("click", openSettingsModal);
    settingsModalClose?.addEventListener("click", closeSettingsModal);
    settingsModalBackdrop?.addEventListener("click", closeSettingsModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSettingsModal();
    });

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

    async function refreshInboundSelectors() {
      const prevSeller = selSeller?.value || "";
      const prevType = selType?.value || "";
      const prevCenter = selCenter?.value || "";
      const prevShop = selShop?.value || "";
      const prevForm = selTemplateSheet?.value || "";
      await Promise.all([
        loadCombo(selSeller, 'get-sellers'),
        loadCombo(selType, 'get-product-types'),
        loadCombo(selCenter, 'get-centers'),
        loadCombo(selShop, 'get-shops'),
        loadCombo(selTemplateSheet, 'get-form'),
      ]);
      if (selSeller) selSeller.value = prevSeller;
      if (selType) selType.value = prevType;
      if (selCenter) selCenter.value = prevCenter;
      if (selShop) selShop.value = prevShop;
      if (selTemplateSheet) selTemplateSheet.value = prevForm;
      if (selSeller && selSeller.value) {
        selSeller.dispatchEvent(new Event('change'));
      } else if (selTemplateSheet && selTemplateSheet.value) {
        selTemplateSheet.dispatchEvent(new Event('change'));
      }
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

    function setTemplateName(container, name) {
      if (!container) return;
      const textEl = container.querySelector(".template-filename-text");
      const value = (name || "").trim();
      if (textEl) textEl.textContent = value;
      container.dataset.empty = value ? "false" : "true";
    }

    function setColumnInputs(map) {
      if (colSku) colSku.value = map.sku || "";
      if (colName) colName.value = map.name || "";
      if (colExpiry) colExpiry.value = map.expiry || "";
      if (colLot) colLot.value = map.lot || "";
      if (colQty) colQty.value = map.qty || "";
    }

    function getColumnInputs() {
      return {
        sku: colSku?.value.trim() || "",
        name: colName?.value.trim() || "",
        expiry: colExpiry?.value.trim() || "",
        lot: colLot?.value.trim() || "",
        qty: colQty?.value.trim() || "",
      };
    }

    function normalizeColumnInput(el) {
      if (!el) return;
      const raw = (el.value || "").replace(/[^a-zA-Z]/g, "");
      el.value = raw.toUpperCase().slice(0, 1);
    }

    async function loadFormOptions() {
      if (!selFormColumns) return;
      const result = await ipcRenderer.invoke("get-form");
      if (result.ok && result.data) {
        selFormColumns.innerHTML =
          '<option value="">선택</option>' +
          result.data.map((row) => `<option value="${row.code}">${row.name || ""}</option>`).join("");
      }
    }

    async function loadFormColumns(formCode) {
      if (!formCode) {
        setColumnInputs({ sku: "", name: "", expiry: "", lot: "", qty: "" });
        return;
      }
      const result = await ipcRenderer.invoke("get-form-columns", formCode);
      if (result.ok && result.data) {
        const map = { sku: "", name: "", expiry: "", lot: "", qty: "" };
        result.data.forEach((row) => {
          if (row.name === "SKU") map.sku = row.column || "";
          if (row.name === "상품명") map.name = row.column || "";
          if (row.name === "유통기한") map.expiry = row.column || "";
          if (row.name === "로트") map.lot = row.column || "";
          if (row.name === "수량") map.qty = row.column || "";
        });
        setColumnInputs(map);
      }
    }

    async function loadDefaultTemplateStatus() {
      try {
        const [verifyRes, inboundRes] = await Promise.all([
          ipcRenderer.invoke('check-default-template'),
          ipcRenderer.invoke('check-inbound-template'),
        ]);
        setTemplateName(defaultVerifyName, verifyRes.ok ? verifyRes.filename : "");
        setTemplateName(defaultInboundName, inboundRes.ok ? inboundRes.filename : "");
        if (btnDefaultVerify) {
          btnDefaultVerify.textContent = verifyRes.ok ? "입고검수파일 기본양식 변경" : "입고검수파일 기본양식 등록";
        }
        if (btnDefaultInbound) {
          btnDefaultInbound.textContent = inboundRes.ok ? "입고파일 기본양식 변경" : "입고파일 기본양식 등록";
        }
        if (btnDefaultVerifyDelete) {
          btnDefaultVerifyDelete.style.display = verifyRes.ok ? "inline-flex" : "none";
        }
        if (btnDefaultInboundDelete) {
          btnDefaultInboundDelete.style.display = inboundRes.ok ? "inline-flex" : "none";
        }
        hasVerifyDefault = !!verifyRes.ok;
        hasInboundDefault = !!inboundRes.ok;
        updateDefaultTemplateStatus();
      } catch (err) {
        console.error("기본양식 상태 로드 실패:", err);
      }
    }

    function stageTemplateChange(templateType, filePath) {
      if (!filePath) return;
      const cleanName = filePath.split("\\").pop()?.replace(/\.(xls|xlsx)$/i, "") || "";
      if (templateType === "verify") {
        pendingTemplateChanges.verifyPath = filePath;
        pendingTemplateDeletes.verify = false;
        setTemplateName(defaultVerifyName, cleanName);
        if (btnDefaultVerify) btnDefaultVerify.textContent = "입고검수파일 기본양식 변경";
        if (btnDefaultVerifyDelete) btnDefaultVerifyDelete.style.display = "inline-flex";
      }
      if (templateType === "inbound") {
        pendingTemplateChanges.inboundPath = filePath;
        pendingTemplateDeletes.inbound = false;
        setTemplateName(defaultInboundName, cleanName);
        if (btnDefaultInbound) btnDefaultInbound.textContent = "입고파일 기본양식 변경";
        if (btnDefaultInboundDelete) btnDefaultInboundDelete.style.display = "inline-flex";
      }
      setDbDirty(true);
    }

    function stageTemplateDelete(templateType) {
      const okPromise = openConfirmModal({
        title: "기본양식 삭제",
        message: "기본양식을 삭제할까요?",
        okText: "삭제",
        cancelText: "취소",
      });
      const run = async () => {
        const ok = await okPromise;
      if (!ok) return;
      if (templateType === "verify") {
        pendingTemplateDeletes.verify = true;
        pendingTemplateChanges.verifyPath = null;
        setTemplateName(defaultVerifyName, "");
        if (btnDefaultVerify) btnDefaultVerify.textContent = "입고검수파일 기본양식 등록";
        if (btnDefaultVerifyDelete) btnDefaultVerifyDelete.style.display = "none";
      }
      if (templateType === "inbound") {
        pendingTemplateDeletes.inbound = true;
        pendingTemplateChanges.inboundPath = null;
        setTemplateName(defaultInboundName, "");
        if (btnDefaultInbound) btnDefaultInbound.textContent = "입고파일 기본양식 등록";
        if (btnDefaultInboundDelete) btnDefaultInboundDelete.style.display = "none";
      }
        setDbDirty(true);
      };
      run();
    }

    async function selectAndUpdateDefault(btnId, templateType) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("click", async () => {
        const result = await ipcRenderer.invoke("select-excel-file");
        if (result.ok) {
          stageTemplateChange(templateType, result.path);
        }
      });
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

      btn.addEventListener("drop", async (e) => {
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
        if (type === "default-inbound" || type === "default-verify") {
          const templateType = type === "default-inbound" ? "inbound" : "verify";
          stageTemplateChange(templateType, filePath);
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

    selectAndUpdateDefault('btn-default-inbound', 'inbound');
    selectAndUpdateDefault('btn-default-verify', 'verify');
    enableDragDrop('btn-default-inbound', 'default-inbound');
    enableDragDrop('btn-default-verify', 'default-verify');

    btnDefaultInboundDelete?.addEventListener("click", () => stageTemplateDelete("inbound"));
    btnDefaultVerifyDelete?.addEventListener("click", () => stageTemplateDelete("verify"));

    const dbTabToParentCode = {
      seller: 100,
      type: 200,
      center: 300,
      shop: 400,
      form: 600,
    };

    function activateSettingsSection(sectionKey) {
      settingsNavItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.section === sectionKey);
      });
      settingsSections.forEach((section) => {
        section.classList.toggle("is-active", section.dataset.section === sectionKey);
      });
    }

    settingsNavItems.forEach((item) => {
      item.addEventListener("click", () => {
        activateSettingsSection(item.dataset.section);
      });
    });

    selFormColumns?.addEventListener("change", async (e) => {
      currentFormCode = e.target.value;
      await loadFormColumns(currentFormCode);
      columnDirty = false;
    });


    [colSku, colName, colExpiry, colLot, colQty].forEach((el) => {
      el?.addEventListener("input", () => {
        normalizeColumnInput(el);
        setDbDirty(true);
        columnDirty = true;
      });
    });

    function setDbDirty(isDirty) {
      currentDbDirty = isDirty;
      if (settingsSave) settingsSave.disabled = !isDirty;
    }

    function renderDbList() {
      if (!dbList) return;
      dbList.innerHTML = "";
      if (!currentDbItems.length) {
        const empty = document.createElement("div");
        empty.className = "db-list-code";
        empty.textContent = "등록된 항목이 없습니다.";
        dbList.appendChild(empty);
        return;
      }
      currentDbItems.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "db-list-item";
        row.setAttribute("draggable", "true");
        row.dataset.index = String(idx);
        row.innerHTML = `
          <div class="db-drag-handle" title="드래그로 순서 변경">|||</div>
          <div class="db-list-name">${item.name || ""}</div>
          <button class="db-delete-btn" title="삭제">x</button>
        `;
        row.addEventListener("dragstart", () => {
          dragIndex = idx;
          row.classList.add("is-dragging");
        });
        row.addEventListener("dragend", () => {
          dragIndex = null;
          row.classList.remove("is-dragging");
        });
        row.addEventListener("dragover", (e) => {
          e.preventDefault();
        });
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          const targetIndex = Number(row.dataset.index);
          if (dragIndex === null || dragIndex === targetIndex) return;
          const moved = currentDbItems.splice(dragIndex, 1)[0];
          currentDbItems.splice(targetIndex, 0, moved);
          currentDbItems = currentDbItems.map((it, i) => ({
            ...it,
            sort_order: i + 1,
          }));
          setDbDirty(true);
          renderDbList();
        });
        const deleteBtn = row.querySelector(".db-delete-btn");
        deleteBtn?.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const ok = await openConfirmModal({
            title: "삭제 확인",
            message: `'${item.name || ""}' 을(를) 삭제하시겠습니까?`,
            okText: "삭제",
            cancelText: "취소",
          });
          if (!ok) return;
          dragIndex = null;
          if (item.code) {
            pendingDbDeletes.add(String(item.code));
          }
          currentDbItems = currentDbItems.filter((it) => it !== item);
          currentDbItems = currentDbItems.map((it, i) => ({
            ...it,
            sort_order: i + 1,
          }));
          setDbDirty(true);
          renderDbList();
        });
        dbList.appendChild(row);
      });
    }

    async function loadDbList(tabKey) {
      const parentCode = dbTabToParentCode[tabKey];
      if (!parentCode) return;
      try {
        const result = await ipcRenderer.invoke("get-code-master-list", {
          parentCode,
        });
        if (result.ok) {
          currentDbItems = result.data || [];
          setDbDirty(false);
          renderDbList();
        }
      } catch (err) {
        console.error("DB 목록 로드 실패:", err);
      }
    }

    dbTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        dbTabs.forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        currentDbTab = tab.dataset.tab;
        loadDbList(currentDbTab);
      });
    });

    dbBtnAdd?.addEventListener("click", () => {
      if (!dbAddModal) return;
      dbAddModal.classList.remove("is-open");
      dbAddModal.setAttribute("aria-hidden", "true");
      requestAnimationFrame(() => {
        dbAddModal.classList.add("is-open");
        dbAddModal.setAttribute("aria-hidden", "false");
        if (dbAddInput) {
          dbAddInput.value = "";
          dbAddInput.disabled = false;
          dbAddInput.readOnly = false;
        }
        window.focus();
        dbAddModalCard?.focus();
        dbAddInput?.blur();
        dbAddInput?.focus({ preventScroll: true });
        setTimeout(() => {
          dbAddInput?.focus({ preventScroll: true });
        }, 50);
      });
    });

    dbAddModal?.addEventListener("mousedown", () => {
      dbAddInput?.focus({ preventScroll: true });
    });

    function openConfirmModal({ title, message, okText, cancelText }) {
      if (!confirmModal) return Promise.resolve(false);
      if (confirmTitle) confirmTitle.textContent = title || "확인";
      if (confirmMessage) confirmMessage.textContent = message || "";
      if (confirmOk) confirmOk.textContent = okText || "확인";
      if (confirmCancel) confirmCancel.textContent = cancelText || "취소";
      confirmModal.classList.add("is-open");
      confirmModal.setAttribute("aria-hidden", "false");
      confirmOk?.focus({ preventScroll: true });
      return new Promise((resolve) => {
        confirmResolve = resolve;
      });
    }

    function closeConfirmModal(result) {
      if (!confirmModal) return;
      confirmModal.classList.remove("is-open");
      confirmModal.setAttribute("aria-hidden", "true");
      if (confirmResolve) confirmResolve(result);
      confirmResolve = null;
    }

    confirmCancel?.addEventListener("click", () => closeConfirmModal(false));
    confirmOk?.addEventListener("click", () => closeConfirmModal(true));
    confirmModal?.addEventListener("click", (e) => {
      if (e.target === confirmModal) closeConfirmModal(false);
    });

    dbAddCancel?.addEventListener("click", () => {
      if (!dbAddModal) return;
      dbAddModal.classList.remove("is-open");
      dbAddModal.setAttribute("aria-hidden", "true");
    });

    dbAddConfirm?.addEventListener("click", async () => {
      const name = dbAddInput?.value.trim();
      if (!name) {
        showToast("이름을 입력해주세요.", true);
        return;
      }
      const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      currentDbItems.push({
        code: null,
        name,
        sort_order: currentDbItems.length + 1,
        tempId,
      });
      setDbDirty(true);
      renderDbList();
      dbAddModal.classList.remove("is-open");
      dbAddModal.setAttribute("aria-hidden", "true");
    });

    settingsSave?.addEventListener("click", async () => {
      const hasTemplatePending =
        pendingTemplateDeletes.verify ||
        pendingTemplateDeletes.inbound ||
        !!pendingTemplateChanges.verifyPath ||
        !!pendingTemplateChanges.inboundPath;
      const hasColumnPending = currentFormCode && columnDirty;
      if (!currentDbDirty && !hasTemplatePending && !hasColumnPending) return;
      const parentCode = dbTabToParentCode[currentDbTab];
      try {
        // 1) 삭제 처리
        for (const code of pendingDbDeletes) {
          await ipcRenderer.invoke("delete-code-master-item", { code });
        }
        pendingDbDeletes.clear();

        // 2) 신규 추가 처리 (현재 순서대로 등록)
        for (const item of currentDbItems) {
          if (!item.code && item.tempId) {
            const payload = {
              parentCode,
              code: null,
              name: item.name,
              sortOrder: item.sort_order,
            };
            const result = await ipcRenderer.invoke("save-code-master-item", payload);
            if (result.ok) {
              item.code = result.code;
            }
          }
        }

        // 3) 정렬 순서 저장
        const orderedCodes = currentDbItems.map((item) => item.code).filter(Boolean);
        if (orderedCodes.length) {
          await ipcRenderer.invoke("update-code-master-order", {
            parentCode,
            orderedCodes,
          });
        }

        // 4) 템플릿 변경/삭제 처리
        if (pendingTemplateDeletes.verify) {
          await ipcRenderer.invoke("delete-default-template", { templateType: "verify" });
        }
        if (pendingTemplateDeletes.inbound) {
          await ipcRenderer.invoke("delete-default-template", { templateType: "inbound" });
        }
        if (pendingTemplateChanges.verifyPath) {
          await ipcRenderer.invoke("update-default-template", {
            templateType: "verify",
            path: pendingTemplateChanges.verifyPath,
          });
        }
        if (pendingTemplateChanges.inboundPath) {
          await ipcRenderer.invoke("update-default-template", {
            templateType: "inbound",
            path: pendingTemplateChanges.inboundPath,
          });
        }

        // 5) 양식지 컬럼 설정 저장
        if (currentFormCode && columnDirty) {
          const columnMap = getColumnInputs();
          const result = await ipcRenderer.invoke("save-form-columns", {
            formCode: currentFormCode,
            columnMap,
          });
          if (!result?.ok) {
            showToast(result?.error || "양식지 컬럼 저장 실패", true);
            return;
          }
          columnDirty = false;
        }

        showToast("저장되었습니다.");
        setDbDirty(false);
        pendingTemplateChanges = { inboundPath: null, verifyPath: null };
        pendingTemplateDeletes = { inbound: false, verify: false };
        await loadDefaultTemplateStatus();
        await loadDbList(currentDbTab);
        await loadFormOptions();
        if (selFormColumns && currentFormCode) {
          selFormColumns.value = currentFormCode;
        }
        await refreshInboundSelectors();
      } catch (err) {
        showToast("저장 실패", true);
      }
    });

    settingsCancel?.addEventListener("click", () => {
      closeSettingsModal();
    });

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
