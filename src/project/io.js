/**
 * Project save / load.
 * Format: .bagdesign.json (plain JSON, version-tagged).
 */

import { state, set } from '../state.js';
import { toast } from '../ui/toast.js';

const CURRENT_VERSION = '1.0';

/**
 * Serializes current state to JSON and triggers download.
 * @param {object} appState
 */
export function saveProject(appState) {
  const project = {
    version: CURRENT_VERSION,
    savedAt: new Date().toISOString(),
    bagType: appState.bagType,
    dimensions: { ...appState.dimensions },
    paperName: appState.paperName,
    paperOrientation: appState.paperOrientation,
    paperCustom: { ...appState.paperCustom },
    bleed: appState.bleed,
    cropMarks: appState.cropMarks,
    foldMarks: appState.foldMarks,
    imposition: { ...appState.imposition },
    panelData: { ...appState.panelData },
  };

  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const { W, H, D } = appState.dimensions;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `torba_${W}x${H}x${D}.bagdesign.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Projekt zapisano.', 'ok');
}

/**
 * Parses JSON string and restores state.
 * Returns the loaded state object (partial) or null on failure.
 * @param {string} jsonText
 */
export function loadProject(jsonText) {
  let project;
  try {
    project = JSON.parse(jsonText);
  } catch {
    toast('Nieprawidłowy format pliku JSON.', 'error');
    return null;
  }

  if (!project.version || !project.dimensions) {
    toast('Plik nie jest projektem JoyRoute Bag Designer.', 'error');
    return null;
  }

  // Apply loaded state
  set({
    bagType: project.bagType ?? 'classic',
    dimensions: {
      W: Number(project.dimensions.W) || 120,
      H: Number(project.dimensions.H) || 185,
      D: Number(project.dimensions.D) || 65,
    },
    paperName: project.paperName ?? 'A3',
    paperOrientation: project.paperOrientation ?? 'portrait',
    paperCustom: project.paperCustom ?? { w: 420, h: 594 },
    bleed: Number(project.bleed) || 3,
    cropMarks: project.cropMarks !== false,
    foldMarks: project.foldMarks !== false,
    imposition: {
      margin: project.imposition?.margin ?? 10,
      gutter: project.imposition?.gutter ?? 5,
    },
    panelData: project.panelData ?? {},
  });

  // Update UI inputs to match loaded state
  document.getElementById('bag-type').value = state.bagType;
  document.getElementById('paper-size').value = state.paperName;
  document.getElementById('bleed').value = state.bleed;
  document.getElementById('crop-marks').checked = state.cropMarks;
  document.getElementById('fold-marks').checked = state.foldMarks;
  document.getElementById('imp-margin').value = state.imposition.margin;
  document.getElementById('imp-gutter').value = state.imposition.gutter;

  // Restore orientation button
  document.querySelectorAll('[data-orient]').forEach(b =>
    b.classList.toggle('active', b.dataset.orient === state.paperOrientation));

  toast('Projekt wczytano.', 'ok');
  return state;
}
