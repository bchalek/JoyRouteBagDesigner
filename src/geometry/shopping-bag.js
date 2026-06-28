/**
 * Traditional shopping bag geometry (from template2.html).
 *
 * Flat layout (left to right):
 *   [RIGHT_GUSSET(D)] [BACK(W)] [LEFT_GUSSET(D)] [FRONT(W)] [GLUE(D/4)]
 *
 * Vertical layout (top to bottom):
 *   [TOP_FLAP = D/2] [BODY (H)] [BOT_FLAP = 0.75D]
 *
 * Handle: rope through 4 holes per panel (2 in front, 2 in back),
 * at y=TOP_FLAP/2 (top flap) and y=TOP_FLAP+D/4 (body, just inside).
 *
 * All coordinates in mm.
 */

/**
 * @param {number} W  – front/back panel width, mm
 * @param {number} H  – body height, mm
 * @param {number} D  – gusset/depth width, mm
 * @param {object} [opts]
 */
export function computeShoppingBag(W, H, D, opts = {}) {
  const GLUE     = Math.max(5, Math.round(D / 4));
  const TOP_FLAP = D / 2;
  const BOT_FLAP = D * 0.75;
  const TAPER    = 1.5; // mm inward taper per side for bottom flaps

  const totalW = 2 * W + 2 * D + GLUE;
  const totalH = TOP_FLAP + H + BOT_FLAP;

  const valid = W > 0 && H > 0 && D > 0;

  // ─── X coordinates ───────────────────────────────────────────────────────────
  const xRightL = 0;
  const xRightR = D;
  const xBackL  = D;
  const xBackR  = D + W;
  const xLeftL  = D + W;
  const xLeftR  = 2 * D + W;
  const xFrontL = 2 * D + W;
  const xFrontR = 2 * D + 2 * W;
  const xGlueR  = 2 * D + 2 * W + GLUE;

  // ─── Y coordinates ───────────────────────────────────────────────────────────
  const yTop   = 0;
  const yFlapB = TOP_FLAP;        // bottom of top flap = top of body
  const yBodyB = TOP_FLAP + H;
  const yBot   = totalH;

  // Coords — named to match flat-view.js renderCutLine and renderDimensions expectations
  const coords = {
    // For renderCutLine bounding rect:
    xGlueL: 0,              // leftmost edge (= xRightL variable)
    xRightR: xGlueR,        // rightmost edge

    // Panel edges (full names for shopping bag)
    xRightGussetL: 0,       // right gusset left
    xRightGussetR: xRightR, // right gusset right
    xBackL, xBackR,
    xLeftL, xLeftR,
    xFrontL, xFrontR, xGlueR,

    // Classic-compatible names for flat-view dimension annotations:
    // W annotation: xFrontL → xRightL (= xFrontR here)
    xRightL: xFrontR,
    // G annotation: xLeftL → xFrontL (= D width) — already above

    // Y coords
    yTop, yBodyT: yFlapB, yBodyB, yBot,
    TOP_FLAP, BOT_FLAP, GLUE,
  };

  // ─── Panel rects ─────────────────────────────────────────────────────────────
  const panelRects = {
    front: { x: xFrontL, y: yFlapB, w: W, h: H, id: 'front', label: 'PRZÓD' },
    back:  { x: xBackL,  y: yFlapB, w: W, h: H, id: 'back',  label: 'TYŁ'   },
    left:  { x: xLeftL,  y: yFlapB, w: D, h: H, id: 'left',  label: 'BOK L'  },
    right: { x: xRightL, y: yFlapB, w: D, h: H, id: 'right', label: 'BOK P'  },
  };

  // ─── Paths ───────────────────────────────────────────────────────────────────
  const GT = Math.min(TAPER * 1.1, D * 0.08); // gusset taper (slightly larger)
  const PT = TAPER;                             // panel taper

  const paths = {
    // Body panels
    front:  rect(xFrontL, yFlapB, W, H),
    back:   rect(xBackL,  yFlapB, W, H),
    left:   rect(xLeftL,  yFlapB, D, H),
    right:  rect(xRightL, yFlapB, D, H),

    // Top flaps
    frontTop: rect(xFrontL, yTop, W, TOP_FLAP),
    backTop:  rect(xBackL,  yTop, W, TOP_FLAP),
    leftTop:  rect(xLeftL,  yTop, D, TOP_FLAP),
    rightTop: rect(xRightL, yTop, D, TOP_FLAP),

    // Glue tab (angled corners: top-right at ~10°, bottom-right at 45°)
    glue: glueTabPath(xFrontR, xGlueR, yTop, yBodyB, GLUE),

    // Bottom flaps (inward taper)
    frontBottom: trapezoid(xFrontL, yBodyB, W, BOT_FLAP, PT),
    backBottom:  trapezoid(xBackL,  yBodyB, W, BOT_FLAP, PT),
    leftBottom:  trapezoid(xLeftL,  yBodyB, D, BOT_FLAP, GT),
    rightBottom: trapezoid(xRightL, yBodyB, D, BOT_FLAP, GT),
  };

  // ─── Fold lines ───────────────────────────────────────────────────────────────
  const foldLines = [];

  // Vertical panel dividers (body height + top flap)
  [xRightR, xBackR, xLeftR, xFrontR].forEach(x => {
    foldLines.push({ x1: x, y1: yTop, x2: x, y2: yBodyB });
  });

  // Horizontal: top flap fold
  foldLines.push({ x1: xRightL, y1: yFlapB, x2: xFrontR, y2: yFlapB });

  // Horizontal: bottom body fold
  foldLines.push({ x1: xRightL, y1: yBodyB, x2: xFrontR, y2: yBodyB });

  // Center fold lines in gussets (for gusset collapse)
  const xRightMid = D / 2;
  const xLeftMid  = xLeftL + D / 2;
  foldLines.push({ x1: xRightMid, y1: yTop, x2: xRightMid, y2: yBot });
  foldLines.push({ x1: xLeftMid,  y1: yTop, x2: xLeftMid,  y2: yBot });

  // Diamond bottom fold lines (gusset bottom construction)
  const yDiamond = yBodyB - D / 2;
  // Right gusset
  foldLines.push({ x1: xRightL,   y1: yBodyB,   x2: xRightMid, y2: yDiamond });
  foldLines.push({ x1: xRightR,   y1: yBodyB,   x2: xRightMid, y2: yDiamond });
  foldLines.push({ x1: xRightL,   y1: yDiamond, x2: xRightR,   y2: yDiamond });
  // Left gusset
  foldLines.push({ x1: xLeftL,    y1: yBodyB,   x2: xLeftMid,  y2: yDiamond });
  foldLines.push({ x1: xLeftR,    y1: yBodyB,   x2: xLeftMid,  y2: yDiamond });
  foldLines.push({ x1: xLeftMid,  y1: yDiamond, x2: xFrontR,   y2: yDiamond });

  // ─── Handle holes ─────────────────────────────────────────────────────────────
  // Rope holes: outer in top flap, inner just inside body
  const R_OUTER = 3;
  const R_INNER = 2.5;
  const Y_OUTER = TOP_FLAP / 2;
  const Y_INNER = TOP_FLAP + Math.min(D / 4, 8);

  const handles = [];
  [
    [xBackL  + W / 4, xBackL  + 3 * W / 4],  // back holes
    [xFrontL + W / 4, xFrontL + 3 * W / 4],  // front holes
  ].forEach(([cx1, cx2]) => {
    handles.push({ cx: cx1, cy: Y_OUTER, r: R_OUTER });
    handles.push({ cx: cx2, cy: Y_OUTER, r: R_OUTER });
    handles.push({ cx: cx1, cy: Y_INNER, r: R_INNER });
    handles.push({ cx: cx2, cy: Y_INNER, r: R_INNER });
  });

  // ─── Cut path ─────────────────────────────────────────────────────────────────
  const glueTopOff = GLUE * 0.176;
  const cutPath = [
    `M${f(xRightL)},${f(yTop)}`,
    `L${f(xFrontR)},${f(yTop)}`,
    `L${f(xGlueR)},${f(glueTopOff)}`,
    `L${f(xGlueR)},${f(yBodyB - GLUE)}`,
    `L${f(xFrontR)},${f(yBodyB)}`,
    // Front bottom flap
    `L${f(xFrontR - PT)},${f(yBot)}`,
    `L${f(xFrontL + PT)},${f(yBot)}`,
    // Up to L gusset junction
    `L${f(xLeftR)},${f(yBodyB)}`,
    // L gusset bottom flap
    `L${f(xLeftR - GT)},${f(yBot)}`,
    `L${f(xLeftL + GT)},${f(yBot)}`,
    // Up to back panel junction
    `L${f(xBackR)},${f(yBodyB)}`,
    // Back bottom flap
    `L${f(xBackR - PT)},${f(yBot)}`,
    `L${f(xBackL + PT)},${f(yBot)}`,
    // Up to R gusset junction
    `L${f(xRightR)},${f(yBodyB)}`,
    // R gusset bottom flap
    `L${f(xRightR - GT)},${f(yBot)}`,
    `L${f(xRightL + GT)},${f(yBot)}`,
    // Back up left side
    `L${f(xRightL)},${f(yBodyB)}`,
    `L${f(xRightL)},${f(yTop)} Z`,
  ].join(' ');

  return {
    W, H, D, GLUE, TOP_FLAP, BOT_FLAP,
    totalW, totalH, valid,
    panelRects, paths, handles, foldLines, cutPath, coords,
  };
}

