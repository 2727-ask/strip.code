// Hand-drawn single-stroke neon letters, shared by the 3D sign (neon.js) and the
// flat age-gate sign (gate.js). Plain data, no imports, so the gate does not have
// to download three.js.
//
// Letters live on a grid where capitals are 1 tall and lowercase is 0.6. Each
// letter is one or more strokes (neon is a continuous tube); a stroke is a smooth
// curve through its points. Only these letters can be used for NEON.text.

export const GLYPHS = {
  S: {
    advance: 0.62,
    strokes: [
      {
        pts: [
          [0.56, 0.84], [0.46, 0.96], [0.3, 1.0], [0.14, 0.96], [0.04, 0.84], [0.06, 0.7], [0.18, 0.6],
          [0.32, 0.52], [0.48, 0.44], [0.58, 0.32], [0.58, 0.18], [0.48, 0.05], [0.3, 0.0], [0.13, 0.04], [0.02, 0.16],
        ],
      },
    ],
  },
  t: {
    advance: 0.4,
    strokes: [
      { pts: [[0.18, 0.9], [0.18, 0.5], [0.18, 0.18], [0.23, 0.06], [0.34, 0.02], [0.42, 0.07]] },
      { pts: [[0.0, 0.6], [0.4, 0.6]] },
    ],
  },
  r: {
    advance: 0.42,
    strokes: [
      { pts: [[0.0, 0.6], [0.0, 0.0]] },
      { pts: [[0.0, 0.4], [0.08, 0.54], [0.22, 0.6], [0.36, 0.57], [0.42, 0.5]] },
    ],
  },
  i: {
    advance: 0.02,
    strokes: [
      { pts: [[0.0, 0.6], [0.0, 0.0]] },
      { pts: [[0.0, 0.86], [0.0, 0.88]] }, // the dot
    ],
  },
  p: {
    advance: 0.5,
    strokes: [
      { pts: [[0.0, 0.6], [0.0, -0.38]] },
      { pts: [[0.0, 0.5], [0.1, 0.6], [0.26, 0.64], [0.42, 0.56], [0.5, 0.35], [0.44, 0.12], [0.28, 0.0], [0.1, 0.04], [0.0, 0.14]] },
    ],
  },
  C: {
    advance: 0.6,
    strokes: [
      {
        pts: [
          [0.6, 0.84], [0.5, 0.96], [0.32, 1.0], [0.14, 0.94], [0.03, 0.76], [0.0, 0.5],
          [0.03, 0.24], [0.14, 0.06], [0.32, 0.0], [0.5, 0.04], [0.6, 0.16],
        ],
      },
    ],
  },
  o: {
    advance: 0.54,
    strokes: [
      {
        closed: true,
        pts: [[0.54, 0.3], [0.46, 0.51], [0.27, 0.6], [0.08, 0.51], [0.0, 0.3], [0.08, 0.09], [0.27, 0.0], [0.46, 0.09]],
      },
    ],
  },
  d: {
    advance: 0.54,
    strokes: [
      { pts: [[0.54, 1.0], [0.54, 0.0]] },
      {
        closed: true,
        pts: [[0.54, 0.3], [0.46, 0.51], [0.27, 0.6], [0.08, 0.51], [0.0, 0.3], [0.08, 0.09], [0.27, 0.0], [0.46, 0.09]],
      },
    ],
  },
  e: {
    advance: 0.54,
    strokes: [
      {
        pts: [
          [0.0, 0.3], [0.27, 0.3], [0.54, 0.3], [0.54, 0.42], [0.46, 0.54], [0.28, 0.6], [0.1, 0.52], [0.0, 0.3],
          [0.08, 0.09], [0.27, 0.0], [0.45, 0.04], [0.54, 0.14],
        ],
      },
    ],
  },
};

export const LETTER_GAP = 0.2;
export const SPACE_WIDTH = 0.4;

/**
 * Lay a piece of text out left to right.
 * @returns {{ letters: Array<{ char: string, glyph: object, x: number }>, totalWidth: number }}
 */
export function layoutText(text) {
  const letters = [];
  let cursor = 0;
  for (const char of text) {
    if (char === ' ') {
      cursor += SPACE_WIDTH;
      continue;
    }
    const glyph = GLYPHS[char];
    if (!glyph) {
      console.warn(`Neon sign: no glyph for "${char}", skipped`);
      continue;
    }
    letters.push({ char, glyph, x: cursor });
    cursor += glyph.advance + LETTER_GAP;
  }
  return { letters, totalWidth: Math.max(cursor - LETTER_GAP, 0.001) };
}
