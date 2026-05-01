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

router.get('/rooms', (req, res) => {
  // Add caching headers to prevent 304 for this specific endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(safeReadJSON('gallery.json', { rooms: [], spawnPoint: null }));
});

router.get('/artworks', (req, res) => {
  // Add caching headers to prevent 304 for this specific endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(safeReadJSON('artworks.json', []));
});

router.get('/settings', (req, res) => {
  // Add caching headers to prevent 304 for this specific endpoint
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(safeReadJSON('settings.json', {}));
});

module.exports = router;