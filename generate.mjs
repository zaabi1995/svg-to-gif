import { generateGif, detectAnimationEnd, detectAspectRatio } from './core.mjs';
import fs from 'fs';
import path from 'path';

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (!args.length || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: node generate.mjs <input.svg> [output.gif] [options]

Options:
  --fps=<n>       Frames per second           (default: 24)
  --width=<n>     Canvas width in px          (default: 800)
  --scale=<n>     Device pixel ratio          (default: 2)
  --quality=<n>   GIF quality 1=best 10=fast  (default: 1)
  --hold=<s>      Hold last frame in seconds  (default: 2)
  --bg=<color>    Background color            (default: white)

Examples:
  node generate.mjs ../logo.svg
  node generate.mjs ../logo.svg ../logo.gif
  node generate.mjs ../logo.svg --fps=15 --width=560 --scale=1 --quality=5
`);
  process.exit(0);
}

const positional = args.filter(a => !a.startsWith('--'));
const svgInput   = positional[0];
const gifOutput  = positional[1] ?? null;

if (!svgInput) {
  console.error('Error: provide an SVG file path as the first argument.');
  process.exit(1);
}

const flag = (name, fallback) => {
  const match = args.find(a => a.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : fallback;
};

const FPS     = Number(flag('fps',     24));
const WIDTH   = Number(flag('width',   800));
const SCALE   = Number(flag('scale',   2));
const QUALITY = Number(flag('quality', 1));
const HOLD_S  = Number(flag('hold',    2));
const BG      = flag('bg', 'white');

// ── Resolve paths ─────────────────────────────────────────────────────────────

const SVG_PATH = path.resolve(svgInput);
if (!fs.existsSync(SVG_PATH)) {
  console.error(`Error: SVG file not found: ${SVG_PATH}`);
  process.exit(1);
}

const defaultOut = path.join(
  path.dirname(SVG_PATH),
  path.basename(SVG_PATH, path.extname(SVG_PATH)) + '.gif'
);
const OUTPUT = path.resolve(gifOutput ?? defaultOut);

// ── Run ───────────────────────────────────────────────────────────────────────

const svgContent  = fs.readFileSync(SVG_PATH, 'utf-8');
const animEnd     = detectAnimationEnd(svgContent);
const aspectRatio = detectAspectRatio(svgContent);
const HEIGHT      = aspectRatio ? Math.round(WIDTH * aspectRatio) : WIDTH;

console.log(`
SVG  : ${SVG_PATH}
OUT  : ${OUTPUT}
Size : ${WIDTH}×${HEIGHT} @ ${SCALE}x
FPS  : ${FPS}   Duration: ${animEnd.toFixed(2)}s + ${HOLD_S}s hold
`);

let lastLine = '';
const buffer = await generateGif(
  svgContent,
  { fps: FPS, width: WIDTH, scale: SCALE, quality: QUALITY, holdS: HOLD_S, bg: BG },
  ({ current, total, phase }) => {
    const line = phase === 'hold'
      ? `  Adding hold frame...`
      : `  Frame ${current} / ${total}`;
    if (line !== lastLine) { process.stdout.write(line + '\n'); lastLine = line; }
  }
);

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, buffer);
console.log(`\nDone: ${OUTPUT}  (${(buffer.length / 1024).toFixed(0)} KB)`);
