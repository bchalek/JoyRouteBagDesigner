import { computeClassicBag, bagNeededPaper as classicNeeded, fitBagToPaper as classicFit } from './geometry/classic-bag.js';
import { computeBottleBag, bagNeededPaper as bottleNeeded, fitBagToPaper as bottleFit } from './geometry/bottle-bag.js';
import { PAPER_SIZES, PAPER_ORDER, findSmallestFittingPaper, paperLabel } from './geometry/paper-sizes.js';
import { state, set, on, effectivePaper, currentGeometry } from './state.js';
import { renderFlatView } from './canvas/flat-view.js';
import { initPanelEditor, switchPanel, saveCurrentPanel } from './canvas/panel-editor.js';
import { renderImposition } from './canvas/imposition-view.js';
import { computeImposition } from './imposition/impositor.js';
import { exportPDF } from './export/pdf-export.js';
import { exportSVG } from './export/svg-export.js';
import { exportPNG } from './export/png-export.js';
import { saveProject, loadProject } from './project/io.js';

// Expose geometry fns globally for state.js
window.__geo = { PAPER_SIZES, computeClassicBag, computeBottleBag };

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populatePaperSelect();
  bindDimensionInputs();
  bindPaperControls();
  bindViewToggle();
  bindToolbarActions();
  bindPrintSettings();
  bindImpositionControls();
  bindLayerTools();

  // Initial render
  refreshAll();
  initPanelEditor('fabric-canvas');
  updateImpositionInfo();
});

