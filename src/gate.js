// The age gate. This is the only code that runs before the visitor says yes: a
// flat neon sign, the question, and the loading bar. Saying yes downloads the
// rest of the site (three.js, the editor, the dancer, the moves and Python) in the
// background behind the gate; the gate lifts once all of it is ready.
//
// Kept small on purpose: no three.js here, the sign is plain SVG drawn from the
// same hand-made letters as the 3D one.

import './theme.css';
import './gate.css';
import { layoutText } from './neonGlyphs.js';
import { onProgress, ready, creep, setTask, reveal } from './loading.js';
import { music } from './music.js';

const SIGN_TEXT = 'StripCode';
const SVG_PAD = 0.3;       // room around the letters for the glow
const DESCENDER = 0.38;    // how far a "p" drops below the line
const REVEAL_DELAY = 450;  // ms to show 100% before the gate lifts

const gate = document.getElementById('gate');
const $ = (id) => document.getElementById(id);

// =====================================================
// THE SIGN
// =====================================================
const fmt = (n) => +n.toFixed(3);

// A smooth curve through the points (Catmull-Rom turned into Bezier segments),
// with y flipped because SVG counts down from the top
function strokePath(points, closed) {
  const pts = points.map(([x, y]) => [x, 1 - y]);
  const n = pts.length;
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.min(Math.max(i, 0), n - 1)]);

  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

function buildSign() {
  const { letters, totalWidth } = layoutText(SIGN_TEXT);
  const width = totalWidth + SVG_PAD * 2;
  const height = 1 + DESCENDER + SVG_PAD * 2;

  const paths = [];  // one <path> per stroke, drawn several times through <use>
  const groups = letters.map(({ glyph, x }, index) => {
    const uses = glyph.strokes.map((stroke, s) => {
      const id = `stroke-${index}-${s}`;
      const moved = stroke.pts.map(([px, py]) => [px + x, py]);
      paths.push(`<path id="${id}" d="${strokePath(moved, !!stroke.closed)}"/>`);
      return id;
    });
    const layer = (cls) => uses.map((id) => `<use href="#${id}" class="tube ${cls}"/>`).join('');
    return (
      `<g class="letter" data-i="${index}" style="--i:${index}">` +
      layer('base') +
      `<g class="lit">${layer('wide')}${layer('mid')}${layer('core')}</g>` +
      `</g>`
    );
  });

  // filters cover the whole sign: a straight line has no area for the default filter region
  const region = `filterUnits="userSpaceOnUse" x="${-SVG_PAD}" y="${-SVG_PAD}" width="${width}" height="${height}"`;
  $('gate-sign').innerHTML =
    `<svg viewBox="${-SVG_PAD} ${-SVG_PAD} ${width} ${height}" aria-hidden="true" focusable="false">` +
    `<defs>` +
    `<filter id="neon-blur" ${region}><feGaussianBlur stdDeviation="0.055"/></filter>` +
    `<filter id="neon-blur-wide" ${region}><feGaussianBlur stdDeviation="0.15"/></filter>` +
    paths.join('') +
    `</defs>${groups.join('')}</svg>`;
}

// =====================================================
// VIEWS
// =====================================================
function show(view) {
  gate.dataset.state = view;
  document.querySelectorAll('#gate .gate-view').forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
}

function renderProgress({ progress, label }) {
  const percent = Math.round(progress * 100);
  const bar = document.querySelector('#gate .neon-bar');
  bar.style.setProperty('--p', percent);
  bar.setAttribute('aria-valuenow', String(percent));
  $('gate-label').textContent = label;
  $('gate-percent').textContent = `${percent}%`;
}

function lift() {
  document.body.classList.add('entered'); // un-hides the site underneath
  music.start();                          // the club opens: the intro build begins
  reveal();                               // ...and the dancer makes her entrance
  gate.classList.add('leaving');
  gate.addEventListener('transitionend', () => gate.remove(), { once: true });
  setTimeout(() => gate.remove(), 1500); // in case the transition never fires
}

// =====================================================
// FLOW
// =====================================================
async function enter() {
  music.unlock(); // browsers only allow sound after a click, and this is that click
  show('load');
  const stopListening = onProgress(renderProgress);

  try {
    // Downloads three.js, the code editor and the rest of the site, and starts it
    // running behind the gate. It starts loading the model, the moves and Python itself.
    creep('code', 0.9, 2);
    await import('./main.js');
    setTask('code', 1);

    await ready; // every task finished, including the first frames being drawn
    await new Promise((resolve) => setTimeout(resolve, REVEAL_DELAY));
    lift();
  } catch (error) {
    console.error(error);
    $('gate-error-text').textContent = error?.message || 'The site could not finish loading.';
    show('error');
  } finally {
    stopListening();
  }
}

buildSign();
$('gate-yes').addEventListener('click', enter);
$('gate-no').addEventListener('click', () => show('denied'));
$('gate-retry').addEventListener('click', () => location.reload());
$('gate-title').focus({ preventScroll: true });
