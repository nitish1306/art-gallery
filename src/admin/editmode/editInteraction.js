import * as THREE from 'three';
import { buildGrid, clearGrid, getWallCellMeshes, getCeilingMeshes, getGridData, recalcBoundary } from './gridRenderer.js';
import { getArtworkMeshes, clearArtworkMeshes } from '../../gallery/artworkLoader.js';
import { loadArtworks } from '../../gallery/artworkLoader.js';
import { initLighting, getLightMeshes, getLightMap, buildGridLights } from '../../gallery/lighting.js';
import { setMinimapGrid, setMinimapArtworks } from './minimap.js';

let camera, scene, renderer, settings;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

// ─── State ───
let currentTool = 'select';
let selectedStashItem = null;
let draggedGroup = null;
let placementGhost = null;
let isRebuilding = false;

// ─── Ghost light (live preview) ───
let ghostLight = null;
let ghostFixtureMesh = null;

// ─── Stash navigation ───
let stashItems = [];
let stashIndex = 0;

// ─── Hovered artifact (for context menu) ───
let hoveredArtifact = null;

// ─── In-memory data ───
let gridDataLocal = null;
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
let _onHoverChange = null;

export function initEditInteraction(cam, scn, rend, sett, callbacks) {
  camera = cam;
  scene = scn;
  renderer = rend;
  settings = sett;
  _onDirtyChange = callbacks.onDirtyChange;
  _onUndoRedoChange = callbacks.onUndoRedoChange;
  _reloadStashFn = callbacks.reloadStash;
  _onHoverChange = callbacks.onHoverChange || null;

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

// ─── Ghost system ───

function initGhost() {
  clearGhostLight();
  if (placementGhost) scene.remove(placementGhost);
  const geo = new THREE.PlaneGeometry(0.9, 0.9);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ff88, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  placementGhost = new THREE.Mesh(geo, mat);
  placementGhost.visible = false;
  scene.add(placementGhost);
}

function clearGhostLight() {
  if (ghostFixtureMesh) { scene.remove(ghostFixtureMesh); ghostFixtureMesh = null; }
  if (ghostLight) { scene.remove(ghostLight.target); scene.remove(ghostLight); ghostLight = null; }
}

function updateGhostForItem(item) {
  clearGhostLight();
  if (!item || !item.isLight) return;
  const isHead = item.type === 'headlight';
  ghostLight = new THREE.SpotLight(
    0xffeedd,
    isHead ? 2.0 : 1.5,
    15,
    isHead ? Math.PI / 4 : 0.4,
    0.5, 1.5
  );
  ghostLight.visible = false;
  scene.add(ghostLight);
  scene.add(ghostLight.target);
  const geo = new THREE.SphereGeometry(0.07, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.75 });
  ghostFixtureMesh = new THREE.Mesh(geo, mat);
  ghostFixtureMesh.visible = false;
  scene.add(ghostFixtureMesh);
  if (placementGhost) placementGhost.visible = false;
}

// ─── Tool switching ───

export function setTool(tool) {
  currentTool = tool;
  if (tool !== 'select') { selectedStashItem = null; clearGhostLight(); }
  draggedGroup = null;
}

export function setSelectedStashItem(art) {
  selectedStashItem = art;
  updateGhostForItem(art);
}

// ─── Stash navigation ───

export function buildStashItems() {
  const lights = [
    { isLight: true, type: 'headlight', id: 'hl_template', label: 'Headlight', icon: '💡' },
    { isLight: true, type: 'spotlight', id: 'sl_template', label: 'Spotlight', icon: '🔦' }
  ];
  const arts = (artworksData || []).filter(a => !a.room || !a.wall || a.room === '' || a.wall === '');
  stashItems = [...lights, ...arts];
  return stashItems;
}

export function getStashItems() { return stashItems; }
export function getStashIndex() { return stashIndex; }
export function getHoveredArtifact() { return hoveredArtifact; }

export function navigateStash(delta) {
  if (stashItems.length === 0) return;
  stashIndex = ((stashIndex + delta) % stashItems.length + stashItems.length) % stashItems.length;
  const item = stashItems[stashIndex];
  selectedStashItem = item.isLight ? { ...item, id: 'new_' + Date.now() } : item;
  updateGhostForItem(selectedStashItem);
  return stashIndex;
}

