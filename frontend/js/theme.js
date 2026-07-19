(function () {
  const THEME_KEY   = 'rs-theme';
  const SIDEBAR_KEY = 'rs-sidebar-collapsed';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
      btn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    });
  }

  function applySidebar(collapsed) {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  }

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  window.toggleSidebar = function () {
    const collapsed = !document.documentElement.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    applySidebar(collapsed);
  };

  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  applySidebar(localStorage.getItem(SIDEBAR_KEY) === '1');
})();
