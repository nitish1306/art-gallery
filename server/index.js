const express = require('express');
const path = require('path');
const fs = require('fs');

const adminRoutes = require('./routes/admin');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3456;
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');

// Parse JSON request bodies
app.use(express.json());

// Serve artwork/texture assets (from DATA_DIR/public in production, or local public/ in dev)
app.use(express.static(path.join(dataDir, 'public')));
if (dataDir !== path.join(__dirname, '..')) {
  // Also serve the repo's public/ as fallback for bundled textures/audio
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/gallery', galleryRoutes);

// In production, serve the Vite-built frontend from dist/
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res) => {
    // Let API 404s pass through; serve HTML for everything else
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    // Serve admin SPA for /admin paths
    if (req.path.startsWith('/admin')) {
      if (req.path.startsWith('/admin/editmode')) {
        const editModeIndex = path.join(distPath, 'admin', 'editmode', 'index.html');
        if (fs.existsSync(editModeIndex)) return res.sendFile(editModeIndex);
      }
      const adminIndex = path.join(distPath, 'admin', 'index.html');
      if (fs.existsSync(adminIndex)) return res.sendFile(adminIndex);
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Art Gallery API server running at http://localhost:${PORT}`);
});
