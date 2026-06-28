/**
 * Classic shopper bag geometry.
 *
 * Flat layout (left to right):
 *   [GLUE][BACK(W)][LEFT_DEPTH(D)][FRONT(W)][RIGHT_DEPTH(D)]
 *
 * All coordinates in mm.
 *
 * Layout vertical sections (top to bottom):
 *   [TOP_FLAP (handle area)] [BODY (H)] [BOT_FLAP (bottom closing)]
 */

export const GLUE_W = 15;       // glue strip width, mm
export const TOP_FLAP_H = 40;   // handle area height, mm
export const HOLE_R = 3;        // handle hole radius, mm

/**
 * Computes full geometry for a classic bag.
 *
 * @param {number} W  – bag width (front/back panel width), mm
 * @param {number} H  – bag body height, mm
 * @param {number} D  – bag depth (side panel width), mm
 * @param {object} opts
 * @param {number} [opts.bleed=3]   – bleed margin, mm
 * @param {number} [opts.glue]      – override glue strip width
 * @param {number} [opts.topFlap]   – override top flap height
 * @returns {BagGeometry}
 */
export function computeClassicBag(W, H, D, opts = {}) {
  const glue    = opts.glue    ?? GLUE_W;
  const topFlap = opts.topFlap ?? TOP_FLAP_H;
  const bleed   = opts.bleed   ?? 3;
  const botFlap = Math.round(D * 0.75 * 10) / 10;   // D×0.75, one decimal
  const botCut  = botFlap;                            // diagonal cut offset from panel edge

  // Panel X boundaries
  const xGlueL  = 0;
  const xBackL  = glue;
  const xLeftL  = glue + W;
  const xFrontL = glue + W + D;
  const xRightL = glue + W + D + W;
  const xRightR = glue + W + D + W + D;

  // Panel Y boundaries
  const yTop   = 0;
  const yBodyT = topFlap;
  const yBodyB = topFlap + H;
  const yBot   = topFlap + H + botFlap;

  const totalW = xRightR;
  const totalH = yBot;

  // Inner bottom fold Y (for gusset fold lines)
  const innerFoldY = yBodyB - D / 2;

  // Min width constraint: W >= 1.5 × D (bottom tabs must not overlap)
  const valid = W >= 1.5 * D;
  const centerTabW = W - 2 * botCut;  // width of center bottom tab

  // --- Panel rectangles (body section only) ---
  // Format: { x, y, w, h }
  const panelRects = {
    back:  { x: xBackL,  y: yBodyT, w: W, h: H, id: 'back',  label: 'Tył'     },
    left:  { x: xLeftL,  y: yBodyT, w: D, h: H, id: 'left',  label: 'Bok L'   },
    front: { x: xFrontL, y: yBodyT, w: W, h: H, id: 'front', label: 'Przód'   },
    right: { x: xRightL, y: yBodyT, w: D, h: H, id: 'right', label: 'Bok P'   },
  };

  // --- SVG paths for all faces ---
  // Bottom back/front flap anchor points
  const bkBotL = xBackL  + botCut;    // 15+49=64
  const bkBotR = xLeftL  - botCut;    // 135-49=86
  const frBotL = xFrontL + botCut;    // 200+49=249
  const frBotR = xRightL - botCut;    // 320-49=271

  const paths = {
    // Glue strip (slightly trapezoidal to follow cut angle, simplified as rect here)
    glue: [
      `M${xGlueL},${yBodyT}`,
      `L${xGlueL},${yTop + (glue / totalH) * topFlap}`,   // angled top-left
      `L${xBackL},${yTop}`,
      `L${xBackL},${yBodyT}`,
      'Z',
    ].join(' '),

    // Back panel top flap
    backTop:  rect(xBackL,  yTop, W,    topFlap),
    // Back panel body
    back:     rect(xBackL,  yBodyT, W,  H),
    // Back panel bottom (trapezoid)
    backBot:  `M${xBackL},${yBodyB} L${xLeftL},${yBodyB} L${bkBotR},${yBot} L${bkBotL},${yBot} Z`,
    backBotTL:`M${xBackL},${yBodyB} L${bkBotL},${yBot} L${xBackL},${yBot} Z`,
    backBotTR:`M${xLeftL},${yBodyB} L${xLeftL},${yBot} L${bkBotR},${yBot} Z`,

    // Left depth panel
    leftTop:  rect(xLeftL,  yTop,   D,  topFlap),
    left:     rect(xLeftL,  yBodyT, D,  H),
    leftBot:  rect(xLeftL,  yBodyB, D,  botFlap),

    // Front panel top flap
    frontTop: rect(xFrontL, yTop,   W,  topFlap),
    // Front panel body
    front:    rect(xFrontL, yBodyT, W,  H),
    // Front panel bottom (trapezoid)
    frontBot: `M${xFrontL},${yBodyB} L${xRightL},${yBodyB} L${frBotR},${yBot} L${frBotL},${yBot} Z`,
    frontBotTL:`M${xFrontL},${yBodyB} L${frBotL},${yBot} L${xFrontL},${yBot} Z`,
    frontBotTR:`M${xRightL},${yBodyB} L${xRightL},${yBot} L${frBotR},${yBot} Z`,

    // Right depth panel
    rightTop: rect(xRightL, yTop,   D,  topFlap),
    right:    rect(xRightL, yBodyT, D,  H),
    rightBot: rect(xRightL, yBodyB, D,  botFlap),
  };

  // --- Handle holes ---
  const holeY = topFlap / 2;
  const holeOffset = W / 4;
  const handles = [
    { cx: xBackL  + holeOffset,   cy: holeY, r: HOLE_R, panel: 'back'  },
    { cx: xBackL  + W - holeOffset, cy: holeY, r: HOLE_R, panel: 'back'  },
    { cx: xFrontL + holeOffset,   cy: holeY, r: HOLE_R, panel: 'front' },
    { cx: xFrontL + W - holeOffset, cy: holeY, r: HOLE_R, panel: 'front' },
  ];

  // --- Fold lines ---
  // type: 'valley' = fold toward you, 'mountain' = fold away (for printing)
  const foldLines = [
    // Panel boundary verticals
    { x1: xBackL,  y1: yTop, x2: xBackL,  y2: yBot, type: 'fold' },
    { x1: xLeftL,  y1: yTop, x2: xLeftL,  y2: yBot, type: 'fold' },
    { x1: xFrontL, y1: yTop, x2: xFrontL, y2: yBot, type: 'fold' },
    { x1: xRightL, y1: yTop, x2: xRightL, y2: yBot, type: 'fold' },

    // Depth panel center verticals
    { x1: xLeftL  + D/2, y1: yTop, x2: xLeftL  + D/2, y2: yBot, type: 'fold' },
    { x1: xRightL + D/2, y1: yTop, x2: xRightL + D/2, y2: yBot, type: 'fold' },

    // Horizontal: top flap fold
    { x1: xBackL, y1: yBodyT, x2: xLeftL,  y2: yBodyT, type: 'fold' },
    { x1: xLeftL, y1: yBodyT, x2: xFrontL, y2: yBodyT, type: 'fold' },
    { x1: xFrontL,y1: yBodyT, x2: xRightL, y2: yBodyT, type: 'fold' },
    { x1: xRightL,y1: yBodyT, x2: xRightR, y2: yBodyT, type: 'fold' },
    { x1: xGlueL, y1: yBodyT, x2: xBackL,  y2: yBodyT, type: 'fold' },

    // Horizontal: bottom body fold
    { x1: xGlueL, y1: yBodyB, x2: xRightR, y2: yBodyB, type: 'fold' },

    // Inner bottom fold (partial — only side depth panels)
    { x1: xGlueL,       y1: innerFoldY, x2: xLeftL + D/2, y2: innerFoldY, type: 'fold' },
    { x1: xRightL + D/2, y1: innerFoldY, x2: xRightR,     y2: innerFoldY, type: 'fold' },

    // Left depth panel bottom diagonals
    { x1: xBackL,       y1: yBodyB, x2: xLeftL + D/2, y2: innerFoldY, type: 'fold' },
    { x1: xLeftL + D/2, y1: innerFoldY, x2: xFrontL, y2: yBodyB,     type: 'fold' },

    // Right depth panel bottom diagonals
    { x1: xRightL,       y1: yBodyB, x2: xRightL + D/2, y2: innerFoldY, type: 'fold' },
    { x1: xRightL + D/2, y1: innerFoldY, x2: xRightR,   y2: yBodyB,    type: 'fold' },

    // Glue strip bottom diagonal
    { x1: xGlueL, y1: yBodyB - glue, x2: xBackL, y2: yBodyB, type: 'fold' },

    // Back panel bottom diagonals (to center tab)
    { x1: xBackL, y1: yBodyB, x2: bkBotL, y2: yBot, type: 'fold' },
    { x1: xLeftL, y1: yBodyB, x2: bkBotR, y2: yBot, type: 'fold' },

    // Front panel bottom diagonals
    { x1: xFrontL, y1: yBodyB, x2: frBotL, y2: yBot, type: 'fold' },
    { x1: xRightL, y1: yBodyB, x2: frBotR, y2: yBot, type: 'fold' },
  ];

  // --- Outer cut line ---
  // Slightly trapezoidal at left edge (glue strip angled), plus bleed
  const B = bleed;
  const cutAngleOffset = glue * 0.066 * totalH;  // small angle at left edge
  const cutPath = [
    `M${-B},${-B}`,
    `L${totalW + B},${-B}`,
    `L${totalW + B},${totalH + B}`,
    `L${-B},${totalH + B}`,
    'Z',
  ].join(' ');

  return {
    // Input dimensions
    W, H, D, glue, topFlap, botFlap, botCut, bleed,
    // Layout totals
    totalW, totalH, valid, centerTabW, innerFoldY,
    // X/Y key coordinates
    coords: { xGlueL, xBackL, xLeftL, xFrontL, xRightL, xRightR, yTop, yBodyT, yBodyB, yBot },
    // Renderables
    panelRects, paths, handles, foldLines, cutPath,
  };
}