// ─── Path helpers ─────────────────────────────────────────────────────────────
function rect(x, y, w, h) {
  return `M${f(x)},${f(y)} L${f(x+w)},${f(y)} L${f(x+w)},${f(y+h)} L${f(x)},${f(y+h)} Z`;
}

function trapezoid(x, y, w, h, taper) {
  return `M${f(x)},${f(y)} L${f(x+w)},${f(y)} L${f(x+w-taper)},${f(y+h)} L${f(x+taper)},${f(y+h)} Z`;
}

function glueTabPath(xL, xR, yTop, yBB, glue) {
  const topOff = glue * 0.176;
  return [
    `M${f(xL)},${f(yTop)}`,
    `L${f(xR)},${f(topOff)}`,
    `L${f(xR)},${f(yBB - glue)}`,
    `L${f(xL)},${f(yBB)} Z`,
  ].join(' ');
}

function f(n) { return Math.round(n * 100) / 100; }

// ─── Paper helpers ─────────────────────────────────────────────────────────────
/**
 * Minimum paper needed to print this bag (with bleed on all sides).
 */
export function bagNeededPaper(W, H, D, bleed = 3) {
  const GLUE = Math.max(5, Math.round(D / 4));
  return {
    w: 2 * W + 2 * D + GLUE + 2 * bleed,
    h: H + 1.25 * D + 2 * bleed,
  };
}

/**
 * Given paper size, compute optimal bag dimensions.
 * Uses W = 2×D heuristic (common shopping bag proportion).
 */
export function fitBagToPaper(paperW, paperH, bleed = 3) {
  const avW = paperW - 2 * bleed;
  const avH = paperH - 2 * bleed;

  let best = null;
  for (let d = 15; d <= Math.floor(avW / 5); d++) {
    const glue = Math.max(5, Math.round(d / 4));
    const w = Math.floor((avW - 2 * d - glue) / 2);
    const h = Math.floor(avH - 1.25 * d);
    if (w < 50 || h < 50 || w < d) continue;
    const vol = w * h * d;
    if (!best || vol > best.vol) best = { W: w, H: h, D: d, vol };
  }
  return best ? { W: best.W, H: best.H, D: best.D } : null;
}
