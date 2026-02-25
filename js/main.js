const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const db = require("./db.js");
const fs = require("fs");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile("html/02 login.html");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- IPC 핸들러 (DB 목록 로직) ---
ipcMain.handle("login", async (_, name) => {
  try {
    const user = await db.findUserByName(name);
    if (!user) return { ok: false, error: "등록된 이름이 아닙니다." };
    return { ok: true, user: { id: user.id, name: user.username } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-sellers", async () => {
  try {
    return { ok: true, data: await db.getSellers() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-product-types", async () => {
  try {
    return { ok: true, data: await db.getProductTypes() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-centers", async () => {
  try {
    return { ok: true, data: await db.getCenters() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-shops", async () => {
  try {
    return { ok: true, data: await db.getShops() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-seller-columns", async (_, code) => {
  try {
    return { ok: true, data: await db.getSellerColumns(code) };
  } catch (e) {
    return { ok: false };
  }
});

ipcMain.handle("select-excel-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
  });
  return result.canceled
    ? { ok: false }
    : { ok: true, path: result.filePaths[0] };
});

// [추가] DB에서 양식을 가져오는 핸들러
ipcMain.handle("load-verify-template", async () => {
  try {
    const buffer = await db.getVerifyTemplate();
    if (!buffer) return { ok: false, error: "등록된 양식이 없습니다." };

    // 이 buffer를 직접 넘기기보다, process 시점에서 사용하거나
    // 임시 파일로 저장 후 경로를 반환할 수 있습니다.
    return { ok: true, data: buffer };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 입고검수파일양식 체크 (id = 1)
ipcMain.handle("check-default-template", async () => {
  try {
    const templateData = await db.getInboundCheckTemplate();
    if (templateData && templateData.buffer) {
      console.log(`기본 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: "등록된 양식이 없습니다." };
  } catch (err) {
    console.error("양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// 입고파일양식 체크 (id = 2)
ipcMain.handle("check-inbound-template", async () => {
  try {
    const templateData = await db.getInboundExcelTemplate();
    if (templateData && templateData.buffer) {
      console.log(`입고파일 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: "등록된 양식이 없습니다." };
  } catch (err) {
    console.error("입고파일 양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// ... 상단 선언부 및 DB 핸들러 동일 ...
ipcMain.handle("process-verify-file", async (_, payload) => {
  try {
    const {
      verifyPath,
      sellerPath,
      sellerName,
      shopName,
      dateValue,
      columnMap,
    } = payload;
    const verifyWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    async function loadWorkbook(workbook, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".xls") {
        const tempXls = XLSX.readFile(filePath);
        const buffer = XLSX.write(tempXls, {
          type: "buffer",
          bookType: "xlsx",
        });
        await workbook.xlsx.load(buffer);
      } else {
        await workbook.xlsx.readFile(filePath);
      }
    }

    function getCellValue(cell) {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText)
          return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    }

    // 1️⃣ 파일 로드
    if (verifyPath && verifyPath !== "") {
      await loadWorkbook(verifyWorkbook, verifyPath);
    } else {
      const templateData = await db.getInboundCheckTemplate();
      await verifyWorkbook.xlsx.load(templateData.buffer);
    }
    await loadWorkbook(sellerWorkbook, sellerPath);

    const verifySheet = verifyWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets[0];

    // 2️⃣ 양식 파일 헤더 위치 및 공통 셀 찾기
    let targetCols = {
      plt: null,
      sku: null,
      name: null,
      barcode: null,
      lot: null,
      expiry: null,
      qty: null,
    };
    let commonCells = { seller: null, shop: null, date: null };
    let startDataRow = 3;

    verifySheet.eachRow((row, rowNum) => {
      row.eachCell((cell) => {
        const val = String(getCellValue(cell))
          .toUpperCase()
          .replace(/\s+/g, "");
        if (val.includes("PLT")) targetCols.plt = cell.col;
        if (val.includes("SKU")) targetCols.sku = cell.col;
        if (val.includes("상품명")) targetCols.name = cell.col;
        if (val.includes("바코드")) targetCols.barcode = cell.col;
        if (val.includes("LOT")) targetCols.lot = cell.col;
        if (val.includes("유통기한")) targetCols.expiry = cell.col;
        if (val.includes("수량")) targetCols.qty = cell.col;

        if (val.includes("셀러")) commonCells.seller = cell.address;
        if (val.includes("쇼핑몰")) commonCells.shop = cell.address;
        if (val.includes("입고예정일")) commonCells.date = cell.address;
      });
      if (targetCols.name && startDataRow === 3) startDataRow = rowNum + 1;
    });

    // 3️⃣ 셀러 파일에서 추출과 동시에 합산 (메모리 최적화)
    const aggregated = {};
    let sellerBarcodeCol = null;
    let sellerPltCol = null;

    // 셀러 파일 헤더 탐색
    sellerSheet.getRow(1).eachCell((cell) => {
      const val = String(getCellValue(cell)).replace(/\s+/g, "");
      if (val.includes("바코드")) sellerBarcodeCol = cell.col;
      if (val.includes("PLT")) sellerPltCol = cell.col;
    });

    for (let i = 2; i <= sellerSheet.rowCount; i++) {
      const row = sellerSheet.getRow(i);
      const name = getCellValue(row.getCell(columnMap.productName));
      if (!name || String(name).trim() === "") continue;

      const plt = sellerPltCol ? getCellValue(row.getCell(sellerPltCol)) : "";
      const sku = getCellValue(row.getCell(columnMap.sku));
      const lot = getCellValue(row.getCell(columnMap.lot));
      const expiry = getCellValue(row.getCell(columnMap.expiry));
      const qty = Number(getCellValue(row.getCell(columnMap.qty))) || 0;
      let barcode = sellerBarcodeCol
        ? String(getCellValue(row.getCell(sellerBarcodeCol)))
        : "";
      if (barcode.length > 4) barcode = barcode.slice(-4);

      // 합산 키 (PLT, SKU, 상품명, LOT, 유통기한 기준)
      const key = `${plt}|${sku}|${name}|${lot}|${expiry}`;
      if (!aggregated[key]) {
        aggregated[key] = { plt, sku, name, barcode, lot, expiry, qty };
      } else {
        aggregated[key].qty += qty;
      }
    }

    // [중요] aggregated 객체를 배열로 변환
    const finalRows = Object.values(aggregated);

    // 4️⃣ 양식 시트 작업
    // (1) 공통 정보 입력
    if (commonCells.seller)
      verifySheet.getCell(commonCells.seller).value = `${sellerName || ""}`;
    if (commonCells.shop)
      verifySheet.getCell(commonCells.shop).value = `${shopName || ""}`;
    if (commonCells.date)
      verifySheet.getCell(commonCells.date).value = `${dateValue || ""}`;

    // (2) 기존 데이터 영역 초기화 (메모리 효율적 방식)
    const currentLastRow = verifySheet.actualRowCount;
    for (
      let i = startDataRow;
      i <= Math.max(currentLastRow, startDataRow + 500);
      i++
    ) {
      const row = verifySheet.getRow(i);
      row.values = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {};
      });
    }

    // [추가] 헤더 행에서 마지막으로 데이터가 있는 열 찾기
    let lastHeaderCol = 1;
    const headerRow = verifySheet.getRow(startDataRow - 1); // 데이터 시작행 바로 위가 헤더행
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.col > lastHeaderCol) lastHeaderCol = cell.col;
    });

    // (3) 데이터 입력 및 테두리 설정
    finalRows.forEach((data, idx) => {
      const r = startDataRow + idx;
      const row = verifySheet.getRow(r);
      row.height = 20;

      // 데이터 입력 (기존 로직)
      if (targetCols.plt) row.getCell(targetCols.plt).value = data.plt;
      if (targetCols.sku) row.getCell(targetCols.sku).value = data.sku;
      if (targetCols.name) row.getCell(targetCols.name).value = data.name;
      if (targetCols.barcode)
        row.getCell(targetCols.barcode).value = data.barcode;
      if (targetCols.lot) row.getCell(targetCols.lot).value = data.lot;
      if (targetCols.expiry) row.getCell(targetCols.expiry).value = data.expiry;
      if (targetCols.qty) row.getCell(targetCols.qty).value = data.qty;

      // [수정된 테두리 로직] A열(1)부터 헤더 끝 열(lastHeaderCol)까지 전체 테두리
      for (let colIdx = 1; colIdx <= lastHeaderCol; colIdx++) {
        row.getCell(colIdx).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });

    // 5️⃣ 최종 파일 저장
    // [추가] 오늘 날짜 생성 (YYYY-MM-DD 형식)
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

// 2. '선택' 및 공백 체크 함수 (유효하지 않으면 null 반환)
    const getValidValue = (val) => {
      if (!val || String(val).trim() === "" || String(val).trim() === "선택") {
        return null;
      }
      return String(val).trim().replace(/[\/\\:*?"<>|]/g, "_"); // 파일명 안전 처리 포함
    };

// 3. 각 항목 유효성 검사
    const safeDate = (dateValue && dateValue.trim() !== "") ? dateValue.replace(/[\/\\:*?"<>|]/g, "-") : formattedToday;
    const safeSeller = getValidValue(sellerName);
    const safeShop = getValidValue(shopName);

    // 4. [핵심] 존재하지 않는 값은 제외하고 공백으로 이어붙이기
    // safeDate는 항상 존재(오늘 날짜라도), 나머지는 있을 때만 배열에 포함
    const nameParts = [safeDate, safeSeller, safeShop, "입고검수지"].filter(part => part !== null);
    
    // 결과 예시: ["2026-02-25", "마녀공장", "Qoo10", "입고검수지"].join(" ") 
    // -> "2026-02-25 마녀공장 Qoo10 입고검수지.xlsx"
    const defaultFileName = `${nameParts.join(" ")}.xlsx`;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "검수 완료 파일 저장",
      defaultPath: path.join(app.getPath("downloads"), defaultFileName),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: "저장이 취소되었습니다." };
    }
    await verifyWorkbook.xlsx.writeFile(filePath);
    return { ok: true, path: filePath };
    
  } catch (err) {
    console.error(err);
    return { ok: false, error: `작업 중 오류: ${err.message}` };
  }
});

ipcMain.handle('process-inbound-file', async (_, payload) => {
  try {
    const { 
      templatePath, // 사용자가 선택한 양식 경로 (없을 수 있음)
      sellerPath, 
      centerData, 
      columnMap 
    } = payload;

    const templateWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    // [내부 보조 함수] 셀 값 추출
    const getCellValue = (cell) => {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText) return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    };

    // [내부 보조 함수] 엑셀 로드
    const loadExcel = async (wb, p, isTemplate = false) => {
      if (!p && isTemplate) {
        const templateData = await db.getInboundExcelTemplate();
        if (!templateData || !templateData.buffer) throw new Error("등록된 양식이 없습니다.");
        await wb.xlsx.load(Buffer.from(templateData.buffer));
        return;
      }
      const ext = path.extname(p).toLowerCase();
      if (ext === '.xls') {
        const tempXls = XLSX.readFile(p);
        const buffer = XLSX.write(tempXls, { type: 'buffer', bookType: 'xlsx' });
        await wb.xlsx.load(buffer);
      } else {
        await wb.xlsx.readFile(p);
      }
    };

    // 1️⃣ 파일 로드
    await loadExcel(templateWorkbook, templatePath, true);
    await loadExcel(sellerWorkbook, sellerPath);

    const targetSheet = templateWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets[0];

    // 2️⃣ "선택" 데이터 및 날짜 처리 로직 (파일명용)
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const getValidValue = (val) => {
      if (!val || String(val).trim() === "" || String(val).trim() === "선택") return null;
      return String(val).trim().replace(/[\/\\:*?"<>|]/g, "_");
    };

    const safeDate = (centerData.dateValue && centerData.dateValue.trim() !== "") 
      ? centerData.dateValue.replace(/[\/\\:*?"<>|]/g, "-") 
      : formattedToday;
    const safeRelease = getValidValue(centerData.releaseCenter);
    const safeShop = getValidValue(centerData.shopName);

    // 3️⃣ 양식 헤더 위치 및 끝 열 찾기
    const headerRow = targetSheet.getRow(1);
    let colMap = { release: null, inbound: null, type: null, date: null, shop: null };
    let lastHeaderCol = 11; // 기본값 K열

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = String(getCellValue(cell)).replace(/\s+/g, '');
      if (val.includes('셀러')) colMap.release = colNumber;
      if (val.includes('입고센터')) colMap.inbound = colNumber;
      if (val.includes('상품구분')) colMap.type = colNumber;
      if (val.includes('예정일')) colMap.date = colNumber;
      if (val.includes('쇼핑몰')) colMap.shop = colNumber;
      
      if (colNumber > lastHeaderCol) lastHeaderCol = colNumber;
    });

    // 4️⃣ 데이터 추출 및 합산 (메모리 최적화: 추출과 동시에 매핑 준비)
    const startRow = 2;
    const checkSelect = (val) => (val === '선택' ? '' : val);

    for (let i = 2; i <= sellerSheet.rowCount; i++) {
      const sRow = sellerSheet.getRow(i);
      const name = getCellValue(sRow.getCell(columnMap.productName));
      
      if (!name || String(name).trim() === '') continue;

      const targetRowNum = startRow + (targetSheet.actualRowCount - 1);
      const tRow = targetSheet.getRow(targetRowNum);

      // 핵심 데이터 매핑 (C, D, G, H, I 고정)
      tRow.getCell('C').value = getCellValue(sRow.getCell(columnMap.sku));
      tRow.getCell('D').value = name;
      tRow.getCell('G').value = getCellValue(sRow.getCell(columnMap.expiry));
      tRow.getCell('H').value = getCellValue(sRow.getCell(columnMap.lot));
      tRow.getCell('I').value = getCellValue(sRow.getCell(columnMap.qty));

      // 부가 정보 매핑 (찾은 헤더 기준)
      if (colMap.release) tRow.getCell(colMap.release).value = checkSelect(centerData.releaseCenter);
      if (colMap.inbound) tRow.getCell(colMap.inbound).value = checkSelect(centerData.inboundCenter);
      if (colMap.type) tRow.getCell(colMap.type).value = checkSelect(centerData.productType);
      if (colMap.shop) tRow.getCell(colMap.shop).value = checkSelect(centerData.shopName);
      if (colMap.date) tRow.getCell(colMap.date).value = centerData.dateValue || '';

      // 테두리 적용 (A열부터 마지막 헤더열까지)
      for (let c = 1; c <= lastHeaderCol; c++) {
        tRow.getCell(c).border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      }
    }

    // 5️⃣ 상품명(D열) 기준 역순 정리
    for (let i = targetSheet.rowCount; i >= startRow; i--) {
      const nameVal = getCellValue(targetSheet.getRow(i).getCell('D'));
      if (!nameVal || String(nameVal).trim() === '') {
        targetSheet.spliceRows(i, 1);
      }
    }

    // 6️⃣ 저장 대화상자 (요청하신 파일명 형식 적용)
    const nameParts = [safeDate, safeRelease, safeShop, "입고작업"].filter(part => part !== null);
    const defaultFileName = `${nameParts.join(" ")}.xlsx`;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '입고파일 저장',
      defaultPath: path.join(app.getPath('downloads'), defaultFileName),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, error: '저장이 취소되었습니다.' };

    await templateWorkbook.xlsx.writeFile(filePath);
    
    // Workbook 인스턴스 해제 보조
    templateWorkbook.worksheets.forEach(ws => templateWorkbook.removeWorksheet(ws.id));
    sellerWorkbook.worksheets.forEach(ws => sellerWorkbook.removeWorksheet(ws.id));

    return { ok: true, path: filePath };

  } catch (err){
    console.error("입고파일 작업 에러:", err);
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
