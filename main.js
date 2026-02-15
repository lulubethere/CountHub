// Electron 모듈 가져오기
const { app, BrowserWindow } = require('electron');
const path = require('path');

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
  mainWindow.loadFile('index.html');

  // 개발자 도구 열기 (선택사항 - 디버깅용)
  mainWindow.webContents.openDevTools();

  // 윈도우가 닫힐 때
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

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