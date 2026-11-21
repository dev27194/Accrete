# Accrete

Your Markdown notes as a 3D black hole you can fly through.

Each note is a star. Its sections are small lights around it, links between notes curve around the hole, and folders (or tags) become groups on the disc. Select a star to read the note.

**[Try the live demo](https://accrete-black.vercel.app)**

Accrete comes in three forms:

- **The website.** Open it, pick a folder of notes, see them as a black hole. Nothing to install.
- **The Obsidian plugin.** The same map as a tab inside Obsidian, reading your vault directly and updating as you write.
- **The one-file export.** Turns any notes folder into a single HTML file you can open offline.

All three run on your own computer. Your notes are never uploaded.

Accrete is only the visual. It has no note-taking app, AI or sync built in: it reads Markdown files you already have.

## Use it in the browser

1. Go to **[accrete-black.vercel.app](https://accrete-black.vercel.app)**. It opens on a set of demo notes.
2. Click **Open your notes** and pick a folder of `.md` files. An Obsidian vault works.
3. Drag to rotate, scroll to zoom, and select a star to open its note.

The map lasts for that browser tab only. A fresh visit starts on the demo again, and **Demo** takes you back to it at any time.

Needs a browser with WebGL 2: current Chrome, Edge, Firefox or Safari.

## Use it in Obsidian

Accrete is not in Obsidian's community plugin list yet. Until it is, install it one of these two ways. Both need Obsidian 1.7.2 or newer on desktop (Windows, Mac or Linux).

### Install by hand

1. Open the [latest release](https://github.com/dev27194/accrete/releases/latest) and download `main.js`, `manifest.json` and `styles.css`.
2. In your vault, create the folder `.obsidian/plugins/accrete/` and put the three files in it. (`.obsidian` is hidden; on Mac press Cmd+Shift+. in Finder to show it.)
3. In Obsidian, open **Settings → Community plugins**, turn on community plugins if asked, and enable **Accrete**.

### Install with BRAT

1. Install and enable the **BRAT** plugin from Obsidian's community plugins.
2. Run **BRAT: Add a beta plugin for testing** and paste `dev27194/accrete`.
3. Enable **Accrete** under **Settings → Community plugins**. BRAT keeps it up to date.

### Using it

- Click the orbit icon in the left ribbon, or run **Open Accrete** from the command palette.
- Drag to rotate, scroll to zoom, select a star to open its note.
- The map follows your vault live: new, renamed, linked and deleted notes show up on their own.

### Settings

| Setting | What it does |
| --- | --- |
| Group notes by | Automatic uses top-level folders if you have two or more, then tags if at least half your notes have one, then groups of linked notes. You can also pick folders, tags or links yourself. |
| Maximum notes | Big vaults show only the most connected notes. Lower it if the map feels slow. |
| Excluded folders | One folder path per line. Notes in these folders are left out. |
| Show unlinked notes | Turn off to hide notes with no links to or from other notes. |
| Reset camera | Moves open maps back to the starting view. |

### Privacy

The plugin only reads your vault. It makes no network requests and sends nothing anywhere.

## Make a one-file export

The importer turns any folder of notes into one HTML file. Open it in a browser, offline, with no server. You need [Node.js](https://nodejs.org) 18 or newer and a copy of this repo (green **Code** button → **Download ZIP**, then unzip it).

### Windows

Double-click **`Build My Brain (Windows).bat`**. It installs what it needs the first time, asks you to pick your notes folder and a name for your map, and opens the result.

### Mac and Linux

Open a terminal in the repo folder and run:

```
npm install
node scripts/import-markdown.mjs "/path/to/your/notes" --owner "Your Name" --open
```

### What you get

The export is written to `my-brain.html`. It holds the full text of your notes, so keep it private (the repo's `.gitignore` already keeps it out of Git).

Options (run with `--help` for all of them):

- `--cluster folders|tags|links` picks how notes are grouped.
- `--max <n>` limits the map to the most connected notes.
- `--out <file>` writes somewhere else.
- `--json <file>` also saves the map data as JSON.

What it reads:

- Every `.md` file in the folder and its subfolders. Hidden folders like `.obsidian` are skipped.
- `[[wiki links]]`, `[[Note|alias]]` and relative Markdown links. Each becomes a connection.
- Tags from front matter (`tags: [a, b]`) and `#tags` in the text.
- Groups: top-level folders when there are two or more, otherwise tags, otherwise groups of linked notes, at most six.
- `title:` and `updated:` from front matter, or the first `# Heading`. File dates otherwise.
- Raw HTML in notes is shown as text, never run.

## Go further with Claude

Want your notes pulled in from somewhere else, refreshed on a schedule, or summarized with AI? [PROMPT.md](PROMPT.md) has a ready-made prompt to paste into [Claude](https://claude.ai). It asks where your notes live, then builds and tests a setup with you step by step.

## Good to know

- The sky, the Milky Way and the stars are generated on your graphics card when the map opens. No photo is used.
- The bending of light around the hole is physically inspired, not an exact relativity simulation.
- Notes changed since your last visit glow gold (on a first visit, the last 48 hours). To know this, the website and the one-file export remember the time of your last visit and your recent pages in your browser's local storage.
- When you open your own notes on the website, the map is kept in your browser only so the page can reload into it. It is cleared on your next fresh visit. Nothing leaves your computer.
- The website and the export make no network requests at all: their Content Security Policy blocks them.
- Needs WebGL 2, which every current desktop browser has.

## For developers

None of this is needed to use Accrete.

You need [Node.js](https://nodejs.org) 18 or newer.

```
npm install
npm run dev
```

Open http://localhost:4321. The page is rebuilt from `src/` on every refresh, using the demo notes in `data/dev-graph.json`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local server for the website at http://localhost:4321 |
| `npm run build:site` | Builds the website into `site/` from the notes in `examples/notes` |
| `npm run build:plugin` | Builds the Obsidian plugin (`main.js`, `styles.css`) |
| `npm run dev:plugin` | Rebuilds the plugin on every change |
| `npm run test:plugin` | Builds test vaults and a browser test page at `test-vaults/harness.html` |
| `npm run lint` | Checks the code with the same rules as Obsidian's plugin review |

### Work on the plugin

- **Try it in a real vault:** link (or copy) this repo folder into `<your vault>/.obsidian/plugins/accrete/` and run `npm run dev:plugin`. It rebuilds `main.js` on every change; reload Obsidian to see it.
- **Run the tests:** `npm run test:plugin` writes test vaults to `test-vaults/` (big, empty, nested, tag-only, link-only and unicode names) that you can also open in Obsidian. It also builds `test-vaults/harness.html`, which runs the plugin against a stand-in for Obsidian in your browser. Serve it with a local web server, for example `npx http-server test-vaults`, then open `harness.html`. The tab title shows how many checks passed.

### Use the map in your own page

`src/blackhole.js` is an ES module you can put in any page:

```js
import { createBlackHole } from './src/blackhole.js';

const map = createBlackHole(element, graph, {
  onSelect: (node, { event }) => { /* a star was clicked; node is null for empty space */ },
  readingPanel: false, // false: clicks only call onSelect, so you show notes your own way
});
map.update(newGraph);  // new data, same WebGL contexts
map.resize();
map.destroy();         // frees every WebGL context, animation frame and listener
```

Include `src/blackhole.css` too. `graph` uses the format below. `src/blackhole.d.ts` lists every option and method, such as `select`, `focusRegion`, `zoomBy`, `flyHome` and `resetCamera`.

### Data format

You can skip the importer and write the map data yourself. Start from `data/sample-graph.json`, then build a page from it:

```
node scripts/build.mjs path/to/graph.json out.html
```

```json
{
  "owner": "Your Name",
  "regions": { "Projects": { "center": [-0.86, -0.04, -0.23], "spread": [0.21, 0.22, 0.2], "density": 850 } },
  "nodes": [
    { "title": "Garage workshop", "category": "Note", "region": "Projects", "path": "Projects/Garage.md",
      "url": "#", "status": "unknown", "updated": "2026-11-01", "modified": 1793145600000,
      "html": "<p>Page text as safe HTML</p>", "ideas": ["Section title"],
      "position": [-1.09, 0.12, -0.29], "degree": 3 }
  ],
  "edges": [[0, 1], [1, 2]]
}
```

- `regions` are the groups. Each node's `region` must match one of their names. About six reads best.
- `edges` are pairs of node positions in the `nodes` list. `degree` is how many links a node has.
- `html` is inserted as HTML, so escape or sanitize it first.
- `ideas` is optional: the section headings inside the note, shown as small lights around the star.

### Deploy the website

`npm run build:site` writes the whole website to `site/`. Any static host can serve it. On Vercel, import the repo: `vercel.json` already sets the build command and output folder.

### Change the demo notes

The demo is built from `examples/notes`. Each folder is a group and each `.md` file a page:

- `# Title` names the page.
- Each `## Heading` becomes one of its ideas, the small lights around the star.
- `[[Page name]]` links two pages.

Edit the notes, then run `npm run build:site` again. For the local server, refresh its data with:

```
node scripts/import-markdown.mjs examples/notes --json data/dev-graph.json
```

### Release the plugin

Run `npm version <x.y.z>` (this updates `manifest.json`, `package.json` and `versions.json`), then push the tag. GitHub Actions builds the plugin and attaches `main.js`, `manifest.json` and `styles.css` to a draft release. Publish the draft by hand.

### Where things are

- `src/` the map: `sky.js` (the Milky Way and stars), `accretion.js` and `lensing.js` (the black hole), `blackhole.js` (camera, pages, links), `app.mjs` (the page around it), `notes.js` (Markdown to map data, shared by the site and the importer), `loader.js` (Open your notes), `prototype.html` (page layout and styles).
- `scripts/` the dev server, site build and importer.
- `obsidian/` the plugin, with its tests in `obsidian/test/`.
- `examples/notes/` the demo notes.

## License

[MIT](LICENSE)
