(function () {
  const API_BASE_KEY = "countHubMobileApiBaseUrl";
  const USER_KEY = "countHubMobileUser";

  const apiBaseInput = document.getElementById("api-base-url");
  const bootSplash = document.getElementById("boot-splash");
  const btnSaveApi = document.getElementById("btn-save-api");
  const btnCheckApi = document.getElementById("btn-check-api");
  const connectCard = document.getElementById("connect-card");
  const apiStatusChip = document.getElementById("api-status-chip");
  const serverAddressList = document.getElementById("server-address-list");
  const loginCard = document.getElementById("login-card");
  const workspaceCard = document.getElementById("workspace-card");
  const loginNameInput = document.getElementById("login-name");
  const btnLogin = document.getElementById("btn-login");
  const currentUserLabel = document.getElementById("current-user-label");
  const btnLogout = document.getElementById("logout-btn");
  const searchKeywordInput = document.getElementById("search-keyword");
  const btnSearch = document.getElementById("btn-search");
  const btnOpenCreate = document.getElementById("btn-open-create");
  const resultCount = document.getElementById("result-count");
  const itemList = document.getElementById("item-list");
  const itemSheet = document.getElementById("item-sheet");
  const sheetCard = itemSheet?.querySelector(".sheet-card");
  const sheetTitle = document.getElementById("sheet-title");
  const itemForm = document.getElementById("item-form");
  const itemIdInput = document.getElementById("item-id");
  const productNameInput = document.getElementById("product-name");
  const groupNameSelect = document.getElementById("group-name");
  const locationNameInput = document.getElementById("location-name");
  const itemNoteInput = document.getElementById("item-note");
  const btnCancelSheet = document.getElementById("btn-cancel-sheet");
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmCancel = document.getElementById("confirm-cancel");
  const confirmOk = document.getElementById("confirm-ok");

  let currentUser = null;
  let currentGroups = [];
  let currentItems = [];
  let confirmResolve = null;
  let isBooting = true;
  let baseViewportHeight = window.visualViewport?.height || window.innerHeight;

  function normalizeApiBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function getApiBaseUrl() {
    const stored = localStorage.getItem(API_BASE_KEY);
    if (stored) {
      return normalizeApiBase(stored);
    }
    const configuredDefault = normalizeApiBase(window.COUNTHUB_MOBILE_DEFAULT_API_BASE || "");
    if (configuredDefault) {
      return configuredDefault;
    }
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      return normalizeApiBase(window.location.origin);
    }
    return normalizeApiBase("http://localhost:3100");
  }

  function setApiBaseUrl(value) {
    localStorage.setItem(API_BASE_KEY, normalizeApiBase(value));
  }

  function setStatus(type, text) {
    apiStatusChip.className = `status-chip ${type}`;
    apiStatusChip.textContent = text;
  }

  function setBootVisible(isVisible) {
    isBooting = !!isVisible;
    bootSplash?.classList.toggle("hidden", !isVisible);
  }

  function setConnectCardVisible(isVisible) {
    connectCard?.classList.toggle("hidden", !isVisible);
    if (isVisible) {
      loadServerInfo();
    }
  }

  function showAlert(message) {
    return openConfirmModal({
      title: "안내",
      message,
      okText: "확인",
      cancelText: "",
      hideCancel: true,
    });
  }

  function renderServerAddresses(addresses, localhostUrl) {
    if (!serverAddressList) return;

    const rows = [];
    if (localhostUrl) {
      rows.push(`
        <button class="server-address-chip" type="button" data-base-url="${escapeHtml(localhostUrl)}">
          <span class="server-address-label">이 PC</span>
          <span class="server-address-value">${escapeHtml(localhostUrl)}</span>
        </button>
      `);
    }

    (addresses || []).forEach((address) => {
      rows.push(`
        <button class="server-address-chip" type="button" data-base-url="${escapeHtml(address.url)}">
          <span class="server-address-label">${escapeHtml(address.label || "네트워크")}</span>
          <span class="server-address-value">${escapeHtml(address.url)}</span>
        </button>
      `);
    });

    serverAddressList.innerHTML = rows.length
      ? rows.join("")
      : `<div class="server-address-empty">표시할 접속 주소를 찾지 못했습니다.</div>`;
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || "요청 중 오류가 발생했습니다.");
      error.payload = data;
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function openSheet(title) {
    sheetTitle.textContent = title;
    itemSheet.classList.remove("hidden");
    itemSheet.setAttribute("aria-hidden", "false");
    updateSheetViewport();
  }

  function closeSheet() {
    itemSheet.classList.add("hidden");
    itemSheet.setAttribute("aria-hidden", "true");
    itemSheet.classList.remove("keyboard-open");
    document.documentElement.style.removeProperty("--visual-viewport-height");
    document.documentElement.style.removeProperty("--keyboard-offset");
  }

  function openConfirmModal({ title, message, okText, cancelText, hideCancel }) {
    confirmTitle.textContent = title || "확인";
    confirmMessage.textContent = message || "";
    confirmOk.textContent = okText || "확인";
    confirmCancel.textContent = cancelText || "취소";
    confirmCancel.classList.toggle("hidden", !!hideCancel);
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }

  function closeConfirmModal(result) {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    if (confirmResolve) confirmResolve(result);
    confirmResolve = null;
  }

  function updateSheetViewport() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const keyboardOffset = Math.max(0, window.innerHeight - viewportHeight);
    const keyboardOpen = keyboardOffset > 120;

    if (!itemSheet || itemSheet.classList.contains("hidden")) return;

    document.documentElement.style.setProperty("--visual-viewport-height", `${viewportHeight}px`);
    document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    itemSheet.classList.toggle("keyboard-open", keyboardOpen);
  }

  function scrollFieldIntoView(target) {
    if (!target || !itemSheet || itemSheet.classList.contains("hidden")) return;

    const field = target.closest("[data-sheet-field]") || target;
    window.setTimeout(() => {
      try {
        field.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      } catch (_) {
        field.scrollIntoView(true);
      }
    }, 220);
  }

  function resetForm() {
    itemIdInput.value = "";
    productNameInput.value = "";
    locationNameInput.value = "";
    itemNoteInput.value = "";
    renderGroupOptions("");
  }

  function renderGroupOptions(selectedValue) {
    const options = [
      `<option value="">그룹 선택</option>`,
      ...currentGroups.map((group) => {
        const selected = group.name === selectedValue ? "selected" : "";
        return `<option value="${escapeHtml(group.name)}" ${selected}>${escapeHtml(group.name)}</option>`;
      }),
    ];
    groupNameSelect.innerHTML = options.join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function updateWorkspaceVisibility() {
    const hasUser = !!(currentUser && currentUser.name);
    loginCard.classList.toggle("hidden", hasUser);
    workspaceCard.classList.toggle("hidden", !hasUser);
    currentUserLabel.classList.toggle("hidden", !hasUser);
    currentUserLabel.textContent = hasUser ? currentUser.name : "작업자 -";
  }

  function setCurrentUser(user) {
    currentUser = user || null;
    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    updateWorkspaceVisibility();
  }

  function loadStoredUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      currentUser = raw ? JSON.parse(raw) : null;
    } catch (_) {
      currentUser = null;
    }
    updateWorkspaceVisibility();
  }

  function renderItems() {
    resultCount.textContent = `${currentItems.length}건`;
    if (!currentItems.length) {
      itemList.innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`;
      return;
    }

    itemList.innerHTML = currentItems
      .map((item) => `
        <article class="item-card${item.isMissing ? " is-missing" : ""}" data-id="${item.id}">
          <div class="item-row-main" data-action="edit" data-id="${item.id}">
            <div class="item-col item-col-name">
              <div class="item-col-label">품명</div>
              <div class="item-col-value">${escapeHtml(item.productName)}</div>
            </div>
            <div class="item-col item-col-location">
              <div class="item-col-label">위치</div>
              <div class="item-col-value">${escapeHtml(item.location || "-")}</div>
            </div>
            <div class="item-col item-col-group">
              <div class="item-col-label">그룹</div>
              <div class="item-col-value item-group-text">${escapeHtml(item.groupName || "-")}</div>
            </div>
          </div>
          <div class="item-row-side">
            <button class="icon-action-btn text-btn ghost${item.isMissing ? " is-active" : ""}" type="button" data-action="ghost" data-id="${item.id}" title="${item.isMissing ? "복구" : "유령"}" aria-label="${item.isMissing ? "복구" : "유령"}">
              ${item.isMissing ? "복구" : "유령"}
            </button>
            <button class="icon-action-btn text-btn delete" type="button" data-action="delete" data-id="${item.id}" title="삭제" aria-label="삭제">
              삭제
            </button>
          </div>
        </article>
      `)
      .join("");
  }

  async function checkHealth() {
    try {
      await apiFetch("/api/mobile/health", { method: "GET" });
      setStatus("ok", "연결됨");
      return true;
    } catch (error) {
      setStatus("error", "실패");
      showAlert(error.message);
      return false;
    }
  }

  async function loadServerInfo() {
    if (!serverAddressList) return;

    serverAddressList.innerHTML = `<div class="server-address-empty">PC 접속 주소를 확인하는 중입니다.</div>`;

    try {
      const result = await apiFetch("/api/mobile/server-info", { method: "GET" });
      renderServerAddresses(result.addresses, result.localhostUrl);
    } catch (_) {
      serverAddressList.innerHTML = `
        <div class="server-address-empty">
          API 연결 후 PC 접속 주소를 불러올 수 있습니다.
        </div>
      `;
    }
  }

  async function loadGroups() {
    const result = await apiFetch("/api/mobile/item-location-groups", {
      method: "GET",
    });
    currentGroups = result.data || [];
    renderGroupOptions(groupNameSelect.value);
  }

  async function loadItems() {
    const keyword = encodeURIComponent(String(searchKeywordInput.value || "").trim());
    const result = await apiFetch(`/api/mobile/item-locations?keyword=${keyword}`, {
      method: "GET",
    });
    currentItems = result.data || [];
    renderItems();
  }

  async function handleLogin() {
    const name = String(loginNameInput.value || "").trim();
    if (!name) {
      await showAlert("이름을 입력해주세요.");
      return;
    }

    const result = await apiFetch("/api/mobile/login", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setCurrentUser(result.user);
    await loadGroups();
    await loadItems();
  }

  function fillForm(item) {
    itemIdInput.value = item.id;
    productNameInput.value = item.productName || "";
    renderGroupOptions(item.groupName || "");
    locationNameInput.value = item.location || "";
    itemNoteInput.value = item.note || "";
    openSheet("품목 수정");
  }

  async function saveItem(event) {
    event.preventDefault();

    const payload = {
      productName: String(productNameInput.value || "").trim(),
      groupName: String(groupNameSelect.value || "").trim(),
      location: String(locationNameInput.value || "").trim(),
      note: String(itemNoteInput.value || "").trim(),
      workerName: currentUser?.name || "",
    };

    if (!payload.productName || !payload.groupName || !payload.location) {
      showAlert("품명, 그룹, 위치를 모두 입력해주세요.");
      return;
    }

    const id = Number(itemIdInput.value || 0);

    try {
      if (id) {
        await apiFetch(`/api/mobile/item-locations/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/mobile/item-locations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      if (error?.payload?.duplicate) {
        const confirmed = await openConfirmModal({
          title: "중복 등록 확인",
          message: "이미 존재하지만 등록하시겠습니까?",
          okText: "등록",
          cancelText: "취소",
        });
        if (!confirmed) return;

        if (id) {
          await apiFetch(`/api/mobile/item-locations/${id}`, {
            method: "PUT",
            body: JSON.stringify({ ...payload, allowDuplicate: true }),
          });
        } else {
          await apiFetch("/api/mobile/item-locations", {
            method: "POST",
            body: JSON.stringify({ ...payload, allowDuplicate: true }),
          });
        }
      } else {
        showAlert(error.message);
        return;
      }
    }

    closeSheet();
    resetForm();
    await loadItems();
  }

  async function toggleMissing(itemId, isMissing) {
    await apiFetch(`/api/mobile/item-locations/${itemId}/missing`, {
      method: "PATCH",
      body: JSON.stringify({ isMissing }),
    });
    await loadItems();
  }

  async function deleteItem(itemId) {
    await apiFetch(`/api/mobile/item-locations/${itemId}`, {
      method: "DELETE",
    });
    await loadItems();
  }

  function getItemById(id) {
    return currentItems.find((item) => Number(item.id) === Number(id)) || null;
  }

  btnSaveApi?.addEventListener("click", () => {
    setApiBaseUrl(apiBaseInput.value);
    apiBaseInput.value = getApiBaseUrl();
    setStatus("idle", "저장됨");
    setConnectCardVisible(false);
  });

  btnCheckApi?.addEventListener("click", async () => {
    const ok = await checkHealth();
    if (ok) setConnectCardVisible(false);
  });

  serverAddressList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-base-url]");
    if (!button) return;
    const nextBaseUrl = String(button.dataset.baseUrl || "").trim();
    if (!nextBaseUrl) return;
    apiBaseInput.value = nextBaseUrl;
    setApiBaseUrl(nextBaseUrl);
    setStatus("idle", "주소 적용됨");
  });

  btnLogin?.addEventListener("click", async () => {
    try {
      await handleLogin();
    } catch (error) {
      await showAlert(error.message);
    }
  });

  btnLogout?.addEventListener("click", () => {
    setCurrentUser(null);
    currentItems = [];
    renderItems();
  });

  btnSearch?.addEventListener("click", async () => {
    try {
      await loadItems();
    } catch (error) {
      await showAlert(error.message);
    }
  });

  searchKeywordInput?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    try {
      await loadItems();
    } catch (error) {
      await showAlert(error.message);
    }
  });

  btnOpenCreate?.addEventListener("click", () => {
    resetForm();
    openSheet("품목 등록");
  });

  btnCancelSheet?.addEventListener("click", () => {
    closeSheet();
    resetForm();
  });

  itemSheet?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-close-sheet='true']")) return;
    closeSheet();
    resetForm();
  });

  itemForm?.addEventListener("submit", saveItem);
  itemForm?.addEventListener("focusin", (event) => {
    if (!event.target.matches("input, textarea, select")) return;
    updateSheetViewport();
    scrollFieldIntoView(event.target);
  });

  itemForm?.addEventListener("focusout", () => {
    window.setTimeout(() => {
      updateSheetViewport();
    }, 120);
  });

  confirmCancel?.addEventListener("click", () => closeConfirmModal(false));
  confirmOk?.addEventListener("click", () => closeConfirmModal(true));
  confirmModal?.addEventListener("click", (event) => {
    if (event.target === confirmModal) closeConfirmModal(false);
  });

  itemList?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const item = getItemById(actionButton.dataset.id);
    if (!item) return;

    try {
      if (actionButton.dataset.action === "edit") {
        fillForm(item);
        return;
      }

      if (actionButton.dataset.action === "ghost") {
        const confirmed = await openConfirmModal({
          title: item.isMissing ? "복구 확인" : "유령 표시",
          message: item.isMissing
            ? "이 품목 위치를 다시 정상 상태로 돌릴까요?"
            : "이 품목 위치를 못 찾고 있는 상태로 표시할까요?",
          okText: "확인",
          cancelText: "취소",
        });
        if (!confirmed) return;
        await toggleMissing(item.id, !item.isMissing);
        return;
      }

      if (actionButton.dataset.action === "delete") {
        const confirmed = await openConfirmModal({
          title: "삭제 확인",
          message: "이 품목 위치 데이터를 삭제할까요?",
          okText: "삭제",
          cancelText: "취소",
        });
        if (!confirmed) return;
        await deleteItem(item.id);
      }
    } catch (error) {
      await showAlert(error.message);
    }
  });

  async function restoreSessionIfPossible() {
    if (!currentUser?.name) return false;
    try {
      const result = await apiFetch("/api/mobile/login", {
        method: "POST",
        body: JSON.stringify({ name: currentUser.name }),
      });
      setCurrentUser(result.user);
      await loadGroups();
      await loadItems();
      return true;
    } catch (_) {
      setCurrentUser(null);
      return false;
    }
  }

  async function initialize() {
    apiBaseInput.value = getApiBaseUrl();
    loadStoredUser();
    renderItems();
    setConnectCardVisible(false);
    const apiOk = await checkHealth();
    if (!apiOk) {
      setConnectCardVisible(true);
      setBootVisible(false);
      return;
    }

    const restored = await restoreSessionIfPossible();
    if (!restored && currentUser?.name) {
      await showAlert("저장된 작업자 정보를 확인하지 못해 다시 로그인해주세요.");
    }
    setBootVisible(false);
  }

  window.visualViewport?.addEventListener("resize", updateSheetViewport);
  window.visualViewport?.addEventListener("scroll", updateSheetViewport);
  window.addEventListener("resize", () => {
    const nextHeight = window.visualViewport?.height || window.innerHeight;
    if (!itemSheet || itemSheet.classList.contains("hidden")) {
      baseViewportHeight = Math.max(baseViewportHeight, nextHeight);
    }
    updateSheetViewport();
  });

  initialize().catch(async (error) => {
    setBootVisible(false);
    setConnectCardVisible(true);
    await showAlert(error?.message || "모바일 화면 초기화 중 오류가 발생했습니다.");
  });
})();
