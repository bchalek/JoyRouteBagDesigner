/**
 * Central application state with simple pub/sub.
 * All UI modules read from and write to this object.
 */

const listeners = {};

export const state = {
  bagType: 'classic',           // 'classic' | 'shopping' | 'bottle'
  dimensions: { W: 120, H: 185, D: 65 },
  paperName: 'A3',
  paperOrientation: 'portrait', // 'portrait' | 'landscape'
  paperCustom: { w: 420, h: 594 },
  bleed: 3,
  cropMarks: true,
  foldMarks: true,
  view: 'flat',                 // 'flat' | 'panels' | 'imposition'
  activePanel: 'front',         // currently edited panel name
  imposition: {
    margin: 10,
    gutter: 5,
    auto: true,
    cols: 1,
    rows: 1,
    rotate: false,
  },
  // Fabric.js JSON per panel (populated by panel-editor.js)
  panelData: {
    front: null, back: null, left: null, right: null, top: null,
  },
  // Low-res JPEG data URLs for flat view preview overlay
  panelPreviews: {
    front: null, back: null, left: null, right: null, top: null,
  },
  zoom: 1,
  panX: 0,
  panY: 0,
};

/**
 * Subscribe to state changes.
 * @param {string} key  – top-level state key, or '*' for all changes
 * @param {Function} cb – called with (newValue, key)
 */
export function on(key, cb) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(cb);
}

/**
 * Update one or more state keys and fire listeners.
 * @param {object} patch – partial state object
 */
export function set(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)
        && typeof state[key] === 'object' && state[key] !== null) {
      Object.assign(state[key], value);
    } else {
      state[key] = value;
    }
    (listeners[key] || []).forEach(cb => cb(state[key], key));
  }
  (listeners['*'] || []).forEach(cb => cb(state, '*'));
}

/**
 * Returns effective paper dimensions in mm (custom or named).
 */
export function effectivePaper() {
  if (state.paperName === 'custom') {
    return { ...state.paperCustom };
  }
  const { PAPER_SIZES } = window.__geo ?? {};
  if (!PAPER_SIZES) return { w: 297, h: 420 };
  const size = PAPER_SIZES[state.paperName] ?? { w: 297, h: 420 };
  return state.paperOrientation === 'landscape'
    ? { w: size.h, h: size.w }
    : { w: size.w, h: size.h };
}

/**
 * Returns computed bag geometry based on current state.
 */
export function currentGeometry() {
  const { W, H, D } = state.dimensions;
  const { __geo } = window;
  if (!__geo) return null;
  const fn = state.bagType === 'bottle'
    ? __geo.computeBottleBag
    : state.bagType === 'shopping'
      ? __geo.computeShoppingBag
      : __geo.computeClassicBag;
  return fn(W, H, D, { bleed: state.bleed });
}
