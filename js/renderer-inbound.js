(function () {
  const { ipcRenderer } = require('electron');

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

  document.addEventListener("DOMContentLoaded", async function () {

 // 셀러 목록 DB에서 로드
const selSeller = document.getElementById("sel-seller");

const nameToFieldId = {
  'SKU': 'sku',
  '상품명': 'product-name',
  '유통기한': 'expiry',
  '로트': 'lot',
  '수량': 'expected-qty'
};

const defaultLabels = {
  'sku': 'SKU',
  'product-name': '상품명',
  'expiry': '유통기한',
  'lot': 'LOT',
  'expected-qty': '입고예정수량'
};

function clearColumnBindings() {
  Object.keys(defaultLabels).forEach(function (id) {
    const input = document.getElementById(id);
    if (input) {
      input.value = '';
      input.removeAttribute('data-column');
      input.removeAttribute('data-column-code');
    }
  });
}

function bindSellerColumns(rows) {
  clearColumnBindings();
  if (!rows || !rows.length) return;

  rows.forEach(function (row) {
    const fieldId = nameToFieldId[row.name];
    if (!fieldId) return;

    const input = document.getElementById(fieldId);
    if (input) {
      input.setAttribute('data-column', row.column || '');
      input.setAttribute('data-column-code', String(row.column_code || ''));
      input.value = row.column ? String(row.column) : '';
    }
  });
}

if (selSeller) {
  try {
    const result = await ipcRenderer.invoke('get-sellers');

    if (result.ok && result.data && result.data.length) {
      selSeller.innerHTML =
        '<option value="">선택</option>' +
        result.data.map(function (row) {
          return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
        }).join('');
    }

  } catch (e) {
    console.error('셀러 목록 로드 실패:', e);
  }

  selSeller.addEventListener('change', async function () {
    const sellerCode = (selSeller.value || '').trim();

    if (!sellerCode) {
      clearColumnBindings();
      return;
    }

    try {
      const result = await ipcRenderer.invoke('get-seller-columns', sellerCode);

      if (result.ok && result.data) {
        bindSellerColumns(result.data);
      } else {
        clearColumnBindings();
      }

    } catch (e) {
      console.error('셀러 컬럼 매핑 로드 실패:', e);
      clearColumnBindings();
    }
  });
}


// 상품구분 목록 DB에서 로드
const selType = document.getElementById("sel-type");

if (selType) {
  try {
    const result = await ipcRenderer.invoke('get-product-types');

    if (result.ok && result.data && result.data.length) {
      selType.innerHTML =
        '<option value="">선택</option>' +
        result.data.map(function (row) {
          return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
        }).join('');
    }

  } catch (e) {
    console.error('상품구분 목록 로드 실패:', e);
  }
}


// 입고센터 목록 DB에서 로드
const selCenter = document.getElementById("sel-center");

if (selCenter) {
  try {
    const result = await ipcRenderer.invoke('get-centers');

    if (result.ok && result.data && result.data.length) {
      selCenter.innerHTML =
        '<option value="">선택</option>' +
        result.data.map(function (row) {
          return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
        }).join('');
    }

  } catch (e) {
    console.error('입고센터 목록 로드 실패:', e);
  }
}


// 쇼핑몰 목록 DB에서 로드
const selShop = document.getElementById("sel-shop");

if (selShop) {
  try {
    const result = await ipcRenderer.invoke('get-shops');

    if (result.ok && result.data && result.data.length) {
      selShop.innerHTML =
        '<option value="">선택</option>' +
        result.data.map(function (row) {
          return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
        }).join('');
    }

  } catch (e) {
    console.error('쇼핑몰 목록 로드 실패:', e);
  }
}


// 날짜 변환 처리
const input = document.getElementById("dateInput");
const error = document.getElementById("dateError");

if (!input) return;

function convertDate() {
  const raw = input.value.replace(/\D/g, "");

  if (raw.length !== 8) return;

  const y = parseInt(raw.slice(0, 4));
  const m = parseInt(raw.slice(4, 6));
  const d = parseInt(raw.slice(6, 8));

  const date = new Date(y, m - 1, d);

  const isValid =
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d;

  if (!isValid) {
    error.style.display = "block";
    input.value = "";
    input.focus();
    return;
  }

  error.style.display = "none";

  input.value =
    y + "-" +
    String(m).padStart(2, "0") + "-" +
    String(d).padStart(2, "0");
}

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    convertDate();
  }
});

input.addEventListener("blur", convertDate);


    // =============================
    // Excel 경로 변수
    // =============================
    let sellerExcelPath = null;
    let inboundExcelPath = null;
    let verifyExcelPath = null;

    // =============================
    // Excel 선택 공통 함수
    // =============================
    async function selectExcelAndBind(buttonId, setter) {
      const btn = document.getElementById(buttonId);
      if (!btn) return;

      btn.addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-excel-file');
        if (!result.ok) return;

        setter(result.path);

        const fileName = result.path.split('\\').pop();
        btn.textContent = fileName;
        btn.title = result.path;
      });
    }

    // 버튼 연결
    selectExcelAndBind('btn-select-excel', path => {
      sellerExcelPath = path;
    });

    selectExcelAndBind('btn-select-inbound-file', path => {
      inboundExcelPath = path;
    });

    selectExcelAndBind('btn-select-verify-file', path => {
      verifyExcelPath = path;
    });

    // =============================
    // 검수 버튼
    // =============================
    const btnVerify = document.getElementById("btn-verify");

    if (btnVerify) {
      btnVerify.addEventListener("click", async function () {

        if (!sellerExcelPath || !verifyExcelPath) {
          alert("엑셀 파일을 모두 선택해주세요.");
          return;
        }

        const sellerSelect = document.getElementById("sel-seller");
        const shopSelect = document.getElementById("sel-shop");
        const dateInput = document.getElementById("dateInput");

        const sellerName = sellerSelect?.options[sellerSelect.selectedIndex]?.text || "";
        const shopName = shopSelect?.options[shopSelect.selectedIndex]?.text || "";
        const dateValue = dateInput?.value || "";

        const columnMap = {
          sku: document.getElementById("sku")?.value,
          productName: document.getElementById("product-name")?.value,
          expiry: document.getElementById("expiry")?.value,
          lot: document.getElementById("lot")?.value,
          qty: document.getElementById("expected-qty")?.value
        };

        const result = await ipcRenderer.invoke("process-verify-file", {
          verifyPath: verifyExcelPath,
          sellerPath: sellerExcelPath,
          sellerName,
          shopName,
          dateValue,
          columnMap
        });

        if (result.ok) {
          alert("완료되었습니다.\n저장경로: " + result.path);
        } else {
          alert("오류: " + result.error);
        }
      });
    }

  });

})();
