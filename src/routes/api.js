// ─── Express REST API for the Web Dashboard ────────────────────────
// Provides CRUD endpoints over audiofile.json and the audio/ folder.

import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import { getAll, getById, add, update, remove } from '../utils/audioStore.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR  = join(__dirname, '..', '..', 'audio');
const ALLOWED    = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm']);

// ── Multer setup ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AUDIO_DIR),
  filename:    (_req, file, cb) => {
    const id  = uuidv4();
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, ALLOWED.has(ext));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Router ───────────────────────────────────────────────────────────
const router = Router();

// GET /api/files — List all (or filter by ?userId=)
router.get('/files', (req, res) => {
  let files = getAll();
  if (req.query.userId) {
    files = files.filter((f) => f.uploaderId === req.query.userId);
  }
  res.json(files);
});

// GET /api/files/:id — Single file metadata
router.get('/files/:id', (req, res) => {
  const file = getById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.json(file);
});

// PUT /api/files/:id — Edit metadata (title, etc.)
router.put('/files/:id', (req, res) => {
  const { title } = req.body;
  const updated = update(req.params.id, { title });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

// DELETE /api/files/:id — Remove from JSON + delete physical file
router.delete('/files/:id', (req, res) => {
  const entry = getById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  // Delete physical file
  const absPath = join(AUDIO_DIR, entry.fileName);
  if (existsSync(absPath)) {
    try { unlinkSync(absPath); } catch { /* ignore */ }
  }

  remove(req.params.id);
  res.json({ success: true, deleted: entry.id });
});

// POST /api/files/upload — Upload from web dashboard
router.post('/files/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid audio file provided.' });
  }

  const ext   = extname(req.file.originalname).toLowerCase();
  const id    = req.file.filename.replace(ext, '');
  const title = req.body.title || req.file.originalname;

  const entry = add({
    id,
    title,
    originalName: req.file.originalname,
    fileName:     req.file.filename,
    filePath:     `audio/${req.file.filename}`,
    size:         req.file.size,
    uploaderId:   req.body.userId || 'web',
    uploaderName: req.body.userName || 'Web Dashboard',
    uploadDate:   new Date().toISOString(),
  });

  res.status(201).json(entry);
});

export default router;
