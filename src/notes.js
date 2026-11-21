// Markdown notes in, map data out. Shared by the command-line importer (scripts/import-markdown.mjs) and
// the website's "Open your notes" button (src/loader.js), so a folder looks the same either way.
// It never touches the disk: callers hand it the files' text, so it runs in Node and in the browser.
import { buildRegions, clusterNotes, degrees, keepMostConnected } from './graph.js';

// files: [{rel: 'Folder/Note.md', text, modified: ms since 1970}]
// options: {owner, clusterMode: auto|folders|tags|links, maxNotes, MarkdownIt (the markdown-it constructor)}
// Returns {graph, method, total}: the map data, how notes were grouped, and how many notes there were.
export function buildNoteGraph(files, {owner = 'Accrete', clusterMode = 'auto', maxNotes = 500, MarkdownIt}) {
  const outsideFences = (text, fn) => {
    let fenced = false;
    return text.split('\n').map(line => {
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; }
      return fenced ? line : fn(line);
    }).join('\n');
  };
  // front matter "tags: [a, b]", "tags: a, b" or a "- a" list, plus #tags in the text (not in code)
  const INLINE_TAG = /(?:^|\s)#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
  const tagsOf = (front, body) => {
    const m = front.match(/^tags?:[ \t]*(.*)((?:\n[ \t]*-.*)*)/mi);
    const tags = !m ? [] : m[1].trim() ? m[1].replace(/^\s*\[|\]\s*$/g, '').split(/[,\s]+/) : m[2].split('\n').map(l => l.replace(/^\s*-\s*/, ''));
    outsideFences(body, line => { for (const t of line.replace(/`[^`]*`/g, '').matchAll(INLINE_TAG)) tags.push(t[1]); return line; });
    return [...new Set(tags.map(t => t.trim().replace(/^["'#]+|["']+$/g, '').toLowerCase()).filter(Boolean))];
  };
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const field = (front, name) => (front.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi')) || [])[1]?.trim().replace(/^["']|["']$/g, '');

  const notes = [...files].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)).map(file => {
    let text = file.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const fm = text.match(frontMatter);
    const front = fm ? fm[1] : '';
    if (fm) text = text.slice(fm[0].length);
    const heading = text.match(/^# +(.+?)\s*#*\s*$/m);
    if (heading) text = text.slice(0, heading.index) + text.slice(heading.index + heading[0].length);
    const stem = file.rel.replace(/\.(md|markdown)$/i, '');
    const base = stem.split('/').pop();
    const title = (field(front, 'title') || heading?.[1] || base.replace(/[-_]+/g, ' ')).replace(/\[\[|\]\]/g, '').trim();
    const dated = ['updated', 'modified', 'date'].map(k => field(front, k)).find(v => /^\d{4}-\d{2}-\d{2}/.test(v || ''));
    return {rel: file.rel, stem, base, title, body: text, folder: file.rel.includes('/') ? file.rel.split('/')[0] : 'Notes',
      tags: tagsOf(front, text), modified: file.modified, updated: (dated || new Date(file.modified).toISOString()).slice(0, 10)};
  });

  // ---- lookup tables (first note wins on duplicates) ----
  const keyed = new Map();
  const addKey = (k, i) => { k = k.toLowerCase(); if (!keyed.has(k)) keyed.set(k, i); };
  notes.forEach((n, i) => { addKey(n.stem, i); addKey(n.base, i); addKey(n.title, i); });
  const lookup = name => keyed.get(name.trim().toLowerCase().replace(/\.(md|markdown)$/, ''));
  // a relative link from one note to another, resolved like a path ("../Ideas/x.md")
  const resolvePath = (from, href) => {
    const parts = from.split('/').slice(0, -1);
    for (const part of href.split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  };

  // ---- markdown rendering (raw HTML in notes is escaped, never passed through) ----
  const md = new MarkdownIt({html: false, linkify: false});
  md.renderer.rules.image = (tokens, i) => md.utils.escapeHtml(tokens[i].content);
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.tag === 'h2' || token.tag === 'h3') {
      const inline = tokens[idx + 1];
      const text = (inline?.children || []).filter(c => c.type === 'text' || c.type === 'code_inline').map(c => c.content).join('').trim() || 'Section';
      token.attrSet('id', `idea-${env.ideas.length}`);
      env.ideas.push(text.slice(0, 140));
    }
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';
    token.attrs = [];
    let target;
    if (href.startsWith('note:')) target = Number(href.slice(5));
    else if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#')) {
      try {
        const path = decodeURIComponent(href.split('#')[0]);
        if (path) target = lookup(resolvePath(env.rel, path));
      } catch { /* bad escape: leave as plain link */ }
    }
    if (target !== undefined) {
      token.attrSet('href', '#');
      token.attrSet('data-page', String(target));
      if (target !== env.index) env.edges.add([Math.min(env.index, target), Math.max(env.index, target)].join(','));
    } else if (/^(https?:|mailto:)/i.test(href)) {
      token.attrSet('href', href); token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener');
    } else token.attrSet('href', '#');
    return self.renderToken(tokens, idx, options);
  };
  const wikiLinks = text => outsideFences(text, line => line
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (m, target, alias) => {
      const label = (alias || target).replace(/[[\]]/g, '').trim();
      const found = lookup(target);
      return found === undefined ? label : `[${label}](note:${found})`;
    }));

  const edgeSet = new Set();
  let rendered = notes.map((note, index) => {
    const env = {rel: note.rel, index, edges: edgeSet, ideas: []};
    const html = md.render(wikiLinks(note.body), env);
    return {note, html, ideas: env.ideas};
  });

  // ---- keep the most connected notes if there are a lot ----
  let edges = [...edgeSet].map(e => e.split(',').map(Number));
  if (rendered.length > maxNotes) {
    const kept = keepMostConnected(rendered.map(r => r.note), edges, maxNotes);
    rendered = kept.keep.map(i => rendered[i]);
    edges = kept.edges;
    // data-page attributes inside kept notes still point at old indexes: rewrite them
    const {remap} = kept;
    rendered.forEach(r => { r.html = r.html.replace(/data-page="(\d+)"/g, (m, n) => remap.has(Number(n)) ? `data-page="${remap.get(Number(n))}"` : 'data-page=""'); });
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // ---- clusters: by folders, tags or links; at most six ----
  const degree = degrees(rendered.length, edges);
  const {groups: groupOf, method} = clusterNotes(rendered.map(r => r.note), edges, clusterMode);
  const {regions, regionOf} = buildRegions(groupOf);
  let seed = 19;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const nodes = rendered.map(({note, html, ideas}, i) => {
    const region = regionOf(groupOf[i]);
    const r = regions[region];
    return {
      title: note.title, category: 'Note', region, path: note.rel, url: '#', status: 'unknown',
      updated: note.updated, modified: Math.round(note.modified), html, ideas, degree: degree[i],
      position: r.center.map((c, k) => +(c + (rand() * 2.2 - 1.1) * r.spread[k]).toFixed(4)),
    };
  });
  return {graph: {owner, nodes, edges, regions}, method, total: notes.length};
}
