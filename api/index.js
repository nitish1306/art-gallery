const express = require('express');
const path = require('path');
// ADD THIS LINE AT THE VERY TOP OF THE FILE
console.log('Vercel API function: api/index.js invoked!');

const adminRoutes = require('../server/routes/admin');
const galleryRoutes = require('../server/routes/gallery');

const app = express();
const PORT = process.env.API_PORT || 3456;
app.use((req, res, next) => {
if (req.originalUrl && req.originalUrl !== req.url) req.url = req.originalUrl;
next();
});
app.get('/api', (req, res) => {
  console.log(adminRoutes.toString() + ' --- -- -- - ' + galleryRoutes.toString());
  res.json({ ok: true });
});

app.use((req, res, next) => {
  console.log(`[Express] Method: ${req.method}, Path: ${req.path}, URL: ${req.url}`);
  console.log(adminRoutes.toString() + ' --- -- -- - ' + galleryRoutes.toString());
  next(); // Pass control to the next middleware/route handler
});
// Parse JSON request bodies
app.use(express.json());

// Serve artwork/texture assets from public/ (also available via Vite in dev)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use(['/api/admin', '/admin'] , adminRoutes);
app.use(['/api/gallery', '/gallery'] , galleryRoutes);

app.use((req, res) => {
  console.log(`[404] No match for: ${req.url}`);
  res.status(404).json({ error: `Route ${req.url} not found` });
});

const serverless = require('serverless-http');
module.exports = serverless(app);