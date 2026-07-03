// Productie-build voor GitHub Pages.
//
// Lokaal ontwikkelen blijft zonder tooling werken: de HTML-pagina's laden
// .jsx-bestanden via Babel-standalone in de browser. Deze build maakt daar
// een snelle productieversie van:
//   1. kopieert de site naar _site/
//   2. compileert elk via <script type="text/babel"> geladen .jsx-bestand
//      één keer met Babel naar .js en minificeert met esbuild
//   3. herschrijft de script-tags (defer behoudt de volgorde)
//   4. verwijdert Babel-standalone en wisselt React dev-builds om voor
//      production-builds
//
// Belangrijk voor de semantiek: de app-modules delen top-level functies en
// consts via het globale bereik. Babel-standalone maakt van top-level
// const/let een `var` (ES5), waardoor alles een window-property wordt en
// er geen lexicale botsingen tussen bestanden zijn. transform-block-scoping
// in preset-env repliceert dat hier; identifiers worden daarom óók niet
// geminificeerd.
//
// Draaien: npm install && npm run build   →  output in _site/

import { transformAsync } from '@babel/core';
import presetEnv from '@babel/preset-env';
import presetReact from '@babel/preset-react';
import { transform as esMinify } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');

const EXCLUDE = new Set([
  '.git', '.github', '.claude', 'node_modules', '_site', 'outputs',
  'package.json', 'package-lock.json', 'scripts',
]);
const EXCLUDE_EXT = new Set(['.pdf', '.xlsx', '.xlsm', '.xls', '.tmp']);

const REACT_SWAPS = [
  {
    from: /<script src="https:\/\/unpkg\.com\/react@18\.3\.1\/umd\/react\.development\.js"[^>]*><\/script>/g,
    to: '<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" integrity="sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z" crossorigin="anonymous"></script>',
  },
  {
    from: /<script src="https:\/\/unpkg\.com\/react-dom@18\.3\.1\/umd\/react-dom\.development\.js"[^>]*><\/script>/g,
    to: '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" integrity="sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1" crossorigin="anonymous"></script>',
  },
];
const BABEL_TAG = /[ \t]*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"[^>]*><\/script>\n?/g;
const BABEL_SCRIPT_TAG = /<script\s+type="text\/babel"\s+src="([^"?]+)(\?[^"]*)?"\s*><\/script>/g;

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name) || entry.name.startsWith('~$') || entry.name === '.DS_Store') continue;
    if (EXCLUDE_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function* walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(p);
    else if (entry.isFile() && p.endsWith('.html')) yield p;
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
copyTree(ROOT, OUT);

const compiled = new Map(); // absoluut .jsx-pad → { hash }

async function compileJsx(jsxPath) {
  if (compiled.has(jsxPath)) return compiled.get(jsxPath);
  const source = fs.readFileSync(jsxPath, 'utf8');
  const { code } = await transformAsync(source, {
    babelrc: false,
    configFile: false,
    presets: [
      [presetEnv, {
        targets: 'last 3 chrome versions, last 3 safari versions, last 3 firefox versions, last 3 ios versions',
        // top-level const/let → var: zo delen de bestanden globals, net als
        // bij Babel-standalone in de browser
        include: ['transform-block-scoping'],
        modules: false,
      }],
      [presetReact, { runtime: 'classic' }],
    ],
    sourceType: 'script',
    compact: false,
  });
  const { code: minified } = await esMinify(code, {
    loader: 'js',
    minifyWhitespace: true,
    minifySyntax: true,
    // géén minifyIdentifiers: top-level namen zijn het publieke API tussen bestanden
  });
  const jsPath = jsxPath.replace(/\.jsx$/, '.js');
  fs.writeFileSync(jsPath, minified);
  fs.rmSync(jsxPath);
  const entry = { hash: createHash('sha256').update(minified).digest('hex').slice(0, 8) };
  compiled.set(jsxPath, entry);
  return entry;
}

let pages = 0;
for (const htmlPath of walkHtml(OUT)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const original = html;

  for (const { from, to } of REACT_SWAPS) html = html.replace(from, to);
  html = html.replace(BABEL_TAG, '');

  const jobs = [];
  html.replace(BABEL_SCRIPT_TAG, (tag, srcPath) => {
    jobs.push({ tag, srcPath });
    return tag;
  });
  for (const { tag, srcPath } of jobs) {
    const jsxAbs = path.resolve(path.dirname(htmlPath), srcPath);
    if (!fs.existsSync(jsxAbs) && !compiled.has(jsxAbs)) {
      throw new Error(`${htmlPath}: verwijst naar ontbrekend bestand ${srcPath}`);
    }
    const { hash } = await compileJsx(jsxAbs);
    const jsSrc = srcPath.replace(/\.jsx$/, '.js');
    html = html.replace(tag, `<script defer src="${jsSrc}?v=${hash}"></script>`);
  }

  if (html !== original) {
    fs.writeFileSync(htmlPath, html);
    pages++;
  }
}

console.log(`Build klaar: ${pages} pagina's herschreven, ${compiled.size} JSX-bestanden gecompileerd → ${OUT}`);
