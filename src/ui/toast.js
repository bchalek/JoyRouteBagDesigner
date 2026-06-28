/**
 * Minimal toast notification.
 * @param {string} message
 * @param {'ok'|'error'|''} type
 * @param {number} duration ms
 */
export function toast(message, type = '', duration = 2500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `toast${type ? ' ' + type : ''}`;
  div.textContent = message;  // textContent — no XSS risk
  container.appendChild(div);
  setTimeout(() => div.remove(), duration);
}
