function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  document.querySelector('.nav-theme').textContent = next === 'dark' ? '☀' : '🌙';
}

// Init theme from OS preference
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.querySelector('.nav-theme').textContent = '☀';
} else {
  document.querySelector('.nav-theme').textContent = '🌙';
}
