/**
 * Imposition preview SVG renderer.
 * Shows all bag copies positioned on the paper sheet.
 */

import { state, currentGeometry, effectivePaper } from '../state.js';
import { computeImposition } from '../imposition/impositor.js';

export function renderImposition() {
  const svg = document.getElementById('imposition-svg');
  if (!svg) return;

  svg.replaceChildren();

  const geo   = currentGeometry();
  const paper = effectivePaper();
  if (!geo) return;

  const { margin, gutter } = state.imposition;
  const imp = computeImposition(
    paper.w, paper.h,
    geo.totalW, geo.totalH,
    margin, gutter,
    state.bleed
  );

  const PAD = 15;
  const vbW = paper.w + PAD * 2;
  const vbH = paper.h + PAD * 2;
  svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${vbW} ${vbH}`);

  // Paper
  svg.appendChild(svgEl('rect', {
    x: 0, y: 0, width: paper.w, height: paper.h,
    fill: '#f8f8f8', stroke: '#888', 'stroke-width': 0.5,
  }));

  // Bleed boundary
  const B = state.bleed;
  svg.appendChild(svgEl('rect', {
    x: B, y: B, width: paper.w - 2*B, height: paper.h - 2*B,
    fill: 'none', stroke: '#aaa', 'stroke-width': 0.3,
    'stroke-dasharray': '2 2',
  }));

  if (!imp) {
    const t = svgEl('text', {
      x: paper.w / 2, y: paper.h / 2,
      'text-anchor': 'middle', fill: '#cc4444',
      'font-size': 12, 'font-family': 'Arial',
    });
    t.textContent = 'Szablon nie mieści się na papierze';
    svg.appendChild(t);
    return;
  }

  // Draw each bag instance
  imp.positions.forEach((pos, i) => {
    const g = svgEl('g', {
      transform: pos.rotate
        ? `translate(${pos.x + geo.totalH},${pos.y}) rotate(90)`
        : `translate(${pos.x},${pos.y})`,
    });

    // Bag outline
    g.appendChild(svgEl('rect', {
      x: 0, y: 0,
      width: geo.totalW, height: geo.totalH,
      fill: `hsl(${(i * 37) % 360},60%,92%)`,
      stroke: '#6666aa', 'stroke-width': 0.4,
    }));

    // Panel dividers (simplified)
    const { coords: c } = geo;
    [c.xBackL, c.xLeftL, c.xFrontL, c.xRightL].forEach(x => {
      g.appendChild(svgEl('line', {
        x1: x, y1: 0, x2: x, y2: geo.totalH,
        stroke: '#9999bb', 'stroke-width': 0.2,
      }));
    });
    [c.yBodyT, c.yBodyB].forEach(y => {
      g.appendChild(svgEl('line', {
        x1: 0, y1: y, x2: geo.totalW, y2: y,
        stroke: '#9999bb', 'stroke-width': 0.2,
      }));
    });

    // Number label
    const t = svgEl('text', {
      x: geo.totalW / 2, y: geo.totalH / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#6666aa', 'font-size': Math.min(12, geo.totalW * 0.1),
      'font-family': 'Arial',
    });
    t.textContent = String(i + 1);
    g.appendChild(t);

    svg.appendChild(g);
  });

  // Paper dimensions label
  const dimLabel = svgEl('text', {
    x: paper.w / 2, y: paper.h + PAD * 0.6,
    'text-anchor': 'middle', fill: '#888',
    'font-size': 5, 'font-family': 'Arial',
  });
  dimLabel.textContent = `${paper.w}×${paper.h}mm — ${imp.count} szt. (${imp.cols}×${imp.rows}${imp.rotate ? ' obrót 90°' : ''}) — odpad ${Math.round((1 - imp.efficiency) * 100)}%`;
  svg.appendChild(dimLabel);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