/**
 * Computes minimum paper size needed to print this bag.
 * @param {number} W @param {number} H @param {number} D @param {number} bleed
 */
export function bagNeededPaper(W, H, D, bleed = 3) {
  const glue    = GLUE_W;
  const topFlap = TOP_FLAP_H;
  const botFlap = D * 0.75;
  return {
    w: glue + 2*W + 2*D + 2*bleed,
    h: topFlap + H + botFlap + 2*bleed,
  };
}

/**
 * Given paper dimensions, suggests optimal bag dimensions.
 * Strategy: fix D = paperW/9, maximize W and H.
 * @param {number} paperW @param {number} paperH @param {number} bleed
 */
export function fitBagToPaper(paperW, paperH, bleed = 3) {
  const avW = paperW - 2 * bleed;
  const avH = paperH - 2 * bleed;

  // Try a range of D values and pick the one that maximizes W*H*D
  let best = null;
  for (let d = 20; d <= Math.floor(avW / 4); d++) {
    const w = Math.floor((avW - GLUE_W - 2 * d) / 2);
    const h = Math.floor(avH - TOP_FLAP_H - d * 0.75);
    if (w < 50 || h < 50) continue;
    if (w < 1.5 * d) continue;
    const vol = w * h * d;
    if (!best || vol > best.vol) best = { W: w, H: h, D: d, vol };
  }
  return best ? { W: best.W, H: best.H, D: best.D } : null;
}

// Helper: SVG rect path string
function rect(x, y, w, h) {
  return `M${x},${y} L${x+w},${y} L${x+w},${y+h} L${x},${y+h} Z`;
}
