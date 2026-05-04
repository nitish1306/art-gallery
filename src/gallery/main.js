import * as THREE from 'three';
import { buildGrid, getGridCollisionBoxes } from '../admin/editmode/gridRenderer.js';
import { initControls, updateControls } from './controls.js';
import { isMobileDevice, initMobileControls, updateMobileControls } from './mobileControls.js';
import { detectQuality, applyQuality, recordFrame } from './quality.js';
import { initHUD, updateHUD } from './hud.js';
import { initLighting } from './lighting.js';
import { loadArtworks } from './artworkLoader.js';
import { initInteraction, updateInteraction } from './interaction.js';
import { initAudio } from './audio.js';

let scene, camera, renderer;
let clock;
let settings = null;

async function init() {
  // Fetch settings
  const res = await fetch('/api/gallery/settings?t=' + Date.now());
  settings = await res.json();

  // Show gallery name on entry screen
  document.getElementById('gallery-name').textContent = settings.galleryName;

  // Wait for user to press Enter or tap
  waitForEntry();
}

function waitForEntry() {
  const overlay = document.getElementById('entry-overlay');

  function enter() {
    // Remove listeners
    document.removeEventListener('keydown', onKey);
    overlay.removeEventListener('click', onTap);
    overlay.removeEventListener('touchstart', onTap);

    // Show loading indicator
    const loadingEl = document.getElementById('loading-overlay');
    loadingEl.style.display = 'flex';

    // Fade out overlay
    overlay.classList.add('fade-out');

    // Initialize and show 3D scene
    initScene().then(() => {
      const container = document.getElementById('canvas-container');
      container.classList.add('visible');

      // Hide loading
      loadingEl.style.opacity = '0';
      setTimeout(() => loadingEl.style.display = 'none', 400);
    });

    // Remove overlay from DOM after transition
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 600);
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      enter();
    }
  }

  function onTap() {
    enter();
  }

  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', onTap);
  overlay.addEventListener('touchstart', onTap);
}

async function initScene() {
  const container = document.getElementById('canvas-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Spawn position set after grid loads (below)

  // Detect device quality tier
  const quality = detectQuality();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality(renderer);
  container.appendChild(renderer.domElement);

  // Load grid data and build scene
  const gridRes = await fetch('/api/gallery/grid?t=' + Date.now());
  const gridData = await gridRes.json();
  await buildGrid(scene, gridData, settings);

  // Set spawn position from grid data
  const spawn = gridData.spawn || [50, 45];
  const cs = gridData.cellSize || 1;
  camera.position.set(spawn[0] * cs + cs / 2, 1.6, spawn[1] * cs + cs / 2);

  // Lighting
  initLighting(scene, settings);

  // Load artworks
  const galData = {
    rooms: [{
      id: 'grid', name: '', width: gridData.width * cs,
      depth: gridData.depth * cs, height: gridData.wallHeight,
      position: [0, 0], connections: []
    }]
  };
  await loadArtworks(scene, settings, undefined, galData);

  // Initialize controls
  initControls(camera, renderer.domElement);
  if (isMobileDevice()) {
    document.body.classList.add('mobile-active');
    initMobileControls(camera, renderer);
  }
  initInteraction(camera, renderer);
  await initHUD(camera);
  clock = new THREE.Clock();

  // Start audio
  initAudio(settings);

  // Handle resize
  window.addEventListener('resize', onResize);

  // Store grid data for collision
  galleryGridData = gridData;

  // Start render loop
  animate();
}

let galleryGridData = null;
const PLAYER_BUFFER = 0.35;

function applyGridCollision(cam) {
  if (!galleryGridData) return;
  const cs = galleryGridData.cellSize;
  let px = cam.position.x;
  let pz = cam.position.z;
  const gx = Math.floor(px / cs);
  const gz = Math.floor(pz / cs);

  if (gx >= 0 && gx < galleryGridData.width && gz >= 0 && gz < galleryGridData.depth) {
    if (galleryGridData.grid[gz][gx] !== 0) {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      let best = null, bestDist = Infinity;
      for (const [dx, dz] of dirs) {
        const nx = gx + dx, nz = gz + dz;
        if (nx >= 0 && nx < galleryGridData.width && nz >= 0 && nz < galleryGridData.depth) {
          if (galleryGridData.grid[nz][nx] === 0) {
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

  // Buffer: push player away from adjacent wall cells
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nx = gx + dx, nz = gz + dz;
      if (nx < 0 || nx >= galleryGridData.width || nz < 0 || nz >= galleryGridData.depth) continue;
      if (galleryGridData.grid[nz][nx] === 0) continue;

      const wallMinX = nx * cs, wallMaxX = nx * cs + cs;
      const wallMinZ = nz * cs, wallMaxZ = nz * cs + cs;
      const closestX = Math.max(wallMinX, Math.min(px, wallMaxX));
      const closestZ = Math.max(wallMinZ, Math.min(pz, wallMaxZ));
      const distX = px - closestX, distZ = pz - closestZ;
      const dist = Math.sqrt(distX * distX + distZ * distZ);

      if (dist < PLAYER_BUFFER && dist > 0.001) {
        cam.position.x += (distX / dist) * (PLAYER_BUFFER - dist);
        cam.position.z += (distZ / dist) * (PLAYER_BUFFER - dist);
        px = cam.position.x;
        pz = cam.position.z;
      } else if (dist < 0.001) {
        cam.position.x = gx * cs + cs / 2;
        cam.position.z = gz * cs + cs / 2;
        px = cam.position.x;
        pz = cam.position.z;
      }
    }
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateControls(delta);
  applyGridCollision(camera);
  updateMobileControls(delta);
  updateInteraction();
  renderer.render(scene, camera);
  recordFrame(timestamp);
  updateHUD(timestamp);
}

// Start
init();
