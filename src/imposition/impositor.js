/**
 * Imposition calculator.
 * Tries both orientations (0° and 90°) and picks the layout
 * that fits the most bags. On a tie, prefers 0° (no rotation).
 *
 * All dimensions in mm.
 */

/**
 * @param {number} paperW   – usable paper width
 * @param {number} paperH   – usable paper height
 * @param {number} templateW – single bag template width
 * @param {number} templateH – single bag template height
 * @param {number} margin   – margin from paper edge
 * @param {number} gutter   – gap between bags
 * @param {number} bleed    – bleed already included in paper (reduce available area)
 * @returns {{ cols, rows, count, rotate, positions, efficiency } | null}
 */
export function computeImposition(paperW, paperH, templateW, templateH, margin = 10, gutter = 5, bleed = 0) {
  const avW = paperW - 2 * (margin + bleed);
  const avH = paperH - 2 * (margin + bleed);
  if (avW <= 0 || avH <= 0) return null;

  const layout0  = tryLayout(avW, avH, templateW,  templateH, gutter, false);
  const layout90 = tryLayout(avW, avH, templateH,  templateW, gutter, true);

  if (!layout0 && !layout90) return null;

  const best = (!layout0) ? layout90
             : (!layout90) ? layout0
             : layout90.count > layout0.count ? layout90 : layout0;

  // Generate actual positions
  const positions = [];
  const startX = margin + bleed;
  const startY = margin + bleed;
  const stepW = best.rotate ? templateH : templateW;
  const stepH = best.rotate ? templateW : templateH;
  for (let row = 0; row < best.rows; row++) {
    for (let col = 0; col < best.cols; col++) {
      positions.push({
        x: startX + col * (stepW + gutter),
        y: startY + row * (stepH + gutter),
        rotate: best.rotate,
      });
    }
  }

  const usedArea = best.count * templateW * templateH;
  const paperArea = paperW * paperH;

  return {
    cols: best.cols,
    rows: best.rows,
    count: best.count,
    rotate: best.rotate,
    positions,
    efficiency: usedArea / paperArea,
    templateW,
    templateH,
  };
}

function tryLayout(avW, avH, tW, tH, gutter, rotate) {
  if (tW <= 0 || tH <= 0) return null;
  const cols = Math.floor((avW + gutter) / (tW + gutter));
  const rows = Math.floor((avH + gutter) / (tH + gutter));
  if (cols < 1 || rows < 1) return null;
  return { cols, rows, count: cols * rows, rotate };
}
