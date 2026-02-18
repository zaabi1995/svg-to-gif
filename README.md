# svg-to-gif

Convert animated SVGs into GIFs — instantly, locally, no cloud required.

Built by **Ali Adnan Haider Darwish Al-Zaabi**.

Comes with two ways to use it:

- **Web UI** — drag and drop your SVG, tweak settings, watch the progress bar, download your GIF
- **CLI** — one command, scriptable, great for batch use

Built on [Puppeteer](https://pptr.dev/) (headless Chrome renders each frame faithfully) and [gif-encoder-2](https://github.com/benjaminadk/gif-encoder-2).

---

## Features

- 🎨 **Drag-and-drop web UI** — zero build step, pure vanilla HTML/CSS/JS
- ⌨️  **CLI tool** — scriptable, great for automation and batch processing
- 🎞️  **Frame-accurate rendering** — Puppeteer renders every frame via `SVGAnimationElement.setCurrentTime()`
- ⚙️  **Configurable output** — FPS, width, scale (retina), quality, hold duration, background color
- 📊 **Real-time progress** — Server-Sent Events stream frame progress to the browser
- 🔒 **Fully local** — no uploads to third-party services, runs on your machine
- 🚀 **Auto-detects animation duration** — scans all `<animate>` elements automatically

---

## Quick start

**Requirements:** Node.js 18+

```bash
git clone https://github.com/zaabi1995/svg-to-gif.git
cd svg-to-gif
npm install
npm start
```

Open **http://localhost:3000** in your browser.

> `npm install` also downloads Chromium automatically via Puppeteer — this takes a minute the first time.

---

## Web UI

1. **Drop** any animated `.svg` onto the page (or click **Browse SVG**)
2. The SVG plays live in the preview area
3. Adjust settings in the right panel
4. Click **Generate GIF**
5. Watch the real-time progress bar as frames are captured
6. Click **Download** when done — the file is named after your SVG automatically

### Settings

| Setting | Default | Description |
|---|---|---|
| FPS | 24 | Frames per second of the output GIF |
| Hold | 2s | How long the final frame is held before looping |
| Width | 800px | Canvas width (height is auto-calculated from the SVG viewBox) |
| Scale | 2× | Device pixel ratio — use 2× for crisp retina output, 1× for smaller file size |
| Quality | Best | GIF color quantisation: Best (1), Good (3), Fast (7) |
| Background | White | Background color shown behind the SVG |

---

## CLI

```bash
node generate.mjs <input.svg> [output.gif] [options]
```

### Examples

```bash
# Auto-detects duration, saves logo.gif next to the SVG
node generate.mjs path/to/logo.svg

# Custom output path
node generate.mjs logo.svg exports/logo-animated.gif

# Compact version for email signatures
node generate.mjs logo.svg --fps=15 --width=560 --scale=1 --quality=5 --hold=3
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--fps=<n>` | `24` | Frames per second |
| `--width=<n>` | `800` | Canvas width in pixels |
| `--scale=<n>` | `2` | Device pixel ratio |
| `--quality=<n>` | `1` | GIF quality: 1 = best, 10 = fastest |
| `--hold=<s>` | `2` | Seconds to hold the last frame |
| `--bg=<color>` | `white` | CSS background color (e.g. `black`, `#f0f0f0`) |

---

## How it works

```
Your SVG
   │
   ▼
Puppeteer (headless Chrome)
   │  renders the SVG animation frame-by-frame
   │  using SVGAnimationElement.setCurrentTime()
   ▼
PNG screenshots  ──►  gif-encoder-2  ──►  output.gif
```

1. The SVG is loaded in a headless browser with animations paused at t=0
2. The animation duration is auto-detected by scanning all `<animate>` elements for the highest `begin + dur` value
3. Frames are captured at evenly-spaced time steps across the animation
4. A hold frame is added at the end with a longer delay to create a natural loop pause
5. All frames are encoded into a GIF using neuquant colour quantisation

---

## Project structure

```
svg-to-gif/
├── core.mjs        # Shared generation engine (Puppeteer + GIFEncoder)
├── generate.mjs    # CLI entry point
├── server.mjs      # Express web server + SSE progress streaming
├── public/
│   └── index.html  # Web UI (vanilla HTML/CSS/JS, no build step)
├── package.json
├── LICENSE
└── README.md
```

---

## Tips

**Reduce file size**
- Lower `--scale` to `1` (halves pixel dimensions, ~4× smaller file)
- Lower `--fps` to `15`
- Increase `--quality` to `5` or `7`
- Reduce `--width`

**Transparent-looking backgrounds**
Set `--bg` to match the background of wherever you'll use the GIF (e.g. `--bg=#f5f5f5` for a light-gray email template).

**Batch conversion**
```bash
for f in logos/*.svg; do
  node generate.mjs "$f" --fps=15 --width=560 --scale=1 --quality=5
done
```

---

## License

MIT © 2026 Ali Adnan Haider Darwish Al-Zaabi
