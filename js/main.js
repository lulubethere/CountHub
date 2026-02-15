// Electron 모듈 가져오기
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db.js');

// 윈도우 객체를 전역으로 유지 (가비지 컬렉션 방지)
let mainWindow;

// 윈도우 생성 함수 (WinForms의 new Form()과 비슷)
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,        // 윈도우 너비
    height: 1000,       // 윈도우 높이
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