export function armStashIndex(idx) {
  if (stashItems.length === 0) return;
  stashIndex = Math.max(0, Math.min(idx, stashItems.length - 1));
  const item = stashItems[stashIndex];
  selectedStashItem = item.isLight ? { ...item, id: 'new_' + Date.now() } : item;
  updateGhostForItem(selectedStashItem);
}

// ─── Live light property update ───

export function updateLightProperty(id, prop, value) {
  const entry = getLightMap().get(id);
  const lightData = (gridDataLocal.lights || []).find(l => l.id === id);
  if (!lightData) return;
  if (prop === 'intensity') {
    if (entry) entry.spotLight.intensity = parseFloat(value);
    lightData.intensity = parseFloat(value);
  } else if (prop === 'angle') {
    if (entry) entry.spotLight.angle = parseFloat(value) * Math.PI / 180;
    lightData.angle = parseFloat(value);
  } else if (prop === 'color') {
    if (entry) {
      entry.spotLight.color.setStyle(value);
      entry.fixtureMesh.material.emissive.setStyle(value);
    }
    lightData.color = value;
  }
  isDirty = true;
  if (_onDirtyChange) _onDirtyChange(true);
}

// ─── Context menu actions ───

export function startMovingArtifact() {
  if (!hoveredArtifact) return;
  if (hoveredArtifact.type === 'artwork') draggedGroup = hoveredArtifact.mesh.parent;
  else if (hoveredArtifact.type === 'light') draggedGroup = hoveredArtifact.mesh;
  hoveredArtifact = null;
  if (_onHoverChange) _onHoverChange(null);
}

export function stashArtworkById(id) {
  const idx = artworksData.findIndex(a => a.id === id);
  if (idx === -1) return;
  pushSnapshot();
  artworksData[idx].room = '';
  artworksData[idx].wall = '';
  artworksData[idx].position = 0;
  hoveredArtifact = null;
  if (_onHoverChange) _onHoverChange(null);
  rebuildScene();
}

export function stashLightById(id) {
  const idx = (gridDataLocal.lights || []).findIndex(l => l.id === id);
  if (idx === -1) return;
  pushSnapshot();
  gridDataLocal.lights.splice(idx, 1);
  hoveredArtifact = null;
  if (_onHoverChange) _onHoverChange(null);
  rebuildScene();
}

export function getLightDataById(id) {
  return (gridDataLocal.lights || []).find(l => l.id === id) || null;
}

// ─── Snapshot ───

function pushSnapshot() {
  undoStack.push({
    artworks: JSON.parse(JSON.stringify(artworksData)),
    grid: gridDataLocal.grid.map(row => [...row]),
    lights: JSON.parse(JSON.stringify(gridDataLocal.lights || []))
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
    grid: gridDataLocal.grid.map(row => [...row]),
    lights: JSON.parse(JSON.stringify(gridDataLocal.lights || []))
  });
  const prev = undoStack.pop();
  artworksData = prev.artworks;
  gridDataLocal.grid = prev.grid;
  if (prev.lights !== undefined) gridDataLocal.lights = prev.lights;
  isDirty = undoStack.length > 0;
  if (_onDirtyChange) _onDirtyChange(isDirty);
  if (_onUndoRedoChange) _onUndoRedoChange();
  await rebuildScene();
}

export async function redo() {
  if (redoStack.length === 0) return;
  undoStack.push({
    artworks: JSON.parse(JSON.stringify(artworksData)),
    grid: gridDataLocal.grid.map(row => [...row]),
    lights: JSON.parse(JSON.stringify(gridDataLocal.lights || []))
  });
  const next = redoStack.pop();
  artworksData = next.artworks;
  gridDataLocal.grid = next.grid;
  if (next.lights !== undefined) gridDataLocal.lights = next.lights;
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
    buildGridLights(tempContainer, gridDataLocal);
    const galData = gridToGalleryData(gridDataLocal);
    await loadArtworks(tempContainer, settings, artworksData, galData);
    scene.clear();
    while (tempContainer.children.length > 0) scene.add(tempContainer.children[0]);
    initGhost();
    if (selectedStashItem) updateGhostForItem(selectedStashItem);
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
      return;
    }

    const lightHits = raycaster.intersectObjects(getLightMeshes(), false);
    if (lightHits.length > 0 && lightHits[0].distance < 6) {
      const mesh = lightHits[0].object;
      const lightData = mesh.userData.lightData;
      stashLight(lightData);
    }
  }
}

