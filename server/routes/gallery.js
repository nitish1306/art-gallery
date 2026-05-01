const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const dataDir = path.join(__dirname, '..', '..', 'data');

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

// Serve settings.json
router.get('/settings', (req, res) => {
  const settingsPath = path.join(__dirname, '../../data/settings.json');
  res.sendFile(settingsPath);
});

module.exports = router;