// ─── Paper select population ──────────────────────────────────────────────────
function populatePaperSelect() {
  const sel = document.getElementById('paper-size');
  sel.innerHTML = '';
  PAPER_ORDER.forEach(name => {
    const s = PAPER_SIZES[name];
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${s.w}×${s.h}mm)`;
    sel.appendChild(opt);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Niestandardowy…';
  sel.appendChild(custom);
  sel.value = state.paperName;
}

// ─── Dimension inputs ─────────────────────────────────────────────────────────
function bindDimensionInputs() {
  ['w', 'h', 'd'].forEach(axis => {
    const el = document.getElementById(`dim-${axis}`);
    el.addEventListener('input', () => {
      const val = Math.max(parseInt(el.min) || 1, parseInt(el.value) || 0);
      set({ dimensions: { [axis.toUpperCase()]: val } });
      refreshAll();
    });
  });

  document.getElementById('btn-fit-bag').addEventListener('click', () => {
    const paper = effectivePaper();
    const fit = state.bagType === 'bottle'
      ? bottleFit(paper.w, paper.h, state.bleed)
      : classicFit(paper.w, paper.h, state.bleed);
    if (!fit) return;
    set({ dimensions: fit });
    document.getElementById('dim-w').value = fit.W;
    document.getElementById('dim-h').value = fit.H;
    document.getElementById('dim-d').value = fit.D;
    refreshAll();
  });
}

// ─── Paper controls ────────────────────────────────────────────────────────────
function bindPaperControls() {
  document.getElementById('paper-size').addEventListener('change', e => {
    set({ paperName: e.target.value });
    document.getElementById('custom-paper').classList.toggle('hidden', e.target.value !== 'custom');
    refreshAll();
  });

  document.querySelectorAll('[data-orient]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-orient]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set({ paperOrientation: btn.dataset.orient });
      refreshAll();
    });
  });

  ['paper-cw', 'paper-ch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      set({ paperCustom: {
        w: parseInt(document.getElementById('paper-cw')?.value) || 297,
        h: parseInt(document.getElementById('paper-ch')?.value) || 420,
      }});
      refreshAll();
    });
  });
}

// ─── View toggle ──────────────────────────────────────────────────────────────
function bindViewToggle() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set({ view: v });
      document.getElementById('flat-view').classList.toggle('hidden', v !== 'flat');
      document.getElementById('panel-editor').classList.toggle('hidden', v !== 'panels');
      document.getElementById('imposition-view').classList.toggle('hidden', v !== 'imposition');
      if (v === 'imposition') renderImposition();
    });
  });

  // Panel tabs
  document.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      saveCurrentPanel();
      document.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set({ activePanel: btn.dataset.panel });
      switchPanel(btn.dataset.panel, currentGeometry());
    });
  });
}

// ─── Toolbar actions ──────────────────────────────────────────────────────────
function bindToolbarActions() {
  document.getElementById('btn-new').addEventListener('click', () => {
    if (!confirm('Zacząć nowy projekt? Niezapisane zmiany zostaną utracone.')) return;
    set({ panelData: { front: null, back: null, left: null, right: null, top: null } });
    switchPanel(state.activePanel, currentGeometry());
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    saveCurrentPanel();
    saveProject(state);
  });

  document.getElementById('btn-open').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.bagdesign,.json';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      const text = await file.text();
      const loaded = loadProject(text);
      if (!loaded) { alert('Nieprawidłowy plik projektu.'); return; }
      // Restore dimensions
      document.getElementById('dim-w').value = loaded.dimensions.W;
      document.getElementById('dim-h').value = loaded.dimensions.H;
      document.getElementById('dim-d').value = loaded.dimensions.D;
      document.getElementById('paper-size').value = loaded.paperName ?? 'A3';
      refreshAll();
      switchPanel(state.activePanel, currentGeometry());
    };
    inp.click();
  });

  document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    saveCurrentPanel();
    const btn = document.getElementById('btn-export-pdf');
    btn.textContent = 'Generuję…';
    btn.disabled = true;
    try {
      await exportPDF(state, currentGeometry(), effectivePaper());
    } finally {
      btn.textContent = 'Eksport PDF';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-export-svg').addEventListener('click', () => {
    exportSVG(currentGeometry(), state);
  });

  document.getElementById('btn-export-png').addEventListener('click', () => {
    exportPNG(currentGeometry(), state);
  });
}

// ─── Print settings ────────────────────────────────────────────────────────────
function bindPrintSettings() {
  document.getElementById('bleed').addEventListener('input', e => {
    set({ bleed: parseFloat(e.target.value) || 3 });
    refreshAll();
  });
  document.getElementById('crop-marks').addEventListener('change', e => set({ cropMarks: e.target.checked }));
  document.getElementById('fold-marks').addEventListener('change', e => set({ foldMarks: e.target.checked }));
}

// ─── Imposition controls ───────────────────────────────────────────────────────
function bindImpositionControls() {
  document.getElementById('imp-margin').addEventListener('input', e => {
    set({ imposition: { margin: parseFloat(e.target.value) || 10 } });
    updateImpositionInfo();
  });
  document.getElementById('imp-gutter').addEventListener('input', e => {
    set({ imposition: { gutter: parseFloat(e.target.value) || 5 } });
    updateImpositionInfo();
  });
  document.getElementById('btn-imposition-preview').addEventListener('click', () => {
    set({ view: 'imposition' });
    document.querySelectorAll('[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === 'imposition'));
    document.getElementById('flat-view').classList.add('hidden');
    document.getElementById('panel-editor').classList.add('hidden');
    document.getElementById('imposition-view').classList.remove('hidden');
    renderImposition();
  });
}

// ─── Layer tool buttons ────────────────────────────────────────────────────────
function bindLayerTools() {
  const addText = document.getElementById('btn-add-text');
  const addImage = document.getElementById('btn-add-image');
  const addRect = document.getElementById('btn-add-rect');
  const addCircle = document.getElementById('btn-add-circle');
  const delLayer = document.getElementById('btn-delete-layer');
  const addBg = document.getElementById('btn-add-bg');

  if (addText) addText.addEventListener('click', () => window.__editor?.addText());
  if (addImage) addImage.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => window.__editor?.addImage(inp.files[0]);
    inp.click();
  });
  if (addRect)   addRect.addEventListener('click',   () => window.__editor?.addRect());
  if (addCircle) addCircle.addEventListener('click', () => window.__editor?.addCircle());
  if (delLayer)  delLayer.addEventListener('click',  () => window.__editor?.deleteSelected());
  if (addBg)     addBg.addEventListener('click',     () => window.__editor?.setBackground());
}

// ─── Safe DOM helpers ──────────────────────────────────────────────────────────
/** Creates an element with optional className and textContent. */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function infoRow(label, value, cls) {
  const row = el('div', `info-row${cls ? ' ' + cls : ''}`);
  row.appendChild(el('span', null, label));
  row.appendChild(el('strong', null, value));
  return row;
}

// ─── Global refresh ────────────────────────────────────────────────────────────
export function refreshAll() {
  const geo = currentGeometry();
  if (!geo) return;

  // Validate dimensions
  const valEl = document.getElementById('dim-validation');
  if (!geo.valid) {
    valEl.textContent = `⚠ Szerokość musi być ≥ 1.5 × Głębokość (min ${Math.ceil(geo.D * 1.5)}mm)`;
    valEl.classList.add('error');
  } else {
    valEl.textContent = '';
    valEl.classList.remove('error');
  }

  // Paper info — built with DOM methods (no innerHTML with interpolated strings)
  const needed = state.bagType === 'bottle'
    ? bottleNeeded(state.dimensions.W, state.dimensions.H, state.dimensions.D, state.bleed)
    : classicNeeded(state.dimensions.W, state.dimensions.H, state.dimensions.D, state.bleed);
  const paper = effectivePaper();
  const fits = paper.w >= needed.w && paper.h >= needed.h;
  const suggestion = findSmallestFittingPaper(needed.w, needed.h);

  const infoEl = document.getElementById('paper-info');
  infoEl.replaceChildren(
    infoRow('Szablon:', `${Math.round(needed.w - 2*state.bleed)}×${Math.round(needed.h - 2*state.bleed)}mm`),
    infoRow('Z spad.:', `${Math.round(needed.w)}×${Math.round(needed.h)}mm`),
    infoRow('Wybrany papier:', `${fits ? '✓' : '✗'} ${paper.w}×${paper.h}mm`, fits ? 'ok' : 'warn'),
    ...(!fits && suggestion
      ? [infoRow('💡 Sugerowany:', paperLabel(suggestion.name, suggestion.orientation), 'suggest')]
      : [])
  );

  updateImpositionInfo();

  // Re-render flat view
  if (state.view === 'flat') renderFlatView(geo, paper, state);
  if (state.view === 'imposition') renderImposition();
}

function updateImpositionInfo() {
  const geo = currentGeometry();
  if (!geo) return;
  const paper = effectivePaper();
  const { margin, gutter } = state.imposition;
  const imp = computeImposition(
    paper.w, paper.h, geo.totalW, geo.totalH, margin, gutter, state.bleed
  );
  const infoEl = document.getElementById('imposition-info');
  if (!infoEl) return;
  infoEl.replaceChildren();
  if (!imp) {
    infoEl.appendChild(el('div', 'imp-result warn', 'Brak miejsca na torebkę.'));
    return;
  }
  const div = el('div', 'imp-result');
  div.appendChild(el('span', 'imp-count', `${imp.count} szt.`));
  div.appendChild(el('span', 'imp-grid', `${imp.cols}×${imp.rows}${imp.rotate ? ' (obrót 90°)' : ''}`));
  div.appendChild(el('span', 'imp-waste', `Odpad: ${Math.round((1 - imp.efficiency) * 100)}%`));
  infoEl.appendChild(div);
}
