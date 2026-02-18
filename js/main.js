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
  // mainWindow.webContents.openDevTools(); // 디버깅이 필요하면 주석 해제
  mainWindow.on('closed', () => { mainWindow = null; });
}

// DB 에러 메시지 처리
function getDbErrorMessage(err) {
  const msg = (err && err.message) || '';
  if (msg.includes('connection')) return '데이터베이스 연결에 실패했습니다.';
  return msg || '오류가 발생했습니다.';
}

// --- IPC 핸들러 ---

ipcMain.handle('login', async (_, name) => {
  try {
    const user = await db.findUserByName(name);
    if (!user) return { ok: false, error: '등록된 이름이 아닙니다.' };
    return { ok: true, user: { id: user.id, name: user.username } };
  } catch (err) { return { ok: false, error: getDbErrorMessage(err) }; }
});

// 공통 목록 호출 핸들러들
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

// 입고검수파일 작업 실행
// ... 상단 선언부 동일 ...

ipcMain.handle('process-verify-file', async (_, payload) => {
  try {
    const { verifyPath, sellerPath, sellerName, shopName, dateValue, columnMap } = payload;

    // 1. 파일 존재 여부 재확인
    if (!fs.existsSync(sellerPath) || !fs.existsSync(verifyPath)) {
      return { ok: false, error: '선택하신 엑셀 파일을 찾을 수 없습니다.' };
    }

    const verifyWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    // 2. 파일 로드 (회사 속성 오류 무시 옵션 유지)
    await verifyWorkbook.xlsx.readFile(verifyPath).catch(e => { if(!e.message.includes('company')) throw e; });
    await sellerWorkbook.xlsx.readFile(sellerPath).catch(e => { if(!e.message.includes('company')) throw e; });

    // 3. [핵심] 시트 찾기 로직 강화
    // 시트가 여러 개일 수 있으므로, 이름이 있든 없든 첫 번째 활성 시트를 가져옵니다.
    const verifySheet = verifyWorkbook.worksheets.find(s => s.state === 'visible') || verifyWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets.find(s => s.state === 'visible') || sellerWorkbook.worksheets[0];

    if (!verifySheet) return { ok: false, error: '검수 양식 파일에서 시트를 찾을 수 없습니다.' };
    if (!sellerSheet) return { ok: false, error: '셀러 엑셀 파일에서 시트를 찾을 수 없습니다.' };

    // 4. 데이터 입력 시작 (이후 로직은 동일)
    verifySheet.getCell('A1').value = sellerName || '';
    verifySheet.getCell('B1').value = shopName || '';
    verifySheet.getCell('K1').value = dateValue || '';

    function getColumnData(sheet, colLetter) {
      if (!colLetter) return [];
      const data = [];
      const col = sheet.getColumn(colLetter);
      if (col) {
        col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          // 1행(헤더) 제외하고 데이터 수집
          if (rowNumber >= 2 && cell.value !== null && cell.value !== undefined) {
            // 셀이 수식이나 객체일 경우 처리
            const val = (cell.value && typeof cell.value === 'object') ? cell.value.result : cell.value;
            data.push(val);
          }
        });
      }
      return data;
    }

    const skuData = getColumnData(sellerSheet, columnMap.sku);
    const nameData = getColumnData(sellerSheet, columnMap.productName);
    const expiryData = getColumnData(sellerSheet, columnMap.expiry);
    const lotData = getColumnData(sellerSheet, columnMap.lot);
    const qtyData = getColumnData(sellerSheet, columnMap.qty);

    const maxLength = Math.max(skuData.length, nameData.length, expiryData.length, lotData.length, qtyData.length);

    if (maxLength === 0) return { ok: false, error: '셀러 파일에서 읽어온 데이터가 0건입니다. 컬럼 알파벳 설정을 확인해주세요.' };

    for (let i = 0; i < maxLength; i++) {
      const r = 3 + i;
      verifySheet.getCell(`B${r}`).value = skuData[i] || '';
      verifySheet.getCell(`C${r}`).value = nameData[i] || '';
      verifySheet.getCell(`F${r}`).value = expiryData[i] || '';
      verifySheet.getCell(`G${r}`).value = lotData[i] || '';
      verifySheet.getCell(`H${r}`).value = qtyData[i] || '';
    }

    // 5. 저장 대화상자
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '결과 파일 저장',
      defaultPath: path.join(app.getPath('downloads'), `검수완료_${Date.now()}.xlsx`),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { ok: false, error: '저장이 취소되었습니다.' };

    await verifyWorkbook.xlsx.writeFile(filePath);
    return { ok: true, path: filePath };

  } catch (err) {
    console.error("상세 에러:", err);
    return { ok: false, error: `작업 중 오류: ${err.message}` };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });