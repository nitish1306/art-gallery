import * as THREE from 'three';
import { initControls, updateControls } from '../../gallery/controls.js';
import { applyQuality, recordFrame } from '../../gallery/quality.js';
import { initLighting } from '../../gallery/lighting.js';
import { loadArtworks } from '../../gallery/artworkLoader.js';
import { buildGrid, getGridCollisionBoxes } from './gridRenderer.js';
import { initMinimap, setMinimapGrid, updateMinimap } from './minimap.js';
import {
  initEditInteraction, updateEditInteraction,
  setTool, setSelectedStashItem,
  loadEditData, getStashedArtworks, getGridDataLocal, getArtworksData,
  undo, redo, saveAll, canUndo, canRedo, getIsDirty, rebuildScene
} from './editInteraction.js';

let scene, camera, renderer, clock;
let settings = null;
let isEditModeActive = false;

async function init() {
  const res = await fetch('/api/gallery/settings');
  settings = await res.json();

  document.getElementById('gallery-name').textContent = "Edit Mode";
  waitForEntry();
}

function waitForEntry() {
  const overlay = document.getElementById('entry-overlay');

  function enter() {
    document.removeEventListener('keydown', onKey);
    overlay.removeEventListener('click', onTap);

    const loadingEl = document.getElementById('loading-overlay');
    loadingEl.style.display = 'flex';
    overlay.style.display = 'none';

    initScene().then(() => {
      const container = document.getElementById('canvas-container');
      container.classList.add('visible');
      loadingEl.style.display = 'none';
      document.getElementById('edit-hud').classList.remove('hidden');
      isEditModeActive = true;
    }).catch(err => {
      console.error('[EditMode] Failed to initialize:', err);
      loadingEl.innerHTML = `<p style="color:#ff6666;">Failed to load: ${err.message}</p><p style="color:#888;margin-top:10px;">Make sure Express server is running (node server/index.js)</p>`;
    });
  }

  function onKey(e) { if (e.key === 'Enter' || e.key === ' ') enter(); }
  function onTap() { enter(); }

  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', onTap);
}

async function initScene() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality(renderer);
  container.appendChild(renderer.domElement);

  // Load grid and artwork data
  await loadEditData();
  const gridData = getGridDataLocal();

  // Set spawn position
  const spawn = gridData.spawn || [50, 22];
  const cs = gridData.cellSize || 1;
  camera.position.set(spawn[0] * cs + cs / 2, 1.6, spawn[1] * cs + cs / 2);
  camera.lookAt(spawn[0] * cs + cs / 2, 1.6, spawn[1] * cs + cs / 2 - 1);

  // Build grid world
  await buildGrid(scene, gridData, settings);
  initLighting(scene, settings);

  // Load artworks using a virtual "grid" room
  const galData = gridToGalleryData(gridData);
  const artData = getArtworksData();
  await loadArtworks(scene, settings, artData, galData);

  // Controls
  initControls(camera, renderer.domElement);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);

  // Init edit interaction
  initEditInteraction(camera, scene, renderer, settings, {
    onDirtyChange: updateSaveButton,
    onUndoRedoChange: updateUndoRedoButtons,
    reloadStash: refreshStashUI
  });

  // Init minimap
  initMinimap(camera);
  setMinimapGrid(gridData);

  setupUI();
  refreshStashUI();
  animate();
}

function gridToGalleryData(gd) {
  return {
    rooms: [{
      id: 'grid',
      name: 'Grid Gallery',
      width: gd.width * gd.cellSize,
      depth: gd.depth * gd.cellSize,
      height: gd.wallHeight,
      position: [0, 0],
      connections: []
    }]
  };
}

// ─── Stash UI ───

