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
  currentUserEl.textContent = user.name ? `${user.name} 님` : '';

  document.getElementById('inbound-btn').addEventListener('click', () => {
    window.location.href = 'inbound.html';
  });
  document.getElementById('outbound-btn').addEventListener('click', () => {
    window.location.href = 'outbound.html';
  });
})();
