const { ipcRenderer } = require('electron');

const loginForm = document.getElementById('login-form');
const loginName = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

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
      const user = result.user;
      try {
        localStorage.setItem('countHubUser', JSON.stringify({ id: user.id, name: user.name }));
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
});
