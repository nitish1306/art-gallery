/**
 * HUD — FPS counter and minimap overlay.
 * Draws a top-down minimap on a 2D canvas showing room outlines,
 * player position, and facing direction.
 */

let fpsEl, mapCanvas, mapCtx;
let rooms = [];
let artworks = [];
let camera = null;

// FPS tracking
let frameCount = 0;
let lastFpsTime = 0;
let currentFps = 0;

// Map settings
const MAP_SIZE = 160;
const MAP_PADDING = 8;

export async function initHUD(cam) {
  camera = cam;

  // Fetch room data for minimap
  const res = await fetch('/api/gallery/rooms');
  const data = await res.json();
  rooms = data.rooms;

  // Fetch artwork data for map dots
  const artRes = await fetch('/api/gallery/artworks');
  artworks = await artRes.json();

  // FPS element
  fpsEl = document.getElementById('fps-counter');

  // Minimap canvas
  mapCanvas = document.getElementById('minimap');
  mapCanvas.width = MAP_SIZE;
  mapCanvas.height = MAP_SIZE;
  mapCtx = mapCanvas.getContext('2d');

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
  drawMinimap();
}

function drawMinimap() {
  const ctx = mapCtx;
  ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Calculate bounds of all rooms
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of rooms) {
    const rx = r.position[0];
    const rz = r.position[1];
    minX = Math.min(minX, rx);
    minZ = Math.min(minZ, rz);
    maxX = Math.max(maxX, rx + r.width);
    maxZ = Math.max(maxZ, rz + r.depth);
  }

  const worldW = maxX - minX;
  const worldD = maxZ - minZ;
  const drawSize = MAP_SIZE - MAP_PADDING * 2;
  const scale = Math.min(drawSize / worldW, drawSize / worldD);
  const offsetX = MAP_PADDING + (drawSize - worldW * scale) / 2;
  const offsetZ = MAP_PADDING + (drawSize - worldD * scale) / 2;

  function toMap(wx, wz) {
    return [
      offsetX + (wx - minX) * scale,
      offsetZ + (wz - minZ) * scale,
    ];
  }

  // Draw rooms
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';

  const roomMap = {};
  for (const r of rooms) {
    roomMap[r.id] = r;
    const [x, z] = toMap(r.position[0], r.position[1]);
    const w = r.width * scale;
    const d = r.depth * scale;
    ctx.fillRect(x, z, w, d);
    ctx.strokeRect(x, z, w, d);

    // Room label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, x + w / 2, z + d / 2 + 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';

    // Draw partition walls
    if (r.partitions) {
      for (const p of r.partitions) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        const rx = r.position[0];
        const rz = r.position[1];

        if (p.axis === 'x') {
          const [x1, z1] = toMap(rx + p.wallStart, rz + p.offset);
          const [x2, z2] = toMap(rx + p.wallEnd, rz + p.offset);
          ctx.beginPath();
          ctx.moveTo(x1, z1);
          ctx.lineTo(x2, z2);
          ctx.stroke();
        } else {
          const [x1, z1] = toMap(rx + p.offset, rz + p.wallStart);
          const [x2, z2] = toMap(rx + p.offset, rz + p.wallEnd);
          ctx.beginPath();
          ctx.moveTo(x1, z1);
          ctx.lineTo(x2, z2);
          ctx.stroke();
        }
      }
    }
  }

  // Draw artwork dots
  ctx.fillStyle = '#ffd54f';
  for (const art of artworks) {
    const room = roomMap[art.room];
    if (!room) continue;
    const pos = getArtworkMapPos(room, art);
    if (!pos) continue;
    const [ax, az] = toMap(pos[0], pos[1]);
    ctx.beginPath();
    ctx.arc(ax, az, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw player position
  const px = camera.position.x;
  const pz = camera.position.z;
  const [mx, mz] = toMap(px, pz);

  // Player dot
  ctx.beginPath();
  ctx.arc(mx, mz, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  // Facing direction arrow
  const q = camera.quaternion;
  // Extract forward direction from quaternion (camera looks down -Z)
  const fw_x = -(2 * (q.x * q.z + q.w * q.y));
  const fw_z = -(1 - 2 * (q.x * q.x + q.y * q.y));
  const len = Math.sqrt(fw_x * fw_x + fw_z * fw_z);
  const nx = fw_x / len;
  const nz = fw_z / len;

  const arrowLen = 12;
  ctx.beginPath();
  ctx.moveTo(mx, mz);
  ctx.lineTo(mx + nx * arrowLen * (scale / scale), mz + nz * arrowLen);
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Compute world X,Z for an artwork to place its dot on the minimap
function getArtworkMapPos(room, art) {
  const rx = room.position[0];
  const rz = room.position[1];
  const w = room.width;
  const d = room.depth;
  const t = art.position ?? 0.5;
  const wall = art.wall;

  if (wall === 'north') return [rx + t * w, rz];
  if (wall === 'south') return [rx + t * w, rz + d];
  if (wall === 'west') return [rx, rz + t * d];
  if (wall === 'east') return [rx + w, rz + t * d];

  if (wall && wall.startsWith('partition-')) {
    const partitions = room.partitions || [];
    const p = partitions[0];
    if (!p) return null;

    if (p.axis === 'x') {
      const pxStart = rx + p.wallStart;
      const pxEnd = rx + p.wallEnd;
      return [pxStart + t * (pxEnd - pxStart), rz + p.offset];
    } else {
      const pzStart = rz + p.wallStart;
      const pzEnd = rz + p.wallEnd;
      return [rx + p.offset, pzStart + t * (pzEnd - pzStart)];
    }
  }

  return null;
}
