import * as THREE from 'three';
import { initControls, updateControls } from '../../gallery/controls.js';
import { applyQuality, recordFrame } from '../../gallery/quality.js';
import { initLighting, buildGridLights } from '../../gallery/lighting.js';
import { loadArtworks } from '../../gallery/artworkLoader.js';
import { buildGrid, getGridCollisionBoxes } from './gridRenderer.js';
import { initMinimap, setMinimapGrid, setMinimapArtworks, updateMinimap } from './minimap.js';
import {
  initEditInteraction, updateEditInteraction,
  setTool, setSelectedStashItem,
  loadEditData, getStashedArtworks, getGridDataLocal, getArtworksData,
  undo, redo, saveAll, canUndo, canRedo, getIsDirty, rebuildScene,
  buildStashItems, getStashItems, getStashIndex, navigateStash, armStashIndex,
  getHoveredArtifact, startMovingArtifact, stashArtworkById, stashLightById,
  getLightDataById, updateLightProperty
} from './editInteraction.js';

let scene, camera, renderer, clock;
let settings = null;
let isEditModeActive = false;

// ─── Stash wheel state ───
let _wheelVisible = false;

async function init() {
  const res = await fetch('/api/gallery/settings');
  settings = await res.json();
  document.getElementById('gallery-name').textContent = 'Edit Mode';
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
      loadingEl.innerHTML = `<p style="color:#ff6666;">Failed to load: ${err.message}</p>`;
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
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.04);
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality(renderer);
  container.appendChild(renderer.domElement);

  await loadEditData();
  const gridData = getGridDataLocal();
  const spawn = gridData.spawn || [50, 22];
  const cs = gridData.cellSize || 1;
  camera.position.set(spawn[0] * cs + cs / 2, 1.6, spawn[1] * cs + cs / 2);
  camera.lookAt(spawn[0] * cs + cs / 2, 1.6, spawn[1] * cs + cs / 2 - 1);

  await buildGrid(scene, gridData, settings);
  initLighting(scene, settings);
  buildGridLights(scene, gridData);

  const galData = gridToGalleryData(gridData);
  const artData = getArtworksData();
  await loadArtworks(scene, settings, artData, galData);

  initControls(camera, renderer.domElement);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);

  initEditInteraction(camera, scene, renderer, settings, {
    onDirtyChange: updateSaveButton,
    onUndoRedoChange: updateUndoRedoButtons,
    reloadStash: refreshStashWheel,
    onHoverChange: onHoverChange
  });

  initMinimap(camera);
  setMinimapGrid(gridData);
  setMinimapArtworks(getArtworksData());

  setupUI();
  refreshStashWheel();
  animate();
}

function gridToGalleryData(gd) {
  return { rooms: [{ id: 'grid', name: 'Grid Gallery', width: gd.width * gd.cellSize, depth: gd.depth * gd.cellSize, height: gd.wallHeight, position: [0, 0], connections: [] }] };
}

// ─── Stash Wheel ───

function refreshStashWheel() {
  const items = buildStashItems();
  renderStashWheel(items, getStashIndex());
}

/** Sizes for positions relative to selected: 0=selected, ±1, ±2, ±3 */
const SW_SIZES  = [80, 64, 52, 40];
const SW_OPACITIES = [1.0, 0.80, 0.60, 0.40];
const SW_RADIUS = 3; // show ±3

function renderStashWheel(items, selIdx) {
  const track = document.getElementById('stash-wheel-track');
  const label = document.getElementById('stash-wheel-label');
  track.innerHTML = '';

  if (items.length === 0) {
    label.textContent = 'Stash empty';
    return;
  }

  const n = items.length;

  for (let offset = -SW_RADIUS; offset <= SW_RADIUS; offset++) {
    const idx = ((selIdx + offset) % n + n) % n;
    const item = items[idx];
    const dist = Math.abs(offset);
    const size = SW_SIZES[Math.min(dist, SW_SIZES.length - 1)];
    const opacity = SW_OPACITIES[Math.min(dist, SW_OPACITIES.length - 1)];

    const div = document.createElement('div');
    div.className = 'sw-item' + (offset === 0 ? ' sw-selected' : '');
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.opacity = opacity;

    if (item.isLight) {
      const icon = document.createElement('span');
      icon.className = 'sw-icon';
      icon.textContent = item.icon || '💡';
      div.appendChild(icon);
    } else {
      const img = document.createElement('img');
      img.src = '/' + (item.thumbnail || item.image || '');
      img.alt = item.title || '';
      div.appendChild(img);
      if (offset === 0) {
        const badge = document.createElement('span');
        badge.className = 'sw-label-badge';
        badge.textContent = (item.title || '').substring(0, 10);
        div.appendChild(badge);
      }
    }
    track.appendChild(div);
  }

  const sel = items[selIdx];
  label.textContent = sel ? (sel.label || sel.title || 'Item') : '';
}

// ─── Hover change callback (from editInteraction) ───

