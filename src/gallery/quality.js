import * as THREE from 'three';

/**
 * Adaptive quality system.
 * Detects device tier on init, then monitors FPS and auto-adjusts render quality.
 *
 * Quality levels:
 *   high   — pixelRatio 2.0, antialias on, shadows on
 *   medium — pixelRatio 1.5, antialias on, shadows off
 *   low    — pixelRatio 1.0, antialias on, shadows off
 *   potato — pixelRatio 0.75, antialias off (requires renderer rebuild)
 */

const QUALITY_LEVELS = ['potato', 'low', 'medium', 'high'];

const QUALITY_SETTINGS = {
  high:   { pixelRatio: 2.0,  shadows: true  },
  medium: { pixelRatio: 1.5,  shadows: false },
  low:    { pixelRatio: 1.0,  shadows: false },
  potato: { pixelRatio: 0.75, shadows: false },
};

// FPS monitoring
const FPS_SAMPLE_WINDOW = 60;     // frames to average
const FPS_CHECK_INTERVAL = 2000;  // ms between quality checks
const FPS_DOWNGRADE_THRESHOLD = 30;
const FPS_UPGRADE_THRESHOLD = 55;
const STABLE_CHECKS_TO_UPGRADE = 3; // need N consecutive good checks before upgrading

let renderer = null;
let currentLevel = 'medium';
let frameTimes = [];
let lastCheckTime = 0;
let stableHighFpsCount = 0;

/**
 * Detect initial quality tier based on device capabilities.
 */
export function detectQuality() {
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4; // GB, Chrome-only
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = window.screen.width * window.screen.height * dpr * dpr;

  let score = 0;

  // CPU cores
  if (cores >= 8) score += 3;
  else if (cores >= 4) score += 2;
  else score += 1;

  // Memory
  if (memory >= 8) score += 3;
  else if (memory >= 4) score += 2;
  else score += 1;

  // Screen resolution (higher = harder to render)
  if (screenPixels > 8000000) score -= 1; // 4K+
  else if (screenPixels < 2000000) score += 1; // 1080p or below

  // Mobile penalty
  if (isMobile) score -= 2;

  // Map score to level
  if (score >= 7) currentLevel = 'high';
  else if (score >= 5) currentLevel = 'medium';
  else if (score >= 3) currentLevel = 'low';
  else currentLevel = 'potato';

  console.log(`[Quality] Detected tier: ${currentLevel} (score: ${score}, cores: ${cores}, mem: ${memory}GB, mobile: ${isMobile})`);
  return currentLevel;
}

/**
 * Apply current quality settings to the renderer.
 */
export function applyQuality(rend) {
  renderer = rend;
  const s = QUALITY_SETTINGS[currentLevel];

  renderer.setPixelRatio(Math.min(s.pixelRatio, window.devicePixelRatio));
  renderer.shadowMap.enabled = s.shadows;

  // Re-apply size so pixel ratio takes effect
  renderer.setSize(window.innerWidth, window.innerHeight);

  console.log(`[Quality] Applied: ${currentLevel} (pixelRatio: ${Math.min(s.pixelRatio, window.devicePixelRatio).toFixed(2)}, shadows: ${s.shadows})`);
}

/**
 * Record a frame timestamp. Call once per frame.
 */
export function recordFrame(timestamp) {
  frameTimes.push(timestamp);
  if (frameTimes.length > FPS_SAMPLE_WINDOW) {
    frameTimes.shift();
  }

  // Periodically check if we should adjust quality
  if (timestamp - lastCheckTime > FPS_CHECK_INTERVAL && frameTimes.length >= FPS_SAMPLE_WINDOW) {
    lastCheckTime = timestamp;
    checkAndAdjust();
  }
}

function getAverageFPS() {
  if (frameTimes.length < 2) return 60;
  const elapsed = frameTimes[frameTimes.length - 1] - frameTimes[0];
  return (frameTimes.length - 1) / (elapsed / 1000);
}

function checkAndAdjust() {
  const fps = getAverageFPS();
  const idx = QUALITY_LEVELS.indexOf(currentLevel);

  if (fps < FPS_DOWNGRADE_THRESHOLD && idx > 0) {
    // Downgrade immediately
    currentLevel = QUALITY_LEVELS[idx - 1];
    stableHighFpsCount = 0;
    console.log(`[Quality] FPS ${fps.toFixed(1)} too low, downgrading to ${currentLevel}`);
    applyQuality(renderer);
  } else if (fps > FPS_UPGRADE_THRESHOLD && idx < QUALITY_LEVELS.length - 1) {
    stableHighFpsCount++;
    if (stableHighFpsCount >= STABLE_CHECKS_TO_UPGRADE) {
      currentLevel = QUALITY_LEVELS[idx + 1];
      stableHighFpsCount = 0;
      console.log(`[Quality] FPS ${fps.toFixed(1)} stable, upgrading to ${currentLevel}`);
      applyQuality(renderer);
    }
  } else {
    stableHighFpsCount = 0;
  }
}

/**
 * Get current quality level name.
 */
export function getQualityLevel() {
  return currentLevel;
}
