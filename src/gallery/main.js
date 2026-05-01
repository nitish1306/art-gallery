import * as THREE from 'three';
import { buildRooms } from './roomBuilder.js';
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
  const res = await fetch('/api/gallery/settings');
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
  camera.position.set(6, 1.6, 5);
  camera.lookAt(6, 1.6, 0);

  // Detect device quality tier
  const quality = detectQuality();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyQuality(renderer);
  container.appendChild(renderer.domElement);

  // Build rooms from gallery data
  await buildRooms(scene);

  // Lighting
  initLighting(scene, settings);

  // Load and display artworks
  await loadArtworks(scene, settings);

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

  // Start render loop
  animate();
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
  updateMobileControls(delta);
  updateInteraction();
  renderer.render(scene, camera);
  recordFrame(timestamp);
  updateHUD(timestamp);
}

// Start
init();
