function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  document.querySelector('.nav-theme').textContent = next === 'dark' ? '☀' : '🌙';
}

// Always start in dark mode
document.querySelector('.nav-theme').textContent = '☀';