function onHoverChange(artifact) {
  const prompt = document.getElementById('artifact-prompt');
  const promptText = document.getElementById('artifact-prompt-text');

  if (!artifact) {
    prompt.classList.add('hidden');
    return;
  }

  const name = artifact.type === 'artwork'
    ? (artifact.data.title || 'Artwork')
    : (artifact.data.type === 'headlight' ? 'Headlight' : 'Spotlight');

  promptText.textContent = `Edit ${name}`;
  prompt.classList.remove('hidden');
}

// ─── Edit Action Menu ───

let _editMenuArtifact = null;

function openEditMenu() {
  const artifact = getHoveredArtifact();
  if (!artifact) return;
  _editMenuArtifact = artifact;

  document.exitPointerLock();

  const menu = document.getElementById('edit-action-menu');
  const title = document.getElementById('eam-title');
  const adjBtn = document.getElementById('eam-adjust');

  const name = artifact.type === 'artwork'
    ? (artifact.data.title || 'Artwork')
    : (artifact.data.type === 'headlight' ? 'Headlight' : 'Spotlight');

  title.textContent = name;
  adjBtn.classList.toggle('hidden', artifact.type !== 'light');

  document.getElementById('artifact-prompt').classList.add('hidden');
  menu.classList.remove('hidden');
}

function closeEditMenu() {
  document.getElementById('edit-action-menu').classList.add('hidden');
  _editMenuArtifact = null;
}

// ─── Light Adjust Panel ───

let _adjustLightId = null;

function openAdjustPanel(artifact) {
  if (!artifact || artifact.type !== 'light') return;
  const ld = artifact.data;
  _adjustLightId = ld.id;

  const panel = document.getElementById('light-adjust-panel');
  const intSlider = document.getElementById('adj-intensity');
  const angSlider = document.getElementById('adj-angle');
  const rotSlider = document.getElementById('adj-rotation');
  const colorPicker = document.getElementById('adj-color');

  intSlider.value = ld.intensity !== undefined ? ld.intensity : 2.0;
  angSlider.value = ld.angle !== undefined ? ld.angle : 45;
  rotSlider.value = ld.rotation !== undefined ? ld.rotation : 0;
  colorPicker.value = ld.color || '#ffeedd';

  document.getElementById('adj-intensity-val').textContent = parseFloat(intSlider.value).toFixed(1);
  document.getElementById('adj-angle-val').textContent = angSlider.value + '°';
  document.getElementById('adj-rotation-val').textContent = rotSlider.value + '°';

  closeEditMenu();
  panel.classList.remove('hidden');
}

function closeAdjustPanel() {
  document.getElementById('light-adjust-panel').classList.add('hidden');
  _adjustLightId = null;
}

// ─── HUD ───

function updateSaveButton(dirty) {
  const btn = document.getElementById('save-btn');
  if (dirty) { btn.classList.add('has-changes'); btn.textContent = '💾 Save*'; }
  else { btn.classList.remove('has-changes'); btn.textContent = '💾 Save'; }
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

// ─── Grid collision ───

const PLAYER_BUFFER = 0.35;

function applyGridCollision(cam) {
  const gridData = getGridDataLocal();
  if (!gridData) return;
  const cs = gridData.cellSize || 1;
  const width = gridData.width || 100;
  const depth = gridData.depth || 100;
  let px = cam.position.x, pz = cam.position.z;
  const gx = Math.floor(px / cs), gz = Math.floor(pz / cs);

  if (gx >= 0 && gx < width && gz >= 0 && gz < depth) {
    if (gridData.grid[gz][gx] !== 0) {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      let best = null, bestDist = Infinity;
      for (const [dx, dz] of dirs) {
        const nx = gx + dx, nz = gz + dz;
        if (nx >= 0 && nx < width && nz >= 0 && nz < depth && gridData.grid[nz][nx] === 0) {
          const cx = nx * cs + cs / 2, cz = nz * cs + cs / 2;
          const d = Math.sqrt((px-cx)**2 + (pz-cz)**2);
          if (d < bestDist) { bestDist = d; best = {x:cx, z:cz}; }
        }
      }
      if (best) { cam.position.x = best.x; cam.position.z = best.z; }
      return;
    }
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nx = gx + dx, nz = gz + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
      if (gridData.grid[nz][nx] === 0) continue;
      const wallMinX = nx * cs, wallMaxX = nx * cs + cs;
      const wallMinZ = nz * cs, wallMaxZ = nz * cs + cs;
      const closestX = Math.max(wallMinX, Math.min(px, wallMaxX));
      const closestZ = Math.max(wallMinZ, Math.min(pz, wallMaxZ));
      const distX = px - closestX, distZ = pz - closestZ;
      const dist = Math.sqrt(distX * distX + distZ * distZ);
      if (dist < PLAYER_BUFFER && dist > 0.001) {
        cam.position.x += (distX / dist) * (PLAYER_BUFFER - dist);
        cam.position.z += (distZ / dist) * (PLAYER_BUFFER - dist);
        px = cam.position.x; pz = cam.position.z;
      } else if (dist < 0.001) {
        cam.position.x = gx * cs + cs / 2;
        cam.position.z = gz * cs + cs / 2;
        px = cam.position.x; pz = cam.position.z;
      }
    }
  }
}

