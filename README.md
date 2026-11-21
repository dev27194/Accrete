# Accrete

Your Markdown notes as a 3D black hole you can fly through.

Each note is a star. Its sections are small lights around it, links between notes curve around the hole, and folders (or tags) become groups on the disc. Select a star to read the note.

**[Try the live demo](https://accrete-black.vercel.app)**

Accrete comes in three forms:

- **The website.** Open it, pick a folder of notes, see them as a black hole. Nothing to install.
- **The Obsidian plugin.** The same map as a tab inside Obsidian, reading your vault directly and updating as you write.
- **The one-file export.** Turns any notes folder into a single HTML file you can open offline.

All three run on your own computer. Your notes are never uploaded.

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

## For developers

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
| `npm run lint` | Checks the code |

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
