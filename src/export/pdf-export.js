/**
 * PDF export for printing.
 *
 * Strategy (browser-side, no backend):
 *   1. Render each panel's Fabric.js canvas to PNG at 300 DPI.
 *   2. Use pdf-lib to create a PDF page sized to the paper.
 *   3. Embed panel PNGs in the correct positions on the page.
 *   4. Draw cut line and fold lines as native PDF vector paths.
 *   5. Add crop marks and bleed guides as vector paths.
 *   6. For imposition: repeat layout N times on the page.
 *
 * Color space: sRGB (browser limitation — CMYK requires server-side).
 */

import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { computeImposition } from '../imposition/impositor.js';
import { toast } from '../ui/toast.js';

const MM_TO_PT = 2.8346;   // 1mm = 2.8346 PDF points
const MM_TO_PX = 3.7795;   // 1mm = 3.7795 px at 96 DPI
const RENDER_SCALE = 3.125; // 300 DPI / 96 DPI

/**
 * @param {object} appState
 * @param {object} geo
 * @param {object} paper  – { w, h } in mm
 */
export async function exportPDF(appState, geo, paper) {
  if (!geo) { toast('Brak geometrii.', 'error'); return; }

  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`JoyRoute Bag — W${geo.W}×H${geo.H}×G${geo.D}mm`);
    pdfDoc.setAuthor('JoyRoute Bag Designer');

    const { margin, gutter } = appState.imposition;
    const bleed = appState.bleed ?? 3;

    // Compute imposition layout
    const imp = computeImposition(
      paper.w, paper.h, geo.totalW, geo.totalH, margin, gutter, bleed
    );
    const positions = imp ? imp.positions : [{
      x: (paper.w - geo.totalW) / 2,
      y: (paper.h - geo.totalH) / 2,
      rotate: false,
    }];

    // Page size in PDF points (paper + bleed on all sides)
    const pageW = (paper.w + 2 * bleed) * MM_TO_PT;
    const pageH = (paper.h + 2 * bleed) * MM_TO_PT;

    const page = pdfDoc.addPage([pageW, pageH]);

    // White background
    page.drawRectangle({
      x: 0, y: 0, width: pageW, height: pageH,
      color: rgb(1, 1, 1),
    });

    // Bleed boundary (dashed — PDF doesn't natively support dash easily, draw as thin rect)
    drawRect(page, bleed, bleed, paper.w, paper.h, { color: rgb(0.7, 0.7, 0.8), thickness: 0.3 });

    // Render panel graphics (Fabric.js canvases → PNG → embed in PDF)
    const panelImages = await renderPanelImages(appState.panelData);

    // Draw each bag position
    for (const pos of positions) {
      await drawBagAtPosition(page, pdfDoc, geo, pos, panelImages, bleed, appState);
    }

    // Crop marks
    if (appState.cropMarks !== false) {
      drawCropMarks(page, paper, bleed);
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    downloadBlob(blob, `torba_${geo.W}x${geo.H}x${geo.D}.pdf`);
    toast('PDF wyeksportowano.', 'ok');
  } catch (err) {
    console.error('PDF export error:', err);
    toast(`Błąd eksportu PDF: ${err.message}`, 'error');
  }
}

// ─── Draw one bag on the page ─────────────────────────────────────────────────
async function drawBagAtPosition(page, pdfDoc, geo, pos, panelImages, bleed, appState) {
  const bX = (pos.x + bleed) * MM_TO_PT;
  const bY = page.getHeight() - (pos.y + bleed + geo.totalH) * MM_TO_PT;

  // Panel fills (white rectangles)
  for (const [, rect] of Object.entries(geo.panelRects)) {
    const px = bX + rect.x * MM_TO_PT;
    const py = bY + (geo.totalH - rect.y - rect.h) * MM_TO_PT;
    page.drawRectangle({
      x: px, y: py,
      width:  rect.w * MM_TO_PT,
      height: rect.h * MM_TO_PT,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.8, 0.8, 0.9),
      borderWidth: 0.2,
    });

    // Embed panel graphic if available
    const img = panelImages[rect.id];
    if (img) {
      try {
        const embedded = await pdfDoc.embedPng(img);
        page.drawImage(embedded, {
          x: px, y: py,
          width:  rect.w * MM_TO_PT,
          height: rect.h * MM_TO_PT,
        });
      } catch (_) { /* skip if embed fails */ }
    }
  }

  // Fold lines
  if (appState.foldMarks !== false) {
    for (const l of geo.foldLines) {
      drawLine(page,
        bX + l.x1 * MM_TO_PT, bY + (geo.totalH - l.y1) * MM_TO_PT,
        bX + l.x2 * MM_TO_PT, bY + (geo.totalH - l.y2) * MM_TO_PT,
        { color: rgb(0.4, 0.4, 0.7), thickness: 0.3 }
      );
    }
  }

  // Cut line (use exact cut path when available, else bounding rect)
  if (geo.cutPath) {
    drawSVGPathLines(page, geo.cutPath, bX, bY, geo.totalH,
      { color: rgb(0.1, 0.2, 0.9), thickness: 0.5 });
  } else {
    drawRect(page, 0, 0, geo.totalW, geo.totalH,
      { color: rgb(0.1, 0.2, 0.9), thickness: 0.5, offsetPt: { x: bX, y: bY } });
  }

  // Handle holes
  for (const h of geo.handles) {
    page.drawEllipse({
      x: bX + h.cx * MM_TO_PT,
      y: bY + (geo.totalH - h.cy) * MM_TO_PT,
      xScale: h.r * MM_TO_PT,
      yScale: h.r * MM_TO_PT,
      color:       rgb(1, 1, 1),
      borderColor: rgb(0.1, 0.2, 0.9),
      borderWidth: 0.4,
    });
  }
}

