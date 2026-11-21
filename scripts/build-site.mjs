// Builds the public website into site/index.html: the map showing the demo notes (examples/notes), with
// the "Open your notes" tool built in. One self-contained page: no server code, no network requests, so
// any static host (Vercel, Netlify, Cloudflare Pages) can serve the site/ folder on your own domain.
//   npm run build:site
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { assemble } from './assemble.mjs';
import { buildNoteGraph } from '../src/notes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notesDir = join(root, 'examples', 'notes');
const outPath = join(root, 'site', 'index.html');

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(md|markdown)$/i.test(entry.name)) {
      files.push({ rel: relative(notesDir, full).split(sep).join('/'), text: readFileSync(full, 'utf8'), modified: statSync(full).mtimeMs });
    }
  }
})(notesDir);

const { graph } = buildNoteGraph(files, { owner: 'Demo', MarkdownIt });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, assemble(graph));
console.log(`Site: ${graph.nodes.length} demo notes, ${graph.edges.length} links -> ${relative(root, outPath)}`);