// ─── Select tool ───

function handleSelectToolClick() {
  if (draggedGroup) { dropArtwork(); return; }

  const artHits = raycaster.intersectObjects(getArtworkMeshes(), false);
  if (artHits.length > 0 && artHits[0].distance < 10) {
    draggedGroup = artHits[0].object.parent;
    return;
  }
  const lightHits = raycaster.intersectObjects(getLightMeshes(), false);
  if (lightHits.length > 0 && lightHits[0].distance < 10) {
    draggedGroup = lightHits[0].object;
    return;
  }
  if (selectedStashItem) {
    const isHeadlight = selectedStashItem.isLight && selectedStashItem.type === 'headlight';
    const targetMeshes = isHeadlight ? getCeilingMeshes() : getWallCellMeshes();
    const targetHits = raycaster.intersectObjects(targetMeshes, false);
    if (targetHits.length > 0 && targetHits[0].distance < 12) placeStashedArtwork(targetHits[0]);
  }
}

// ─── Per-frame update ───

export function updateEditInteraction() {
  if (!document.pointerLockElement) {
    if (placementGhost) placementGhost.visible = false;
    if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
    if (ghostLight) ghostLight.visible = false;
    if (hoveredArtifact) { hoveredArtifact = null; if (_onHoverChange) _onHoverChange(null); }
    return;
  }

  raycaster.setFromCamera(mouse, camera);

  if (currentTool === 'select') {
    const dragIsHead = draggedGroup && draggedGroup.userData.isLight && draggedGroup.userData.type === 'headlight';
    const armIsHead = selectedStashItem && selectedStashItem.isLight && selectedStashItem.type === 'headlight';
    const usesCeiling = dragIsHead || armIsHead;
    const targets = usesCeiling ? getCeilingMeshes() : getWallCellMeshes();
    const hits = raycaster.intersectObjects(targets, false);

    if (draggedGroup) {
      // Move dragged object
      if (hits.length > 0 && hits[0].distance < 12) {
        const wn = getWorldNormal(hits[0]);
        draggedGroup.position.copy(hits[0].point).addScaledVector(wn, 0.05);
        if (!dragIsHead) draggedGroup.rotation.y = Math.atan2(wn.x, wn.z);
      }
      if (placementGhost) placementGhost.visible = false;
      if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
      if (ghostLight) ghostLight.visible = false;

    } else if (selectedStashItem) {
      // Show ghost at cursor
      if (hits.length > 0 && hits[0].distance < 12) {
        const wn = getWorldNormal(hits[0]);
        const pos = hits[0].point.clone().addScaledVector(wn, 0.05);
        if (selectedStashItem.isLight && ghostFixtureMesh && ghostLight) {
          ghostFixtureMesh.position.copy(pos);
          ghostFixtureMesh.visible = true;
          ghostLight.position.copy(pos);
          if (armIsHead) {
            ghostLight.target.position.set(pos.x, 0, pos.z);
          } else {
            const tp = pos.clone();
            if (wn.z > 0.5) tp.z += 2; else if (wn.z < -0.5) tp.z -= 2;
            else if (wn.x > 0.5) tp.x += 2; else if (wn.x < -0.5) tp.x -= 2;
            ghostLight.target.position.copy(tp);
          }
          ghostLight.visible = true;
          if (placementGhost) placementGhost.visible = false;
        } else if (placementGhost) {
          placementGhost.position.copy(pos);
          if (!armIsHead) placementGhost.rotation.y = Math.atan2(wn.x, wn.z);
          placementGhost.visible = true;
          if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
          if (ghostLight) ghostLight.visible = false;
        }
      } else {
        if (placementGhost) placementGhost.visible = false;
        if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
        if (ghostLight) ghostLight.visible = false;
      }
      // No hover detection while item armed
      if (hoveredArtifact) { hoveredArtifact = null; if (_onHoverChange) _onHoverChange(null); }

    } else {
      // Nothing armed — detect hover for context menu
      if (placementGhost) placementGhost.visible = false;
      if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
      if (ghostLight) ghostLight.visible = false;
      _detectHover();
    }
  } else {
    if (placementGhost) placementGhost.visible = false;
    if (ghostFixtureMesh) ghostFixtureMesh.visible = false;
    if (ghostLight) ghostLight.visible = false;
    if (hoveredArtifact) { hoveredArtifact = null; if (_onHoverChange) _onHoverChange(null); }
  }
}

