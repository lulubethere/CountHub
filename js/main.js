const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path'); 
const db = require('./db.js'); 
const fs = require("fs"); 
const ExcelJS = require('exceljs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('html/02 login.html');
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC 핸들러 (DB 목록 로직) ---
ipcMain.handle('login', async (_, name) => {
  try {
    const user = await db.findUserByName(name);
    if (!user) return { ok: false, error: '등록된 이름이 아닙니다.' };
    return { ok: true, user: { id: user.id, name: user.username } };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('get-sellers', async () => { try { return { ok: true, data: await db.getSellers() }; } catch (e) { return { ok: false }; } });
ipcMain.handle('get-product-types', async () => { try { return { ok: true, data: await db.getProductTypes() }; } catch (e) { return { ok: false }; } });
ipcMain.handle('get-centers', async () => { try { return { ok: true, data: await db.getCenters() }; } catch (e) { return { ok: false }; } });
ipcMain.handle('get-shops', async () => { try { return { ok: true, data: await db.getShops() }; } catch (e) { return { ok: false }; } });
ipcMain.handle('get-seller-columns', async (_, code) => { try { return { ok: true, data: await db.getSellerColumns(code) }; } catch (e) { return { ok: false }; } });

ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  });
  return result.canceled ? { ok: false } : { ok: true, path: result.filePaths[0] };
});


