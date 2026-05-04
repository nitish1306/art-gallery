const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const baseDir = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const dataDir = path.join(baseDir, 'data');

function safeReadJSON(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf-8'));
  } catch (err) {
    console.error(`[Gallery] Error reading ${filename}:`, err.message);
    return fallback;
  }
}

// GET /api/gallery/rooms — returns gallery.json (room layout)
router.get('/rooms', (req, res) => {
  res.json(safeReadJSON('gallery.json', { rooms: [], spawnPoint: null }));
});

// GET /api/gallery/artworks — returns artworks.json
router.get('/artworks', (req, res) => {
  res.json(safeReadJSON('artworks.json', []));
});

// GET /api/gallery/settings — returns settings.json
router.get('/settings', (req, res) => {
  res.json(safeReadJSON('settings.json', {}));
});

// GET /api/gallery/grid — returns grid.json
router.get('/grid', (req, res) => {
  res.json(safeReadJSON('grid.json', { width: 100, depth: 100, cellSize: 1, wallHeight: 4, grid: [], spawn: [50, 22] }));
});

// PUT /api/gallery/grid — save grid.json
router.put('/grid', express.json({ limit: '5mb' }), (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(path.join(dataDir, 'grid.json'), JSON.stringify(data), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('[Gallery] Error writing grid.json:', err.message);
    res.status(500).json({ error: 'Failed to save grid' });
  }
});

module.exports = router;
