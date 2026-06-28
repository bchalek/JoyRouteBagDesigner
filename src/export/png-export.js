/**
 * PNG export — renders the flat view SVG to a high-resolution PNG.
 * Target: 300 DPI (scale factor = 300/96 ≈ 3.125×).
 */

import { toast } from '../ui/toast.js';

const DPI = 300;
const SCREEN_DPI = 96;
const SCALE = DPI / SCREEN_DPI; // ~3.125

export function exportPNG(geo, appState) {
  if (!geo) { toast('Brak geometrii.', 'error'); return; }

  const svg = document.getElementById('flat-svg');
  if (!svg) { toast('Brak podglądu SVG.', 'error'); return; }

  const vb = svg.viewBox.baseVal;
  if (!vb || vb.width === 0) {
    toast('Przejdź do widoku rozniętego przed eksportem PNG.', 'error');
    return;
  }

  // Clone SVG and set explicit mm dimensions so Image.naturalWidth/Height are correct
  const svgClone = svg.cloneNode(true);
  svgClone.setAttribute('width', `${vb.width}mm`);
  svgClone.setAttribute('height', `${vb.height}mm`);

  const svgStr = new XMLSerializer().serializeToString(svgClone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.naturalWidth  * SCALE);
    canvas.height = Math.round(img.naturalHeight * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(SCALE, SCALE);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob(pngBlob => {
      if (!pngBlob) { toast('Błąd eksportu PNG.', 'error'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pngBlob);
      a.download = `torba_${geo.W}x${geo.H}x${geo.D}_300dpi.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('PNG wyeksportowano (300 DPI).', 'ok');
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Błąd renderowania SVG.', 'error');
  };
  img.src = url;
}