// ─── Render Fabric.js canvases to PNG data ────────────────────────────────────
async function renderPanelImages(panelData) {
  const result = {};
  for (const [panelName, json] of Object.entries(panelData ?? {})) {
    if (!json) continue;
    try {
      // Create off-screen canvas to render Fabric.js JSON
      // We re-import fabric dynamically to avoid circular dep issues at module load
      const { Canvas } = await import('fabric');
      const tempEl = document.createElement('canvas');
      tempEl.id = `__export_canvas_${panelName}`;
      tempEl.style.display = 'none';
      document.body.appendChild(tempEl);

      const fc = new Canvas(tempEl.id, {
        width: json.width ?? 400,
        height: json.height ?? 400,
      });
      await fc.loadFromJSON(json);
      fc.renderAll();
      const dataUrl = fc.toDataURL({ format: 'png', multiplier: RENDER_SCALE });
      result[panelName] = dataUrlToUint8Array(dataUrl);
      fc.dispose();
      tempEl.remove();
    } catch (e) {
      // Skip panels that fail to render
    }
  }
  return result;
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ─── PDF drawing helpers ──────────────────────────────────────────────────────
function drawLine(page, x1, y1, x2, y2, { color, thickness }) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

// Parses SVG M/L path commands (in mm) and draws each segment as a PDF line.
// Handles the Y-axis flip: SVG y-down → PDF y-up.
function drawSVGPathLines(page, svgPath, bX, bY, totalH, { color, thickness }) {
  const tokens = svgPath.match(/[ML][^MLZ]*/gi) || [];
  let prevPx = 0, prevPy = 0, firstPx = 0, firstPy = 0, started = false;
  for (const tok of tokens) {
    const type = tok[0].toUpperCase();
    const nums = tok.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    if (nums.length < 2) continue;
    const px = bX + nums[0] * MM_TO_PT;
    const py = bY + (totalH - nums[1]) * MM_TO_PT;
    if (type === 'M') {
      firstPx = px; firstPy = py; prevPx = px; prevPy = py; started = true;
    } else if (type === 'L' && started) {
      drawLine(page, prevPx, prevPy, px, py, { color, thickness });
      prevPx = px; prevPy = py;
    }
  }
  if (started && (Math.abs(prevPx - firstPx) > 0.1 || Math.abs(prevPy - firstPy) > 0.1)) {
    drawLine(page, prevPx, prevPy, firstPx, firstPy, { color, thickness });
  }
}

function drawRect(page, xMm, yMm, wMm, hMm, { color, thickness, offsetPt }) {
  const x = offsetPt ? offsetPt.x : xMm * MM_TO_PT;
  const y = offsetPt ? offsetPt.y : yMm * MM_TO_PT;
  const w = wMm * MM_TO_PT;
  const h = hMm * MM_TO_PT;
  page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: thickness, color: undefined });
}

function drawCropMarks(page, paper, bleed) {
  const LEN_PT = 5 * MM_TO_PT;
  const GAP_PT = 2 * MM_TO_PT;
  const C = rgb(0, 0, 0);
  const TH = 0.3;
  const pH = page.getHeight();
  const corners = [
    [bleed, bleed, -1, -1],
    [bleed + paper.w, bleed, 1, -1],
    [bleed, bleed + paper.h, -1, 1],
    [bleed + paper.w, bleed + paper.h, 1, 1],
  ];
  for (const [xMm, yMm, sx, sy] of corners) {
    const x  = xMm * MM_TO_PT;
    const y  = pH - yMm * MM_TO_PT;
    drawLine(page, x + sx*GAP_PT, y, x + sx*(GAP_PT+LEN_PT), y, { color: C, thickness: TH });
    drawLine(page, x, y - sy*GAP_PT, x, y - sy*(GAP_PT+LEN_PT), { color: C, thickness: TH });
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
