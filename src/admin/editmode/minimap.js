import * as THREE from 'three';

/**
 * Minimap — real-time 2D canvas overlay showing the grid.
 * Auto-zooms to fit the bounding box of active cells.
 * Shows player position + direction arrow.
 */

let canvas, ctx;
let gridData = null;
let artworksData = null;
let camera = null;

const MINIMAP_SIZE = 200;
const PADDING = 2; // cells of padding around active area

export function initMinimap(cam) {
  camera = cam;
  canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  canvas.width = MINIMAP_SIZE;
  canvas.height = MINIMAP_SIZE;
  ctx = canvas.getContext('2d');
}

export function setMinimapGrid(data) {
  gridData = data;
}

export function setMinimapArtworks(data) {
  artworksData = data;
}

export function updateMinimap() {
  if (!ctx || !gridData || !camera) return;

  const { grid, width, depth, cellSize } = gridData;

  // Find active bounds (include air, wall, boundary — skip void=3)
  let minX = width, maxX = 0, minZ = depth, maxZ = 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (grid[z][x] >= 0 && grid[z][x] <= 2) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
  }

  // Add padding + boundary
  minX = Math.max(0, minX - PADDING);
  maxX = Math.min(width - 1, maxX + PADDING);
  minZ = Math.max(0, minZ - PADDING);
  maxZ = Math.min(depth - 1, maxZ + PADDING);

  const rangeX = maxX - minX + 1;
  const rangeZ = maxZ - minZ + 1;

  // Scale to fit canvas
  const scale = Math.min(MINIMAP_SIZE / rangeX, MINIMAP_SIZE / rangeZ);
  const offsetX = (MINIMAP_SIZE - rangeX * scale) / 2;
  const offsetZ = (MINIMAP_SIZE - rangeZ * scale) / 2;

  // Clear
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Draw cells
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = grid[z][x];
      const px = offsetX + (x - minX) * scale;
      const pz = offsetZ + (z - minZ) * scale;

      if (cell === 0) {
        ctx.fillStyle = '#2a2a3a'; // air
      } else if (cell === 1) {
        ctx.fillStyle = '#8888aa'; // wall
      } else if (cell === 2) {
        ctx.fillStyle = '#555570'; // boundary
      } else {
        continue; // void, don't draw
      }

      ctx.fillRect(px, pz, Math.ceil(scale), Math.ceil(scale));
    }
  }

  // Draw grid lines (subtle)
  ctx.strokeStyle = 'rgba(100, 100, 140, 0.15)';
  ctx.lineWidth = 0.5;
  for (let x = minX; x <= maxX + 1; x++) {
    const px = offsetX + (x - minX) * scale;
    ctx.beginPath();
    ctx.moveTo(px, offsetZ);
    ctx.lineTo(px, offsetZ + rangeZ * scale);
    ctx.stroke();
  }
  for (let z = minZ; z <= maxZ + 1; z++) {
    const pz = offsetZ + (z - minZ) * scale;
    ctx.beginPath();
    ctx.moveTo(offsetX, pz);
    ctx.lineTo(offsetX + rangeX * scale, pz);
    ctx.stroke();
  }

  // Draw artwork dots
  if (artworksData) {
    ctx.fillStyle = '#ffd54f';
    for (const art of artworksData) {
      // Must have valid world coordinates
      if (art.worldX != null && art.worldZ != null) {
        // Must be currently placed (has room)
        if (art.room && art.room !== '') {
          const px = offsetX + (art.worldX / cellSize - minX) * scale;
          const pz = offsetZ + (art.worldZ / cellSize - minZ) * scale;
          ctx.beginPath();
          ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Draw player position
  const playerGridX = camera.position.x / cellSize;
  const playerGridZ = camera.position.z / cellSize;
  const ppx = offsetX + (playerGridX - minX) * scale;
  const ppz = offsetZ + (playerGridZ - minZ) * scale;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  
  ctx.save();
  ctx.translate(ppx, ppz);
  // Angle from +X axis (Right)
  ctx.rotate(Math.atan2(dir.z, dir.x));

  // Draw arrow pointing Right (+X)
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.moveTo(5, 0);     // Tip pointing right
  ctx.lineTo(-4, 3);    // Bottom left
  ctx.lineTo(-4, -3);   // Top left
  ctx.closePath();
  ctx.fill();

  // Dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
