const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { autoFix, getPreview } = require('../services/imageProcessor');

const router = express.Router();

// Paths — configurable via DATA_DIR env var for persistent disk mounts (e.g. Fly.io)
const baseDir = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const dataDir = path.join(baseDir, 'data');
const uploadsDir = path.join(baseDir, 'public', 'assets', 'artworks');

// Ensure upload dir exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage — save uploads with a unique name
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, 'upload_' + uuidv4() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max

// ─── Helpers ───

function readJSON(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf-8'));
  } catch (err) {
    console.error(`[Data] Error reading ${filename}:`, err.message);
    if (filename === 'artworks.json') return [];
    if (filename === 'gallery.json') return { rooms: [], spawnPoint: null };
    if (filename === 'settings.json') return {};
    return null;
  }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Artwork Endpoints ───

// GET /api/admin/artworks — list all
router.get('/artworks', (req, res) => {
  res.json(readJSON('artworks.json'));
});

// POST /api/admin/artworks/upload — upload image, return preview
router.post('/artworks/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const preview = await getPreview(req.file.path);
    res.json({
      tempFile: req.file.filename,
      preview,
    });
  } catch (err) {
    console.error('[Admin] Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/admin/artworks — save artwork (process image + add to artworks.json)
router.post('/artworks', express.json(), async (req, res) => {
  try {
    const { tempFile, title, date, medium, description, room, wall, position } = req.body;
    if (!tempFile || !title || !room || !wall) {
      return res.status(400).json({ error: 'Missing required fields: tempFile, title, room, wall' });
    }

    const inputPath = path.join(uploadsDir, path.basename(tempFile));
    if (!fs.existsSync(inputPath)) {
      return res.status(400).json({ error: 'Temp file not found. Upload first.' });
    }

    // Process image
    const result = await autoFix(inputPath);

    // Clean up raw upload if different from processed
    const processedFullPath = path.join(baseDir, 'public', result.processedPath);
    if (path.resolve(inputPath) !== path.resolve(processedFullPath)) {
      fs.unlinkSync(inputPath);
    }

    // Build artwork entry
    const artwork = {
      id: 'artwork-' + uuidv4().slice(0, 8),
      title,
      date: date || '',
      medium: medium || '',
      description: description || '',
      image: result.processedPath,
      thumbnail: result.thumbnailPath,
      room,
      wall,
      position: parseFloat(position) || 0.5,
    };

    // Save to artworks.json
    const artworks = readJSON('artworks.json');
    artworks.push(artwork);
    writeJSON('artworks.json', artworks);

    res.json(artwork);
  } catch (err) {
    console.error('[Admin] Save artwork error:', err);
    res.status(500).json({ error: 'Failed to save artwork' });
  }
});

// PUT /api/admin/artworks/:id — update artwork metadata
router.put('/artworks/:id', express.json(), (req, res) => {
  const artworks = readJSON('artworks.json');
  const idx = artworks.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Artwork not found' });

  const allowed = ['title', 'date', 'medium', 'description', 'room', 'wall', 'position'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      artworks[idx][key] = key === 'position' ? parseFloat(req.body[key]) : req.body[key];
    }
  }

  writeJSON('artworks.json', artworks);
  res.json(artworks[idx]);
});

// DELETE /api/admin/artworks/:id — delete artwork + files
router.delete('/artworks/:id', (req, res) => {
  const artworks = readJSON('artworks.json');
  const idx = artworks.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Artwork not found' });

  const artwork = artworks[idx];

  // Delete image files
  const publicDir = path.join(baseDir, 'public');
  const imagePath = path.join(publicDir, artwork.image);
  const thumbPath = path.join(publicDir, artwork.thumbnail);

  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

  // Remove from JSON
  artworks.splice(idx, 1);
  writeJSON('artworks.json', artworks);

  res.json({ deleted: true, id: req.params.id });
});

// ─── Rooms Endpoints ───

router.get('/rooms', (req, res) => {
  res.json(readJSON('gallery.json'));
});

// PUT /api/admin/rooms — replace entire gallery layout
router.put('/rooms', express.json(), (req, res) => {
  try {
    const data = req.body;
    if (!data.rooms || !Array.isArray(data.rooms)) {
      return res.status(400).json({ error: 'Invalid layout: rooms array required' });
    }
    writeJSON('gallery.json', data);
    res.json(data);
  } catch (err) {
    console.error('[Admin] Update rooms error:', err);
    res.status(500).json({ error: 'Failed to update rooms' });
  }
});

// POST /api/admin/rooms — add a single room
router.post('/rooms', express.json(), (req, res) => {
  try {
    const gallery = readJSON('gallery.json');
    const { id, name, template } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }
    if (gallery.rooms.find(r => r.id === id)) {
      return res.status(400).json({ error: 'Room id already exists' });
    }

    const templates = { small: { w: 8, d: 6 }, medium: { w: 12, d: 10 }, large: { w: 16, d: 12 } };
    const tmpl = templates[template] || templates.medium;

    // Auto-position: find rightmost room edge and place new room there
    let maxX = 0;
    for (const r of gallery.rooms) {
      maxX = Math.max(maxX, r.position[0] + r.width);
    }

    const room = {
      id,
      name,
      template: template || 'medium',
      width: tmpl.w,
      depth: tmpl.d,
      height: 4,
      position: [maxX, 0],
      connections: [],
    };

    gallery.rooms.push(room);
    writeJSON('gallery.json', gallery);
    res.json(room);
  } catch (err) {
    console.error('[Admin] Add room error:', err);
    res.status(500).json({ error: 'Failed to add room' });
  }
});

// DELETE /api/admin/rooms/:id — remove a room
router.delete('/rooms/:id', (req, res) => {
  try {
    const gallery = readJSON('gallery.json');
    const idx = gallery.rooms.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Room not found' });

    const roomId = gallery.rooms[idx].id;
    gallery.rooms.splice(idx, 1);

    // Remove references in connections
    for (const r of gallery.rooms) {
      r.connections = (r.connections || []).filter(c => c !== roomId);
    }

    // Update spawn if it pointed to deleted room
    if (gallery.spawnPoint && gallery.spawnPoint.room === roomId && gallery.rooms.length > 0) {
      const first = gallery.rooms[0];
      gallery.spawnPoint = { room: first.id, position: [first.position[0] + first.width / 2, 0, first.position[1] + first.depth / 2] };
    }

    writeJSON('gallery.json', gallery);
    res.json({ deleted: true, id: roomId });
  } catch (err) {
    console.error('[Admin] Delete room error:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ─── Settings Endpoints ───

router.get('/settings', (req, res) => {
  res.json(readJSON('settings.json'));
});

router.put('/settings', express.json(), (req, res) => {
  try {
    const data = req.body;
    writeJSON('settings.json', data);
    res.json(data);
  } catch (err) {
    console.error('[Admin] Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/admin/textures — list available texture files
router.get('/textures', (req, res) => {
  const texDir = path.join(baseDir, 'public', 'assets', 'textures');
  try {
    const files = fs.readdirSync(texDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    const textures = files.map(f => ({
      name: f.replace(/\.[^.]+$/, ''),
      file: f,
      url: '/assets/textures/' + f,
    }));
    res.json(textures);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
