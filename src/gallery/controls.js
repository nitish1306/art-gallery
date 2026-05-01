import * as THREE from 'three';
import { collisionWalls } from './roomBuilder.js';
import { isMobileDevice } from './mobileControls.js';

const WALK_SPEED = 4.0;
const RUN_MULTIPLIER = 1.5;
const ACCELERATION = 15.0;
const DECELERATION = 10.0;
const MOUSE_SENSITIVITY = 0.002;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.5;
const BOB_FREQUENCY = 10;
const BOB_AMPLITUDE = 0.025;

let walkCycle = 0;

// State
let camera = null;
let domElement = null;
let isLocked = false;

// Euler for camera look
let yaw = 0;
let pitch = 0;

// Movement velocity
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Pre-allocated reusable objects (avoid GC pressure)
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _movement = new THREE.Vector3();
const _playerMin = new THREE.Vector3();
const _playerMax = new THREE.Vector3();
const _playerBox = new THREE.Box3();

// Key states
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
};

/**
 * Initialize controls. Call once after scene is set up.
 */
export function initControls(cam, element) {
  camera = cam;
  domElement = element;

  // Set initial yaw from camera direction
  const lookDir = new THREE.Vector3();
  camera.getWorldDirection(lookDir);
  yaw = Math.atan2(lookDir.x, lookDir.z);
  pitch = 0;

  // Skip desktop controls on mobile — handled by mobileControls.js
  if (isMobileDevice()) return;

  // Pointer lock
  domElement.addEventListener('click', requestLock);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mousemove', onMouseMove);

  // Keyboard
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

function requestLock() {
  domElement.requestPointerLock();
}

function onLockChange() {
  isLocked = document.pointerLockElement === domElement;
}

function onMouseMove(e) {
  if (!isLocked) return;

  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;

  // Clamp pitch to prevent flipping
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    keys.forward = true; break;
    case 'KeyS': case 'ArrowDown':  keys.backward = true; break;
    case 'KeyA': case 'ArrowLeft':  keys.left = true; break;
    case 'KeyD': case 'ArrowRight': keys.right = true; break;
    case 'ShiftLeft': case 'ShiftRight': keys.run = true; break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    keys.forward = false; break;
    case 'KeyS': case 'ArrowDown':  keys.backward = false; break;
    case 'KeyA': case 'ArrowLeft':  keys.left = false; break;
    case 'KeyD': case 'ArrowRight': keys.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': keys.run = false; break;
  }
}

/**
 * Call every frame with delta time.
 */
export function updateControls(delta) {
  if (!camera) return;
  // On mobile, desktop controls are a no-op
  if (isMobileDevice()) return;

  // Apply camera rotation from mouse look
  _euler.set(pitch, yaw, 0);
  camera.quaternion.setFromEuler(_euler);

  if (!isLocked) {
    // Decelerate when not locked
    velocity.multiplyScalar(1 - DECELERATION * delta);
    if (velocity.length() < 0.01) velocity.set(0, 0, 0);
    return;
  }

  // Calculate desired movement direction
  const speed = WALK_SPEED * (keys.run ? RUN_MULTIPLIER : 1);

  // Forward/backward direction (on XZ plane)
  _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  // Strafe direction
  _strafe.set(-Math.sin(yaw - Math.PI / 2), 0, -Math.cos(yaw - Math.PI / 2));

  direction.set(0, 0, 0);
  if (keys.forward) direction.add(_forward);
  if (keys.backward) direction.sub(_forward);
  if (keys.left) direction.sub(_strafe);
  if (keys.right) direction.add(_strafe);

  if (direction.length() > 0) {
    direction.normalize().multiplyScalar(speed);
    // Accelerate toward target velocity
    velocity.lerp(direction, 1 - Math.exp(-ACCELERATION * delta));
  } else {
    // Decelerate
    velocity.multiplyScalar(1 - DECELERATION * delta);
    if (velocity.length() < 0.01) velocity.set(0, 0, 0);
  }

  // Apply movement with collision detection
  _movement.copy(velocity).multiplyScalar(delta);
  applyMovementWithCollision(_movement);

  // Camera bob while walking
  if (velocity.length() > 0.5) {
    walkCycle += delta * BOB_FREQUENCY;
    camera.position.y = EYE_HEIGHT + Math.sin(walkCycle) * BOB_AMPLITUDE;
  } else {
    walkCycle = 0;
    camera.position.y = EYE_HEIGHT;
  }
}

/**
 * Apply movement, checking collisions on each axis.
 * Slide along walls by testing X and Z independently.
 */
function applyMovementWithCollision(movement) {
  const pos = camera.position;

  // Try X movement
  const newX = pos.x + movement.x;
  if (!checkCollision(newX, pos.z)) {
    pos.x = newX;
  }

  // Try Z movement
  const newZ = pos.z + movement.z;
  if (!checkCollision(pos.x, newZ)) {
    pos.z = newZ;
  }
}

/**
 * Check if position (x, z) collides with any wall.
 * Uses player radius as a buffer.
 */
function checkCollision(x, z) {
  _playerMin.set(x - PLAYER_RADIUS, 0, z - PLAYER_RADIUS);
  _playerMax.set(x + PLAYER_RADIUS, EYE_HEIGHT + 0.5, z + PLAYER_RADIUS);
  _playerBox.set(_playerMin, _playerMax);

  for (const wall of collisionWalls) {
    if (_playerBox.intersectsBox(wall.box)) {
      return true;
    }
  }

  return false;
}
