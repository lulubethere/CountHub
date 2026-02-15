(function () {
  let user;
  try {
    const raw = localStorage.getItem('countHubUser');
    user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    user = null;
  }
  if (!user || !user.name) {
    window.location.href = 'login.html';
    return;
  }

  const currentUserEl = document.getElementById('current-user');
  if (currentUserEl) currentUserEl.textContent = `${user.name} 님`;

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'main.html';
  });
})();
