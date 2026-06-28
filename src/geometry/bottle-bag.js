/**
 * Bottle bag geometry (narrow tall bag).
 *
 * Layout (left to right):
 *   [GLUE][SIDE(D/2)][FRONT(W)][SIDE(D/2)][BACK(W)][SIDE(D/2)]
 *
 * The bottom is a simple rectangular flap (no gusset triangles).
 * Top is open (no flap for bottle bags — just reinforced edge).
 *
 * All coordinates in mm.
 */

export const GLUE_W = 10;

/**
 * @param {number} W  – front/back panel width, mm
 * @param {number} H  – body height, mm
 * @param {number} D  – side panel width (= bag depth), mm
 * @param {object} opts
 * @param {number} [opts.bleed=3]
 * @param {number} [opts.topFlap=20]   – small reinforcement at top
 * @param {number} [opts.botFlap]      – bottom closing flap (default D/2 + 10)
 */
export function computeBottleBag(W, H, D, opts = {}) {
  const glue    = GLUE_W;
  const topFlap = opts.topFlap ?? 20;
  const botFlap = opts.botFlap ?? Math.round(D / 2 + 10);
  const bleed   = opts.bleed   ?? 3;

  // Layout: GLUE | SIDE(D) | FRONT(W) | SIDE(D) | BACK(W) | SIDE_PARTIAL(D-GLUE)
  // Simplified: glue | front(W) | left(D) | back(W) | right(D)
  const xGlueL  = 0;
  const xFrontL = glue;
  const xLeftL  = glue + W;
  const xBackL  = glue + W + D;
  const xRightL = glue + W + D + W;
  const xRightR = glue + W + D + W + D;

  const yTop   = 0;
  const yBodyT = topFlap;
  const yBodyB = topFlap + H;
  const yBot   = topFlap + H + botFlap;

  const totalW = xRightR;
  const totalH = yBot;

  const valid = W > 0 && H > 0 && D > 0;

  const panelRects = {
    front: { x: xFrontL, y: yBodyT, w: W, h: H, id: 'front', label: 'Przód' },
    left:  { x: xLeftL,  y: yBodyT, w: D, h: H, id: 'left',  label: 'Bok L' },
    back:  { x: xBackL,  y: yBodyT, w: W, h: H, id: 'back',  label: 'Tył'   },
    right: { x: xRightL, y: yBodyT, w: D, h: H, id: 'right', label: 'Bok P' },
  };

  const paths = {
    glue:     rect(xGlueL,  yBodyT, glue, H),
    frontTop: rect(xFrontL, yTop,   W, topFlap),
    front:    rect(xFrontL, yBodyT, W, H),
    frontBot: rect(xFrontL, yBodyB, W, botFlap),
    leftTop:  rect(xLeftL,  yTop,   D, topFlap),
    left:     rect(xLeftL,  yBodyT, D, H),
    leftBot:  rect(xLeftL,  yBodyB, D, botFlap),
    backTop:  rect(xBackL,  yTop,   W, topFlap),
    back:     rect(xBackL,  yBodyT, W, H),
    backBot:  rect(xBackL,  yBodyB, W, botFlap),
    rightTop: rect(xRightL, yTop,   D, topFlap),
    right:    rect(xRightL, yBodyT, D, H),
    rightBot: rect(xRightL, yBodyB, D, botFlap),
  };

  // No handle holes for bottle bags (open top)
  const handles = [];

  const foldLines = [
    { x1: xFrontL, y1: yTop, x2: xFrontL, y2: yBot, type: 'fold' },
    { x1: xLeftL,  y1: yTop, x2: xLeftL,  y2: yBot, type: 'fold' },
    { x1: xBackL,  y1: yTop, x2: xBackL,  y2: yBot, type: 'fold' },
    { x1: xRightL, y1: yTop, x2: xRightL, y2: yBot, type: 'fold' },
    { x1: xGlueL,  y1: yBodyT, x2: xRightR, y2: yBodyT, type: 'fold' },
    { x1: xGlueL,  y1: yBodyB, x2: xRightR, y2: yBodyB, type: 'fold' },
    // Depth panel centers
    { x1: xLeftL  + D/2, y1: yTop, x2: xLeftL  + D/2, y2: yBot, type: 'fold' },
    { x1: xRightL + D/2, y1: yTop, x2: xRightL + D/2, y2: yBot, type: 'fold' },
  ];

  const cutPath = [
    `M${-bleed},${-bleed}`,
    `L${totalW + bleed},${-bleed}`,
    `L${totalW + bleed},${totalH + bleed}`,
    `L${-bleed},${totalH + bleed}`,
    'Z',
  ].join(' ');

  return {
    W, H, D, glue, topFlap, botFlap, bleed,
    totalW, totalH, valid,
    coords: { xGlueL, xFrontL, xLeftL, xBackL, xRightL, xRightR, yTop, yBodyT, yBodyB, yBot },
    panelRects, paths, handles, foldLines, cutPath,
  };
}

export function bagNeededPaper(W, H, D, bleed = 3) {
  const botFlap = Math.round(D / 2 + 10);
  return {
    w: GLUE_W + 2*W + 2*D + 2*bleed,
    h: 20 + H + botFlap + 2*bleed,
  };
}

export function fitBagToPaper(paperW, paperH, bleed = 3) {
  const avW = paperW - 2 * bleed;
  const avH = paperH - 2 * bleed;
  let best = null;
  for (let d = 20; d <= Math.floor(avW / 4); d++) {
    const w = Math.floor((avW - GLUE_W - 2 * d) / 2);
    const h = Math.floor(avH - 20 - d / 2 - 10);
    if (w < 40 || h < 80) continue;
    const vol = w * h * d;
    if (!best || vol > best.vol) best = { W: w, H: h, D: d, vol };
  }
  return best ? { W: best.W, H: best.H, D: best.D } : null;
}

function rect(x, y, w, h) {
  return `M${x},${y} L${x+w},${y} L${x+w},${y+h} L${x},${y+h} Z`;
}
