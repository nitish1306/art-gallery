const express = require('express');
const path = require('path');

const adminRoutes = require('./routes/admin');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.API_PORT || 3456;

// Parse JSON request bodies
app.use(express.json());

// Serve artwork/texture assets from public/ (also available via Vite in dev)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/gallery', galleryRoutes);

app.listen(PORT, () => {
  console.log(`Art Gallery API server running at http://localhost:${PORT}`);
});
