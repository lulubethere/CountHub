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

    // --- [수정된 부분] 엑셀 파일을 읽는 공통 함수 ---
    async function loadWorkbook(workbook, filePath) {
      const ext = path.extname(filePath).toLowerCase();

      if (ext === ".xls") {
        // .xls 파일인 경우 SheetJS로 읽어서 xlsx 버퍼로 변환
        const tempXls = XLSX.readFile(filePath);
        const buffer = XLSX.write(tempXls, {
          type: "buffer",
          bookType: "xlsx",
        });
        await workbook.xlsx.load(buffer);
      } else {
        // .xlsx 파일인 경우 기존 방식대로 읽기
        await workbook.xlsx.readFile(filePath);
      }
    }

    // 1️⃣ 입고검수파일 양식 로드
    if (verifyPath && verifyPath !== "") {
      await loadWorkbook(verifyWorkbook, verifyPath);
    } else {
      // ... (DB에서 가져오는 기존 로직 동일)
      const templateData = await db.getInboundCheckTemplate();
      // ... 생략 ...
      await verifyWorkbook.xlsx.load(templateData.buffer);
    }

    // 2️⃣ 셀러 데이터 파일 로드 (.xls 대응)
    await loadWorkbook(sellerWorkbook, sellerPath);

    const verifySheet = verifyWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets[0];

    if (!verifySheet || !sellerSheet) {
      return { ok: false, error: "엑셀 시트를 찾을 수 없습니다." };
    }

    // --- 데이터 처리 로직 (이전과 동일) ---
    // [보조 함수] getCellValue (수식 결과값 대응)
    function getCellValue(cell) {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText)
          return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    }

    // [함수] 포함 검색 데이터 추출 (PLT, 바코드)
    function getDataBySearchTerm(sheet, term, isBarcode = false) {
      let targetColNum = null;
      let headerRowNum = null;
      sheet.eachRow((row, rowNum) => {
        row.eachCell((cell) => {
          const cellVal = String(getCellValue(cell))
            .toUpperCase()
            .replace(/\s+/g, "");
          const searchText = term.toUpperCase().replace(/\s+/g, "");
          if (cellVal.includes(searchText)) {
            targetColNum = cell.address.match(/[A-Z]+/)[0];
            headerRowNum = rowNum;
          }
        });
        if (targetColNum) return false;
      });
      if (!targetColNum) return null;
      const data = [];
      for (let i = headerRowNum + 1; i <= sheet.rowCount; i++) {
        const cell = sheet.getRow(i).getCell(targetColNum);
        let val = String(getCellValue(cell));
        if (isBarcode && val.length > 4) val = val.slice(-4);
        data.push(val);
      }
      return data;
    }

    // [함수] 일반 컬럼 데이터 추출
    function getColumnData(sheet, colLetter) {
      if (!colLetter) return [];
      const data = [];
      for (let i = 2; i <= sheet.rowCount; i++) {
        const cell = sheet.getRow(i).getCell(colLetter);
        data.push(getCellValue(cell));
      }
      return data;
    }

    // 데이터 수집
    const skuData = getColumnData(sellerSheet, columnMap.sku);
    const nameData = getColumnData(sellerSheet, columnMap.productName);
    const expiryData = getColumnData(sellerSheet, columnMap.expiry);
    const lotData = getColumnData(sellerSheet, columnMap.lot);
    const qtyData = getColumnData(sellerSheet, columnMap.qty);
    const barcodeData = getDataBySearchTerm(sellerSheet, "바코드", true);
    const pltData = getDataBySearchTerm(sellerSheet, "PLT", false);

    const dataLength = Math.max(
      skuData.length,
      nameData.length,
      expiryData.length,
      lotData.length,
      qtyData.length,
      pltData ? pltData.length : 0,
      barcodeData ? barcodeData.length : 0,
    );

    const startRow = 3;
    const lastRow = startRow + dataLength - 1;

    verifySheet.getCell("A1").value = sellerName || "";
    verifySheet.getCell("B1").value = shopName || "";
    verifySheet.getCell("I1").value = dateValue || "";

    // 3️⃣ 데이터 입력, 테두리, 행 높이 설정
    for (let i = 0; i < dataLength; i++) {
      const r = startRow + i;
      verifySheet.getRow(r).height = 20;

      if (pltData && pltData[i] !== undefined)
        verifySheet.getCell(`A${r}`).value = pltData[i];
      verifySheet.getCell(`B${r}`).value = skuData[i] || "";
      verifySheet.getCell(`C${r}`).value = nameData[i] || "";
      verifySheet.getCell(`E${r}`).value = lotData[i] || "";
      verifySheet.getCell(`F${r}`).value = expiryData[i] || "";
      verifySheet.getCell(`G${r}`).value = qtyData[i] || "";
      if (barcodeData && barcodeData[i] !== undefined)
        verifySheet.getCell(`D${r}`).value = barcodeData[i];

      for (let col = 1; col <= 10; col++) {
        const cell = verifySheet.getRow(r).getCell(col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    // 3.5️⃣ 중복 행 합산 로직 추가 (A, B, C, E, F열 기준)
    const rowsToProcess = [];
    // 3행부터 데이터가 있는 마지막 행까지 수집
    for (let i = startRow; i <= lastRow; i++) {
      const row = verifySheet.getRow(i);
      rowsToProcess.push({
        rowNum: i,
        // 비교 키 생성 (A, B, C, E, F열 값을 합쳐서 고유 키 생성)
        key: ["A", "B", "C", "E", "F"]
          .map((col) => String(getCellValue(row.getCell(col))).trim())
          .join("|"),
        // G열 데이터를 숫자로 변환 (합산용)
        gValue: Number(getCellValue(row.getCell("G"))) || 0,
        // 전체 행 데이터 복사 (나중에 다시 그리기용)
        rowData: row.values,
      });
    }

    // 키를 기준으로 데이터 합산
    const aggregated = {};
    rowsToProcess.forEach((item) => {
      if (!aggregated[item.key]) {
        aggregated[item.key] = { ...item };
      } else {
        aggregated[item.key].gValue += item.gValue;
      }
    });

    // 기존 시트 데이터 영역 초기화 (3행부터)
    for (let i = startRow; i <= verifySheet.rowCount; i++) {
      verifySheet.getRow(i).values = [];
      verifySheet.getRow(i).border = {};
    }

    // 합산된 데이터를 시트에 다시 작성
    const finalData = Object.values(aggregated);
    finalData.forEach((item, index) => {
      const r = startRow + index;
      verifySheet.getRow(r).values = item.rowData; // 기존 데이터 복원
      verifySheet.getCell(`G${r}`).value = item.gValue; // 합산된 G열 값 입력

      // 테두리 다시 적용 (A~J열까지)
      for (let col = 1; col <= 10; col++) {
        const cell = verifySheet.getRow(r).getCell(col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });

    // 4️⃣ 행 정리: C열 데이터가 없거나 전체적으로 비어있는 행 제거
    // 밑에서부터 위로 올라가며 지워야 행 인덱스가 꼬이지 않습니다.
    const finalRowCount = verifySheet.rowCount;

    for (let i = finalRowCount; i >= startRow; i--) {
      const row = verifySheet.getRow(i);
      const cValue = getCellValue(row.getCell("C")); // 상품명 컬럼

      // 1. C열이 비어있는지 확인 (공백 제거 후 체크)
      const isCEmpty = !cValue || String(cValue).trim() === "";

      // 2. 해당 행에 데이터가 하나라도 있는지 확인 (A~M열 조사)
      let hasAnyData = false;
      for (let col = 1; col <= 13; col++) {
        const val = getCellValue(row.getCell(col));
        if (val && String(val).trim() !== "") {
          hasAnyData = true;
          break;
        }
      }

      // 조건: C열이 비어있는데 다른 데이터가 있거나, 아예 데이터가 없는 행 삭제
      if (isCEmpty || !hasAnyData) {
        // ExcelJS에서 spliceRows(시작행, 개수)는 실제 행을 밀어올리며 삭제합니다.
        verifySheet.spliceRows(i, 1);
      }
    }

    // 5️⃣ 최종 파일 저장
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "검수 완료 파일 저장",
      defaultPath: path.join(
        app.getPath("downloads"),
        `검수완료_${Date.now()}.xlsx`,
      ),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath)
      return { ok: false, error: "저장이 취소되었습니다." };
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

    // [내부 보조 함수] 셀 값 추출 (수식 및 리치텍스트 대응)
    const getCellValue = (cell) => {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText) return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    };

    // [내부 보조 함수] 엑셀 로드 (.xls / .xlsx 공통)
    const loadExcel = async (wb, p, isTemplate = false) => {
      if (!p && isTemplate) {
        // 경로가 없는데 양식 로드인 경우 DB에서 가져옴
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

    // 2️⃣ 셀러 데이터 추출
    function getColumnData(sheet, colLetter) {
      if (!colLetter) return [];
      const data = [];
      // 2행부터 마지막행까지 추출
      for (let i = 2; i <= sheet.rowCount; i++) {
        data.push(getCellValue(sheet.getRow(i).getCell(colLetter)));
      }
      return data;
    }

    const skuData = getColumnData(sellerSheet, columnMap.sku);
    const nameData = getColumnData(sellerSheet, columnMap.productName);
    const expiryData = getColumnData(sellerSheet, columnMap.expiry);
    const lotData = getColumnData(sellerSheet, columnMap.lot);
    const qtyData = getColumnData(sellerSheet, columnMap.qty);

    const startRow = 2;

// 3️⃣ [로직 보강] 대상 양식 헤더 위치 찾기
    const headers = targetSheet.getRow(1);
    let colMap = { release: null, inbound: null, type: null, date: null, shop: null };

    headers.eachCell((cell, colNumber) => {
      const val = String(getCellValue(cell)).replace(/\s+/g, ''); // 공백 제거
      
      // 포함 관계를 통해 더 유연하게 매핑
      if (val.includes('출고센터')) colMap.release = colNumber;
      if (val.includes('입고센터')) colMap.inbound = colNumber;
      if (val.includes('상품구분')) colMap.type = colNumber;
      if (val.includes('예정일')) colMap.date = colNumber;
      if (val.includes('쇼핑몰')) colMap.shop = colNumber;
    });

    // 4️⃣ 데이터 매핑 및 붙여넣기
    for (let i = 0; i < nameData.length; i++) {
      const r = startRow + i;
      const row = targetSheet.getRow(r);

      // (1~5) 핵심 5가지 데이터 입력
      row.getCell('C').value = skuData[i] || '';
      row.getCell('D').value = nameData[i] || '';
      row.getCell('G').value = expiryData[i] || '';
      row.getCell('H').value = lotData[i] || '';
      row.getCell('I').value = qtyData[i] || '';

      // 상품명이 있는 경우에만 부가 정보 입력 및 테두리 설정
      if (nameData[i] && String(nameData[i]).trim() !== '') {
        const checkSelect = (val) => (val === '선택' ? '' : val);

        if (colMap.release) row.getCell(colMap.release).value = checkSelect(centerData.releaseCenter);
        if (colMap.inbound) row.getCell(colMap.inbound).value = checkSelect(centerData.inboundCenter);
        if (colMap.type) row.getCell(colMap.type).value = checkSelect(centerData.productType);
        if (colMap.shop) row.getCell(colMap.shop).value = checkSelect(centerData.shopName);
        if (colMap.date) row.getCell(colMap.date).value = centerData.dateValue || '';

        // (8) A~K열(1~11번 열) 테두리 작업
        for (let c = 1; c <= 11; c++) {
          row.getCell(c).border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        }
      }
    }

    // 5️⃣ (9) 상품명(D열)이 없는 행 삭제 (역순 처리)
    for (let i = targetSheet.rowCount; i >= startRow; i--) {
      const nameVal = getCellValue(targetSheet.getRow(i).getCell('D'));
      if (!nameVal || String(nameVal).trim() === '') {
        targetSheet.spliceRows(i, 1);
      }
    }

    // 6️⃣ 저장 대화상자
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '입고파일 저장',
      defaultPath: path.join(app.getPath('downloads'), `입고작업_${Date.now()}.xlsx`),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, error: '저장이 취소되었습니다.' };
    await templateWorkbook.xlsx.writeFile(filePath);
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
