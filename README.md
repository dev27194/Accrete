# Accrete

Your Markdown notes as a 3D black hole you can fly through. Each note is a star, its sections are small lights around it, links curve around the hole, and folders become groups on the disc.

## The website

The site is one self-contained page. It opens on demo notes. Visitors click **Open your notes**, pick a folder of `.md` files (an Obsidian vault works), and see their own notes as the black hole.

- Everything happens in the visitor's browser tab. Notes are read there and never uploaded, and the page makes no network requests at all (its Content Security Policy blocks them).
- The map stays for that browser tab only. A fresh visit starts on the demo again, and **Demo** goes back to it at any time.
- Needs a browser with WebGL 2 (current Chrome, Edge, Firefox and Safari).

### Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```
npm install
npm run dev
```

Open http://localhost:4321. The page is rebuilt from `src/` on every refresh, using the demo notes in `data/dev-graph.json`.

### Build and deploy

```
npm run build:site
```

That writes `site/index.html` from the demo notes in `examples/notes`. The `site/` folder is the whole website: any static host can serve it.

**Vercel:** import this repo. `vercel.json` already sets the build command (`npm run build:site`) and the output folder (`site`). Then add your domain under **Settings → Domains**.

### Change the demo notes

The demo is built from `examples/notes`. Each folder is a group and each `.md` file a page:

- `# Title` names the page.
- Each `## Heading` becomes one of its ideas (the small lights around the star).
- `[[Page name]]` links two pages.

Edit the notes, then run `npm run build:site` again. For the local server, refresh its data with:

```
node scripts/import-markdown.mjs examples/notes --json data/dev-graph.json
```

## One-file export (command line)

The importer turns any notes folder into a single HTML file you can open offline:

```
node scripts/import-markdown.mjs "C:\path\to\notes" --owner "Your Name" --open
```

It writes `my-brain.html` (git-ignored). That file holds the full text of the notes, so keep it private. Run it with `--help` for the options (`--cluster folders|tags|links`, `--max`, `--json`, `--out`). On Windows, `Build My Brain (Windows).bat` does the same with a folder picker.

What it reads:
- Every `.md` file in the folder and its subfolders. Hidden folders like `.obsidian` are skipped.
- `[[wiki links]]`, `[[Note|alias]]` and relative Markdown links: each becomes a connection.
- Tags from front matter (`tags: [a, b]`) and `#tags` in the text.
- Groups: top-level folders when there are two or more, otherwise tags, otherwise groups of linked notes, at most six.
- `title:` and `updated:` in front matter, or the first `# Heading`. File dates otherwise.
- Raw HTML in notes is shown as text, never run.

## Obsidian plugin

The same map as an Obsidian tab, reading the vault directly:

```
npm run build:plugin
```

Copy `main.js`, `styles.css` and `manifest.json` into `<vault>/.obsidian/plugins/accrete/`.

## Where things are

- `src/` the map: `sky.js` (the Milky Way and stars), `accretion.js` and `lensing.js` (the black hole), `blackhole.js` (camera, pages, links), `app.mjs` (the page around it), `notes.js` (Markdown to map data, shared by the site and the importer), `loader.js` (Open your notes), `prototype.html` (page layout and styles).
- `scripts/` the dev server, site build and importer.
- `obsidian/` the plugin.
