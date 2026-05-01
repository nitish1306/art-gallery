import * as THREE from 'three';
import { getArtworkMeshes } from './artworkLoader.js';
import { isMobileDevice } from './mobileControls.js';

let camera = null;
let renderer = null;
let controlsPaused = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;

export function initInteraction(cam, rend) {
  camera = cam;
  renderer = rend;

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('touchend', onTouch);

  // Close button
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-overlay')) closeDetail();
  });
}

function onClick(e) {
  if (controlsPaused) return;
  if (!document.pointerLockElement) return;

  // In pointer lock, cursor is at center
  mouse.set(0, 0);
  raycaster.setFromCamera(mouse, camera);

  const meshes = getArtworkMeshes();
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    showDetail(hits[0].object.userData.artwork);
  }
}

function onTouch(e) {
  if (controlsPaused) return;
  const touch = e.changedTouches[0];
  if (!touch) return;

  mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const meshes = getArtworkMeshes();
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    showDetail(hits[0].object.userData.artwork);
  }
}

function showDetail(artwork) {
  if (!artwork) return;
  controlsPaused = true;
  document.exitPointerLock();

  const overlay = document.getElementById('detail-overlay');
  document.getElementById('detail-title').textContent = artwork.title || 'Untitled';
  document.getElementById('detail-meta').textContent =
    `${artwork.date || ''} — ${artwork.medium || ''}`;
  document.getElementById('detail-description').textContent =
    artwork.description || '';
  document.getElementById('detail-image').src = '/' + artwork.image;

  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
}

function closeDetail() {
  const overlay = document.getElementById('detail-overlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
  controlsPaused = false;
}

/**
 * Call every frame — hover highlight and interaction prompt (desktop only).
 */
export function updateInteraction() {
  if (controlsPaused || !camera || isMobileDevice()) return;
  if (!document.pointerLockElement) {
    clearHover();
    return;
  }

  mouse.set(0, 0);
  raycaster.setFromCamera(mouse, camera);

  const meshes = getArtworkMeshes();
  const hits = raycaster.intersectObjects(meshes, false);
  const prompt = document.getElementById('interaction-prompt');

  if (hits.length > 0 && hits[0].distance < 5) {
    const mesh = hits[0].object;
    if (hoveredMesh !== mesh) {
      clearHover();
      hoveredMesh = mesh;
      if (hoveredMesh.material.emissive) {
        hoveredMesh.material.emissive.setHex(0x1a1a1a);
      }
    }
    if (prompt) prompt.classList.add('visible');
  } else {
    clearHover();
    if (prompt) prompt.classList.remove('visible');
  }
}

function clearHover() {
  if (hoveredMesh && hoveredMesh.material.emissive) {
    hoveredMesh.material.emissive.setHex(0x000000);
  }
  hoveredMesh = null;
}

export function isInteractionPaused() {
  return controlsPaused;
}
