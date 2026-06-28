/**
 * SVG flat view renderer.
 * Renders the unfolded bag template as an SVG with pan/zoom support.
 * All internal coordinates are in mm; displayed via SVG viewBox.
 */

import { state, set } from '../state.js';
import { toast } from '../ui/toast.js';

let panX = 0, panY = 0, zoom = 1;
let isPanning = false, lastMX = 0, lastMY = 0;
let svg, g;

const COLORS = {
  paper:    '#1a1a2e',
  bleed:    '#2a2a4a',
  panel:    '#ffffff',
  panelHov: '#e8e8ff',
  fold:     '#5555aa',
  cut:      '#2866ff',
  handle:   '#2866ff',
  label:    '#8888cc',
  grid:     '#1e1e38',
};

/**
 * @param {object} geo      – bag geometry from computeClassicBag / computeBottleBag
 * @param {object} paper    – { w, h } in mm
 * @param {object} appState – application state
 */
export function renderFlatView(geo, paper, appState) {
  svg = document.getElementById('flat-svg');
  if (!svg) return;

  // Guard against zoom being 0 (can happen when SVG was hidden during fitToWindow)
  if (!zoom || zoom <= 0 || !isFinite(zoom)) { zoom = 1; panX = 0; panY = 0; }

  // Determine viewBox: show paper + some padding
  const PAD = 20; // mm padding around paper
  const vbW = paper.w + PAD * 2;
  const vbH = paper.h + PAD * 2;

  svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${vbW} ${vbH}`);
  svg.replaceChildren(); // clear previous render

  // Apply pan/zoom via a transform group
  g = createEl('g', {
    transform: `translate(${panX},${panY}) scale(${zoom})`,
    id: 'pan-zoom-group',
  });
  svg.appendChild(g);

  // Paper shadow/background
  g.appendChild(createEl('rect', {
    x: -2, y: -2, width: paper.w + 4, height: paper.h + 4,
    fill: 'none', stroke: '#111122', 'stroke-width': 2,
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
  }));

  // Paper fill
  g.appendChild(createEl('rect', {
    x: 0, y: 0, width: paper.w, height: paper.h,
    fill: '#f8f8f8',
  }));

  // Bleed boundary (dashed, inside paper area)
  const B = appState.bleed;
  g.appendChild(createEl('rect', {
    x: B, y: B, width: paper.w - 2*B, height: paper.h - 2*B,
    fill: 'none', stroke: '#aaaacc', 'stroke-width': 0.3,
    'stroke-dasharray': '2 2',
  }));

  // Center bag template on paper
  const offsetX = (paper.w - geo.totalW) / 2;
  const offsetY = (paper.h - geo.totalH) / 2;

  const bagG = createEl('g', {
    transform: `translate(${offsetX},${offsetY})`,
    id: 'bag-template',
  });
  g.appendChild(bagG);

  // Panel fills (editable areas)
  renderPanels(bagG, geo, appState);

  // Fold lines
  if (appState.foldMarks !== false) renderFoldLines(bagG, geo);

  // Cut line
  renderCutLine(bagG, geo);

  // Handle holes
  renderHandles(bagG, geo);

  // Panel labels
  renderPanelLabels(bagG, geo);

  // Dimension annotations
  renderDimensions(g, geo, offsetX, offsetY, paper);

  // Event handlers (pan + zoom)
  bindInteraction(svg, bagG, geo, offsetX, offsetY, appState);

  // Crop marks (outside paper bounds)
  if (appState.cropMarks !== false) renderCropMarks(g, paper);
}

// ─── Panels ─────────────────────────────────────────────────────────────────
function renderPanels(parent, geo, appState) {
  const SW = 0.3; // stroke width mm

  // All face paths (white fill, no stroke here — cut line handles border)
  const faces = Object.entries(geo.paths);
  for (const [key, d] of faces) {
    const panel = findPanelForPath(key, geo);
    const isMain = panel !== null;
    const p = createEl('path', {
      d,
      fill: '#ffffff',
      stroke: '#ccccdd',
      'stroke-width': SW,
      class: isMain ? `bag-panel panel-${panel}` : 'bag-face',
      'data-panel': panel,
      cursor: isMain ? 'pointer' : 'default',
    });
    if (isMain) {
      p.addEventListener('click', () => onPanelClick(panel));
      p.addEventListener('mouseenter', () => p.setAttribute('fill', '#eeeeff'));
      p.addEventListener('mouseleave', () => p.setAttribute('fill', '#ffffff'));
    }
    parent.appendChild(p);
  }
}

function findPanelForPath(key, geo) {
  // Direct panel name match
  if (geo.panelRects[key]) return key;
  // Top flap maps to 'top' panel only when it exists in panelRects
  if ((key === 'frontTop' || key === 'backTop') && geo.panelRects['top']) return 'top';
  return null;
}

function onPanelClick(panel) {
  // Dispatch a custom event — main.js handles the view switch
  document.dispatchEvent(new CustomEvent('bag:open-panel', { detail: { panel } }));
}

// ─── Fold lines ───────────────────────────────────────────────────────────────
function renderFoldLines(parent, geo) {
  const g = createEl('g', { id: 'fold-lines' });
  for (const l of geo.foldLines) {
    g.appendChild(createEl('line', {
      x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2,
      stroke: '#6666bb',
      'stroke-width': 0.25,
      'stroke-dasharray': '1.5 0.8',
    }));
  }
  parent.appendChild(g);
}

// ─── Cut line ─────────────────────────────────────────────────────────────────
function renderCutLine(parent, geo) {
  parent.appendChild(createEl('path', {
    d: geo.cutPath,
    fill: 'none',
    stroke: '#2255ff',
    'stroke-width': 0.35,
    id: 'cut-line',
  }));
  // Also draw the outer bag outline (inner cut)
  const { xGlueL, xRightR, yTop, yBot } = geo.coords;
  parent.appendChild(createEl('rect', {
    x: xGlueL, y: yTop,
    width: xRightR - xGlueL,
    height: yBot - yTop,
    fill: 'none',
    stroke: '#2255ff',
    'stroke-width': 0.4,
  }));
}

// ─── Handle holes ─────────────────────────────────────────────────────────────
function renderHandles(parent, geo) {
  const g = createEl('g', { id: 'handles' });
  for (const h of geo.handles) {
    // Outer ring
    g.appendChild(createEl('circle', {
      cx: h.cx, cy: h.cy, r: h.r,
      fill: 'white', stroke: '#2255ff', 'stroke-width': 0.3,
    }));
    // Inner dot
    g.appendChild(createEl('circle', {
      cx: h.cx, cy: h.cy, r: 0.8,
      fill: '#2255ff',
    }));
  }
  parent.appendChild(g);
}

// ─── Panel labels ─────────────────────────────────────────────────────────────
function renderPanelLabels(parent, geo) {
  const g = createEl('g', { id: 'labels' });
  for (const [, rect] of Object.entries(geo.panelRects)) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const t = createEl('text', {
      x: cx, y: cy,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#9999cc',
      'font-size': Math.min(10, rect.w * 0.12, rect.h * 0.12),
      'font-family': 'Inter, system-ui, sans-serif',
      'pointer-events': 'none',
      'user-select': 'none',
    });
    t.textContent = rect.label;
    g.appendChild(t);
  }
  parent.appendChild(g);
}

// ─── Dimension annotations ────────────────────────────────────────────────────
function renderDimensions(parent, geo, offX, offY, paper) {
  const g = createEl('g', { id: 'dimensions', opacity: '0.7' });
  const { coords: c } = geo;
  const ARROW_SIZE = 1.5;
  const LABEL_OFFSET = 5;
  const FS = 4.5;

  // Width annotation (W — front panel)
  addDimArrow(g,
    offX + c.xFrontL, offY - LABEL_OFFSET,
    offX + c.xRightL, offY - LABEL_OFFSET,
    `W=${geo.W}mm`, FS, 'horizontal');

  // Height annotation (H)
  addDimArrow(g,
    offX - LABEL_OFFSET, offY + c.yBodyT,
    offX - LABEL_OFFSET, offY + c.yBodyB,
    `H=${geo.H}mm`, FS, 'vertical');

  // Depth annotation (D — left panel)
  addDimArrow(g,
    offX + c.xLeftL, offY + c.yBot + LABEL_OFFSET,
    offX + c.xFrontL, offY + c.yBot + LABEL_OFFSET,
    `G=${geo.D}mm`, FS, 'horizontal');

  parent.appendChild(g);
}

function addDimArrow(parent, x1, y1, x2, y2, label, fs, dir) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const line = createEl('line', {
    x1, y1, x2, y2,
    stroke: '#8888bb', 'stroke-width': 0.4,
    'marker-start': 'none', 'marker-end': 'none',
  });
  parent.appendChild(line);
  const t = createEl('text', {
    x: dir === 'vertical' ? x1 - 2 : mx,
    y: dir === 'vertical' ? my : y1 - 1.5,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    fill: '#8888bb',
    'font-size': fs,
    'font-family': 'Inter, system-ui, sans-serif',
    transform: dir === 'vertical' ? `rotate(-90, ${x1 - 2}, ${my})` : '',
    'pointer-events': 'none',
  });
  t.textContent = label;
  parent.appendChild(t);
}

// ─── Crop marks ───────────────────────────────────────────────────────────────
function renderCropMarks(parent, paper) {
  const g = createEl('g', { id: 'crop-marks', stroke: '#000', 'stroke-width': 0.3 });
  const LEN = 5;
  const GAP = 3;
  // Corners
  [[0, 0], [paper.w, 0], [0, paper.h], [paper.w, paper.h]].forEach(([x, y]) => {
    const sx = x === 0 ? -1 : 1;
    const sy = y === 0 ? -1 : 1;
    // Horizontal mark
    g.appendChild(createEl('line', {
      x1: x + sx * GAP, y1: y,
      x2: x + sx * (GAP + LEN), y2: y,
      stroke: '#333', 'stroke-width': 0.3,
    }));
    // Vertical mark
    g.appendChild(createEl('line', {
      x1: x, y1: y + sy * GAP,
      x2: x, y2: y + sy * (GAP + LEN),
      stroke: '#333', 'stroke-width': 0.3,
    }));
  });
  parent.appendChild(g);
}

// ─── Pan & zoom interaction ───────────────────────────────────────────────────
function bindInteraction(svg, bagG, geo, offsetX, offsetY, appState) {
  // Zoom with mouse wheel
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.1, Math.min(10, zoom * factor));
    applyTransform(svg);
  }, { passive: false });

  // Pan with mouse drag
  svg.addEventListener('mousedown', e => {
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return;
    isPanning = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
    svg.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    const dx = (e.clientX - lastMX) / zoom;
    const dy = (e.clientY - lastMY) / zoom;
    panX += dx; panY += dy;
    lastMX = e.clientX; lastMY = e.clientY;
    applyTransform(svg);
  });
  window.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; svg.style.cursor = ''; }
  });

  // Zoom buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    zoom = Math.min(10, zoom * 1.2); applyTransform(svg);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    zoom = Math.max(0.1, zoom / 1.2); applyTransform(svg);
  });
  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
    fitToWindow(svg); applyTransform(svg);
  });

  // Store geo for panel editor access
  window.__currentGeo = geo;
}

function applyTransform(svg) {
  const g = svg.getElementById?.('pan-zoom-group') || svg.querySelector('#pan-zoom-group');
  if (g) g.setAttribute('transform', `translate(${panX},${panY}) scale(${zoom})`);
  const lbl = document.getElementById('zoom-label');
  if (lbl) lbl.textContent = `${Math.round(zoom * 100)}%`;
}

function fitToWindow(svg) {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  zoom = Math.min(rect.width / vb.width, rect.height / vb.height) * 0.9;
  panX = 0; panY = 0;
}

// ─── SVG element factory ───────────────────────────────────────────────────────
function createEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
