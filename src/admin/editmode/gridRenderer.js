import * as THREE from 'three';

/**
 * Grid Renderer — builds 3D meshes from a 2D grid.
 *
 * Cell types: 0=air, 1=wall, 2=boundary, 3=void (invisible)
 * Only wall/boundary faces adjacent to air are rendered.
 * Floor + ceiling rendered for all air cells.
 * Void (3) is never rendered or shown on minimap.
 */

let wallMeshGroup = null;
let floorMeshGroup = null;
let gridLinesGroup = null;
let gridData = null;

const wallCellMeshes = [];
const gridCollisionBoxes = [];

export function getGridData() { return gridData; }
export function getWallCellMeshes() { return wallCellMeshes; }
export function getGridCollisionBoxes() { return gridCollisionBoxes; }

/**
 * Build the full 3D grid scene.
 */
export async function buildGrid(parent, data, settings) {
  gridData = data;
  const { width, depth, cellSize, wallHeight, grid } = data;
  const theme = (settings && settings.theme) || {};

  // Load textures
  const loader = new THREE.TextureLoader();
  const wallTex = await loadTex(loader, theme.walls || 'white-plaster');
  const floorTex = await loadTex(loader, theme.floor || 'concrete');
  const ceilTex = await loadTex(loader, theme.ceiling || 'white-plaster');

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex });
  const boundaryMat = new THREE.MeshStandardMaterial({
    map: wallTex ? wallTex.clone() : null,
    color: 0xcccccc
  });

  wallMeshGroup = new THREE.Group();
  wallMeshGroup.name = 'grid-walls';
  floorMeshGroup = new THREE.Group();
  floorMeshGroup.name = 'grid-floors';

  wallCellMeshes.length = 0;
  gridCollisionBoxes.length = 0;

  // Compute bounding box of active area
  const bounds = getActiveBounds(grid, width, depth);
  const minX = Math.max(0, bounds.minX - 1);
  const maxX = Math.min(width - 1, bounds.maxX + 1);
  const minZ = Math.max(0, bounds.minZ - 1);
  const maxZ = Math.min(depth - 1, bounds.maxZ + 1);

  const wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);

  // Texture tiling scale: match original look (~4m per tile repeat)
  const TILE_SIZE = 4.0;

  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = grid[z][x];
      const wx = x * cellSize + cellSize / 2;
      const wz = z * cellSize + cellSize / 2;

      if (cell === 0) {
        // Air cell: floor + ceiling with world-space UVs
        const floorGeo = new THREE.PlaneGeometry(cellSize, cellSize);
        shiftUVs(floorGeo, x, z, cellSize, TILE_SIZE);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(wx, 0, wz);
        floor.receiveShadow = true;
        floorMeshGroup.add(floor);

        const ceilGeo = new THREE.PlaneGeometry(cellSize, cellSize);
        shiftUVs(ceilGeo, x, z, cellSize, TILE_SIZE);
        const ceil = new THREE.Mesh(ceilGeo, ceilMat);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(wx, wallHeight, wz);
        floorMeshGroup.add(ceil);

      } else if (cell === 1 || cell === 2) {
        if (!isAdjacentToAir(grid, x, z, width, depth)) continue;

        const mat = cell === 2 ? boundaryMat : wallMat;
        const mesh = new THREE.Mesh(wallGeo, mat);
        mesh.position.set(wx, wallHeight / 2, wz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.gridX = x;
        mesh.userData.gridZ = z;
        mesh.userData.cellType = cell;
        wallMeshGroup.add(mesh);
        wallCellMeshes.push(mesh);

        const half = cellSize / 2;
        gridCollisionBoxes.push({
          box: new THREE.Box3(
            new THREE.Vector3(wx - half, 0, wz - half),
            new THREE.Vector3(wx + half, wallHeight, wz + half)
          )
        });
      }
    }
  }

  parent.add(wallMeshGroup);
  parent.add(floorMeshGroup);

  // Grid lines
  gridLinesGroup = buildGridLines(bounds, cellSize, width, depth);
  parent.add(gridLinesGroup);
}

/**
 * Shift UV coordinates to world-space so floor textures tile seamlessly
 * across adjacent cells at `tileSize` intervals.
 */
