/**
 * HUD — FPS counter and minimap overlay.
 * Draws a top-down minimap on a 2D canvas showing room outlines,
 * player position, and facing direction.
 */

import { initMinimap, setMinimapGrid, setMinimapArtworks, updateMinimap } from '../admin/editmode/minimap.js';

let fpsEl;
let camera = null;

// FPS tracking
let frameCount = 0;
let lastFpsTime = 0;
let currentFps = 0;

export async function initHUD(cam) {
  camera = cam;

  // Fetch grid data for minimap
  const res = await fetch('/api/gallery/grid?t=' + Date.now());
  const gridData = await res.json();
  
  // Fetch artwork data for map dots
  const artRes = await fetch('/api/gallery/artworks?t=' + Date.now());
  const artworks = await artRes.json();

  // FPS element
  fpsEl = document.getElementById('fps-counter');

  // Init shared minimap
  initMinimap(camera);
  setMinimapGrid(gridData);
  setMinimapArtworks(artworks);

  // Show HUD
  document.getElementById('hud').style.display = 'block';
}

export function updateHUD(timestamp) {
  if (!camera) return;

  // FPS
  frameCount++;
  if (timestamp - lastFpsTime >= 500) {
    currentFps = Math.round(frameCount / ((timestamp - lastFpsTime) / 1000));
    frameCount = 0;
    lastFpsTime = timestamp;
    fpsEl.textContent = currentFps + ' FPS';
  }

  // Minimap
  updateMinimap();
}
