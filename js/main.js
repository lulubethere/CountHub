// Electron 모듈 가져오기
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path'); 
const db = require('./db.js'); 
const fs = require("fs"); 
const XLSX = require("xlsx"); 
const ExcelJS = require('exceljs');

// 윈도우 객체를 전역으로 유지 (가비지 컬렉션 방지)
let mainWindow;

// 윈도우 생성 함수 (WinForms의 new Form()과 비슷)
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,        // 윈도우 너비
    height: 900,       // 윈도우 높이
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // HTML 파일 로드 (WinForms의 디자이너와 비슷한 역할)
  mainWindow.loadFile('html/02 login.html');

  // 개발자 도구 열기 (선택사항 - 디버깅용)
  mainWindow.webContents.openDevTools();

  // 윈도우가 닫힐 때
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// DB 에러 메시지를 한글로 변환
function getDbErrorMessage(err) {
  const msg = (err && err.message) || '';
  if (msg.includes('does not exist') || msg.includes('relation')) {
    return '존재하지 않는 사용자 입니다.';
  }
  if (msg.includes('connection') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return '데이터베이스에 연결할 수 없습니다. 네트워크를 확인하세요.';
  }
  return msg || '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.';
}

// 로그인: 이름으로 사용자 조회
ipcMain.handle('login', async (_event, name) => {
  try {
    const user = await db.findUserByName(name);
    if (!user) return { ok: false, error: '등록된 이름이 아닙니다.' };
    const displayName = user.name ?? user.Name ?? name.trim();
    return { ok: true, user: { id: user.id, name: displayName } };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 셀러 목록 (CodeMaster parent_code=100)
ipcMain.handle('get-sellers', async () => {
  try {
    const rows = await db.getSellers();
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 상품구분 목록 (CodeMaster parent_code=200)
ipcMain.handle('get-product-types', async () => {
  try {
    const rows = await db.getProductTypes();
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 입고센터 목록 (CodeMaster parent_code=300)
ipcMain.handle('get-centers', async () => {
  try {
    const rows = await db.getCenters();
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 쇼핑몰 목록 (CodeMaster parent_code=400)
ipcMain.handle('get-shops', async () => {
  try {
    const rows = await db.getShops();
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 셀러별 컬럼 매핑 (SellerColumn + CodeMaster)
ipcMain.handle('get-seller-columns', async (_event, sellerCode) => {
  try {
    const rows = await db.getSellerColumns(sellerCode);
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: getDbErrorMessage(err) };
  }
});

// 앱이 준비되면 윈도우 생성 (WinForms의 Application.Run()과 비슷)
app.whenReady().then(createWindow);

// 모든 윈도우가 닫혔을 때
app.on('window-all-closed', function () {
  // macOS가 아니면 앱 종료
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱이 활성화될 때 (macOS용)
app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('process-verify-file', async (_, payload) => {
  try {
    const {
      verifyPath,
      sellerPath,
      sellerName,
      shopName,
      dateValue,
      columnMap
    } = payload;

if (!verifyPath || !sellerPath) {
  return { ok: false, error: '엑셀 파일을 찾을 수 없습니다.' };
}

if (!columnMap) {
  return { ok: false, error: '컬럼 매핑 정보가 없습니다.' };
}

if (!fs.existsSync(sellerPath)) {
  return { ok: false, error: 'seller 파일이 존재하지 않습니다.' };
}

if (!fs.existsSync(verifyPath)) {
  return { ok: false, error: 'verify 파일이 존재하지 않습니다.' };
}

    const verifyWorkbook = new ExcelJS.Workbook();
    await verifyWorkbook.xlsx.readFile(verifyPath);
    const verifySheet = verifyWorkbook.worksheets[0];

    const sellerWorkbook = new ExcelJS.Workbook();
    await sellerWorkbook.xlsx.readFile(sellerPath);
    const sellerSheet = sellerWorkbook.worksheets[0];

    // =========================
    // 1️⃣ 상단 값 입력 (서식 유지)
    // =========================
    verifySheet.getCell('A1').value = sellerName;
    verifySheet.getCell('B1').value = shopName;
    verifySheet.getCell('K1').value = dateValue;

    // =========================
    // 2️⃣ seller 데이터 읽기
    // =========================
    function getColumnData(colLetter) {
      const data = [];
      if (!colLetter) return data;

      const col = sellerSheet.getColumn(colLetter);
      col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber >= 2 && cell.value !== null && cell.value !== '') {
          data.push(cell.value);
        }
      });
      return data;
    }

    const skuData = getColumnData(columnMap.sku);
    const nameData = getColumnData(columnMap.productName);
    const expiryData = getColumnData(columnMap.expiry);
    const lotData = getColumnData(columnMap.lot);
    const qtyData = getColumnData(columnMap.qty);

    const maxLength = Math.max(
      skuData.length,
      nameData.length,
      expiryData.length,
      lotData.length,
      qtyData.length
    );

    // =========================
    // 3️⃣ verify에 붙여넣기
    // =========================
    for (let i = 0; i < maxLength; i++) {
      const rowIndex = 3 + i;

      verifySheet.getCell(`B${rowIndex}`).value = skuData[i] || '';
      verifySheet.getCell(`C${rowIndex}`).value = nameData[i] || '';
      verifySheet.getCell(`F${rowIndex}`).value = expiryData[i] || '';
      verifySheet.getCell(`G${rowIndex}`).value = lotData[i] || '';
      verifySheet.getCell(`H${rowIndex}`).value = qtyData[i] || '';
    }

    // =========================
    // 4️⃣ 새 파일로 저장 (원본 보호)
    // =========================
    const outputPath = path.join(
      path.dirname(verifyPath),
      `검수완료_${Date.now()}.xlsx`
    );

    await verifyWorkbook.xlsx.writeFile(outputPath);

    return { ok: true, path: outputPath };

  } catch (err) {
    console.error(err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
    ]
  });
 
  if (result.canceled || !result.filePaths.length) {
    return { ok: false };
  }

  return {
    ok: true,
    path: result.filePaths[0]
  };
});
