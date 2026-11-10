// A neon tube sign for the scene, like glass tubing bent into letters.
//
// Each letter is drawn as one or more single strokes (neon is one continuous
// tube). A stroke becomes a tube mesh, drawn three times: a hot pale core, then
// two larger additive pink layers that fake the glow without any post-processing.
// A pink point light makes the sign actually light the stage.
//
// Letters live on a grid where capitals are 1 tall and lowercase is 0.6.
// Only the letters in GLYPHS can be used for NEON.text in config.js.

import * as THREE from 'three';

const GLYPHS = {
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

const LETTER_GAP = 0.2;
const SPACE_WIDTH = 0.4;

// Tube thickness and strength of each of the three layers: hot core + two halos
const LAYERS = [
  { scale: 1, opacity: 1, core: true },
  { scale: 2.3, opacity: 0.42 },
  { scale: 4.8, opacity: 0.14 },
];

/**
 * @param {object} options  see NEON in config.js
 * @returns {{ group: THREE.Group, update(time: number): void }}
 */
export function createNeonSign(options) {
  const { text, color, coreColor, position, width, tubeRadius, light, flicker } = options;

  const pink = new THREE.Color(color);
  const hot = new THREE.Color(coreColor);
  const unlit = new THREE.Color(color).multiplyScalar(0.22); // a tube that has flickered off

  // ---------- lay the letters out ----------
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
    letters.push({ glyph, x: cursor });
    cursor += glyph.advance + LETTER_GAP;
  }
  const totalWidth = Math.max(cursor - LETTER_GAP, 0.001);
  const unit = width / totalWidth; // metres per grid unit
  const radius = tubeRadius / unit; // tube radius in grid units

  // ---------- build the tubes ----------
  const sign = new THREE.Group();
  sign.scale.setScalar(unit);
  // centre the sign on its own origin (capitals are 1 tall, so the middle is 0.5)
  sign.position.set(-width / 2, -0.5 * unit, 0);

  const endCaps = LAYERS.map((layer) => new THREE.SphereGeometry(radius * layer.scale, 14, 10));
  const glyphs = letters.map(({ glyph, x }) => {
    const group = new THREE.Group();
    group.position.x = x;

    const materials = LAYERS.map((layer) =>
      layer.core
        ? new THREE.MeshBasicMaterial({ color: hot.clone() })
        : new THREE.MeshBasicMaterial({
            color: pink.clone(),
            transparent: true,
            opacity: layer.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
    );

    for (const stroke of glyph.strokes) {
      const points = stroke.pts.map(([px, py]) => new THREE.Vector3(px, py, 0));
      const closed = !!stroke.closed;
      const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
      const segments = Math.max(20, points.length * 14);

      LAYERS.forEach((layer, index) => {
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius * layer.scale, 14, closed), materials[index]));
        if (!closed) {
          // round the open ends of the tube
          [curve.getPoint(0), curve.getPoint(1)].forEach((end) => {
            const cap = new THREE.Mesh(endCaps[index], materials[index]);
            cap.position.copy(end);
            group.add(cap);
          });
        }
      });
    }

    sign.add(group);
    return { materials };
  });

  // ---------- the light the sign throws on the stage ----------
  const lamp = new THREE.PointLight(color, light.intensity, light.distance);
  lamp.position.set(0, 0, light.offsetZ);

  const group = new THREE.Group();
  group.position.set(...position);
  group.add(sign, lamp);

  // ---------- the glow breathes, and one letter stutters now and then ----------
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate = flicker && !calm;

  function setLetter(materials, level) {
    // level 1 = fully lit, 0 = flickered off
    materials[0].color.lerpColors(unlit, hot, level);
    for (let i = 1; i < materials.length; i++) materials[i].opacity = LAYERS[i].opacity * level;
  }

  return {
    group,
    update(time) {
      if (!animate) return;

      const breathe = 1 + 0.04 * Math.sin(time * 2.1);
      lamp.intensity = light.intensity * breathe;

      glyphs.forEach(({ materials }, index) => {
        let level = breathe;
        // the first letter stutters for a moment every few seconds
        if (index === 0) {
          const phase = time % 7;
          if (phase > 6.3) level = Math.floor((phase - 6.3) * 24) % 2 === 0 ? 1 : 0.18;
        }
        setLetter(materials, Math.min(level, 1));
      });
    },
  };
}
