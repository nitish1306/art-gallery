let audioEl = null;
let isMuted = false;

/**
 * Initialize ambient audio. Call after user interaction (entry screen).
 */
export function initAudio(settings) {
  const audioConf = settings.audio || {};
  const track = audioConf.track;
  if (!track) return;

  audioEl = document.createElement('audio');
  audioEl.src = '/' + track;
  audioEl.loop = true;
  audioEl.volume = audioConf.volume ?? 0.3;

  // Start playing
  audioEl.play().catch(() => {
    // Autoplay blocked — will try again on next interaction
    console.warn('[Audio] Autoplay blocked, will retry on interaction');
    const retry = () => {
      audioEl.play().catch(() => {});
      document.removeEventListener('click', retry);
      document.removeEventListener('keydown', retry);
    };
    document.addEventListener('click', retry);
    document.addEventListener('keydown', retry);
  });

  // Wire up UI controls
  const volumeSlider = document.getElementById('volume-slider');
  const muteBtn = document.getElementById('mute-btn');

  if (volumeSlider) {
    volumeSlider.value = audioEl.volume;
    volumeSlider.addEventListener('input', (e) => {
      audioEl.volume = parseFloat(e.target.value);
      isMuted = false;
      if (muteBtn) muteBtn.textContent = '\u{1F50A}';
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      audioEl.muted = isMuted;
      muteBtn.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';
    });
  }

  // Show audio controls
  const controls = document.getElementById('audio-controls');
  if (controls) controls.style.display = 'flex';
}
