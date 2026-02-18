import express from 'express';
import multer from 'multer';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateGif } from './core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app  = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── In-memory job store ───────────────────────────────────────────────────────

class Job extends EventEmitter {
  constructor(filename) {
    super();
    this.setMaxListeners(20);
    this.status    = 'pending';  // pending | running | done | error
    this.gifBuffer = null;
    this.error     = null;
    this.filename  = filename;
  }
}

const jobs = new Map();

// ── Static UI ─────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ── POST /generate ────────────────────────────────────────────────────────────

app.post('/generate', upload.single('svg'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No SVG file uploaded.' });

  const svgContent = req.file.buffer.toString('utf-8');
  const rawName    = (req.body.filename ?? req.file.originalname ?? 'output.svg')
    .replace(/\.svg$/i, '');
  const gifName    = `${rawName}.gif`;

  const options = {
    fps:     Number(req.body.fps     ?? 24),
    width:   Number(req.body.width   ?? 800),
    scale:   Number(req.body.scale   ?? 2),
    quality: Number(req.body.quality ?? 1),
    holdS:   Number(req.body.hold    ?? 2),
    bg:      req.body.bg ?? 'white',
  };

  const jobId = crypto.randomUUID();
  const job   = new Job(gifName);
  jobs.set(jobId, job);

  res.json({ jobId, filename: gifName });

  // Run generation asynchronously after responding
  job.status = 'running';
  generateGif(svgContent, options, ({ current, total, phase }) => {
    job.emit('progress', { current, total, phase });
  })
    .then(buffer => {
      job.gifBuffer = buffer;
      job.status    = 'done';
      job.emit('done', { size: buffer.length });
      // Auto-cleanup after 10 minutes
      setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
    })
    .catch(err => {
      console.error('Generation error:', err);
      job.status = 'error';
      job.error  = err.message;
      job.emit('error', err.message);
      setTimeout(() => jobs.delete(jobId), 60 * 1000);
    });
});

// ── GET /progress/:jobId  (Server-Sent Events) ────────────────────────────────

app.get('/progress/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).send('Job not found');

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (job.status === 'done') {
    send({ type: 'done', size: job.gifBuffer.length });
    return res.end();
  }
  if (job.status === 'error') {
    send({ type: 'error', message: job.error });
    return res.end();
  }

  const onProgress = data => send({ type: 'progress', ...data });
  const onDone     = ({ size }) => { send({ type: 'done', size }); res.end(); };
  const onError    = msg => { send({ type: 'error', message: msg }); res.end(); };

  job.on('progress', onProgress);
  job.once('done',   onDone);
  job.once('error',  onError);

  req.on('close', () => {
    job.off('progress', onProgress);
    job.off('done',     onDone);
    job.off('error',    onError);
  });
});

// ── GET /download/:jobId ──────────────────────────────────────────────────────

app.get('/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done' || !job.gifBuffer) {
    return res.status(404).json({ error: 'GIF not ready or not found.' });
  }
  res.setHeader('Content-Type',        'image/gif');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.send(job.gifBuffer);
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\n  SVG → GIF  ready at  http://localhost:${PORT}\n`);
});
