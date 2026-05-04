/**
 * Mobile Controls — virtual joystick, drag-to-look, gyroscope, tap-to-move.
 *
 * Control modes:
 *   'joystick-drag'  — left joystick + right-side drag-to-look (default)
 *   'joystick-gyro'  — left joystick + gyroscope for look
 *   'tap-drag'       — tap floor to walk + drag-to-look
 */
import * as THREE from 'three';
import { collisionWalls } from './roomBuilder.js';

// ─── Constants ───
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 3.5;
const PLAYER_RADIUS = 0.5;
const DRAG_SENSITIVITY = 0.004;
const JOYSTICK_DEAD_ZONE = 10; // px
const JOYSTICK_MAX_RADIUS = 50; // px from center

// ─── State ───
let camera = null;
let renderer = null;
let isMobile = false;
let mode = 'joystick-drag'; // persisted in localStorage
let enabled = false;
let yaw = 0;
let pitch = 0;

// Joystick state
let joystickActive = false;
let joystickTouchId = null;
let joystickOrigin = { x: 0, y: 0 };
let joystickDelta = { x: 0, y: 0 }; // -1..1 normalized

// Drag-look state
let lookTouchId = null;
let lastLookPos = { x: 0, y: 0 };

// Gyroscope state
let gyroEnabled = false;
let gyroAlpha = 0;
let gyroBeta = 0;
let gyroBaseAlpha = null;
let gyroBaseBeta = null;
let initialYaw = 0;
let initialPitch = 0;

// Tap-to-move state
let tapTarget = null; // THREE.Vector3 or null
const tapSpeed = 3.0;

// DOM elements
let joystickContainer, joystickKnob, settingsBtn, settingsMenu;

// Reusable THREE objects
const _forward = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _movement = new THREE.Vector3();
const _playerMin = new THREE.Vector3();
const _playerMax = new THREE.Vector3();
const _playerBox = new THREE.Box3();
const _raycaster = new THREE.Raycaster();
const _tapVec = new THREE.Vector2();

// ─── Public API ───

export function isMobileDevice() {
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth <= 1024;
}

export function initMobileControls(cam, ren) {
  isMobile = isMobileDevice();
  if (!isMobile) return;

  camera = cam;
  renderer = ren;
  enabled = true;

  // Restore persisted mode
  const saved = localStorage.getItem('gallery-control-mode');
  if (saved && ['joystick-drag', 'joystick-gyro', 'tap-drag'].includes(saved)) {
    mode = saved;
  }

  // Extract initial yaw from camera
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  yaw = Math.atan2(dir.x, dir.z);
  pitch = 0;

  // Create UI
  createUI();
  applyMode();

  // Touch events on canvas
  const canvas = renderer.domElement;
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

export function updateMobileControls(delta) {
  if (!enabled || !camera) return;

  // Apply look rotation
  const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  if (mode === 'joystick-drag' || mode === 'joystick-gyro') {
    // Joystick movement
    if (joystickActive || (Math.abs(joystickDelta.x) > 0.01 || Math.abs(joystickDelta.y) > 0.01)) {
      _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _strafe.set(-Math.sin(yaw - Math.PI / 2), 0, -Math.cos(yaw - Math.PI / 2));

      _movement.set(0, 0, 0);
      _movement.addScaledVector(_forward, -joystickDelta.y); // up = forward
      _movement.addScaledVector(_strafe, joystickDelta.x);  // right = strafe right

      if (_movement.length() > 1) _movement.normalize();
      _movement.multiplyScalar(WALK_SPEED * delta);
      applyMovement(_movement);
    }

    // Gyro look
    if (mode === 'joystick-gyro' && gyroEnabled) {
      applyGyro();
    }
  } else if (mode === 'tap-drag') {
    // Move toward tap target
    if (tapTarget) {
      const dx = tapTarget.x - camera.position.x;
      const dz = tapTarget.z - camera.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3) {
        tapTarget = null;
      } else {
        _movement.set(dx, 0, dz).normalize().multiplyScalar(tapSpeed * delta);
        const moved = applyMovement(_movement);
        if (!moved) tapTarget = null; // stuck on wall
      }
    }
  }

  camera.position.y = EYE_HEIGHT;
}