function shiftUVs(geo, gridX, gridZ, cellSize, tileSize) {
  const uvAttr = geo.getAttribute('uv');
  for (let i = 0; i < uvAttr.count; i++) {
    const u = (gridX + uvAttr.getX(i)) * cellSize / tileSize;
    const v = (gridZ + uvAttr.getY(i)) * cellSize / tileSize;
    uvAttr.setXY(i, u, v);
  }
}

export function clearGrid(parent) {
  if (wallMeshGroup) { parent.remove(wallMeshGroup); wallMeshGroup = null; }
  if (floorMeshGroup) { parent.remove(floorMeshGroup); floorMeshGroup = null; }
  if (gridLinesGroup) { parent.remove(gridLinesGroup); gridLinesGroup = null; }
  wallCellMeshes.length = 0;
  gridCollisionBoxes.length = 0;
}

function isAdjacentToAir(grid, x, z, w, d) {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dz] of dirs) {
    const nx = x + dx, nz = z + dz;
    if (nx >= 0 && nx < w && nz >= 0 && nz < d) {
      if (grid[nz][nx] === 0) return true;
    }
  }
  return false;
}

function getActiveBounds(grid, w, d) {
  let minX = w, maxX = 0, minZ = d, maxZ = 0;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      // Include air, wall, AND boundary in bounds (skip void=3)
      if (grid[z][x] >= 0 && grid[z][x] <= 2) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
  }
  return { minX, maxX, minZ, maxZ };
}
export { getActiveBounds };

function buildGridLines(bounds, cellSize, w, d) {
  const group = new THREE.Group();
  group.name = 'grid-lines';

  const minX = Math.max(0, bounds.minX - 1);
  const maxX = Math.min(w, bounds.maxX + 2);
  const minZ = Math.max(0, bounds.minZ - 1);
  const maxZ = Math.min(d, bounds.maxZ + 2);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x444466,
    transparent: true,
    opacity: 0.15
  });

  const points = [];
  for (let x = minX; x <= maxX; x++) {
    points.push(
      new THREE.Vector3(x * cellSize, 0.01, minZ * cellSize),
      new THREE.Vector3(x * cellSize, 0.01, maxZ * cellSize)
    );
  }
  for (let z = minZ; z <= maxZ; z++) {
    points.push(
      new THREE.Vector3(minX * cellSize, 0.01, z * cellSize),
      new THREE.Vector3(maxX * cellSize, 0.01, z * cellSize)
    );
  }

  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);
  return group;
}

export function recalcBoundary(grid, w, d) {
  // First: any cell that WAS boundary (2) but is no longer adjacent to air/wall → becomes void (3)
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      if (grid[z][x] === 2) {
        let nearAirOrWall = false;
        for (let dz = -1; dz <= 1 && !nearAirOrWall; dz++) {
          for (let dx = -1; dx <= 1 && !nearAirOrWall; dx++) {
            if (dz === 0 && dx === 0) continue;
            const nz = z + dz, nx = x + dx;
            if (nz >= 0 && nz < d && nx >= 0 && nx < w) {
              if (grid[nz][nx] === 0 || grid[nz][nx] === 1) nearAirOrWall = true;
            }
          }
        }
        if (!nearAirOrWall) grid[z][x] = 3; // demote to void
      }
    }
  }

  // Second: any void (3) cell adjacent (8-dir) to air/wall → becomes boundary (2)
  const shouldBeBoundary = [];
  for (let z = 0; z < d; z++) {
    shouldBeBoundary[z] = new Array(w).fill(false);
  }

  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      if (grid[z][x] === 0 || grid[z][x] === 1) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dz === 0 && dx === 0) continue;
            const nz = z + dz, nx = x + dx;
            if (nz >= 0 && nz < d && nx >= 0 && nx < w) {
              if (grid[nz][nx] === 3) {
                shouldBeBoundary[nz][nx] = true;
              }
            }
          }
        }
      }
    }
  }

  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      if (shouldBeBoundary[z][x]) {
        grid[z][x] = 2;
      }
    }
  }
}

// ─── Texture loading ───

function loadTex(loader, name) {
  return new Promise((resolve) => {
    const url = `/assets/textures/${name}.jpg`;
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 16;
      resolve(texture);
    }, undefined, () => {
      console.warn(`[GridRenderer] Failed to load texture: ${url}`);
      resolve(null);
    });
  });
}
