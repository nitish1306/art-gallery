import * as THREE from 'three';
import { buildGrid, clearGrid, getWallCellMeshes, getGridData, recalcBoundary } from './gridRenderer.js';
import { getArtworkMeshes, clearArtworkMeshes } from '../../gallery/artworkLoader.js';
import { loadArtworks } from '../../gallery/artworkLoader.js';
import { initLighting } from '../../gallery/lighting.js';
import { setMinimapGrid, setMinimapArtworks } from './minimap.js';

let camera, scene, renderer, settings;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

// ─── State ───
let currentTool = 'select'; // 'select', 'dig', 'add-wall'
let selectedStashItem = null;
let draggedGroup = null;
let placementGhost = null;
let isRebuilding = false;

// ─── In-memory data ───
let gridDataLocal = null; // local copy of grid.json data
let artworksData = null;

// ─── Undo / Redo ───
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;
let isDirty = false;

// ─── Callbacks ───
let _onDirtyChange = null;
let _onUndoRedoChange = null;
let _reloadStashFn = null;

export function initEditInteraction(cam, scn, rend, sett, callbacks) {
  camera = cam;
  scene = scn;
  renderer = rend;
  settings = sett;
  _onDirtyChange = callbacks.onDirtyChange;
  _onUndoRedoChange = callbacks.onUndoRedoChange;
  _reloadStashFn = callbacks.reloadStash;

  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (document.pointerLockElement) onRightClick();
  });

  initGhost();
}

// ─── Data loading ───

export async function loadEditData() {
  const [artRes, gridRes] = await Promise.all([
    fetch('/api/admin/artworks'),
    fetch('/api/gallery/grid')
  ]);
  artworksData = await artRes.json();
  gridDataLocal = await gridRes.json();
}

export function getGridDataLocal() { return gridDataLocal; }
export function getArtworksData() { return artworksData; }
export function getStashedArtworks() {
  return (artworksData || []).filter(a => !a.room || !a.wall || a.room === '' || a.wall === '');
}
export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }
export function getIsDirty() { return isDirty; }

// ─── World normal helper ───

function getWorldNormal(hit) {
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
}

// ─── Ghost ───

function initGhost() {
  if (placementGhost) scene.remove(placementGhost);
  const geo = new THREE.PlaneGeometry(0.9, 0.9);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ff88, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  placementGhost = new THREE.Mesh(geo, mat);
  placementGhost.visible = false;
  scene.add(placementGhost);
}

// ─── Tool switching ───

export function setTool(tool) {
  currentTool = tool;
  if (tool !== 'select') selectedStashItem = null;
  draggedGroup = null;
}

export function setSelectedStashItem(art) {
  selectedStashItem = art;
}

// ─── Snapshot ───

