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

document.addEventListener("DOMContentLoaded", function () {

  const input = document.getElementById("dateInput");
  const error = document.getElementById("dateError");

  if (!input) return;

  function convertDate() {

    const raw = input.value.replace(/\D/g, "");

    if (raw.length !== 8) return;

    const y = parseInt(raw.slice(0, 4));
    const m = parseInt(raw.slice(4, 6));
    const d = parseInt(raw.slice(6, 8));

    const date = new Date(y, m - 1, d);

    const isValid =
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d;

    if (!isValid) {
      error.style.display = "block";
      input.value = "";
      input.focus();
      return;
    }

    error.style.display = "none";

    input.value =
      y + "-" +
      String(m).padStart(2, "0") + "-" +
      String(d).padStart(2, "0");
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      convertDate();
    }
  });

  input.addEventListener("blur", convertDate);

});

})();
