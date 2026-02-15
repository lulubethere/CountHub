(function () {
  let user;
  try {
    const raw = localStorage.getItem('countHubUser');
    user = raw ? JSON.parse(raw) : null;
  } catch (_) {
    user = null;
  }
  if (!user || !user.name) {
    window.location.href = '02 login.html';
    return;
  }

  document.getElementById('inbound-btn').addEventListener('click', () => {
    window.location.href = '04-01 inbound.html';
  });
  document.getElementById('outbound-btn').addEventListener('click', () => {
    window.location.href = '04-02 outbound.html';
  });
})();