// ─── UI setup ───

function setupUI() {
  // Hotbar tool slots
  const slots = document.querySelectorAll('.hotbar-slot');
  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      slots.forEach(s => s.classList.remove('active'));
      slot.classList.add('active');
      setTool(slot.dataset.tool);
      document.getElementById('current-tool-info').textContent = slot.querySelector('.slot-name').textContent;
    });
  });

  // Keydown
  document.addEventListener('keydown', (e) => {
    // Tool hotkeys
    if (['1', '2', '3'].includes(e.key) && !e.ctrlKey) {
      const idx = parseInt(e.key) - 1;
      if (slots[idx]) slots[idx].click();
    }

    // Undo / Redo / Save
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }

    // Edit menu (E key while pointer-locked)
    if (e.key === 'e' || e.key === 'E') {
      if (document.pointerLockElement) openEditMenu();
    }

    // Edit menu keyboard shortcuts (when menu is open)
    const menuOpen = !document.getElementById('edit-action-menu').classList.contains('hidden');
    if (menuOpen) {
      if (e.key === 'm' || e.key === 'M') { closeEditMenu(); startMovingArtifact(); }
      if (e.key === 'a' || e.key === 'A') openAdjustPanel(_editMenuArtifact);
      if (e.key === 'x' || e.key === 'X') {
        const a = _editMenuArtifact;
        closeEditMenu();
        if (a) {
          if (a.type === 'artwork') stashArtworkById(a.data.id);
          else stashLightById(a.data.id);
        }
      }
      if (e.key === 'Escape') closeEditMenu();
      return;
    }

    if (e.key === 'Escape') {
      closeAdjustPanel();
      document.exitPointerLock();
    }
  });

  // Scroll wheel — stash navigation (while pointer-locked)
  renderer.domElement.addEventListener('wheel', (e) => {
    if (!document.pointerLockElement) return;
    // Only in select tool
    const activeSlot = document.querySelector('.hotbar-slot.active');
    if (!activeSlot || activeSlot.dataset.tool !== 'select') return;

    const delta = e.deltaY > 0 ? 1 : -1;
    const newIdx = navigateStash(delta);
    renderStashWheel(getStashItems(), getStashIndex());
  }, { passive: true });

  // Edit action menu buttons
  document.getElementById('eam-move').addEventListener('click', () => {
    closeEditMenu();
    startMovingArtifact();
    // Re-lock after short delay
    setTimeout(() => renderer.domElement.requestPointerLock(), 100);
  });

  document.getElementById('eam-adjust').addEventListener('click', () => {
    openAdjustPanel(_editMenuArtifact);
  });

  document.getElementById('eam-stash').addEventListener('click', () => {
    const a = _editMenuArtifact;
    closeEditMenu();
    if (a) {
      if (a.type === 'artwork') stashArtworkById(a.data.id);
      else stashLightById(a.data.id);
    }
  });

  document.getElementById('eam-cancel').addEventListener('click', () => {
    closeEditMenu();
    renderer.domElement.requestPointerLock();
  });

  // Light adjust sliders
  document.getElementById('adj-intensity').addEventListener('input', (e) => {
    document.getElementById('adj-intensity-val').textContent = parseFloat(e.target.value).toFixed(1);
    if (_adjustLightId) updateLightProperty(_adjustLightId, 'intensity', e.target.value);
  });

  document.getElementById('adj-angle').addEventListener('input', (e) => {
    document.getElementById('adj-angle-val').textContent = e.target.value + '°';
    if (_adjustLightId) updateLightProperty(_adjustLightId, 'angle', e.target.value);
  });

  document.getElementById('adj-rotation').addEventListener('input', (e) => {
    document.getElementById('adj-rotation-val').textContent = e.target.value + '°';
    if (_adjustLightId) updateLightProperty(_adjustLightId, 'rotation', e.target.value);
  });

  document.getElementById('adj-color').addEventListener('input', (e) => {
    if (_adjustLightId) updateLightProperty(_adjustLightId, 'color', e.target.value);
  });

  document.getElementById('adj-done').addEventListener('click', () => {
    closeAdjustPanel();
    renderer.domElement.requestPointerLock();
  });

  // Save / Undo / Redo buttons
  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('undo-btn').addEventListener('click', () => undo());
  document.getElementById('redo-btn').addEventListener('click', () => redo());

  // Upload modal
  const modal = document.getElementById('upload-modal');
  document.getElementById('add-new-artwork-btn').addEventListener('click', () => {
    document.exitPointerLock();
    modal.classList.remove('hidden');
  });
  document.getElementById('cancel-upload-btn').addEventListener('click', () => modal.classList.add('hidden'));

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
      body: JSON.stringify({ tempFile: uploadData.tempFile, title: titleInput.value, room: '', wall: '', position: 0.5 })
    });
    if (saveRes.ok) {
      const newArt = await saveRes.json();
      getArtworksData().push(newArt);
      modal.classList.add('hidden');
      fileInput.value = '';
      titleInput.value = '';
      refreshStashWheel();
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