export function getMobileMode() { return mode; }
export function isMobileEnabled() { return enabled; }

// ─── UI Creation ───

function createUI() {
  // Virtual joystick
  joystickContainer = document.createElement('div');
  joystickContainer.id = 'mobile-joystick';
  joystickContainer.innerHTML = '<div id="mobile-joystick-knob"></div>';
  document.body.appendChild(joystickContainer);
  joystickKnob = document.getElementById('mobile-joystick-knob');

  // Settings gear
  settingsBtn = document.createElement('button');
  settingsBtn.id = 'mobile-settings-btn';
  settingsBtn.textContent = '\u2699';
  settingsBtn.addEventListener('click', toggleSettingsMenu);
  document.body.appendChild(settingsBtn);

  // Settings menu
  settingsMenu = document.createElement('div');
  settingsMenu.id = 'mobile-settings-menu';
  settingsMenu.classList.add('hidden');
  settingsMenu.innerHTML = `
    <div class="mobile-settings-title">Control Mode</div>
    <label><input type="radio" name="ctrl-mode" value="joystick-drag"> Joystick + Drag</label>
    <label><input type="radio" name="ctrl-mode" value="joystick-gyro"> Joystick + Gyro</label>
    <label><input type="radio" name="ctrl-mode" value="tap-drag"> Tap to Move + Drag</label>
  `;
  document.body.appendChild(settingsMenu);

  // Bind radio buttons
  const radios = settingsMenu.querySelectorAll('input[name="ctrl-mode"]');
  radios.forEach(r => {
    r.addEventListener('change', () => {
      mode = r.value;
      localStorage.setItem('gallery-control-mode', mode);
      applyMode();
      settingsMenu.classList.add('hidden');
    });
  });
}

function toggleSettingsMenu() {
  settingsMenu.classList.toggle('hidden');
  // Mark current mode
  const radios = settingsMenu.querySelectorAll('input[name="ctrl-mode"]');
  radios.forEach(r => { r.checked = r.value === mode; });
}

function applyMode() {
  // Show/hide joystick
  const showJoystick = mode === 'joystick-drag' || mode === 'joystick-gyro';
  joystickContainer.style.display = showJoystick ? 'block' : 'none';

  // Gyro handling
  if (mode === 'joystick-gyro') {
    requestGyro();
  } else {
    gyroEnabled = false;
    gyroBaseAlpha = null;
  }

  // Reset states
  joystickDelta = { x: 0, y: 0 };
  joystickActive = false;
  tapTarget = null;
  resetKnob();
}

// ─── Joystick Touch Handling ───

function isInJoystickZone(x) {
  return x < window.innerWidth * 0.4;
}

function onTouchStart(e) {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    const tx = touch.clientX;
    const ty = touch.clientY;

    if ((mode === 'joystick-drag' || mode === 'joystick-gyro') && isInJoystickZone(tx) && joystickTouchId === null) {
      // Start joystick
      joystickTouchId = touch.identifier;
      joystickActive = true;
      joystickOrigin = { x: tx, y: ty };
      joystickDelta = { x: 0, y: 0 };
      // Move joystick container to finger position
      joystickContainer.style.left = (tx - 60) + 'px';
      joystickContainer.style.top = (ty - 60) + 'px';
    } else if (mode === 'tap-drag') {
      // Tap on floor
      if (lookTouchId === null) {
        lookTouchId = touch.identifier;
        lastLookPos = { x: tx, y: ty };
      }
    } else if (lookTouchId === null) {
      // Right-side drag look
      lookTouchId = touch.identifier;
      lastLookPos = { x: tx, y: ty };
    }
  }
}

