#!/usr/bin/env node
/**
 * Checks the colour claims in the README against the stylesheet.
 *
 *   node scripts/check-contrast.mjs
 *
 * Reads the light and dark tokens from client/src/styles/app.css and verifies
 *   - every text colour against EVERY surface it can sit on (WCAG AA, 4.5:1)
 *   - control borders against every surface (WCAG 1.4.11, 3:1)
 *   - the categorical chart palette: contrast against the page, and separation
 *     under simulated colour-vision deficiency for EVERY pair of series
 *
 * Both "every" clauses are deliberate. Earlier checks compared text against
 * the page background only, and chart colours as adjacent pairs only, and
 * each missed a real failure.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'client/src/styles/app.css'), 'utf8');
const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
};
const tokens = (text) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const themes = { light: tokens(block(':root')), dark: tokens(block('.dark')) };

/* ---------------------------------------------------------- colour maths */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex) => { const [r, g, b] = rgb(hex).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// Viénot–Brettel–Mollon dichromat simulation on linear RGB.
const DICHROMAT = {
  deutan: [[0.625, 0.375, 0], [0.70, 0.30, 0], [0, 0.30, 0.70]],
  protan: [[0.1115, 0.8885, 0], [0.1115, 0.8885, 0], [0, 0, 1]],
  tritan: [[1, 0.1667, -0.1667], [0, 1, 0], [0, 0, 1]]
};
const simulate = (hex, kind) => {
  if (kind === 'normal') return rgb(hex);
  const v = rgb(hex).map(toLinear);
  return DICHROMAT[kind].map(row => toSrgb(Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))));
};
const lab = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map(toLinear);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/* ---------------------------------------------------------------- checks */
let failures = 0;
const row = (ok, text) => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${text}`); };

for (const [theme, t] of Object.entries(themes)) {
  console.log(`\n${theme}`);
  const surfaces = ['--paper', '--ground', '--ground-2'];
  for (const fg of ['--ink', '--ink-2', '--muted', '--accent']) {
    const worst = Math.min(...surfaces.map(bg => contrast(t[fg], t[bg])));
    row(worst >= 4.5, `${fg.padEnd(11)} ${t[fg]}  worst ${worst.toFixed(2)}:1 across all surfaces (text needs 4.5)`);
  }
  const border = Math.min(...surfaces.map(bg => contrast(t['--line-firm'], t[bg])));
  row(border >= 3, `--line-firm  ${t['--line-firm']}  worst ${border.toFixed(2)}:1 (control borders need 3.0)`);

  const series = ['--s-green', '--s-blue', '--s-rose'].map(k => t[k]);
  const seriesContrast = Math.min(...series.map(c => contrast(c, t['--paper'])));
  row(seriesContrast >= 3, `chart series  worst ${seriesContrast.toFixed(2)}:1 against the page (needs 3.0)`);
  for (const vision of ['normal', 'deutan', 'protan', 'tritan']) {
    let worst = Infinity, pair = '';
    for (let i = 0; i < series.length; i++) for (let j = i + 1; j < series.length; j++) {
      const d = deltaE(simulate(series[i], vision), simulate(series[j], vision));
      if (d < worst) { worst = d; pair = `${series[i]}↔${series[j]}`; }
    }
    row(worst >= 15, `${vision.padEnd(7)} worst pair ${pair}  ΔE ${worst.toFixed(1)} (needs 15)`);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall colour checks pass');
process.exit(failures ? 1 : 0);