// [추가] DB에서 양식을 가져오는 핸들러
ipcMain.handle('load-verify-template', async () => {
  try {
    const buffer = await db.getVerifyTemplate();
    if (!buffer) return { ok: false, error: 'DB에 등록된 양식이 없습니다.' };
    
    // 이 buffer를 직접 넘기기보다, process 시점에서 사용하거나 
    // 임시 파일로 저장 후 경로를 반환할 수 있습니다.
    return { ok: true, data: buffer }; 
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 입고검수파일양식 체크 (id = 1)
ipcMain.handle('check-default-template', async () => {
  try {
    const templateData = await db.getInboundCheckTemplate();
    if (templateData && templateData.buffer) {
      console.log(`기본 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: 'DB에 등록된 양식이 없습니다.' };
  } catch (err) {
    console.error("양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// 입고파일양식 체크 (id = 2)
ipcMain.handle('check-inbound-template', async () => {
  try {
    const templateData = await db.getInboundExcelTemplate();
    if (templateData && templateData.buffer) {
      console.log(`입고파일 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: 'DB에 등록된 양식이 없습니다.' };
  } catch (err) {
    console.error("입고파일 양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// ... 상단 선언부 및 DB 핸들러 동일 ...
ipcMain.handle('process-verify-file', async (_, payload) => {
  try {
    const { verifyPath, sellerPath, sellerName, shopName, dateValue, columnMap } = payload;

    const verifyWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    // 1️⃣ 입고검수파일 양식 로드 (파일 선택 vs DB 기본값)
    if (verifyPath && verifyPath !== "") {
      // 사용자가 직접 파일을 선택한 경우 경로로 읽기
      await verifyWorkbook.xlsx.readFile(verifyPath).catch((e) => {
        if (!e.message.includes("company")) throw e;
      });
    } else {
      const templateData = await db.getInboundCheckTemplate();

      if (!templateData) {
        console.error("DB에서 templateData를 받지 못함");
        return { ok: false, error: "DB에 데이터가 없습니다." };
      }

      if (!Buffer.isBuffer(templateData.buffer)) {
        console.error(
          "데이터가 Buffer 형식이 아닙니다. 현재 타입:",
          typeof templateData.buffer,
        );
        // 만약 Supabase/Postgres 설정에 따라 Uint8Array로 올 수도 있음 -> Buffer로 변환 필요
        templateData.buffer = Buffer.from(templateData.buffer);
      }

      try {
        await verifyWorkbook.xlsx.load(templateData.buffer);
        console.log("ExcelJS: DB 양식 로드 성공!");
      } catch (loadError) {
        console.error("ExcelJS 로드 실패:", loadError);
        return {
          ok: false,
          error: "엑셀 양식 해석 실패: " + loadError.message,
        };
      }
    }

    // 2️⃣ 셀러 데이터 파일 로드 (첫 번째 시트 고정)
    await sellerWorkbook.xlsx.readFile(sellerPath).catch(e => { if(!e.message.includes('company')) throw e; });

    const verifySheet = verifyWorkbook.worksheets[0]; 
    const sellerSheet = sellerWorkbook.worksheets[0];

    if (!verifySheet || !sellerSheet) {
      return { ok: false, error: '엑셀 시트를 찾을 수 없습니다.' };
    }

    // --- 데이터 처리 로직 (이전과 동일) ---
    // [보조 함수] getCellValue (수식 결과값 대응)
    function getCellValue(cell) {
      if (!cell || cell.value === null || cell.value === undefined) return '';
      if (typeof cell.value === 'object' && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText) return cell.value.richText.map(t => t.text).join('');
      }
      return cell.value;
    }

    // [함수] 포함 검색 데이터 추출 (PLT, 바코드)
    function getDataBySearchTerm(sheet, term, isBarcode = false) {
      let targetColNum = null;
      let headerRowNum = null;
      sheet.eachRow((row, rowNum) => {
        row.eachCell((cell) => {
          const cellVal = String(getCellValue(cell)).toUpperCase().replace(/\s+/g, '');
          const searchText = term.toUpperCase().replace(/\s+/g, '');
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
      for(let i = 2; i <= sheet.rowCount; i++) {
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
    const barcodeData = getDataBySearchTerm(sellerSheet, '바코드', true);
    const pltData = getDataBySearchTerm(sellerSheet, 'PLT', false);

    const dataLength = Math.max(
      skuData.length, nameData.length, expiryData.length, lotData.length, qtyData.length,
      (pltData ? pltData.length : 0), (barcodeData ? barcodeData.length : 0)
    );

    const startRow = 3;
    const lastRow = startRow + dataLength - 1;

    verifySheet.getCell('A1').value = sellerName || '';
    verifySheet.getCell('B1').value = shopName || '';
    verifySheet.getCell('M1').value = dateValue || '';

    // 3️⃣ 데이터 입력, 테두리, 행 높이 설정
    for (let i = 0; i < dataLength; i++) {
      const r = startRow + i;
      verifySheet.getRow(r).height = 20;

      if (pltData && pltData[i] !== undefined) verifySheet.getCell(`A${r}`).value = pltData[i];
      verifySheet.getCell(`B${r}`).value = skuData[i] || '';
      verifySheet.getCell(`C${r}`).value = nameData[i] || '';
      verifySheet.getCell(`I${r}`).value = lotData[i] || '';
      verifySheet.getCell(`J${r}`).value = expiryData[i] || '';
      verifySheet.getCell(`K${r}`).value = qtyData[i] || '';
      if (barcodeData && barcodeData[i] !== undefined) verifySheet.getCell(`H${r}`).value = barcodeData[i];

      for (let col = 1; col <= 13; col++) {
        const cell = verifySheet.getRow(r).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // 4️⃣ 마지막 행 아래 청소
    const totalRowsInSheet = verifySheet.rowCount;
    if (totalRowsInSheet > lastRow) {
      for (let i = lastRow + 1; i <= totalRowsInSheet; i++) {
        verifySheet.getRow(i).values = [];
        verifySheet.getRow(i).border = {};
      }
    }

    // 5️⃣ 최종 파일 저장
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '검수 완료 파일 저장',
      defaultPath: path.join(app.getPath('downloads'), `검수완료_${Date.now()}.xlsx`),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, error: '저장이 취소되었습니다.' };
    await verifyWorkbook.xlsx.writeFile(filePath);
    return { ok: true, path: filePath };

  } catch (err) {
    console.error(err);
    return { ok: false, error: `작업 중 오류: ${err.message}` };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });