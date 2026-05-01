import * as THREE from 'three';

let settings = null;
const spotlights = [];

/**
 * Initialize scene lighting from settings.
 */
export function initLighting(scene, settingsData) {
  settings = settingsData;
  const lighting = settings.lighting || {};
  const ambientConf = lighting.ambient || {};
  const spotConf = lighting.spotlight || {};

  // Ambient light
  const ambient = new THREE.AmbientLight(
    ambientConf.color || '#ffffff',
    ambientConf.intensity ?? 0.4
  );
  scene.add(ambient);

  // Hemisphere light for natural sky/ground
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);
}

/**
 * Create a spotlight aimed at an artwork position.
 * Called by artworkLoader for each artwork.
 */
export function createArtworkSpotlight(scene, targetPosition, settingsData) {
  const spotConf = (settingsData || settings).lighting?.spotlight || {};
  const color = spotConf.color || '#ffcc66';
  const intensity = spotConf.intensity ?? 1.2;
  const angle = spotConf.angle ?? 0.4;

  const spot = new THREE.SpotLight(color, intensity, 15, angle, 0.5, 1.5);

  // Position above and slightly in front of artwork
  spot.position.set(
    targetPosition.x,
    targetPosition.y + 2.5,
    targetPosition.z + 0.5
  );
  spot.target.position.copy(targetPosition);
  scene.add(spot);
  scene.add(spot.target);

  spotlights.push(spot);
  return spot;
}
