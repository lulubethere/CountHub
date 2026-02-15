const { ipcRenderer } = require('electron');

const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginName = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const currentUserEl = document.getElementById('current-user');

function showLogin() {
  loginScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
  loginError.textContent = '';
  loginName.value = '';
}

function showMain(user) {
  loginScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  const name = user && (user.name ?? user.Name);
  currentUserEl.textContent = name ? `${name}님` : '';
}

// 로그인 폼 제출
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = loginName.value.trim();
  if (!name) {
    loginError.textContent = '이름을 입력하세요.';
    return;
  }
  loginError.textContent = '';
  loginBtn.disabled = true;
  try {
    const result = await ipcRenderer.invoke('login', name);
    if (result.ok) {
      showMain(result.user);
      initMainScreen();
    } else {
      loginError.textContent = result.error || '로그인에 실패했습니다.';
    }
  } catch (err) {
    loginError.textContent = err.message || '오류가 발생했습니다.';
  } finally {
    loginBtn.disabled = false;
  }
});

// 메인 화면 초기화 (기존 버튼/클릭 로직)
function initMainScreen() {
  const button = document.getElementById('myButton');
  const resultDiv = document.getElementById('result');
  if (!button || !resultDiv) return;

  let clickCount = 0;
  resultDiv.innerHTML = '<p>버튼을 클릭해보세요!</p>';

  button.addEventListener('click', function () {
    clickCount++;
    resultDiv.innerHTML = `<p>버튼을 <strong>${clickCount}</strong>번 클릭했습니다!</p>`;
    console.log(`클릭 횟수: ${clickCount}`);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  showLogin();
});
