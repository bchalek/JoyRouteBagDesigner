// All dimensions in mm, portrait orientation (w < h)
export const PAPER_SIZES = {
  'A0':   { w: 841,  h: 1189 },
  'A1':   { w: 594,  h: 841  },
  'A2':   { w: 420,  h: 594  },
  'A3':   { w: 297,  h: 420  },
  'A4':   { w: 210,  h: 297  },
  'A5':   { w: 148,  h: 210  },
  'B1':   { w: 707,  h: 1000 },
  'B2':   { w: 500,  h: 707  },
  'B3':   { w: 353,  h: 500  },
  'SRA0': { w: 900,  h: 1280 },
  'SRA1': { w: 640,  h: 900  },
  'SRA2': { w: 450,  h: 640  },
  'SRA3': { w: 320,  h: 450  },
};

export const PAPER_ORDER = ['A5','A4','A3','SRA3','A2','SRA2','B3','A1','SRA1','B2','B1','A0','SRA0'];

/**
 * Returns paper dimensions for given name and orientation.
 * @param {string} name
 * @param {'portrait'|'landscape'} orientation
 */
export function getPaperDimensions(name, orientation = 'portrait') {
  const size = PAPER_SIZES[name];
  if (!size) return null;
  if (orientation === 'landscape') return { w: size.h, h: size.w };
  return { w: size.w, h: size.h };
}

/**
 * Finds the smallest standard paper that fits the template (trying both orientations).
 * @param {number} neededW — template width in mm
 * @param {number} neededH — template height in mm
 * @returns {{ name: string, w: number, h: number, orientation: string } | null}
 */
export function findSmallestFittingPaper(neededW, neededH) {
  for (const name of PAPER_ORDER) {
    const size = PAPER_SIZES[name];
    if (size.w >= neededW && size.h >= neededH) {
      return { name, w: size.w, h: size.h, orientation: 'portrait' };
    }
    if (size.h >= neededW && size.w >= neededH) {
      return { name, w: size.h, h: size.w, orientation: 'landscape' };
    }
  }
  return null;
}

/**
 * Human-readable label for a paper size.
 */
export function paperLabel(name, orientation) {
  const size = PAPER_SIZES[name];
  if (!size) return name;
  const [w, h] = orientation === 'landscape' ? [size.h, size.w] : [size.w, size.h];
  return `${name} ${orientation === 'landscape' ? 'poziomy' : 'pionowy'} (${w}×${h}mm)`;
}