function _detectHover() {
  const aHits = raycaster.intersectObjects(getArtworkMeshes(), false);
  if (aHits.length > 0 && aHits[0].distance < 5) {
    const art = aHits[0].object.userData.artwork;
    if (!hoveredArtifact || hoveredArtifact.data !== art) {
      hoveredArtifact = { type: 'artwork', data: art, mesh: aHits[0].object };
      if (_onHoverChange) _onHoverChange(hoveredArtifact);
    }
    return;
  }
  const lHits = raycaster.intersectObjects(getLightMeshes(), false);
  if (lHits.length > 0 && lHits[0].distance < 5) {
    const ld = lHits[0].object.userData.lightData;
    if (!hoveredArtifact || hoveredArtifact.data !== ld) {
      hoveredArtifact = { type: 'light', data: ld, mesh: lHits[0].object };
      if (_onHoverChange) _onHoverChange(hoveredArtifact);
    }
    return;
  }
  if (hoveredArtifact) { hoveredArtifact = null; if (_onHoverChange) _onHoverChange(null); }
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
  const isLight = draggedGroup.userData.isLight;
  const isHead = isLight && draggedGroup.userData.type === 'headlight';

  raycaster.setFromCamera(mouse, camera);
  const targetMeshes = isHead ? getCeilingMeshes() : getWallCellMeshes();
  const targetHits = raycaster.intersectObjects(targetMeshes, false);

  if (targetHits.length > 0 && targetHits[0].distance < 12) {
    const wn = getWorldNormal(targetHits[0]);
    const mapping = worldToRoomWall(targetHits[0].point, wn);
    if (mapping) {
      pushSnapshot();
      if (isLight) {
        const ld = draggedGroup.userData.lightData;
        const idx = (gridDataLocal.lights || []).findIndex(l => l.id === ld.id);
        if (idx !== -1) {
          gridDataLocal.lights[idx].worldX = targetHits[0].point.x;
          gridDataLocal.lights[idx].worldY = isHead ? gridDataLocal.wallHeight : mapping.wallY;
          gridDataLocal.lights[idx].worldZ = targetHits[0].point.z;
          if (!isHead) gridDataLocal.lights[idx].wallFace = mapping.wallFace;
        }
      } else {
        const artMesh = draggedGroup.children.find(c => c.userData && c.userData.artwork);
        if (artMesh) {
          const artData = artMesh.userData.artwork;
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
      rebuildScene();
    }
  }
  draggedGroup = null;
}

async function placeStashedArtwork(hit) {
  if (!selectedStashItem) return;
  const isHead = selectedStashItem.isLight && selectedStashItem.type === 'headlight';
  const wn = getWorldNormal(hit);
  const mapping = worldToRoomWall(hit.point, wn);
  if (!mapping) return;

  pushSnapshot();

  if (selectedStashItem.isLight) {
    gridDataLocal.lights = gridDataLocal.lights || [];
    gridDataLocal.lights.push({
      id: 'light_' + Date.now(),
      type: selectedStashItem.type,
      worldX: hit.point.x,
      worldY: isHead ? gridDataLocal.wallHeight : mapping.wallY,
      worldZ: hit.point.z,
      wallFace: isHead ? null : mapping.wallFace,
      intensity: isHead ? 2.0 : 1.5,
      angle: isHead ? 45 : 23,
      color: '#ffeedd'
    });
    // Re-arm with new ID so user can keep placing
    selectedStashItem = { ...selectedStashItem, id: 'new_' + Date.now() };
  } else {
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
    if (placementGhost) placementGhost.visible = false;
  }

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

function stashLight(lightData) {
  pushSnapshot();
  const idx = gridDataLocal.lights.findIndex(l => l.id === lightData.id);
  if (idx !== -1) {
    gridDataLocal.lights.splice(idx, 1);
  }
  rebuildScene(); // Full rebuild to clean up lights correctly
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
