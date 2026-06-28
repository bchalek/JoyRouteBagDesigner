/**
 * Fabric.js panel editor — Fabric.js v6 compatible.
 *
 * Fabric.js 6 breaking changes used here:
 *  - Named exports: Canvas, IText, FabricImage, Rect, Circle
 *  - loadFromJSON returns Promise (no callback)
 *  - bringToFront/sendToBack → canvas.bringObjectToFront/sendObjectToBack
 *  - setBackgroundImage → FabricImage.fromURL + canvas.set()
 */

import { Canvas, IText, FabricImage, Rect, Circle } from 'fabric';
import { state, set } from '../state.js';
import { toast } from '../ui/toast.js';
import { renderLayerList } from './layer-manager.js';
import { renderProperties } from '../ui/properties-panel.js';

/** @type {Canvas} */
let canvas = null;
let historyStack = [];
let historyPointer = -1;
let ignoreHistory = false;

const MM_TO_PX = 3.7795;
const EDITOR_SCALE = 2;  // 192 DPI display quality

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initPanelEditor() {
  bindEditorToolbar();
  bindKeyboard();
}

export async function switchPanel(panelName, geo) {
  if (!geo) return;

  if (canvas) saveCurrentPanel();

  const rect = panelRect(panelName, geo);
  if (!rect) return;

  const pxW = Math.round(rect.w * MM_TO_PX * EDITOR_SCALE);
  const pxH = Math.round(rect.h * MM_TO_PX * EDITOR_SCALE);

  if (canvas) { canvas.dispose(); canvas = null; }

  const canvasEl = document.getElementById('fabric-canvas');
  canvasEl.width  = pxW;
  canvasEl.height = pxH;
  canvasEl.style.width  = `${pxW / EDITOR_SCALE}px`;
  canvasEl.style.height = `${pxH / EDITOR_SCALE}px`;

  canvas = new Canvas('fabric-canvas', {
    width: pxW,
    height: pxH,
    backgroundColor: '#ffffff',
    selection: true,
  });

  const saved = state.panelData[panelName];
  if (saved) {
    await canvas.loadFromJSON(saved);
    canvas.renderAll();
  } else {
    canvas.renderAll();
  }
  refreshLayerList();

  historyStack = [];
  historyPointer = -1;
  pushHistory();

  canvas.on('object:added',    onCanvasChange);
  canvas.on('object:removed',  onCanvasChange);
  canvas.on('object:modified', onCanvasChange);
  canvas.on('selection:created',  refreshUI);
  canvas.on('selection:updated',  refreshUI);
  canvas.on('selection:cleared',  refreshUI);

  window.__editor = {
    addText:        () => addText(canvas, pxW, pxH),
    addImage:       (file) => addImage(canvas, file),
    addRect:        () => addRect(canvas),
    addCircle:      () => addCircle(canvas),
    deleteSelected: () => deleteSelected(canvas),
    setBackground:  () => showBgPicker(canvas),
    bringForward:   () => {
      const o = canvas.getActiveObject();
      if (o) { canvas.bringObjectToFront(o); canvas.renderAll(); refreshLayerList(); }
    },
    sendBackward:   () => {
      const o = canvas.getActiveObject();
      if (o) { canvas.sendObjectToBack(o); canvas.renderAll(); refreshLayerList(); }
    },
    undo, redo,
    getCanvas: () => canvas,
  };
}

export function saveCurrentPanel() {
  if (!canvas) return;
  const json = canvas.toJSON(['id', 'name', 'locked']);
  set({ panelData: { [state.activePanel]: json } });
}

// ─── History ──────────────────────────────────────────────────────────────────
function pushHistory() {
  if (ignoreHistory || !canvas) return;
  historyStack = historyStack.slice(0, historyPointer + 1);
  historyStack.push(canvas.toJSON(['id', 'name', 'locked']));
  historyPointer = historyStack.length - 1;
}

function undo() {
  if (historyPointer <= 0) return;
  historyPointer--;
  restoreHistory(historyStack[historyPointer]);
}

function redo() {
  if (historyPointer >= historyStack.length - 1) return;
  historyPointer++;
  restoreHistory(historyStack[historyPointer]);
}

async function restoreHistory(json) {
  ignoreHistory = true;
  await canvas.loadFromJSON(json);
  canvas.renderAll();
  refreshLayerList();
  ignoreHistory = false;
}

