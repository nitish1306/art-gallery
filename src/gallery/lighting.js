import * as THREE from 'three';

let settings = null;
const spotlights = [];

/** id → { spotLight, fixtureMesh } — used for live property updates */
const lightMap = new Map();

export function getLightMeshes() {
  return spotlights.map(s => s.fixtureMesh).filter(Boolean);
}

export function getLightMap() { return lightMap; }

/**
 * Initialize scene lighting from settings.
 */
export function initLighting(scene, settingsData) {
  settings = settingsData;
  const ambient = new THREE.AmbientLight('#ffffff', 0.05);
  scene.add(ambient);
}

/**
 * Build manually placed lights from gridData.
 * Each light entry may carry: intensity, angle (degrees), color (hex string)
 */
export function buildGridLights(scene, gridData) {
  // Clear old lights
  spotlights.forEach(l => {
    scene.remove(l);
    if (l.target) scene.remove(l.target);
    if (l.fixtureMesh) scene.remove(l.fixtureMesh);
  });
  spotlights.length = 0;
  lightMap.clear();

  if (!gridData.lights || gridData.lights.length === 0) return;

  gridData.lights.forEach(light => {
    const color = light.color || '#ffeedd';
    const intensity = light.intensity !== undefined ? light.intensity
      : (light.type === 'headlight' ? 2.0 : 1.5);
    const angleDeg = light.angle !== undefined ? light.angle
      : (light.type === 'headlight' ? 45 : 23);
    const angleRad = angleDeg * Math.PI / 180;

    // Fixture mesh (glowing sphere)
    const fixtureGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const emissiveColor = new THREE.Color(color);
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: emissiveColor,
      emissiveIntensity: 0.8
    });
    const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixtureMesh.position.set(light.worldX, light.worldY, light.worldZ);
    fixtureMesh.userData = { isLight: true, type: light.type, id: light.id, lightData: light };
    scene.add(fixtureMesh);

    if (light.type === 'headlight') {
      const spot = new THREE.SpotLight(color, intensity, 15, angleRad, 0.5, 1.5);
      spot.position.set(light.worldX, light.worldY, light.worldZ);
      spot.target.position.set(light.worldX, 0, light.worldZ);
      scene.add(spot);
      scene.add(spot.target);
      spot.fixtureMesh = fixtureMesh;
      spotlights.push(spot);
      lightMap.set(light.id, { spotLight: spot, fixtureMesh });

    } else if (light.type === 'spotlight') {
      const spot = new THREE.SpotLight(color, intensity, 15, angleRad, 0.5, 1.5);
      spot.position.set(light.worldX, light.worldY, light.worldZ);

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
      lightMap.set(light.id, { spotLight: spot, fixtureMesh });
    }
  });
}

/**
 * Automatic artwork spotlights are disabled — manual placement only.
 */
export function createArtworkSpotlight(scene, targetPosition, settingsData) {
  return null;
}
