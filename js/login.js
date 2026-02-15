const { ipcRenderer } = require('electron');

const STORAGE_AUTO_LOGIN = 'countHubAutoLogin';
const STORAGE_AUTO_LOGIN_NAME = 'countHubAutoLoginName';

const loginForm = document.getElementById('login-form');
const loginName = document.getElementById('login-name');
const loginAuto = document.getElementById('login-auto');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

function loadAutoLogin() {
  try {
    const enabled = localStorage.getItem(STORAGE_AUTO_LOGIN) === 'true';
    const name = localStorage.getItem(STORAGE_AUTO_LOGIN_NAME) || '';
    if (enabled && name) {
      loginName.value = name;
      loginAuto.checked = true;
      return true;
    }
  } catch (_) {}
  return false;
}

async function doLogin(name) {
  loginError.textContent = '';
  loginBtn.disabled = true;
  try {
    const result = await ipcRenderer.invoke('login', name);
    if (result.ok) {
      const user = result.user;
      try {
        localStorage.setItem('countHubUser', JSON.stringify({ id: user.id, name: user.name }));
        if (loginAuto.checked) {
          localStorage.setItem(STORAGE_AUTO_LOGIN, 'true');
          localStorage.setItem(STORAGE_AUTO_LOGIN_NAME, name);
        } else {
          localStorage.removeItem(STORAGE_AUTO_LOGIN);
          localStorage.removeItem(STORAGE_AUTO_LOGIN_NAME);
        }
      } catch (_) {}
      window.location.href = '03 main.html';
    } else {
      loginError.textContent = result.error || '로그인에 실패했습니다.';
    }
  } catch (err) {
    loginError.textContent = err.message || '오류가 발생했습니다.';
  } finally {
    loginBtn.disabled = false;
  }
}

if (loadAutoLogin()) {
  doLogin(loginName.value.trim());
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = loginName.value.trim();
  if (!name) {
    loginError.textContent = '이름을 입력하세요.';
    return;
  }
  await doLogin(name);
});
