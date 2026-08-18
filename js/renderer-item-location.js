(function () {
  const { ipcRenderer } = require("electron");
  const Toastify = require("toastify-js");

  let user;
  try {
    const raw = localStorage.getItem("countHubUser");
    user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    user = null;
  }

  if (!user || !user.name) {
    window.location.href = "02 login.html";
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const GROUP_STORAGE_KEY = "countHubItemGroups";
    const DEFAULT_GROUPS = ["마녀", "바닐라코", "무지"];
    const form = document.getElementById("item-form");
    const itemId = document.getElementById("item-id");
    const productNameInput = document.getElementById("product-name");
    const groupNameSelect = document.getElementById("group-name");
    const locationInput = document.getElementById("location-name");
    const noteInput = document.getElementById("item-note");
    const formTitle = document.getElementById("form-title");
    const resultBody = document.getElementById("result-body");
    const summaryBody = document.getElementById("summary-body");
    const resultCount = document.getElementById("result-count");
    const searchKeywordInput = document.getElementById("search-keyword");
    const btnSearch = document.getElementById("btn-search");
    const btnSearchReset = document.getElementById("btn-search-reset");
    const btnCreateItem = document.getElementById("btn-create-item");
    const btnSummaryModal = document.getElementById("btn-summary-modal");
    const btnGroupSettings = document.getElementById("btn-group-settings");
    const btnCancelEdit = document.getElementById("btn-cancel-edit");
    const itemModal = document.getElementById("item-modal");
    const itemModalCard = document.querySelector(".item-modal-card");
    const groupSettingsModal = document.getElementById("group-settings-modal");
    const groupSettingsModalCard = document.querySelector(".settings-modal-card");
    const groupSettingsInput = document.getElementById("group-settings-input");
    const btnAddGroup = document.getElementById("btn-add-group");
    const groupSettingsList = document.getElementById("group-settings-list");
    const summaryModal = document.getElementById("summary-modal");
    const summaryModalCard = document.querySelector(".summary-modal-card");
    const confirmModal = document.getElementById("confirm-modal");
    const confirmTitle = document.getElementById("confirm-title");
    const confirmMessage = document.getElementById("confirm-message");
    const confirmCancel = document.getElementById("confirm-cancel");
    const confirmOk = document.getElementById("confirm-ok");
    const loadingOverlay = document.getElementById("loading-overlay");
    const filterPopover = document.getElementById("filter-popover");
    const filterTitle = document.getElementById("filter-title");
    const filterSortAsc = document.getElementById("filter-sort-asc");
    const filterSortDesc = document.getElementById("filter-sort-desc");
    const filterClear = document.getElementById("filter-clear");
    const filterSearch = document.getElementById("filter-search");
    const filterOptions = document.getElementById("filter-options");
    const filterApply = document.getElementById("filter-apply");
    const filterButtons = Array.from(document.querySelectorAll(".column-filter-btn"));
    const summaryFilterButtons = Array.from(document.querySelectorAll(".summary-filter-btn"));
    const activeToasts = [];
    let selectedItemId = null;
    let allRows = [];
    let lastRows = [];
    let summaryRows = [];
    let sortState = { column: "", direction: "" };
    let columnFilters = {};
    let summarySortState = { column: "", direction: "" };
    let summaryColumnFilters = {};
    let activeFilterColumn = "";
    let activeFilterContext = "main";
    let tempSelectedValues = new Set();
    let confirmResolve = null;
    let itemGroups = [];

    const currentWorkerName = String(user.name ?? user.username ?? "").trim();

    function showToast(message, isError = false) {
      while (activeToasts.length >= 2) {
        const oldToast = activeToasts.shift();
        oldToast?.hideToast?.();
      }

      const toast = Toastify({
        text: message,
        duration: 2800,
        gravity: "bottom",
        position: "right",
        close: true,
        style: {
          background: "#ffffff",
          color: "#0f172a",
          borderLeft: isError ? "5px solid #ef4444" : "5px solid #0f172a",
          borderRadius: "10px",
          boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
        },
        callback: function () {
          const index = activeToasts.indexOf(toast);
          if (index >= 0) activeToasts.splice(index, 1);
        },
      });

      activeToasts.push(toast);
      toast.showToast();
    }

    function loadGroups() {
      try {
        const raw = localStorage.getItem(GROUP_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) {
          itemGroups = parsed
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          return;
        }
      } catch (_) {}
      itemGroups = [...DEFAULT_GROUPS];
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(itemGroups));
    }

    function saveGroups() {
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(itemGroups));
    }

    function renderGroupOptions(selectedValue = "") {
      if (!groupNameSelect) return;
      groupNameSelect.innerHTML = [
        `<option value="">그룹 선택</option>`,
        ...itemGroups.map((group) => {
          const selected = group === selectedValue ? "selected" : "";
          return `<option value="${escapeHtml(group)}" ${selected}>${escapeHtml(group)}</option>`;
        }),
      ].join("");
    }

    function renderGroupSettingsList() {
      if (!groupSettingsList) return;
      if (!itemGroups.length) {
        groupSettingsList.innerHTML = `<div class="empty-row"><div>등록된 그룹이 없습니다.</div></div>`;
        return;
      }
      groupSettingsList.innerHTML = itemGroups
        .map((group) => `
          <div class="group-settings-item">
            <span class="group-settings-name">${escapeHtml(group)}</span>
            <button class="row-action-btn delete" type="button" data-group-delete="${escapeHtml(group)}">삭제</button>
          </div>
        `)
        .join("");
    }

    function setLoadingState(isLoading) {
      if (!loadingOverlay) return;
      loadingOverlay.classList.toggle("is-open", isLoading);
      loadingOverlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
      document.body.style.overflow = isLoading ? "hidden" : "";
    }

    function openConfirmModal({ title, message, okText, cancelText }) {
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
      confirmModal.classList.remove("is-open");
      confirmModal.setAttribute("aria-hidden", "true");
      if (confirmResolve) confirmResolve(result);
      confirmResolve = null;
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

    function openModal() {
      itemModal.classList.add("is-open");
      itemModal.setAttribute("aria-hidden", "false");
      itemModalCard?.focus();
      productNameInput.focus();
    }

    function closeModal() {
      itemModal.classList.remove("is-open");
      itemModal.setAttribute("aria-hidden", "true");
    }

    function openSummaryModal() {
      summaryModal.classList.add("is-open");
      summaryModal.setAttribute("aria-hidden", "false");
      summaryModalCard?.focus();
    }

    function closeSummaryModal() {
      summaryModal.classList.remove("is-open");
      summaryModal.setAttribute("aria-hidden", "true");
    }

    function openGroupSettingsModal() {
      renderGroupSettingsList();
      groupSettingsModal.classList.add("is-open");
      groupSettingsModal.setAttribute("aria-hidden", "false");
      groupSettingsModalCard?.focus();
      groupSettingsInput?.focus();
    }

    function closeGroupSettingsModal() {
      groupSettingsModal.classList.remove("is-open");
      groupSettingsModal.setAttribute("aria-hidden", "true");
    }

    function resetForm() {
      itemId.value = "";
      productNameInput.value = "";
      renderGroupOptions();
      locationInput.value = "";
      noteInput.value = "";
      formTitle.textContent = "품목 등록";
      selectedItemId = null;
      renderRows(lastRows);
    }

    function fillForm(row) {
      itemId.value = String(row.id || "");
      productNameInput.value = row.product_name || "";
      renderGroupOptions(row.group_name || "");
      locationInput.value = row.location || "";
      noteInput.value = row.note || "";
      formTitle.textContent = "품목 수정";
      selectedItemId = Number(row.id);
      renderRows(lastRows);
      openModal();
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getColumnValue(row, column) {
      if (column === "updated_at") return formatDate(row.updated_at);
      if (column === "actions") return "";
      return String(row?.[column] ?? "").trim();
    }

    function getSummaryValue(row, column) {
      if (column === "count") return Number(row.count || 0);
      return String(row?.[column] ?? "").trim();
    }

    function getUniqueValues(rows, column, valueGetter = getColumnValue) {
      return Array.from(
        new Set(
          rows
            .map((row) => valueGetter(row, column) || "-")
            .filter((value) => value !== ""),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko"));
    }

    function updateFilterButtonState(buttons, filters, sortInfo, keyName) {
      buttons.forEach((button) => {
        const column = button.dataset[keyName];
        const hasFilter = Array.isArray(filters[column]) && filters[column].length > 0;
        const hasSort = sortInfo.column === column && sortInfo.direction;
        button.classList.toggle("is-active", hasFilter || hasSort);
      });
    }

    function applyTableState(rows) {
      let filteredRows = Array.isArray(rows) ? [...rows] : [];

      Object.entries(columnFilters).forEach(([column, values]) => {
        if (!values || !values.length || column === "actions") return;
        filteredRows = filteredRows.filter((row) => {
          const value = getColumnValue(row, column) || "-";
          return values.includes(value);
        });
      });

      if (sortState.column && sortState.direction && sortState.column !== "actions") {
        filteredRows.sort((a, b) => {
          const aValue = getColumnValue(a, sortState.column);
          const bValue = getColumnValue(b, sortState.column);

          if (sortState.column === "updated_at") {
            const aTime = new Date(a.updated_at).getTime() || 0;
            const bTime = new Date(b.updated_at).getTime() || 0;
            return sortState.direction === "asc" ? aTime - bTime : bTime - aTime;
          }

          const compared = String(aValue).localeCompare(String(bValue), "ko", {
            numeric: true,
            sensitivity: "base",
          });
          return sortState.direction === "asc" ? compared : -compared;
        });
      }

      updateFilterButtonState(filterButtons, columnFilters, sortState, "column");
      renderRows(filteredRows);
    }

    function buildSummaryRows() {
      const map = new Map();
      allRows
        .filter((row) => !row.is_missing)
        .forEach((row) => {
          const key = `${row.product_name}__${row.group_name || ""}__${row.note || ""}`;
          const current = map.get(key) || {
            product_name: row.product_name,
            group_name: row.group_name || "",
            note: row.note || "",
            count: 0,
          };
          current.count += 1;
          map.set(key, current);
        });
      summaryRows = Array.from(map.values());
    }

    function renderSummaryRows(rows) {
      if (!rows.length) {
        summaryBody.innerHTML = `
          <tr class="empty-row">
            <td colspan="3">표시할 품목 수량이 없습니다.</td>
          </tr>
        `;
        return;
      }

      summaryBody.innerHTML = rows
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.product_name)}</td>
            <td>${escapeHtml(String(row.count))}</td>
            <td>${escapeHtml(row.group_name || "-")}</td>
            <td>${escapeHtml(row.note || "-")}</td>
          </tr>
        `)
        .join("");
    }

    function applySummaryTableState(rows) {
      let filteredRows = Array.isArray(rows) ? [...rows] : [];

      Object.entries(summaryColumnFilters).forEach(([column, values]) => {
        if (!values || !values.length) return;
        filteredRows = filteredRows.filter((row) => {
          const value = String(getSummaryValue(row, column) || "-");
          return values.includes(value);
        });
      });

      if (summarySortState.column && summarySortState.direction) {
        filteredRows.sort((a, b) => {
          if (summarySortState.column === "count") {
            const diff = Number(a.count || 0) - Number(b.count || 0);
            return summarySortState.direction === "asc" ? diff : -diff;
          }
          const compared = String(getSummaryValue(a, summarySortState.column)).localeCompare(
            String(getSummaryValue(b, summarySortState.column)),
            "ko",
            { numeric: true, sensitivity: "base" },
          );
          return summarySortState.direction === "asc" ? compared : -compared;
        });
      }

      updateFilterButtonState(
        summaryFilterButtons,
        summaryColumnFilters,
        summarySortState,
        "summaryColumn",
      );
      renderSummaryRows(filteredRows);
    }

    function closeFilterPopover() {
      filterPopover.classList.remove("is-open");
      filterPopover.setAttribute("aria-hidden", "true");
      activeFilterColumn = "";
      activeFilterContext = "main";
      if (filterSearch) filterSearch.value = "";
    }

    function renderFilterOptions() {
      if (!activeFilterColumn) return;
      const searchValue = String(filterSearch?.value || "").trim().toLowerCase();
      const isSummary = activeFilterContext === "summary";
      const sourceRows = isSummary ? summaryRows : allRows;
      const getter = isSummary
        ? (row, column) => String(getSummaryValue(row, column) || "-")
        : (row, column) => getColumnValue(row, column) || "-";
      const values = getUniqueValues(sourceRows, activeFilterColumn, getter).filter((value) =>
        value.toLowerCase().includes(searchValue),
      );

      if (!values.length) {
        filterOptions.innerHTML = `<div class="empty-row"><div>선택 가능한 값이 없습니다.</div></div>`;
        return;
      }

      filterOptions.innerHTML = values
        .map((value, index) => {
          const checked = tempSelectedValues.has(value) ? "checked" : "";
          return `
            <label class="filter-option">
              <input type="checkbox" data-filter-value="${escapeHtml(String(value))}" ${checked}>
              <span>${escapeHtml(value)}</span>
            </label>
          `;
        })
        .join("");
    }

    function openFilterPopover(button, context) {
      activeFilterContext = context;
      activeFilterColumn =
        context === "summary" ? button.dataset.summaryColumn : button.dataset.column;
      const label =
        context === "summary" ? button.dataset.summaryLabel || "필터" : button.dataset.label || "필터";
      filterTitle.textContent = `${label} 필터`;
      const sourceRows = context === "summary" ? summaryRows : allRows;
      const getter = context === "summary"
        ? (row, column) => String(getSummaryValue(row, column) || "-")
        : (row, column) => getColumnValue(row, column) || "-";
      const existingFilters = context === "summary" ? summaryColumnFilters : columnFilters;
      tempSelectedValues = new Set(
        existingFilters[activeFilterColumn] || getUniqueValues(sourceRows, activeFilterColumn, getter),
      );
      renderFilterOptions();

      const rect = button.getBoundingClientRect();
      filterPopover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 340)}px`;
      filterPopover.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
      filterPopover.classList.add("is-open");
      filterPopover.setAttribute("aria-hidden", "false");
    }

    function renderRows(rows) {
      lastRows = Array.isArray(rows) ? rows : [];
      resultCount.textContent = `${lastRows.length}건`;

      if (!lastRows.length) {
        resultBody.innerHTML = `
          <tr class="empty-row">
            <td colspan="6">검색 결과가 없습니다.</td>
          </tr>
        `;
        return;
      }

      resultBody.innerHTML = lastRows
        .map((row) => {
          const isSelected = Number(row.id) === Number(selectedItemId);
          const workerLabel = row.worker_name || "-";
          return `
            <tr class="result-row${isSelected ? " is-selected" : ""}${row.is_missing ? " is-missing" : ""}" data-id="${row.id}">
              <td>${escapeHtml(row.product_name)}</td>
              <td>${escapeHtml(row.location)}</td>
              <td>${escapeHtml(row.group_name || "-")}</td>
              <td>${escapeHtml(row.note || "-")}</td>
              <td>${escapeHtml(workerLabel)}</td>
              <td>${escapeHtml(formatDate(row.updated_at))}</td>
              <td>
                <div class="row-actions">
                  <button class="row-action-btn ghost" type="button" data-action="ghost" data-id="${row.id}">${row.is_missing ? "복구" : "유령"}</button>
                  <button class="row-action-btn delete" type="button" data-action="delete" data-id="${row.id}">삭제</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    async function loadRows() {
      setLoadingState(true);
      try {
        const result = await ipcRenderer.invoke("search-item-locations", {
          keyword: searchKeywordInput.value.trim(),
        });

        if (!result?.ok) {
          showToast(result?.error || "검색 중 오류가 발생했습니다.", true);
          return;
        }

        allRows = result.data || [];
        buildSummaryRows();
        applyTableState(allRows);
        applySummaryTableState(summaryRows);
      } finally {
        setLoadingState(false);
      }
    }

    async function saveItem() {
      const payload = {
        id: itemId.value ? Number(itemId.value) : null,
        productName: productNameInput.value.trim(),
        groupName: groupNameSelect.value.trim(),
        location: locationInput.value.trim(),
        note: noteInput.value.trim(),
        workerName: currentWorkerName,
      };

      if (!payload.productName || !payload.groupName || !payload.location) {
        showToast("품명, 그룹, 위치를 모두 입력해주세요.", true);
        return;
      }

      let result = await ipcRenderer.invoke("save-item-location", payload);
      if (result?.duplicate) {
        const ok = await openConfirmModal({
          title: "중복 등록 확인",
          message: "이미 존재하지만 등록하시겠습니까?",
          okText: "등록",
          cancelText: "취소",
        });
        if (!ok) return;
        result = await ipcRenderer.invoke("save-item-location", {
          ...payload,
          allowDuplicate: true,
        });
      }
      if (!result?.ok) {
        showToast(result?.error || "저장에 실패했습니다.", true);
        return;
      }

      showToast(payload.id ? "수정되었습니다." : "저장되었습니다.");
      closeModal();
      resetForm();
      await loadRows();
    }

    async function deleteItem(id) {
      const ok = await openConfirmModal({
        title: "삭제 확인",
        message: "이 품목 위치 데이터를 삭제할까요?",
        okText: "삭제",
        cancelText: "취소",
      });
      if (!ok) return;

      const result = await ipcRenderer.invoke("delete-item-location", { id });
      if (!result?.ok) {
        showToast(result?.error || "삭제에 실패했습니다.", true);
        return;
      }

      if (Number(itemId.value) === Number(id)) {
        closeModal();
        resetForm();
      }
      showToast("삭제되었습니다.");
      await loadRows();
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveItem();
    });

    btnCreateItem?.addEventListener("click", () => {
      resetForm();
      openModal();
    });

    btnGroupSettings?.addEventListener("click", () => {
      openGroupSettingsModal();
    });

    btnSummaryModal?.addEventListener("click", () => {
      buildSummaryRows();
      applySummaryTableState(summaryRows);
      openSummaryModal();
    });

    btnCancelEdit?.addEventListener("click", () => {
      closeModal();
      resetForm();
    });

    itemModal?.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-close='modal']");
      if (!closeTarget) return;
      closeModal();
      resetForm();
    });

    summaryModal?.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-close='summary-modal']");
      if (!closeTarget) return;
      closeSummaryModal();
    });

    groupSettingsModal?.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-close='group-settings-modal']");
      if (!closeTarget) return;
      closeGroupSettingsModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && itemModal?.classList.contains("is-open")) {
        closeModal();
        resetForm();
      }
      if (event.key === "Escape" && summaryModal?.classList.contains("is-open")) {
        closeSummaryModal();
      }
      if (event.key === "Escape" && groupSettingsModal?.classList.contains("is-open")) {
        closeGroupSettingsModal();
      }
      if (event.key === "Escape" && confirmModal?.classList.contains("is-open")) {
        closeConfirmModal(false);
      }
    });

    btnAddGroup?.addEventListener("click", () => {
      const newGroup = String(groupSettingsInput?.value || "").trim();
      if (!newGroup) {
        showToast("그룹명을 입력해주세요.", true);
        return;
      }
      if (itemGroups.includes(newGroup)) {
        showToast("이미 등록된 그룹입니다.", true);
        return;
      }
      itemGroups.push(newGroup);
      saveGroups();
      renderGroupOptions(groupNameSelect.value);
      renderGroupSettingsList();
      groupSettingsInput.value = "";
      groupSettingsInput.focus();
      showToast("그룹이 추가되었습니다.");
    });

    groupSettingsInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        btnAddGroup?.click();
      }
    });

    groupSettingsList?.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest("[data-group-delete]");
      if (!deleteButton) return;
      const targetGroup = deleteButton.getAttribute("data-group-delete");
      const ok = await openConfirmModal({
        title: "그룹 삭제",
        message: `'${targetGroup}' 그룹을 삭제할까요?`,
        okText: "삭제",
        cancelText: "취소",
      });
      if (!ok) return;
      itemGroups = itemGroups.filter((group) => group !== targetGroup);
      saveGroups();
      renderGroupOptions();
      renderGroupSettingsList();
      showToast("그룹이 삭제되었습니다.");
    });

    confirmCancel?.addEventListener("click", () => closeConfirmModal(false));
    confirmOk?.addEventListener("click", () => closeConfirmModal(true));
    confirmModal?.addEventListener("click", (event) => {
      if (event.target === confirmModal) closeConfirmModal(false);
    });

    btnSearch?.addEventListener("click", async () => {
      await loadRows();
    });

    btnSearchReset?.addEventListener("click", async () => {
      searchKeywordInput.value = "";
      sortState = { column: "", direction: "" };
      columnFilters = {};
      closeFilterPopover();
      await loadRows();
    });

    searchKeywordInput?.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await loadRows();
      }
    });

    resultBody?.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        const action = actionButton.dataset.action;
        const id = Number(actionButton.dataset.id);
        const row = lastRows.find((item) => Number(item.id) === id);
        if (!row) return;

        if (action === "edit") {
          fillForm(row);
          return;
        }
        if (action === "delete") {
          await deleteItem(id);
          return;
        }
        if (action === "ghost") {
          const confirmMessage = row.is_missing
            ? "이 품목 위치를 다시 정상 상태로 돌릴까요?"
            : "이 품목 위치를 못 찾고 있는 상태로 표시할까요?";
          const ok = await openConfirmModal({
            title: row.is_missing ? "복구 확인" : "유령 표시",
            message: confirmMessage,
            okText: "확인",
            cancelText: "취소",
          });
          if (!ok) return;

          const result = await ipcRenderer.invoke("mark-item-location-missing", {
            id,
            isMissing: !row.is_missing,
          });
          if (!result?.ok) {
            showToast(result?.error || "상태 변경에 실패했습니다.", true);
            return;
          }
          showToast(row.is_missing ? "정상 상태로 복구했습니다." : "못 찾음 상태로 표시했습니다.");
          await loadRows();
          return;
        }
      }

      const rowElement = event.target.closest(".result-row");
      if (!rowElement) return;
      const id = Number(rowElement.dataset.id);
      const row = lastRows.find((item) => Number(item.id) === id);
      if (row) fillForm(row);
    });

    filterButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (
          activeFilterContext === "main" &&
          activeFilterColumn === button.dataset.column &&
          filterPopover.classList.contains("is-open")
        ) {
          closeFilterPopover();
          return;
        }
        openFilterPopover(button, "main");
      });
    });

    summaryFilterButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (
          activeFilterContext === "summary" &&
          activeFilterColumn === button.dataset.summaryColumn &&
          filterPopover.classList.contains("is-open")
        ) {
          closeFilterPopover();
          return;
        }
        openFilterPopover(button, "summary");
      });
    });

    filterSearch?.addEventListener("input", () => {
      renderFilterOptions();
    });

    filterOptions?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-filter-value]");
      if (!checkbox) return;
      const value = checkbox.getAttribute("data-filter-value");
      if (checkbox.checked) {
        tempSelectedValues.add(value);
      } else {
        tempSelectedValues.delete(value);
      }
    });

    filterSortAsc?.addEventListener("click", () => {
      if (!activeFilterColumn || activeFilterColumn === "actions") return;
      if (activeFilterContext === "summary") {
        summarySortState = { column: activeFilterColumn, direction: "asc" };
        applySummaryTableState(summaryRows);
      } else {
        sortState = { column: activeFilterColumn, direction: "asc" };
        applyTableState(allRows);
      }
    });

    filterSortDesc?.addEventListener("click", () => {
      if (!activeFilterColumn || activeFilterColumn === "actions") return;
      if (activeFilterContext === "summary") {
        summarySortState = { column: activeFilterColumn, direction: "desc" };
        applySummaryTableState(summaryRows);
      } else {
        sortState = { column: activeFilterColumn, direction: "desc" };
        applyTableState(allRows);
      }
    });

    filterClear?.addEventListener("click", () => {
      if (!activeFilterColumn) return;
      if (activeFilterContext === "summary") {
        delete summaryColumnFilters[activeFilterColumn];
        if (summarySortState.column === activeFilterColumn) {
          summarySortState = { column: "", direction: "" };
        }
        tempSelectedValues = new Set(
          getUniqueValues(summaryRows, activeFilterColumn, (row, column) =>
            String(getSummaryValue(row, column) || "-"),
          ),
        );
        applySummaryTableState(summaryRows);
      } else {
        delete columnFilters[activeFilterColumn];
        if (sortState.column === activeFilterColumn) {
          sortState = { column: "", direction: "" };
        }
        tempSelectedValues = new Set(getUniqueValues(allRows, activeFilterColumn));
        applyTableState(allRows);
      }
      closeFilterPopover();
    });

    filterApply?.addEventListener("click", () => {
      if (!activeFilterColumn) return;
      const sourceRows = activeFilterContext === "summary" ? summaryRows : allRows;
      const allValues = getUniqueValues(
        sourceRows,
        activeFilterColumn,
        activeFilterContext === "summary"
          ? (row, column) => String(getSummaryValue(row, column) || "-")
          : getColumnValue,
      );
      const selectedValues = Array.from(tempSelectedValues);
      if (activeFilterContext === "summary") {
        if (!selectedValues.length || selectedValues.length === allValues.length) {
          delete summaryColumnFilters[activeFilterColumn];
        } else {
          summaryColumnFilters[activeFilterColumn] = selectedValues;
        }
        applySummaryTableState(summaryRows);
      } else {
        if (!selectedValues.length || selectedValues.length === allValues.length) {
          delete columnFilters[activeFilterColumn];
        } else {
          columnFilters[activeFilterColumn] = selectedValues;
        }
        applyTableState(allRows);
      }
      closeFilterPopover();
    });

    document.addEventListener("click", (event) => {
      if (!filterPopover.classList.contains("is-open")) return;
      if (event.target.closest(".filter-popover")) return;
      if (event.target.closest(".column-filter-btn")) return;
      closeFilterPopover();
    });

    loadGroups();
    renderGroupOptions();
    renderGroupSettingsList();

    loadRows().catch((error) => {
      console.error(error);
      setLoadingState(false);
      showToast("초기 데이터를 불러오지 못했습니다.", true);
    });
  });
})();