function onTouchMove(e) {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      const dx = touch.clientX - joystickOrigin.x;
      const dy = touch.clientY - joystickOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < JOYSTICK_DEAD_ZONE) {
        joystickDelta = { x: 0, y: 0 };
        resetKnob();
      } else {
        const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
        const norm = clampedDist / JOYSTICK_MAX_RADIUS;
        const angle = Math.atan2(dy, dx);
        joystickDelta = {
          x: Math.cos(angle) * norm,
          y: Math.sin(angle) * norm,
        };
        // Move knob
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;
        joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      }
    } else if (touch.identifier === lookTouchId) {
      const dx = touch.clientX - lastLookPos.x;
      const dy = touch.clientY - lastLookPos.y;
      lastLookPos = { x: touch.clientX, y: touch.clientY };

      yaw -= dx * DRAG_SENSITIVITY;
      pitch -= dy * DRAG_SENSITIVITY;
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    }
  }
}

function onTouchEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      joystickTouchId = null;
      joystickActive = false;
      joystickDelta = { x: 0, y: 0 };
      resetKnob();
    } else if (touch.identifier === lookTouchId) {
      // In tap-drag mode, a short tap = tap-to-move
      if (mode === 'tap-drag') {
        handleTapToMove(touch.clientX, touch.clientY);
      }
      lookTouchId = null;
    }
  }
}

function resetKnob() {
  if (joystickKnob) {
    joystickKnob.style.transform = 'translate(0px, 0px)';
  }
}

// ─── Tap-to-Move ───

function handleTapToMove(screenX, screenY) {
  if (!camera || !renderer) return;

  _tapVec.x = (screenX / window.innerWidth) * 2 - 1;
  _tapVec.y = -(screenY / window.innerHeight) * 2 + 1;

  _raycaster.setFromCamera(_tapVec, camera);

  // Create a floor plane at y=0
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  _raycaster.ray.intersectPlane(floorPlane, target);

  if (target) {
    tapTarget = target.clone();
    tapTarget.y = EYE_HEIGHT;
  }
}

// ─── Gyroscope ───

function requestGyro() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ — needs user gesture permission
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', onDeviceOrientation);
          gyroEnabled = true;
        } else {
          // Denied — fall back to drag
          mode = 'joystick-drag';
          applyMode();
        }
      })
      .catch(() => {
        mode = 'joystick-drag';
        applyMode();
      });
  } else if ('DeviceOrientationEvent' in window) {
    // Android / non-iOS
    window.addEventListener('deviceorientation', onDeviceOrientation);
    gyroEnabled = true;
  }
}

function onDeviceOrientation(e) {
  if (e.alpha === null) return;

  if (gyroBaseAlpha === null) {
    gyroBaseAlpha = e.alpha;
    gyroBaseBeta = e.beta;
    initialYaw = yaw;
    initialPitch = pitch;
  }

  gyroAlpha = e.alpha;
  gyroBeta = e.beta;
}

function applyGyro() {
  if (gyroBaseAlpha === null) return;

  let deltaAlpha = gyroAlpha - gyroBaseAlpha;
  if (deltaAlpha > 180) deltaAlpha -= 360;
  if (deltaAlpha < -180) deltaAlpha += 360;

  let deltaBeta = gyroBeta - gyroBaseBeta;

  yaw = initialYaw + (deltaAlpha * Math.PI) / 180;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1,
    initialPitch + (deltaBeta * Math.PI) / 180));
}

// ─── Collision ───

function applyMovement(movement) {
  const pos = camera.position;
  let moved = false;

  const newX = pos.x + movement.x;
  if (!checkCollision(newX, pos.z)) {
    pos.x = newX;
    moved = true;
  }

  const newZ = pos.z + movement.z;
  if (!checkCollision(pos.x, newZ)) {
    pos.z = newZ;
    moved = true;
  }

  return moved;
}

function checkCollision(x, z) {
  _playerMin.set(x - PLAYER_RADIUS, 0, z - PLAYER_RADIUS);
  _playerMax.set(x + PLAYER_RADIUS, EYE_HEIGHT + 0.5, z + PLAYER_RADIUS);
  _playerBox.set(_playerMin, _playerMax);

  for (const wall of collisionWalls) {
    if (_playerBox.intersectsBox(wall.box)) return true;
  }
  return false;
}
