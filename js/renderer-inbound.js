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
  if (selSeller) {
    try {
      const result = await ipcRenderer.invoke('get-sellers');
      if (result.ok && result.data && result.data.length) {
        selSeller.innerHTML = '<option value="">선택</option>' +
          result.data.map(function (row) {
            return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
          }).join('');
      }
    } catch (e) {
      console.error('셀러 목록 로드 실패:', e);
    }
  }

  // 상품구분 목록 DB에서 로드
  const selType = document.getElementById("sel-type");
  if (selType) {
    try {
      const result = await ipcRenderer.invoke('get-product-types');
      if (result.ok && result.data && result.data.length) {
        selType.innerHTML = '<option value="">선택</option>' +
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
        selCenter.innerHTML = '<option value="">선택</option>' +
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
        selShop.innerHTML = '<option value="">선택</option>' +
          result.data.map(function (row) {
            return '<option value="' + String(row.code) + '">' + (row.name || '') + '</option>';
          }).join('');
      }
    } catch (e) {
      console.error('쇼핑몰 목록 로드 실패:', e);
    }
  }

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

});

})();
