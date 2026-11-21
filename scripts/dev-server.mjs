// Local editing: serves the map at http://localhost:4321 and rebuilds the page from src/ on every
// reload, so changes to src/*.js, src/*.css or src/prototype.html show up after a refresh.
//
//   node scripts/dev-server.mjs                 uses data/dev-graph.json (the example notes)
//   node scripts/dev-server.mjs other.json      uses another graph file from the importer's --json
//
// To use your own notes: node scripts/import-markdown.mjs "C:\path\to\notes" --json data/dev-graph.json
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { assemble } from './assemble.mjs';

const PORT = Number(process.env.PORT) || 4321;
const graphFile = process.argv[2] || new URL('../data/dev-graph.json', import.meta.url);

createServer((req, res) => {
  if (req.url !== '/' && !req.url.startsWith('/?')) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const graph = JSON.parse(readFileSync(graphFile, 'utf8'));
    graph.owner = 'Demo';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(assemble(graph));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Couldn't build the page:\n${e.stack}`);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Accrete: http://localhost:${PORT}`));
