/**
 * Properties panel — shows editable properties for the selected Fabric.js object.
 * All DOM built with createElement/textContent (no innerHTML with user data).
 */

/**
 * @param {fabric.Object|null} obj
 */
export function renderProperties(obj) {
  const container = document.getElementById('properties-content');
  if (!container) return;
  container.replaceChildren();

  if (!obj) {
    const hint = document.createElement('div');
    hint.style.cssText = 'color:var(--text-muted);font-size:11px;';
    hint.textContent = 'Zaznacz obiekt na canvasie.';
    container.appendChild(hint);
    return;
  }

  // Common: position & size
  container.appendChild(section('Pozycja i rozmiar', [
    numRow('X', obj.left,  v => obj.set('left',  v) || obj.canvas?.renderAll(), 1),
    numRow('Y', obj.top,   v => obj.set('top',   v) || obj.canvas?.renderAll(), 1),
    numRow('W', Math.round(obj.getScaledWidth()),
      v => obj.scaleToWidth(v) || obj.canvas?.renderAll(), 1),
    numRow('H', Math.round(obj.getScaledHeight()),
      v => obj.scaleToHeight(v) || obj.canvas?.renderAll(), 1),
    numRow('°', Math.round(obj.angle || 0),
      v => obj.set('angle', v) || obj.canvas?.renderAll(), 1),
    numRow('%', Math.round((obj.opacity ?? 1) * 100),
      v => obj.set('opacity', v / 100) || obj.canvas?.renderAll(), 1, 0, 100),
  ]));

  // Text-specific
  if (obj.type === 'i-text' || obj.type === 'textbox') {
    container.appendChild(section('Tekst', [
      colorRow('Kolor',    obj.fill,    v => obj.set('fill', v) || obj.canvas?.renderAll()),
      numRow('Rozmiar',    obj.fontSize,
        v => obj.set('fontSize', v) || obj.canvas?.renderAll(), 1, 4, 300),
      fontFamilyRow(obj),
      fontStyleRow(obj),
    ]));
  }

  // Shape fill/stroke
  if (['rect', 'circle', 'triangle', 'path', 'polygon'].includes(obj.type)) {
    container.appendChild(section('Wypełnienie i obramowanie', [
      colorRow('Kolor',    obj.fill,        v => obj.set('fill',        v) || obj.canvas?.renderAll()),
      colorRow('Obram.',   obj.stroke,      v => obj.set('stroke',      v) || obj.canvas?.renderAll()),
      numRow('Gr. obram.', obj.strokeWidth,
        v => obj.set('strokeWidth', v) || obj.canvas?.renderAll(), 0.5, 0, 50),
    ]));
  }

  // Image
  if (obj.type === 'image') {
    container.appendChild(section('Obraz', [
      numRow('%', Math.round((obj.opacity ?? 1) * 100),
        v => obj.set('opacity', v / 100) || obj.canvas?.renderAll(), 1, 0, 100),
    ]));
  }
}

// ─── Row builders ─────────────────────────────────────────────────────────────
function section(title, rows) {
  const div = document.createElement('div');
  div.className = 'prop-group';
  const lbl = document.createElement('div');
  lbl.className = 'prop-label';
  lbl.textContent = title;
  div.appendChild(lbl);
  rows.forEach(r => r && div.appendChild(r));
  return div;
}

function numRow(label, value, onChange, step = 1, min, max) {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.value = Math.round((value ?? 0) * 10) / 10;
  inp.step = step;
  if (min !== undefined) inp.min = min;
  if (max !== undefined) inp.max = max;
  inp.addEventListener('change', () => onChange(parseFloat(inp.value) || 0));
  row.appendChild(lbl);
  row.appendChild(inp);
  return row;
}

function colorRow(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'color';
  // Fabric may return rgba — extract hex fallback
  inp.value = cssColorToHex(value) || '#000000';
  inp.addEventListener('input', () => onChange(inp.value));
  row.appendChild(lbl);
  row.appendChild(inp);
  return row;
}

function fontFamilyRow(obj) {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const lbl = document.createElement('label');
  lbl.textContent = 'Font';
  const sel = document.createElement('select');
  ['Arial', 'Georgia', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Impact'].forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    if (f === obj.fontFamily) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => { obj.set('fontFamily', sel.value); obj.canvas?.renderAll(); });
  row.appendChild(lbl);
  row.appendChild(sel);
  return row;
}

function fontStyleRow(obj) {
  const row = document.createElement('div');
  row.className = 'prop-row';
  ['bold', 'italic', 'underline'].forEach(style => {
    const btn = document.createElement('button');
    btn.textContent = style === 'bold' ? 'B' : style === 'italic' ? 'I' : 'U';
    btn.style.fontWeight   = style === 'bold'   ? 'bold'   : 'normal';
    btn.style.fontStyle    = style === 'italic' ? 'italic' : 'normal';
    btn.style.textDecoration = style === 'underline' ? 'underline' : 'none';
    btn.style.padding = '2px 6px';
    btn.style.minWidth = '24px';
    if (obj[style]) btn.classList.add('active');
    btn.addEventListener('click', () => {
      obj.set(style, !obj[style]);
      btn.classList.toggle('active', !!obj[style]);
      obj.canvas?.renderAll();
    });
    row.appendChild(btn);
  });
  return row;
}

function cssColorToHex(color) {
  if (!color || color === 'transparent') return '#000000';
  if (/^#[0-9a-f]{3,6}$/i.test(color)) return color;
  return '#000000';
}
