(function () {
  const STORAGE_KEY = 'rs-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
      btn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    });
  }

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const saved = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(saved);
})();
