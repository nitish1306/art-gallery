const express = require('express');
const path = require('path');
// ADD THIS LINE AT THE VERY TOP OF THE FILE
console.log('Vercel API function: api/index.js invoked!');

const adminRoutes = require('../server/routes/admin');
const galleryRoutes = require('../server/routes/gallery');

const app = express();
const PORT = process.env.API_PORT || 3456;

// Parse JSON request bodies
app.use(express.json());

// Serve artwork/texture assets from public/ (also available via Vite in dev)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/gallery', galleryRoutes);

module.exports = app;