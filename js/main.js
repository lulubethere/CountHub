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

// --- 입고검수파일 작업 실행 (첫 번째 시트 기준) ---
ipcMain.handle('process-verify-file', async (_, payload) => {
  try {
    const { verifyPath, sellerPath, sellerName, shopName, dateValue, columnMap } = payload;

    const verifyWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    await verifyWorkbook.xlsx.readFile(verifyPath).catch(e => { if(!e.message.includes('company')) throw e; });
    await sellerWorkbook.xlsx.readFile(sellerPath).catch(e => { if(!e.message.includes('company')) throw e; });

    // [수정] 무조건 첫 번째(맨 왼쪽) 시트를 가져옵니다.
    const verifySheet = verifyWorkbook.worksheets[0]; 
    const sellerSheet = sellerWorkbook.worksheets[0];

    if (!verifySheet || !sellerSheet) {
      return { ok: false, error: '엑셀 시트를 찾을 수 없습니다.' };
    }

    console.log(`사용 중인 셀러 시트 이름: ${sellerSheet.name}`);

    // 1️⃣ 상단 공통 정보 입력
    verifySheet.getCell('A1').value = sellerName || '';
    verifySheet.getCell('B1').value = shopName || '';
    verifySheet.getCell('N1').value = dateValue || '';

    // [함수] 포함 검색 데이터 추출 (바코드, PLT 등)
    function getDataBySearchTerm(sheet, term, isBarcode = false) {
      let targetColNum = null;
      let headerRowNum = null;

      sheet.eachRow((row, rowNum) => {
        row.eachCell((cell) => {
          if (cell.value) {
            const cellText = String(cell.value).toUpperCase().replace(/\s+/g, '');
            const searchText = term.toUpperCase().replace(/\s+/g, '');
            if (cellText.includes(searchText)) {
              targetColNum = cell.address.match(/[A-Z]+/)[0];
              headerRowNum = rowNum;
            }
          }
        });
        if (targetColNum) return false;
      });

      if (!targetColNum) return null;

      const data = [];
      for (let i = headerRowNum + 1; i <= sheet.rowCount; i++) {
        const cell = sheet.getRow(i).getCell(targetColNum);
        let val = '';
        if (cell.value !== null && cell.value !== undefined) {
          val = (cell.value && typeof cell.value === 'object') ? String(cell.value.result || '') : String(cell.value);
          if (isBarcode && val.length > 4) val = val.slice(-4);
        }
        data.push(val);
      }
      return data;
    }

    // [함수] 고정 컬럼 데이터 추출 (SKU, 상품명 등)
    function getColumnData(sheet, colLetter) {
      if (!colLetter) return [];
      const data = [];
      for(let i = 2; i <= sheet.rowCount; i++) {
        const cell = sheet.getRow(i).getCell(colLetter);
        const val = (cell.value && typeof cell.value === 'object') ? cell.value.result : cell.value;
        data.push(val !== null && val !== undefined ? val : '');
      }
      return data;
    }

    // 데이터 추출
    const skuData = getColumnData(sellerSheet, columnMap.sku);
    const nameData = getColumnData(sellerSheet, columnMap.productName);
    const expiryData = getColumnData(sellerSheet, columnMap.expiry);
    const lotData = getColumnData(sellerSheet, columnMap.lot);
    const qtyData = getColumnData(sellerSheet, columnMap.qty);
    
    const barcodeData = getDataBySearchTerm(sellerSheet, '바코드', true);
    const pltData = getDataBySearchTerm(sellerSheet, 'PLT', false);

    const maxLength = Math.max(
      skuData.length, nameData.length, expiryData.length, lotData.length, qtyData.length,
      (pltData ? pltData.length : 0), (barcodeData ? barcodeData.length : 0)
    );

    // 2️⃣ 리스트 데이터 입력
    for (let i = 0; i < maxLength; i++) {
      const r = 3 + i;
      
      // PLT (A열)
      if (pltData && pltData[i] !== undefined) {
        verifySheet.getCell(`A${r}`).value = pltData[i];
      }

      verifySheet.getCell(`B${r}`).value = skuData[i] || '';     // SKU (B열)
      verifySheet.getCell(`C${r}`).value = nameData[i] || '';    // 상품명 (C열)
      verifySheet.getCell(`I${r}`).value = lotData[i] || '';     // LOT (I열)
      verifySheet.getCell(`J${r}`).value = expiryData[i] || '';  // 유통기한 (J열)
      verifySheet.getCell(`K${r}`).value = qtyData[i] || '';     // 수량 (K열)
      
      // 바코드 뒤 4자리 (H열)
      if (barcodeData && barcodeData[i] !== undefined) {
        verifySheet.getCell(`H${r}`).value = barcodeData[i];
      }
    }

    // 3️⃣ 저장
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