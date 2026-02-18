import puppeteer from 'puppeteer';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export function detectAnimationEnd(svg) {
  let maxEnd = 1;
  const animRe = /<animate[^>]*>/g;
  let m;
  while ((m = animRe.exec(svg)) !== null) {
    const tag = m[0];
    const beginStr = (tag.match(/\bbegin="([^"]*)"/) ?? [])[1] ?? '0';
    const durStr   = (tag.match(/\bdur="([^"]*)"/)   ?? [])[1] ?? '0';
    const begin = parseFloat(beginStr) || 0;
    const dur   = parseFloat(durStr)   || 0;
    maxEnd = Math.max(maxEnd, begin + dur);
  }
  return maxEnd;
}

export function detectAspectRatio(svg) {
  const vb = (svg.match(/viewBox="([^"]*)"/) ?? [])[1];
  if (vb) {
    const [, , vw, vh] = vb.trim().split(/[\s,]+/).map(Number);
    if (vw && vh) return vh / vw;
  }
  return null;
}

/**
 * Generates an animated GIF from SVG content.
 * @param {string} svgContent - Raw SVG markup
 * @param {object} options
 * @param {function} onProgress - Called with { current, total, phase }
 * @returns {Promise<Buffer>} GIF binary buffer
 */
export async function generateGif(svgContent, options = {}, onProgress = null) {
  const {
    fps     = 24,
    width   = 800,
    scale   = 2,
    quality = 1,
    holdS   = 2,
    bg      = 'white',
    animEnd: animEndOverride = null,
  } = options;

  const animEnd    = animEndOverride ?? detectAnimationEnd(svgContent);
  const aspectRatio = detectAspectRatio(svgContent);
  const height     = aspectRatio ? Math.round(width * aspectRatio) : width;
  const svgWidth   = Math.round(width * 0.85);

  const animFrames  = Math.ceil(fps * animEnd);
  const totalFrames = animFrames + 2; // frame 0..animFrames + 1 hold

  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });

  const html = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:${bg};overflow:hidden}
svg{width:${svgWidth}px;height:auto}
</style></head><body>${svgContent}</body></html>`;

  const tmpId   = crypto.randomUUID();
  const htmlPath = path.join(os.tmpdir(), `gif-gen-${tmpId}.html`);
  fs.writeFileSync(htmlPath, html);

  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const svg = document.querySelector('svg');
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    });

    const probe = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    const { width: W, height: H } = PNG.sync.read(Buffer.from(probe));

    const encoder = new GIFEncoder(W, H, 'neuquant', false);
    encoder.setRepeat(0);
    encoder.setQuality(quality);
    encoder.start();

    const frameDelay = Math.round(1000 / fps);

    async function snap(t) {
      await page.evaluate(time => document.querySelector('svg').setCurrentTime(time), t);
      await new Promise(r => setTimeout(r, 40));
      const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
      return PNG.sync.read(Buffer.from(buf)).data;
    }

    for (let i = 0; i <= animFrames; i++) {
      encoder.setDelay(frameDelay);
      encoder.addFrame(await snap((i / animFrames) * animEnd));
      onProgress?.({ current: i + 1, total: totalFrames, phase: 'frames' });
    }

    encoder.setDelay(holdS * 1000);
    encoder.addFrame(await snap(animEnd));
    onProgress?.({ current: totalFrames, total: totalFrames, phase: 'hold' });

    encoder.finish();
    return encoder.out.getData();
  } finally {
    try { fs.unlinkSync(htmlPath); } catch {}
    await browser.close();
  }
}