function refreshStashUI() {
  const stashGrid = document.getElementById('stash-grid');
  stashGrid.innerHTML = '';

  const stashed = getStashedArtworks();
  stashed.forEach(art => {
    const div = document.createElement('div');
    div.className = 'stash-item';
    div.innerHTML = `<img src="/${art.thumbnail || art.image}" alt="${art.title}"><p>${art.title}</p>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.stash-item').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      setSelectedStashItem(art);
    });
    stashGrid.appendChild(div);
  });
}

// ─── HUD ───

function updateSaveButton(dirty) {
  const btn = document.getElementById('save-btn');
  if (dirty) {
    btn.classList.add('has-changes');
    btn.textContent = '💾 Save*';
  } else {
    btn.classList.remove('has-changes');
    btn.textContent = '💾 Save';
  }
}

function updateUndoRedoButtons() {
  document.getElementById('undo-btn').disabled = !canUndo();
  document.getElementById('redo-btn').disabled = !canRedo();
}

// ─── Resize / Animate ───

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  if (!isEditModeActive) return;

  const delta = clock.getDelta();

  updateControls(delta);
  applyGridCollision(camera);

  updateEditInteraction();
  updateMinimap();
  renderer.render(scene, camera);
  recordFrame(timestamp);
}

// ─── Grid collision with wall buffer ───
// Keeps the player at least BUFFER meters from any wall/boundary cell.

const PLAYER_BUFFER = 0.35;

function applyGridCollision(cam) {
  const gridData = getGridDataLocal();
  if (!gridData) return;

  const cs = gridData.cellSize;
  let px = cam.position.x;
  let pz = cam.position.z;
  const gx = Math.floor(px / cs);
  const gz = Math.floor(pz / cs);

  // If inside a wall cell, push to nearest air cell center
  if (gx >= 0 && gx < gridData.width && gz >= 0 && gz < gridData.depth) {
    if (gridData.grid[gz][gx] !== 0) {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      let best = null, bestDist = Infinity;
      for (const [dx, dz] of dirs) {
        const nx = gx + dx, nz = gz + dz;
        if (nx >= 0 && nx < gridData.width && nz >= 0 && nz < gridData.depth) {
          if (gridData.grid[nz][nx] === 0) {
            const cx = nx * cs + cs / 2, cz = nz * cs + cs / 2;
            const d = Math.sqrt((px-cx)**2 + (pz-cz)**2);
            if (d < bestDist) { bestDist = d; best = {x:cx, z:cz}; }
          }
        }
      }
      if (best) { cam.position.x = best.x; cam.position.z = best.z; }
      return;
    }
  }

  // Buffer: check all 8 neighboring cells for walls and push away
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nx = gx + dx, nz = gz + dz;
      if (nx < 0 || nx >= gridData.width || nz < 0 || nz >= gridData.depth) continue;
      if (gridData.grid[nz][nx] === 0) continue; // air, no collision

      // Wall/boundary cell — push player away from its edges
      const wallMinX = nx * cs;
      const wallMaxX = nx * cs + cs;
      const wallMinZ = nz * cs;
      const wallMaxZ = nz * cs + cs;

      // Find closest point on the wall box to the player
      const closestX = Math.max(wallMinX, Math.min(px, wallMaxX));
      const closestZ = Math.max(wallMinZ, Math.min(pz, wallMaxZ));

      const distX = px - closestX;
      const distZ = pz - closestZ;
      const dist = Math.sqrt(distX * distX + distZ * distZ);

      if (dist < PLAYER_BUFFER && dist > 0.001) {
        // Push away from the wall
        const pushX = (distX / dist) * (PLAYER_BUFFER - dist);
        const pushZ = (distZ / dist) * (PLAYER_BUFFER - dist);
        cam.position.x += pushX;
        cam.position.z += pushZ;
        px = cam.position.x;
        pz = cam.position.z;
      } else if (dist < 0.001) {
        // Exactly on the wall edge — push toward own cell center
        cam.position.x = gx * cs + cs / 2;
        cam.position.z = gz * cs + cs / 2;
        px = cam.position.x;
        pz = cam.position.z;
      }
    }
  }
}

// ─── UI setup ───

function setupUI() {
  const slots = document.querySelectorAll('.hotbar-slot');
  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      slots.forEach(s => s.classList.remove('active'));
      slot.classList.add('active');
      setTool(slot.dataset.tool);
      document.getElementById('current-tool-info').textContent =
        slot.querySelector('.slot-name').textContent;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (['1', '2', '3'].includes(e.key)) {
      const idx = parseInt(e.key) - 1;
      if (slots[idx]) slots[idx].click();
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { document.exitPointerLock(); }
  });

  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('undo-btn').addEventListener('click', () => undo());
  document.getElementById('redo-btn').addEventListener('click', () => redo());

  // Upload modal
  const modal = document.getElementById('upload-modal');
  document.getElementById('add-new-artwork-btn').addEventListener('click', () => {
    document.exitPointerLock();
    modal.classList.remove('hidden');
  });

  document.getElementById('cancel-upload-btn').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('artwork-file');
    const titleInput = document.getElementById('artwork-title');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    const uploadRes = await fetch('/api/admin/artworks/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();

    const saveRes = await fetch('/api/admin/artworks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempFile: uploadData.tempFile,
        title: titleInput.value,
        room: '',
        wall: '',
        position: 0.5
      })
    });

    if (saveRes.ok) {
      const newArt = await saveRes.json();
      getArtworksData().push(newArt);
      modal.classList.add('hidden');
      fileInput.value = '';
      titleInput.value = '';
      refreshStashUI();
    }
  });

  updateUndoRedoButtons();
  updateSaveButton(false);
}

async function handleSave() {
  const btn = document.getElementById('save-btn');
  btn.textContent = '⏳ Saving...';
  btn.disabled = true;

  const ok = await saveAll();

  btn.disabled = false;
  if (ok) {
    btn.textContent = '✅ Saved!';
    setTimeout(() => updateSaveButton(false), 1500);
  } else {
    btn.textContent = '❌ Failed';
    setTimeout(() => updateSaveButton(getIsDirty()), 1500);
  }
}

init();
