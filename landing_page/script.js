function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  document.querySelector('.nav-theme').textContent = next === 'dark' ? '☀' : '🌙';
}

// Dark mode by default; light only if user explicitly prefers it
if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  document.documentElement.setAttribute('data-theme', 'light');
  document.querySelector('.nav-theme').textContent = '🌙';
} else {
  document.querySelector('.nav-theme').textContent = '☀';
}
