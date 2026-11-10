// A neon tube sign for the scene, like glass tubing bent into letters.
//
// Each letter is drawn as one or more single strokes (neon is one continuous
// tube). A stroke becomes a tube mesh, drawn three times: a hot pale core, then
// two larger additive pink layers that fake the glow without any post-processing.
// A pink point light makes the sign actually light the stage.
//
// The letter shapes live in neonGlyphs.js (shared with the flat sign on the age gate).

import * as THREE from 'three';
import { layoutText } from './neonGlyphs.js';

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
  const { letters, totalWidth } = layoutText(text);
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
