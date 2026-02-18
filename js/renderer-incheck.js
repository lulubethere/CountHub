(function () {
  const { ipcRenderer } = require('electron');

  // ===============================
  // 로그인 체크
  // ===============================
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

  // ===============================
  // 파일 경로 저장 변수
  // ===============================
  let sellerExcelPath = null;
  let verifyExcelPath = null;

  // ===============================
  // 1️⃣ seller 파일 선택
  // ===============================
  document.getElementById("btn-select-excel")
    ?.addEventListener("click", async () => {

      const result = await ipcRenderer.invoke("select-excel-file");

      if (result.ok) {
        sellerExcelPath = result.path;
        alert("Seller 파일 선택 완료");
        console.log("seller:", sellerExcelPath);
      }
    });

  // ===============================
  // 2️⃣ verify 파일 선택
  // ===============================
  document.getElementById("btn-select-verify-file")
    ?.addEventListener("click", async () => {

      const result = await ipcRenderer.invoke("select-excel-file");

      if (result.ok) {
        verifyExcelPath = result.path;
        alert("Verify 파일 선택 완료");
        console.log("verify:", verifyExcelPath);
      }
    });

  // ===============================
  // 3️⃣ 검수 실행 버튼
  // ===============================
  document.getElementById("btn-verify")
    ?.addEventListener("click", async () => {

      console.log("seller:", sellerExcelPath);
      console.log("verify:", verifyExcelPath);

      if (!sellerExcelPath || !verifyExcelPath) {
        alert("엑셀 파일을 선택해주세요");
        return;
      }

      const sellerName = document.getElementById("sel-seller")?.value || "";
      const shopName = document.getElementById("sel-shop")?.value || "";
      const dateValue = document.getElementById("dateInput")?.value || "";

      const columnMap = {
        sku: "H",
        productName: "I",
        expiry: "J",
        lot: "K",
        qty: "L"
      };

      const result = await ipcRenderer.invoke("process-verify-file", {
        sellerPath: sellerExcelPath,
        verifyPath: verifyExcelPath,
        sellerName,
        shopName,
        dateValue,
        columnMap
      });

      if (!result.ok) {
        alert(result.error);
      } else {
        alert("파일 생성 완료!\n저장 위치:\n" + result.path);
      }

    });

})();
