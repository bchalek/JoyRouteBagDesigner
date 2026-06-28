/**
 * SVG export — exports the full unfolded bag template as a clean SVG file.
 * Includes all panels, fold lines, cut line, handle holes, and bleed boundary.
 */

import { toast } from '../ui/toast.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {object} geo   – bag geometry
 * @param {object} appState – application state
 */
export function exportSVG(geo, appState) {
  if (!geo) { toast('Brak geometrii torebki.', 'error'); return; }

  const paper = effectivePaperFromState(appState);
  const offsetX = (paper.w - geo.totalW) / 2;
  const offsetY = (paper.h - geo.totalH) / 2;
  const B = appState.bleed ?? 3;
  const totalW = paper.w + 2 * B;
  const totalH = paper.h + 2 * B;

  const root = document.createElementNS(NS, 'svg');
  root.setAttribute('xmlns', NS);
  root.setAttribute('version', '1.1');
  root.setAttribute('width', `${totalW}mm`);
  root.setAttribute('height', `${totalH}mm`);
  root.setAttribute('viewBox', `${-B} ${-B} ${totalW} ${totalH}`);

  // Metadata
  const meta = document.createElementNS(NS, 'metadata');
  const desc = document.createElementNS(NS, 'desc');
  desc.textContent = `JoyRoute Bag Designer | W=${geo.W}mm H=${geo.H}mm D=${geo.D}mm`;
  meta.appendChild(desc);
  root.appendChild(meta);

  // Paper background
  root.appendChild(el('rect', { x: 0, y: 0, width: paper.w, height: paper.h,
    fill: '#ffffff', stroke: 'none' }));

  // Bleed boundary
  root.appendChild(el('rect', { x: B, y: B, width: paper.w - 2*B, height: paper.h - 2*B,
    fill: 'none', stroke: '#aaaacc', 'stroke-width': '0.3',
    'stroke-dasharray': '2 2' }));

  // Bag group (positioned on paper)
  const bag = el('g', { transform: `translate(${offsetX},${offsetY})`,
    id: 'bag-template', 'inkscape:label': 'Szablon torebki' });

  // Layer: Faces (print area)
  const layerFaces = el('g', { id: 'layer-faces', 'inkscape:label': 'Panele' });
  for (const [, d] of Object.entries(geo.paths)) {
    layerFaces.appendChild(el('path', { d, fill: '#ffffff', stroke: '#ddddee', 'stroke-width': '0.2' }));
  }
  bag.appendChild(layerFaces);

  // Layer: Fold lines
  if (appState.foldMarks !== false) {
    const layerFolds = el('g', { id: 'layer-folds', 'inkscape:label': 'Bigowanie',
      stroke: '#6666bb', 'stroke-width': '0.3', 'stroke-dasharray': '2 1', fill: 'none' });
    for (const l of geo.foldLines) {
      layerFolds.appendChild(el('line', { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }));
    }
    bag.appendChild(layerFolds);
  }

  // Layer: Cut line (use exact cut path if available, else bounding rect)
  const layerCut = el('g', { id: 'layer-cut', 'inkscape:label': 'Cięcie' });
  if (geo.cutPath) {
    layerCut.appendChild(el('path', {
      d: geo.cutPath, fill: 'none', stroke: '#0033ff', 'stroke-width': '0.5',
    }));
  } else {
    layerCut.appendChild(el('rect', {
      x: geo.coords.xGlueL, y: geo.coords.yTop,
      width: geo.totalW, height: geo.totalH,
      fill: 'none', stroke: '#0033ff', 'stroke-width': '0.5',
    }));
  }
  bag.appendChild(layerCut);

  // Layer: Handle holes
  if (geo.handles.length > 0) {
    const layerHoles = el('g', { id: 'layer-holes', 'inkscape:label': 'Dziurki na uszy' });
    for (const h of geo.handles) {
      layerHoles.appendChild(el('circle', {
        cx: h.cx, cy: h.cy, r: h.r,
        fill: 'white', stroke: '#0033ff', 'stroke-width': '0.4',
      }));
    }
    bag.appendChild(layerHoles);
  }

  root.appendChild(bag);

  // Crop marks
  if (appState.cropMarks !== false) {
    root.appendChild(buildCropMarks(paper, B));
  }

  // Serialize and download
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(root);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `torba_${geo.W}x${geo.H}x${geo.D}.svg`);
  toast('SVG wyeksportowano.', 'ok');
}

function buildCropMarks(paper, B) {
  const g = el('g', { id: 'crop-marks', stroke: '#000000', 'stroke-width': '0.25', fill: 'none' });
  const LEN = 5, GAP = 2;
  [[0, 0], [paper.w, 0], [0, paper.h], [paper.w, paper.h]].forEach(([x, y]) => {
    const sx = x === 0 ? -1 : 1;
    const sy = y === 0 ? -1 : 1;
    g.appendChild(el('line', { x1: x + sx*GAP, y1: y, x2: x + sx*(GAP+LEN), y2: y }));
    g.appendChild(el('line', { x1: x, y1: y + sy*GAP, x2: x, y2: y + sy*(GAP+LEN) }));
  });
  return g;
}

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

function effectivePaperFromState(st) {
  if (st.paperName === 'custom') return { ...st.paperCustom };
  const sizes = {
    'A0':{w:841,h:1189},'A1':{w:594,h:841},'A2':{w:420,h:594},'A3':{w:297,h:420},
    'A4':{w:210,h:297},'A5':{w:148,h:210},'B1':{w:707,h:1000},'B2':{w:500,h:707},
    'SRA3':{w:320,h:450},'SRA2':{w:450,h:640},
  };
  const s = sizes[st.paperName] ?? {w:297,h:420};
  return st.paperOrientation === 'landscape' ? {w:s.h,h:s.w} : s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
