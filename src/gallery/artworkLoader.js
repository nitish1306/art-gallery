import * as THREE from 'three';
import { createArtworkSpotlight } from './lighting.js';

const artworkMeshes = [];
let roomsData = null;

/**
 * Load and place all artworks on walls.
 */
export async function loadArtworks(scene, settings) {
  const [artRes, roomRes] = await Promise.all([
    fetch('/api/gallery/artworks'),
    fetch('/api/gallery/rooms'),
  ]);
  const artworks = await artRes.json();
  roomsData = await roomRes.json();

  if (!artworks.length) return;

  const loader = new THREE.TextureLoader();
  const roomMap = {};
  for (const r of roomsData.rooms) {
    roomMap[r.id] = r;
  }

  for (const art of artworks) {
    const room = roomMap[art.room];
    if (!room) continue;

    try {
      await placeArtwork(scene, loader, art, room, settings);
    } catch (e) {
      console.warn(`[Artwork] Failed to load "${art.title}":`, e);
    }
  }
}

async function placeArtwork(scene, loader, art, room, settings) {
  // Load image texture (with placeholder fallback)
  const texture = await new Promise((resolve) => {
    loader.load('/' + art.image, resolve, undefined, () => {
      console.warn(`[Artwork] Image not found: ${art.image}`);
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 216, 216);
      ctx.fillStyle = '#888';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image not found', 128, 120);
      ctx.font = '14px sans-serif';
      ctx.fillText(art.title || '', 128, 150);
      resolve(new THREE.CanvasTexture(c));
    });
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 16;

  // Calculate dimensions preserving aspect ratio
  const img = texture.image;
  const aspect = img.width / img.height;
  const maxW = 1.5;
  const maxH = 1.8;
  let artW, artH;
  if (aspect > 1) {
    artW = maxW;
    artH = maxW / aspect;
  } else {
    artH = maxH;
    artW = maxH * aspect;
  }

  // Artwork mesh
  const artGeo = new THREE.PlaneGeometry(artW, artH);
  const artMat = new THREE.MeshStandardMaterial({ map: texture });
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.userData = { artwork: art };

  // Frame — slightly larger dark border
  const frameW = artW + 0.1;
  const frameH = artH + 0.1;
  const frameGeo = new THREE.PlaneGeometry(frameW, frameH);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);

  // Placard — canvas texture with title/date/medium
  const placardMesh = createPlacard(art);

  // Calculate wall position
  const pos = getWallPosition(room, art.wall, art.position, artH);

  // Position everything
  const group = new THREE.Group();
  frameMesh.position.z = -0.005; // slightly behind artwork
  artMesh.position.z = 0;
  placardMesh.position.set(0, -(artH / 2) - 0.2, 0);
  group.add(frameMesh);
  group.add(artMesh);
  group.add(placardMesh);

  group.position.copy(pos.position);
  group.rotation.y = pos.rotation;

  scene.add(group);
  artworkMeshes.push(artMesh);

  // Add spotlight
  createArtworkSpotlight(scene, pos.position, settings);
}

/**
 * Create a placard mesh with Title, Date, Medium rendered via canvas.
 */
function createPlacard(art) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, 512, 2);

  // Text
  ctx.fillStyle = '#222';
  ctx.font = 'bold 28px Helvetica, Arial, sans-serif';
  ctx.fillText(art.title || 'Untitled', 20, 40);

  ctx.fillStyle = '#555';
  ctx.font = '20px Helvetica, Arial, sans-serif';
  ctx.fillText(`${art.date || ''} — ${art.medium || ''}`, 20, 75);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(0.6, 0.15);
  const mat = new THREE.MeshStandardMaterial({ map: texture });
  return new THREE.Mesh(geo, mat);
}

/**
 * Calculate world position for an artwork on a wall.
 */
function getWallPosition(room, wall, normalizedPos, artHeight) {
  const rx = room.position[0];
  const rz = room.position[1];
  const w = room.width;
  const d = room.depth;
  const eyeH = 1.5;
  const offset = 0.05; // offset from outer walls to avoid z-fighting
  const partOffset = 0.15; // offset from partition walls (half thickness + gap)

  const t = normalizedPos ?? 0.5;

  // Partition walls: "partition-north" / "partition-south" / "partition-east" / "partition-west"
  if (wall.startsWith('partition-')) {
    const face = wall.replace('partition-', '');
    const partitions = room.partitions || [];
    const part = partitions[0]; // use first partition
    if (!part) return { position: new THREE.Vector3(0, 0, 0), rotation: 0 };

    if (part.axis === 'x') {
      // Partition runs along X at z = rz + part.offset
      const pz = rz + part.offset;
      const pxStart = rx + part.wallStart;
      const pxEnd = rx + part.wallEnd;
      const pLen = pxEnd - pxStart;
      const px = pxStart + t * pLen;

      if (face === 'north') {
        return { position: new THREE.Vector3(px, eyeH, pz - partOffset), rotation: Math.PI };
      } else {
        return { position: new THREE.Vector3(px, eyeH, pz + partOffset), rotation: 0 };
      }
    } else {
      // Partition runs along Z at x = rx + part.offset
      const px = rx + part.offset;
      const pzStart = rz + part.wallStart;
      const pzEnd = rz + part.wallEnd;
      const pLen = pzEnd - pzStart;
      const pzPos = pzStart + t * pLen;

      if (face === 'west') {
        return { position: new THREE.Vector3(px - partOffset, eyeH, pzPos), rotation: Math.PI / 2 };
      } else {
        return { position: new THREE.Vector3(px + partOffset, eyeH, pzPos), rotation: -Math.PI / 2 };
      }
    }
  }

  switch (wall) {
    case 'north':
      return {
        position: new THREE.Vector3(rx + t * w, eyeH, rz + offset),
        rotation: 0,
      };
    case 'south':
      return {
        position: new THREE.Vector3(rx + t * w, eyeH, rz + d - offset),
        rotation: Math.PI,
      };
    case 'east':
      return {
        position: new THREE.Vector3(rx + w - offset, eyeH, rz + t * d),
        rotation: -Math.PI / 2,
      };
    case 'west':
      return {
        position: new THREE.Vector3(rx + offset, eyeH, rz + t * d),
        rotation: Math.PI / 2,
      };
    default:
      return {
        position: new THREE.Vector3(rx + w / 2, eyeH, rz + offset),
        rotation: 0,
      };
  }
}

/**
 * Get all artwork meshes (for raycasting).
 */
export function getArtworkMeshes() {
  return artworkMeshes;
}