function pushSnapshot() {
  undoStack.push({
    artworks: JSON.parse(JSON.stringify(artworksData)),
    grid: gridDataLocal.grid.map(row => [...row])
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  isDirty = true;
  if (_onDirtyChange) _onDirtyChange(true);
  if (_onUndoRedoChange) _onUndoRedoChange();
}

export async function undo() {
  if (undoStack.length === 0) return;
  redoStack.push({
    artworks: JSON.parse(JSON.stringify(artworksData)),
    grid: gridDataLocal.grid.map(row => [...row])
  });
  const prev = undoStack.pop();
  artworksData = prev.artworks;
  gridDataLocal.grid = prev.grid;
  isDirty = undoStack.length > 0;
  if (_onDirtyChange) _onDirtyChange(isDirty);
  if (_onUndoRedoChange) _onUndoRedoChange();
  await rebuildScene();
}

export async function redo() {
  if (redoStack.length === 0) return;
  undoStack.push({
    artworks: JSON.parse(JSON.stringify(artworksData)),
    grid: gridDataLocal.grid.map(row => [...row])
  });
  const next = redoStack.pop();
  artworksData = next.artworks;
  gridDataLocal.grid = next.grid;
  isDirty = true;
  if (_onDirtyChange) _onDirtyChange(true);
  if (_onUndoRedoChange) _onUndoRedoChange();
  await rebuildScene();
}

// ─── Save ───

export async function saveAll() {
  try {
    await fetch('/api/gallery/grid', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gridDataLocal)
    });

    for (const art of artworksData) {
      await fetch(`/api/admin/artworks/${art.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: art.room || '',
          wall: art.wall || '',
          position: art.position || 0,
          worldX: art.worldX,
          worldZ: art.worldZ,
          wallFace: art.wallFace,
          wallY: art.wallY
        })
      });
    }

    isDirty = false;
    undoStack.length = 0;
    redoStack.length = 0;
    if (_onDirtyChange) _onDirtyChange(false);
    if (_onUndoRedoChange) _onUndoRedoChange();
    return true;
  } catch (err) {
    console.error('[EditMode] Save failed:', err);
    return false;
  }
}

// ─── Scene rebuild ───

export async function rebuildScene() {
  if (isRebuilding) return;
  isRebuilding = true;

  try {
    clearArtworkMeshes();

    const tempContainer = new THREE.Group();
    await buildGrid(tempContainer, gridDataLocal, settings);
    initLighting(tempContainer, settings);

    // Load placed artworks
    const galData = gridToGalleryData(gridDataLocal);
    await loadArtworks(tempContainer, settings, artworksData, galData);

    scene.clear();
    while (tempContainer.children.length > 0) {
      scene.add(tempContainer.children[0]);
    }

    initGhost();
    setMinimapGrid(gridDataLocal);
    setMinimapArtworks(artworksData);
    if (_reloadStashFn) _reloadStashFn();
  } finally {
    isRebuilding = false;
  }
}

/**
 * Convert grid data to a minimal gallery.json-compatible format
 * so loadArtworks() can place artworks using room/wall/position.
 * Creates a single "virtual room" that covers the entire grid.
 */
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

// ─── Mouse handlers ───

function onMouseDown(e) {
  if (!document.pointerLockElement) return;
  if (e.button !== 0) return;
  if (isRebuilding) return;

  raycaster.setFromCamera(mouse, camera);

  if (currentTool === 'select') {
    handleSelectToolClick();
  } else if (currentTool === 'dig') {
    handleDigClick();
  } else if (currentTool === 'add-wall') {
    handleAddWallClick();
  }
}

function onRightClick() {
  if (isRebuilding) return;

  if (currentTool === 'select') {
    if (draggedGroup) {
      draggedGroup = null;
      rebuildScene();
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const artHits = raycaster.intersectObjects(getArtworkMeshes(), false);
    if (artHits.length > 0 && artHits[0].distance < 6) {
      const mesh = artHits[0].object;
      const artData = mesh.userData.artwork;
      stashArtwork(artData, mesh.parent);
    }
  }
}

// ─── Select tool ───

function handleSelectToolClick() {
  if (draggedGroup) {
    dropArtwork();
    return;
  }

  const artHits = raycaster.intersectObjects(getArtworkMeshes(), false);
  if (artHits.length > 0 && artHits[0].distance < 6) {
    draggedGroup = artHits[0].object.parent;
    return;
  }

  if (selectedStashItem) {
    const wallHits = raycaster.intersectObjects(getWallCellMeshes(), false);
    if (wallHits.length > 0 && wallHits[0].distance < 6) {
      placeStashedArtwork(wallHits[0]);
    }
  }
}

// ─── Per-frame update ───

export function updateEditInteraction() {
  if (!document.pointerLockElement) {
    if (placementGhost) placementGhost.visible = false;
    return;
  }

  raycaster.setFromCamera(mouse, camera);

  if (currentTool === 'select') {
    const wallHits = raycaster.intersectObjects(getWallCellMeshes(), false);

    if (draggedGroup) {
      if (wallHits.length > 0 && wallHits[0].distance < 10) {
        const hit = wallHits[0];
        const wn = getWorldNormal(hit);
        draggedGroup.position.copy(hit.point);
        draggedGroup.position.addScaledVector(wn, 0.02);
        draggedGroup.rotation.y = Math.atan2(wn.x, wn.z);
      }
      if (placementGhost) placementGhost.visible = false;
    } else if (selectedStashItem) {
      if (wallHits.length > 0 && wallHits[0].distance < 10) {
        const hit = wallHits[0];
        const wn = getWorldNormal(hit);
        placementGhost.position.copy(hit.point);
        placementGhost.position.addScaledVector(wn, 0.02);
        placementGhost.rotation.y = Math.atan2(wn.x, wn.z);
        placementGhost.visible = true;
      } else {
        placementGhost.visible = false;
      }
    } else {
      if (placementGhost) placementGhost.visible = false;
    }
  } else {
    if (placementGhost) placementGhost.visible = false;
  }
}

// ─── Grid coordinate helpers ───

function worldToGrid(worldPos) {
  if (!gridDataLocal) return null;
  const cs = gridDataLocal.cellSize;
  return {
    x: Math.floor(worldPos.x / cs),
    z: Math.floor(worldPos.z / cs)
  };
}

function isInBounds(gx, gz) {
  return gx >= 0 && gx < gridDataLocal.width && gz >= 0 && gz < gridDataLocal.depth;
}

// ─── Artwork actions ───

function worldToRoomWall(worldPos, worldNormal) {
  // Determine which face of the grid cell we hit
  let face = 'north';
  if (Math.abs(worldNormal.z) > Math.abs(worldNormal.x)) {
    // Normal points +Z (South) or -Z (North)
    face = worldNormal.z > 0 ? 'south' : 'north';
  } else {
    // Normal points +X (East) or -X (West)
    face = worldNormal.x > 0 ? 'east' : 'west';
  }

  // Very small elevation (0.02m) on top of the wall surface
  const px = worldPos.x + worldNormal.x * 0.02;
  const pz = worldPos.z + worldNormal.z * 0.02;

  const cs = gridDataLocal.cellSize;
  const gx = Math.floor(worldPos.x / cs);
  const gz = Math.floor(worldPos.z / cs);

  // Position is just a fallback for the old system
  const position = worldPos.x / (gridDataLocal.width * cs);

  return {
    room: 'grid',
    wall: face,
    position,
    gridX: gx,
    gridZ: gz,
    worldX: px,
    worldZ: pz,
    wallFace: face,
    wallY: worldPos.y
  };
}

function dropArtwork() {
  if (!draggedGroup) return;

  const artMesh = draggedGroup.children.find(c => c.userData && c.userData.artwork);
  if (!artMesh) { draggedGroup = null; return; }
  const artData = artMesh.userData.artwork;

  raycaster.setFromCamera(mouse, camera);
  const wallHits = raycaster.intersectObjects(getWallCellMeshes(), false);

  if (wallHits.length > 0 && wallHits[0].distance < 10) {
    const hit = wallHits[0];
    const wn = getWorldNormal(hit);
    const mapping = worldToRoomWall(hit.point, wn);

    if (mapping) {
      pushSnapshot();
      const idx = artworksData.findIndex(a => a.id === artData.id);
      if (idx !== -1) {
        artworksData[idx].room = mapping.room;
        artworksData[idx].wall = mapping.wall;
        artworksData[idx].position = mapping.position;
        artworksData[idx].worldX = mapping.worldX;
        artworksData[idx].worldZ = mapping.worldZ;
        artworksData[idx].wallFace = mapping.wallFace;
        artworksData[idx].wallY = mapping.wallY;
      }
    }
  }

  draggedGroup = null;
}

async function placeStashedArtwork(hit) {
  if (!selectedStashItem) return;

  const wn = getWorldNormal(hit);
  const mapping = worldToRoomWall(hit.point, wn);
  if (!mapping) return;

  pushSnapshot();

  const idx = artworksData.findIndex(a => a.id === selectedStashItem.id);
  if (idx !== -1) {
    artworksData[idx].room = mapping.room;
    artworksData[idx].wall = mapping.wall;
    artworksData[idx].position = mapping.position;
    artworksData[idx].worldX = mapping.worldX;
    artworksData[idx].worldZ = mapping.worldZ;
    artworksData[idx].wallFace = mapping.wallFace;
    artworksData[idx].wallY = mapping.wallY;
  }

  selectedStashItem = null;
  document.querySelectorAll('.stash-item').forEach(el => el.classList.remove('selected'));
  placementGhost.visible = false;

  await rebuildScene();
}

function stashArtwork(artData, group) {
  pushSnapshot();

  const idx = artworksData.findIndex(a => a.id === artData.id);
  if (idx !== -1) {
    artworksData[idx].room = '';
    artworksData[idx].wall = '';
    artworksData[idx].position = 0;
  }

  scene.remove(group);
  if (_reloadStashFn) _reloadStashFn();
}

// ─── Dig tool ───
// Click a wall block → set to 0 (air). If it was boundary (2), wrap new boundary.

async function handleDigClick() {
  const wallHits = raycaster.intersectObjects(getWallCellMeshes(), false);
  if (wallHits.length === 0 || wallHits[0].distance > 6) return;

  const hit = wallHits[0];
  const gx = hit.object.userData.gridX;
  const gz = hit.object.userData.gridZ;

  if (!isInBounds(gx, gz)) return;

  const grid = gridDataLocal.grid;
  const cellType = grid[gz][gx];

  pushSnapshot();

  // Set to air
  grid[gz][gx] = 0;

  // Recalculate boundary (8-directional wrapping)
  recalcBoundary(grid, gridDataLocal.width, gridDataLocal.depth);

  await rebuildScene();
}

// ─── Add Wall tool ───
// Click in air space → place a wall block (1).
// We raycast the floor plane to find which grid cell to fill.

async function handleAddWallClick() {
  // Raycast against floor (y=0 plane) and wall meshes
  const wallHits = raycaster.intersectObjects(getWallCellMeshes(), false);

  // If we hit a wall, place the wall block in the adjacent air cell (on the face we clicked)
  if (wallHits.length > 0 && wallHits[0].distance < 6) {
    const hit = wallHits[0];
    const wn = getWorldNormal(hit);
    const gx = hit.object.userData.gridX;
    const gz = hit.object.userData.gridZ;

    // Calculate adjacent air cell based on normal direction
    let targetX = gx, targetZ = gz;
    if (wn.x > 0.5) targetX = gx + 1;
    else if (wn.x < -0.5) targetX = gx - 1;
    else if (wn.z > 0.5) targetZ = gz + 1;
    else if (wn.z < -0.5) targetZ = gz - 1;

    // Wait, we want to ADD a wall, not dig. The adjacent cell should be air.
    // Actually, clicking in air → we need to find the air cell.
    // When clicking a wall face, the normal points INTO the air cell.
    // So the target air cell = wall cell + normal direction.
    // But that's opposite — the normal points away from the surface.
    // Let me reconsider: if we click the inner face of a wall block,
    // the normal points toward the air. So target = wall + normal = air cell.
    // We want to place a wall THERE. That makes sense!

    if (isInBounds(targetX, targetZ) && gridDataLocal.grid[targetZ][targetX] === 0) {
      // Don't allow placing wall on player position
      const playerGrid = worldToGrid(camera.position);
      if (playerGrid && targetX === playerGrid.x && targetZ === playerGrid.z) return;

      pushSnapshot();
      gridDataLocal.grid[targetZ][targetX] = 1;
      recalcBoundary(gridDataLocal.grid, gridDataLocal.width, gridDataLocal.depth);
      await rebuildScene();
    }
    return;
  }

  // Fallback: raycast the floor plane
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersect = new THREE.Vector3();
  raycaster.ray.intersectPlane(floorPlane, intersect);

  if (intersect) {
    const gc = worldToGrid(intersect);
    if (gc && isInBounds(gc.x, gc.z) && gridDataLocal.grid[gc.z][gc.x] === 0) {
      const playerGrid = worldToGrid(camera.position);
      if (playerGrid && gc.x === playerGrid.x && gc.z === playerGrid.z) return;

      pushSnapshot();
      gridDataLocal.grid[gc.z][gc.x] = 1;
      recalcBoundary(gridDataLocal.grid, gridDataLocal.width, gridDataLocal.depth);
      await rebuildScene();
    }
  }
}
