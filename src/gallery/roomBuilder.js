import * as THREE from 'three';

// Archway dimensions
const ARCHWAY_WIDTH = 3;
const ARCHWAY_HEIGHT = 3;
const WALL_THICKNESS = 0.2;

// Store collision boundaries for later use
export const collisionWalls = [];

/**
 * Build all rooms from gallery data and add them to the scene.
 */
export async function buildRooms(scene) {
  const res = await fetch('/api/gallery/rooms');
  const data = await res.json();
  const rooms = data.rooms;

  // Fetch settings for textures
  const settingsRes = await fetch('/api/gallery/settings');
  const settings = await settingsRes.json();
  const theme = settings.theme || {};

  // Build a lookup map for quick access
  const roomMap = {};
  for (const room of rooms) {
    roomMap[room.id] = room;
  }

  // Load textures
  const loader = new THREE.TextureLoader();
  const wallTex = await loadTiledTexture(loader, theme.walls || 'white-plaster');
  const floorTex = await loadTiledTexture(loader, theme.floor || 'concrete');
  const ceilTex = await loadTiledTexture(loader, theme.ceiling || 'white-plaster');

  const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTex });
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTex });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ map: ceilTex });

  for (const room of rooms) {
    const x = room.position[0];
    const z = room.position[1];
    const w = room.width;
    const d = room.depth;
    const h = room.height;

    // --- Floor ---
    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floor = new THREE.Mesh(floorGeo, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x + w / 2, 0, z + d / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // --- Ceiling ---
    const ceilGeo = new THREE.PlaneGeometry(w, d);
    const ceiling = new THREE.Mesh(ceilGeo, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(x + w / 2, h, z + d / 2);
    scene.add(ceiling);

    // --- Walls ---
    const connections = room.connections || [];
    const archways = findArchways(room, connections, roomMap);

    buildWall(scene, wallMaterial, x, z, w, h, 'north', archways.north);
    buildWall(scene, wallMaterial, x, z + d, w, h, 'south', archways.south);
    buildWall(scene, wallMaterial, x, z, d, h, 'west', archways.west);
    buildWall(scene, wallMaterial, x + w, z, d, h, 'east', archways.east);

    // --- Partition walls ---
    if (room.partitions) {
      for (const part of room.partitions) {
        buildPartition(scene, wallMaterial, room, part);
      }
    }
  }

  return { collisionWalls };
}

function findArchways(room, connections, roomMap) {
  const archways = { north: false, south: false, east: false, west: false };
  const x = room.position[0];
  const z = room.position[1];
  const w = room.width;
  const d = room.depth;

  for (const connId of connections) {
    const other = roomMap[connId];
    if (!other) continue;
    const ox = other.position[0];
    const oz = other.position[1];
    const ow = other.width;
    const od = other.depth;

    if (ox === x + w) archways.east = true;
    if (ox + ow === x) archways.west = true;
    if (oz === z + d) archways.south = true;
    if (oz + od === z) archways.north = true;
  }

  return archways;
}

// ─── Wall building (BoxGeometry with thickness) ───

function buildWall(scene, material, wallX, wallZ, wallLength, wallHeight, side, hasArchway) {
  if (!hasArchway) {
    const mesh = createWallBox(wallLength, wallHeight, WALL_THICKNESS, material);
    positionWall(mesh, wallX, wallZ, wallLength, wallHeight, side);
    scene.add(mesh);
    addCollision(wallX, wallZ, wallLength, wallHeight, side);
  } else {
    const archW = ARCHWAY_WIDTH;
    const archH = ARCHWAY_HEIGHT;
    const sideWidth = (wallLength - archW) / 2;

    if (sideWidth > 0) {
      const left = createWallBox(sideWidth, wallHeight, WALL_THICKNESS, material);
      positionWallSegment(left, wallX, wallZ, wallLength, wallHeight, side, 'left', sideWidth, archW);
      scene.add(left);
      addCollisionSegment(wallX, wallZ, wallLength, wallHeight, side, 'left', sideWidth, archW);

      const right = createWallBox(sideWidth, wallHeight, WALL_THICKNESS, material);
      positionWallSegment(right, wallX, wallZ, wallLength, wallHeight, side, 'right', sideWidth, archW);
      scene.add(right);
      addCollisionSegment(wallX, wallZ, wallLength, wallHeight, side, 'right', sideWidth, archW);
    }

    const topH = wallHeight - archH;
    if (topH > 0) {
      const top = createWallBox(archW, topH, WALL_THICKNESS, material);
      positionWallSegment(top, wallX, wallZ, wallLength, wallHeight, side, 'top', sideWidth, archW, archH, topH);
      scene.add(top);
    }
  }
}

function createWallBox(w, h, thickness, material) {
  const geo = new THREE.BoxGeometry(w, h, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function positionWall(mesh, wallX, wallZ, wallLength, wallHeight, side) {
  const t = WALL_THICKNESS / 2;
  switch (side) {
    case 'north':
      mesh.position.set(wallX + wallLength / 2, wallHeight / 2, wallZ - t);
      break;
    case 'south':
      mesh.position.set(wallX + wallLength / 2, wallHeight / 2, wallZ + t);
      break;
    case 'west':
      mesh.position.set(wallX - t, wallHeight / 2, wallZ + wallLength / 2);
      mesh.rotation.y = Math.PI / 2;
      break;
    case 'east':
      mesh.position.set(wallX + t, wallHeight / 2, wallZ + wallLength / 2);
      mesh.rotation.y = Math.PI / 2;
      break;
  }
}

function positionWallSegment(mesh, wallX, wallZ, wallLength, wallHeight, side, segment, sideWidth, archW, archH, topH) {
  const t = WALL_THICKNESS / 2;
  const center = wallLength / 2;

  switch (side) {
    case 'north':
    case 'south': {
      const zPos = side === 'north' ? wallZ - t : wallZ + t;
      if (segment === 'left') {
        mesh.position.set(wallX + sideWidth / 2, wallHeight / 2, zPos);
      } else if (segment === 'right') {
        mesh.position.set(wallX + wallLength - sideWidth / 2, wallHeight / 2, zPos);
      } else if (segment === 'top') {
        mesh.position.set(wallX + center, archH + topH / 2, zPos);
      }
      break;
    }
    case 'west':
    case 'east': {
      const xPos = side === 'west' ? wallX - t : wallX + t;
      mesh.rotation.y = Math.PI / 2;
      if (segment === 'left') {
        mesh.position.set(xPos, wallHeight / 2, wallZ + sideWidth / 2);
      } else if (segment === 'right') {
        mesh.position.set(xPos, wallHeight / 2, wallZ + wallLength - sideWidth / 2);
      } else if (segment === 'top') {
        mesh.position.set(xPos, archH + topH / 2, wallZ + wallLength / 2);
      }
      break;
    }
  }
}

// ─── Partition walls (internal dividers) ───
// Format: { axis: "x"|"z", offset, wallStart, wallEnd }
//   axis "x" → wall runs along X at z = room.z + offset
//   axis "z" → wall runs along Z at x = room.x + offset
//   wallStart/wallEnd = where the solid wall begins/ends (relative to room origin along that axis)
//   Gaps are implicitly on both sides of the wall segment.

function buildPartition(scene, material, room, partition) {
  const rx = room.position[0];
  const rz = room.position[1];
  const h = room.height;
  const axis = partition.axis || 'x';
  const offset = partition.offset;
  const wallStart = partition.wallStart;
  const wallEnd = partition.wallEnd;
  const wallLen = wallEnd - wallStart;

  if (wallLen <= 0) return;

  const t = WALL_THICKNESS / 2;

  if (axis === 'x') {
    // Wall runs along X axis at z = rz + offset
    const wz = rz + offset;
    const wxStart = rx + wallStart;

    const mesh = createWallBox(wallLen, h, WALL_THICKNESS, material);
    mesh.position.set(wxStart + wallLen / 2, h / 2, wz);
    scene.add(mesh);

    collisionWalls.push({
      box: new THREE.Box3(
        new THREE.Vector3(wxStart, 0, wz - t),
        new THREE.Vector3(wxStart + wallLen, h, wz + t)
      ),
      side: 'partition',
    });
  } else {
    // Wall runs along Z axis at x = rx + offset
    const wx = rx + offset;
    const wzStart = rz + wallStart;

    const mesh = createWallBox(wallLen, h, WALL_THICKNESS, material);
    mesh.position.set(wx, h / 2, wzStart + wallLen / 2);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);

    collisionWalls.push({
      box: new THREE.Box3(
        new THREE.Vector3(wx - t, 0, wzStart),
        new THREE.Vector3(wx + t, h, wzStart + wallLen)
      ),
      side: 'partition',
    });
  }
}

// ─── Collision ───

function addCollision(wallX, wallZ, wallLength, wallHeight, side) {
  const t = WALL_THICKNESS / 2;
  let box;

  switch (side) {
    case 'north':
    case 'south':
      box = new THREE.Box3(
        new THREE.Vector3(wallX, 0, wallZ - t),
        new THREE.Vector3(wallX + wallLength, wallHeight, wallZ + t)
      );
      break;
    case 'west':
    case 'east':
      box = new THREE.Box3(
        new THREE.Vector3(wallX - t, 0, wallZ),
        new THREE.Vector3(wallX + t, wallHeight, wallZ + wallLength)
      );
      break;
  }

  collisionWalls.push({ box, side });
}

function addCollisionSegment(wallX, wallZ, wallLength, wallHeight, side, segment, sideWidth, archW) {
  const t = WALL_THICKNESS / 2;
  let box;

  switch (side) {
    case 'north':
    case 'south': {
      if (segment === 'left') {
        box = new THREE.Box3(
          new THREE.Vector3(wallX, 0, wallZ - t),
          new THREE.Vector3(wallX + sideWidth, wallHeight, wallZ + t)
        );
      } else if (segment === 'right') {
        box = new THREE.Box3(
          new THREE.Vector3(wallX + wallLength - sideWidth, 0, wallZ - t),
          new THREE.Vector3(wallX + wallLength, wallHeight, wallZ + t)
        );
      }
      break;
    }
    case 'west':
    case 'east': {
      if (segment === 'left') {
        box = new THREE.Box3(
          new THREE.Vector3(wallX - t, 0, wallZ),
          new THREE.Vector3(wallX + t, wallHeight, wallZ + sideWidth)
        );
      } else if (segment === 'right') {
        box = new THREE.Box3(
          new THREE.Vector3(wallX - t, 0, wallZ + wallLength - sideWidth),
          new THREE.Vector3(wallX + t, wallHeight, wallZ + wallLength)
        );
      }
      break;
    }
  }

  if (box) {
    collisionWalls.push({ box, side });
  }
}

// ─── Texture loading ───

function loadTiledTexture(loader, name) {
  return new Promise((resolve) => {
    const url = `/assets/textures/${name}.jpg`;
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 3);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 16;
      resolve(texture);
    }, undefined, () => {
      console.warn(`[Texture] Failed to load: ${url}`);
      resolve(null);
    });
  });
}