// ─── Object helpers ───────────────────────────────────────────────────────────
function addText(canvas, pxW, pxH) {
  const t = new IText('Wpisz tekst', {
    left: pxW / 2,
    top:  pxH / 2,
    originX: 'center',
    originY: 'center',
    fontSize: Math.round(14 * EDITOR_SCALE),
    fill: '#222222',
    fontFamily: 'Arial',
    id: uid(),
    name: 'Tekst',
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.renderAll();
  t.enterEditing();
}

function addImage(canvas, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    FabricImage.fromURL(e.target.result).then(fi => {
      fi.set({ left: 50 * EDITOR_SCALE, top: 50 * EDITOR_SCALE, id: uid(), name: file.name.replace(/\.[^.]+$/, '') });
      const maxW = canvas.width * 0.4;
      if (fi.width > maxW) fi.scaleToWidth(maxW);
      canvas.add(fi);
      canvas.setActiveObject(fi);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(file);
}

function addRect(canvas) {
  const r = new Rect({
    left:   80 * EDITOR_SCALE,
    top:    60 * EDITOR_SCALE,
    width:  60 * EDITOR_SCALE,
    height: 40 * EDITOR_SCALE,
    fill:   '#ccccff',
    stroke: '#6666cc',
    strokeWidth: EDITOR_SCALE,
    rx: 4 * EDITOR_SCALE,
    ry: 4 * EDITOR_SCALE,
    id: uid(),
    name: 'Prostokąt',
  });
  canvas.add(r);
  canvas.setActiveObject(r);
  canvas.renderAll();
}

function addCircle(canvas) {
  const c = new Circle({
    left:   80 * EDITOR_SCALE,
    top:    60 * EDITOR_SCALE,
    radius: 30 * EDITOR_SCALE,
    fill:   '#ccffee',
    stroke: '#44aa77',
    strokeWidth: EDITOR_SCALE,
    id: uid(),
    name: 'Koło',
  });
  canvas.add(c);
  canvas.setActiveObject(c);
  canvas.renderAll();
}

function deleteSelected(canvas) {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  // In Fabric.js 6, multi-selection type is 'ActiveSelection'
  if (obj.type === 'ActiveSelection' || obj.type === 'activeselection') {
    obj.forEachObject(o => canvas.remove(o));
    canvas.discardActiveObject();
  } else {
    canvas.remove(obj);
  }
  canvas.renderAll();
}

function showBgPicker(canvas) {
  const overlay = document.createElement('div');
  overlay.className = 'bg-picker-overlay';

  const box = document.createElement('div');
  box.className = 'bg-picker-box';

  const title = document.createElement('h4');
  title.textContent = 'Tło panelu';
  box.appendChild(title);

  const colorRow = document.createElement('div');
  colorRow.className = 'input-group';
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Kolor';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#ffffff';
  colorRow.appendChild(colorLabel);
  colorRow.appendChild(colorInput);
  box.appendChild(colorRow);

  const imgRow = document.createElement('div');
  imgRow.className = 'input-group';
  const imgLabel = document.createElement('label');
  imgLabel.textContent = 'Lub obraz tła';
  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.accept = 'image/*';
  imgRow.appendChild(imgLabel);
  imgRow.appendChild(imgInput);
  box.appendChild(imgRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const btnOk = document.createElement('button');
  btnOk.className = 'btn-primary';
  btnOk.textContent = 'Zastosuj';
  btnOk.addEventListener('click', async () => {
    if (imgInput.files.length > 0) {
      const reader = new FileReader();
      reader.onload = async e => {
        const img = await FabricImage.fromURL(e.target.result);
        img.scaleToWidth(canvas.width);
        img.scaleToHeight(canvas.height);
        canvas.backgroundImage = img;
        canvas.renderAll();
      };
      reader.readAsDataURL(imgInput.files[0]);
    } else {
      canvas.backgroundColor = colorInput.value;
      canvas.renderAll();
    }
    overlay.remove();
    pushHistory();
  });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Anuluj';
  btnCancel.addEventListener('click', () => overlay.remove());

  btnRow.appendChild(btnOk);
  btnRow.appendChild(btnCancel);
  box.appendChild(btnRow);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ─── UI refresh ───────────────────────────────────────────────────────────────
function onCanvasChange() {
  pushHistory();
  refreshLayerList();
}

function refreshUI() {
  refreshLayerList();
  renderProperties(canvas?.getActiveObject() ?? null);
}

function refreshLayerList() {
  if (!canvas) return;
  renderLayerList(canvas.getObjects(), {
    onSelect: (obj) => { canvas.setActiveObject(obj); canvas.renderAll(); },
    onToggleVis: (obj) => {
      obj.visible = !obj.visible;
      canvas.renderAll();
      refreshLayerList();
    },
    onToggleLock: (obj) => {
      obj.locked = !obj.locked;
      obj.selectable = !obj.locked;
      obj.evented    = !obj.locked;
      canvas.renderAll();
      refreshLayerList();
    },
    activeObj: canvas.getActiveObject(),
  });
}

// ─── Toolbar bindings ─────────────────────────────────────────────────────────
function bindEditorToolbar() {
  document.getElementById('btn-undo')?.addEventListener('click', undo);
  document.getElementById('btn-redo')?.addEventListener('click', redo);
  document.getElementById('btn-bring-front')?.addEventListener('click',
    () => window.__editor?.bringForward());
  document.getElementById('btn-send-back')?.addEventListener('click',
    () => window.__editor?.sendBackward());
}

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (!canvas) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const active = canvas.getActiveObject();
      // Don't delete when editing text
      if (active && active.type !== 'i-text' && active.type !== 'IText') deleteSelected(canvas);
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function panelRect(name, geo) {
  return geo.panelRects[name] ?? null;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
