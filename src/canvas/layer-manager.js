/**
 * Layer list renderer.
 * Builds the layer panel DOM from Fabric.js object array.
 * Uses only textContent / DOM methods — no innerHTML.
 */

const TYPE_ICON = {
  'i-text':   'T',
  'textbox':  'T',
  'image':    '🖼',
  'rect':     '□',
  'circle':   '○',
  'triangle': '△',
  'path':     '✏',
  'group':    '⊞',
};

/**
 * @param {fabric.Object[]} objects  – canvas objects (bottom to top)
 * @param {object} callbacks
 * @param {Function} callbacks.onSelect
 * @param {Function} callbacks.onToggleVis
 * @param {Function} callbacks.onToggleLock
 * @param {fabric.Object|null} callbacks.activeObj
 */
export function renderLayerList(objects, { onSelect, onToggleVis, onToggleLock, activeObj }) {
  const list = document.getElementById('layers-list');
  if (!list) return;

  list.replaceChildren();

  // Render in reverse order (top layer first in UI)
  const reversed = [...objects].reverse();
  reversed.forEach((obj, i) => {
    const item = document.createElement('div');
    item.className = 'layer-item';
    if (obj === activeObj) item.classList.add('selected');
    item.draggable = true;

    // Visibility toggle
    const vis = document.createElement('span');
    vis.className = 'layer-vis';
    vis.title = obj.visible !== false ? 'Ukryj' : 'Pokaż';
    vis.textContent = obj.visible !== false ? '👁' : '👁‍🗨';
    vis.addEventListener('click', e => { e.stopPropagation(); onToggleVis(obj); });
    item.appendChild(vis);

    // Type icon
    const icon = document.createElement('span');
    icon.className = 'layer-icon';
    icon.textContent = TYPE_ICON[obj.type] ?? '?';
    icon.style.fontSize = '11px';
    icon.style.color = 'var(--text-muted)';
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.title = obj.name ?? obj.type;
    name.textContent = obj.name ?? obj.type ?? 'Obiekt';
    item.appendChild(name);

    // Lock toggle
    const lock = document.createElement('span');
    lock.className = 'layer-lock';
    lock.title = obj.locked ? 'Odblokuj' : 'Zablokuj';
    lock.textContent = obj.locked ? '🔒' : '🔓';
    lock.addEventListener('click', e => { e.stopPropagation(); onToggleLock(obj); });
    item.appendChild(lock);

    item.addEventListener('click', () => onSelect(obj));

    // Drag-to-reorder (visual only — actual reorder via Fabric object order)
    item.addEventListener('dragstart', () => item.classList.add('dragging'));
    item.addEventListener('dragend', () => item.classList.remove('dragging'));

    list.appendChild(item);
  });
}
