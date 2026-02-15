(function () {
  const container = document.getElementById('app-header');
  if (!container) return;

  fetch('partials/header.html')
    .then(function (res) { return res.text(); })
    .then(function (html) {
      container.innerHTML = html;
      var titleEl = document.getElementById('header-title');
      var userEl = document.getElementById('current-user');
      if (titleEl) {
        titleEl.textContent = 'CountHub';
        titleEl.addEventListener('click', function () {
          window.location.href = '03 main.html';
        });
      }
      if (userEl) {
        var user = null;
        try {
          var raw = localStorage.getItem('countHubUser');
          user = raw ? JSON.parse(raw) : null;
        } catch (_) {}
        userEl.textContent = user && user.name ? user.name + ' 님' : '';
      }
      var logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          try {
            localStorage.removeItem('countHubUser');
            localStorage.removeItem('countHubAutoLogin');
            localStorage.removeItem('countHubAutoLoginName');
          } catch (_) {}
          window.location.href = '02 login.html';
        });
      }
      document.dispatchEvent(new CustomEvent('header-ready'));
    })
    .catch(function () {
      document.dispatchEvent(new CustomEvent('header-ready'));
    });
})();
