/**
 * Room Editor — manage rooms, connections, and 2D layout preview.
 */
import { showToast } from './toast.js';

let gallery = null; // { rooms: [], spawnPoint: {} }
let artworks = [];
const templates = {
  small: { w: 8, d: 6 },
  medium: { w: 12, d: 10 },
  large: { w: 16, d: 12 },
};

const roomList = document.getElementById('room-list');
const previewCanvas = document.getElementById('room-preview');
const previewCtx = previewCanvas.getContext('2d');
const addRoomForm = document.getElementById('add-room-form');
const spawnSelect = document.getElementById('spawn-room');
const saveSpawnBtn = document.getElementById('save-spawn-btn');

async function init() {
  await loadData();
  render();
  bindEvents();
}

async function loadData() {
  const [gRes, aRes] = await Promise.all([
    fetch('/api/admin/rooms'),
    fetch('/api/admin/artworks'),
  ]);
  gallery = await gRes.json();
  artworks = await aRes.json();
}

function render() {
  renderRoomList();
  renderPreview();
  renderSpawnSelect();
}

// ─── Room list ───

function renderRoomList() {
  roomList.innerHTML = '';
  for (const room of gallery.rooms) {
    const artCount = artworks.filter(a => a.room === room.id).length;
    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div class="room-card-header">
        <strong>${esc(room.name)}</strong>
        <span class="room-meta">${room.template} &middot; ${room.width}x${room.depth} &middot; ${artCount} art</span>
      </div>
      <div class="room-card-row">
        <label>Template</label>
        <select data-id="${room.id}" class="tmpl-select">
          <option value="small" ${room.template === 'small' ? 'selected' : ''}>Small (8x6)</option>
          <option value="medium" ${room.template === 'medium' ? 'selected' : ''}>Medium (12x10)</option>
          <option value="large" ${room.template === 'large' ? 'selected' : ''}>Large (16x12)</option>
        </select>
      </div>
      <div class="room-card-row">
        <label>Connections</label>
        <div class="conn-checks">${renderConnectionCheckboxes(room)}</div>
      </div>
      <button class="btn-delete btn-delete-room" data-id="${room.id}">Delete Room</button>
    `;
    roomList.appendChild(card);
  }

  // Bind template selects
  roomList.querySelectorAll('.tmpl-select').forEach(sel => {
    sel.addEventListener('change', () => onTemplateChange(sel.dataset.id, sel.value));
  });

  // Bind connection checkboxes
  roomList.querySelectorAll('.conn-check').forEach(cb => {
    cb.addEventListener('change', () => onConnectionChange(cb.dataset.room, cb.dataset.target, cb.checked));
  });

  // Bind delete buttons
  roomList.querySelectorAll('.btn-delete-room').forEach(btn => {
    btn.addEventListener('click', () => onDeleteRoom(btn.dataset.id));
  });
}

function renderConnectionCheckboxes(room) {
  return gallery.rooms
    .filter(r => r.id !== room.id)
    .map(r => {
      const checked = (room.connections || []).includes(r.id) ? 'checked' : '';
      return `<label class="conn-label"><input type="checkbox" class="conn-check" data-room="${room.id}" data-target="${r.id}" ${checked}> ${esc(r.name)}</label>`;
    })
    .join('');
}

// ─── Room actions ───

async function onTemplateChange(roomId, template) {
  const room = gallery.rooms.find(r => r.id === roomId);
  if (!room) return;

  const tmpl = templates[template] || templates.medium;
  room.template = template;
  room.width = tmpl.w;
  room.depth = tmpl.d;

  // Re-layout positions
  reLayoutRooms();
  await saveGallery();
  render();
}

function onConnectionChange(roomId, targetId, connected) {
  const room = gallery.rooms.find(r => r.id === roomId);
  const target = gallery.rooms.find(r => r.id === targetId);
  if (!room || !target) return;

  room.connections = room.connections || [];
  target.connections = target.connections || [];

  if (connected) {
    if (!room.connections.includes(targetId)) room.connections.push(targetId);
    if (!target.connections.includes(roomId)) target.connections.push(roomId);
  } else {
    room.connections = room.connections.filter(c => c !== targetId);
    target.connections = target.connections.filter(c => c !== roomId);
  }

  reLayoutRooms();
  saveGallery();
  render();
}

async function onDeleteRoom(roomId) {
  const artCount = artworks.filter(a => a.room === roomId).length;
  const msg = artCount > 0
    ? `This room has ${artCount} artwork(s) assigned. Delete anyway?`
    : 'Delete this room?';
  if (!confirm(msg)) return;

  try {
    const res = await fetch('/api/admin/rooms/' + roomId, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Room deleted', 'success');
    await loadData();
    render();
  } catch (err) {
    showToast('Failed to delete room: ' + err.message, 'error');
  }
}

// ─── Add room ───

function bindEvents() {
  addRoomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-room-name').value.trim();
    const template = document.getElementById('new-room-template').value;
    if (!name) return;

    const id = 'room-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, template }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Add failed');
      }
      showToast('Room added!', 'success');
      addRoomForm.reset();
      await loadData();
      render();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });

  saveSpawnBtn.addEventListener('click', async () => {
    const roomId = spawnSelect.value;
    const room = gallery.rooms.find(r => r.id === roomId);
    if (!room) return;

    gallery.spawnPoint = {
      room: roomId,
      position: [room.position[0] + room.width / 2, 0, room.position[1] + room.depth / 2],
    };
    await saveGallery();
    showToast('Spawn point saved', 'success');
  });
}

// ─── Layout ───

function reLayoutRooms() {
  // Simple linear layout: place rooms left to right in order
  let x = 0;
  for (const room of gallery.rooms) {
    room.position = [x, 0];
    x += room.width;
  }
}

async function saveGallery() {
  try {
    const res = await fetch('/api/admin/rooms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gallery),
    });
    if (!res.ok) throw new Error('Save failed');
  } catch (err) {
    showToast('Failed to save layout: ' + err.message, 'error');
  }
}

// ─── Spawn select ───

function renderSpawnSelect() {
  spawnSelect.innerHTML = '';
  for (const room of gallery.rooms) {
    const opt = document.createElement('option');
    opt.value = room.id;
    opt.textContent = room.name;
    if (gallery.spawnPoint && gallery.spawnPoint.room === room.id) opt.selected = true;
    spawnSelect.appendChild(opt);
  }
}

// ─── 2D Preview Canvas ───

function renderPreview() {
  const ctx = previewCtx;
  const W = previewCanvas.width;
  const H = previewCanvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!gallery.rooms.length) return;

  // Compute world bounds
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of gallery.rooms) {
    minX = Math.min(minX, r.position[0]);
    minZ = Math.min(minZ, r.position[1]);
    maxX = Math.max(maxX, r.position[0] + r.width);
    maxZ = Math.max(maxZ, r.position[1] + r.depth);
  }

  const worldW = maxX - minX || 1;
  const worldD = maxZ - minZ || 1;
  const pad = 20;
  const drawW = W - pad * 2;
  const drawH = H - pad * 2;
  const scale = Math.min(drawW / worldW, drawH / worldD);
  const ox = pad + (drawW - worldW * scale) / 2;
  const oz = pad + (drawH - worldD * scale) / 2;

  function toCanvas(wx, wz) {
    return [ox + (wx - minX) * scale, oz + (wz - minZ) * scale];
  }

  const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#ce93d8', '#ef5350', '#90a4ae'];

  // Draw rooms
  for (let i = 0; i < gallery.rooms.length; i++) {
    const r = gallery.rooms[i];
    const [x, z] = toCanvas(r.position[0], r.position[1]);
    const w = r.width * scale;
    const d = r.depth * scale;
    const color = colors[i % colors.length];

    ctx.fillStyle = color + '30';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillRect(x, z, w, d);
    ctx.strokeRect(x, z, w, d);

    // Label
    ctx.fillStyle = '#eee';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, x + w / 2, z + d / 2 + 4);
  }

  // Draw connection lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const drawn = new Set();
  for (const r of gallery.rooms) {
    const cx1 = r.position[0] + r.width / 2;
    const cz1 = r.position[1] + r.depth / 2;
    for (const connId of (r.connections || [])) {
      const key = [r.id, connId].sort().join('-');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const other = gallery.rooms.find(x => x.id === connId);
      if (!other) continue;
      const cx2 = other.position[0] + other.width / 2;
      const cz2 = other.position[1] + other.depth / 2;
      const [a1, b1] = toCanvas(cx1, cz1);
      const [a2, b2] = toCanvas(cx2, cz2);
      ctx.beginPath();
      ctx.moveTo(a1, b1);
      ctx.lineTo(a2, b2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Spawn point marker
  if (gallery.spawnPoint) {
    const sp = gallery.spawnPoint.position;
    if (sp) {
      const [sx, sz] = toCanvas(sp[0], sp[2]);
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd54f';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

init();
