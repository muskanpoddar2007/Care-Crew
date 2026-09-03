// Dark/light mode, applied via [data-theme] on <html>. Persisted per-browser.
(function () {
  const STORAGE_KEY = "carecrew-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) toggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(saved || preferred);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  window.CareCrewTheme = { initTheme, toggleTheme };
})();
