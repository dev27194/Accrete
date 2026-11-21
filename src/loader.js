// "Open your notes": a visitor picks a folder of Markdown notes and sees it as the black hole. Everything
// happens in this browser tab: the files are read here (src/notes.js), never uploaded, and the page makes
// no network requests. The map data is kept in this browser (IndexedDB) only so the page can reload into
// it, and only for this tab's session; the next fresh visit clears it and starts on the demo again.
const OWN_SESSION_KEY = 'accrete.ownNotes';

function openNotesStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('accrete', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('maps');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function notesStore(mode, run) {
  const db = await openNotesStore();
  return new Promise((resolve, reject) => {
    const request = run(db.transaction('maps', mode).objectStore('maps'));
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// Before the map starts: if this tab loaded someone's own notes, swap them in for the demo.
async function restoreOwnNotes() {
  let own = false;
  try { own = sessionStorage.getItem(OWN_SESSION_KEY) === '1'; } catch { /* storage blocked: demo only */ }
  try {
    if (!own) { await notesStore('readwrite', store => store.delete('own')); return; }
    const graph = await notesStore('readonly', store => store.get('own'));
    if (!graph) return;
    document.getElementById('data').textContent = JSON.stringify(graph);
    document.getElementById('owner').textContent = graph.owner;
    document.body.classList.add('own-notes');
  } catch { /* no IndexedDB (private mode in some browsers): stay on the demo */ }
}

// Reads the picked folder, builds the map and reloads into it.
async function loadOwnNotes(fileList, report) {
  const all = [...fileList];
  const folder = (all[0]?.webkitRelativePath || '').split('/')[0] || 'My notes';
  const picked = all.filter(file => {
    const parts = (file.webkitRelativePath || file.name).split('/').slice(1);
    return /\.(md|markdown)$/i.test(file.name) && file.size <= 1_000_000
      && !parts.some(part => part.startsWith('.') || part === 'node_modules');
  });
  if (!picked.length) { report('No .md notes in that folder'); return; }
  report(`Reading ${picked.length} notes…`);
  const files = await Promise.all(picked.map(async file => ({
    rel: file.webkitRelativePath.split('/').slice(1).join('/') || file.name,
    text: await file.text(),
    modified: file.lastModified || Date.now(),
  })));
  const {graph} = buildNoteGraph(files, {owner: folder, MarkdownIt: window.markdownit});
  try {
    await notesStore('readwrite', store => store.put(graph, 'own'));
    sessionStorage.setItem(OWN_SESSION_KEY, '1');
  } catch {
    report('Your browser blocked local storage');
    return;
  }
  location.reload();
}

// Back to the demo: forget the visitor's map and reload.
async function showDemo() {
  try { sessionStorage.removeItem(OWN_SESSION_KEY); } catch { /* nothing stored */ }
  try { await notesStore('readwrite', store => store.delete('own')); } catch { /* nothing stored */ }
  location.reload();
}
