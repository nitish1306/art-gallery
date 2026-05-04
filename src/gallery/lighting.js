import * as THREE from 'three';

let settings = null;
const spotlights = [];

export function getLightMeshes() {
  return spotlights.map(s => s.fixtureMesh).filter(Boolean);
}

/**
 * Initialize scene lighting from settings.
 */
export function initLighting(scene, settingsData) {
  settings = settingsData;
  const lighting = settings.lighting || {};
  const ambientConf = lighting.ambient || {};
  const spotConf = lighting.spotlight || {};

  // Ambient light (reduced for shadowed gallery)
  const ambient = new THREE.AmbientLight(
    ambientConf.color || '#ffffff',
    0.05
  );
  scene.add(ambient);
}

/**
 * Build manually placed lights from gridData
 */
export function buildGridLights(scene, gridData) {
  // Clear old manually placed lights
  spotlights.forEach(l => {
    scene.remove(l);
    if (l.target) scene.remove(l.target);
    if (l.fixtureMesh) scene.remove(l.fixtureMesh);
  });
  spotlights.length = 0;

  if (!gridData.lights) return;

  gridData.lights.forEach(light => {
    const fixtureGeo = new THREE.BoxGeometry(0.2, 0.1, 0.2);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x111111 });
    const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixtureMesh.position.set(light.worldX, light.worldY, light.worldZ);
    // Mark as light mesh for Edit Mode picking
    fixtureMesh.userData = { isLight: true, type: light.type, id: light.id, lightData: light };
    scene.add(fixtureMesh);

    if (light.type === 'headlight') {
      const spot = new THREE.SpotLight(0xffeedd, 2.0, 15, Math.PI / 4, 0.5, 1.5);
      spot.position.set(light.worldX, light.worldY, light.worldZ);
      spot.target.position.set(light.worldX, 0, light.worldZ);
      scene.add(spot);
      scene.add(spot.target);
      
      spot.fixtureMesh = fixtureMesh;
      spotlights.push(spot);
    } else if (light.type === 'spotlight') {
      const spot = new THREE.SpotLight(0xffeedd, 1.5, 15, 0.4, 0.5, 1.5);
      spot.position.set(light.worldX, light.worldY, light.worldZ);
      
      // Target based on wallFace (pointing away from wall)
      const targetPos = new THREE.Vector3(light.worldX, Math.max(0, light.worldY - 1), light.worldZ);
      if (light.wallFace === 'north') targetPos.z += 2;
      else if (light.wallFace === 'south') targetPos.z -= 2;
      else if (light.wallFace === 'east') targetPos.x -= 2;
      else if (light.wallFace === 'west') targetPos.x += 2;
      
      spot.target.position.copy(targetPos);
      scene.add(spot);
      scene.add(spot.target);
      
      spot.fixtureMesh = fixtureMesh;
      spotlights.push(spot);
    }
  });
}

/**
 * Create a spotlight aimed at an artwork position.
 * Called by artworkLoader for each artwork.
 */
export function createArtworkSpotlight(scene, targetPosition, settingsData) {
  // Automatic artwork spotlights are disabled in favor of manual placement
  return null;
}
