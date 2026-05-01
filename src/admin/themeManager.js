/**
 * Theme Manager — gallery name, textures, lighting, audio settings.
 */
import { showToast } from './toast.js';

let settings = null;
let textures = []; // available texture list
let isDirty = false;

// Track unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function init() {
  const [sRes, tRes] = await Promise.all([
    fetch('/api/admin/settings'),
    fetch('/api/admin/textures'),
  ]);
  settings = await sRes.json();
  textures = await tRes.json();

  populateForm();
  bindEvents();
}

function populateForm() {
  // Gallery name
  document.getElementById('theme-gallery-name').value = settings.galleryName || '';

  // Textures
  renderTexturePicker('tex-walls', settings.theme?.walls || 'white-plaster');
  renderTexturePicker('tex-floor', settings.theme?.floor || 'concrete');
  renderTexturePicker('tex-ceiling', settings.theme?.ceiling || 'white-plaster');

  // Lighting
  const light = settings.lighting || {};
  const ambient = light.ambient || {};
  const spot = light.spotlight || {};

  document.getElementById('ambient-color').value = ambient.color || '#ffffff';
  setSlider('ambient-intensity', 'ambient-int-val', ambient.intensity ?? 0.4);
  document.getElementById('spot-color').value = spot.color || '#ffcc66';
  setSlider('spot-intensity', 'spot-int-val', spot.intensity ?? 1.2);
  setSlider('spot-angle', 'spot-angle-val', spot.angle ?? 0.4);

  // Audio
  setSlider('audio-volume', 'audio-vol-val', settings.audio?.volume ?? 0.3);
}

function renderTexturePicker(containerId, selected) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (const tex of textures) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tex-btn' + (tex.name === selected ? ' selected' : '');
    btn.dataset.name = tex.name;
    btn.innerHTML = `<img src="${tex.url}" alt="${tex.name}"><span>${tex.name}</span>`;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tex-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    container.appendChild(btn);
  }
}

function setSlider(sliderId, labelId, value) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  slider.value = value;
  label.textContent = parseFloat(value).toFixed(2);
}

function bindEvents() {
  // Slider live labels
  const sliders = [
    ['ambient-intensity', 'ambient-int-val'],
    ['spot-intensity', 'spot-int-val'],
    ['spot-angle', 'spot-angle-val'],
    ['audio-volume', 'audio-vol-val'],
  ];
  for (const [sid, lid] of sliders) {
    document.getElementById(sid).addEventListener('input', (e) => {
      document.getElementById(lid).textContent = parseFloat(e.target.value).toFixed(2);
      isDirty = true;
    });
  }

  // Gallery name change tracking
  document.getElementById('theme-gallery-name').addEventListener('input', () => isDirty = true);

  // Save
  document.getElementById('save-theme-btn').addEventListener('click', saveSettings);
}

function getSelectedTexture(containerId) {
  const sel = document.querySelector('#' + containerId + ' .tex-btn.selected');
  return sel ? sel.dataset.name : null;
}

async function saveSettings() {
  settings.galleryName = document.getElementById('theme-gallery-name').value.trim() || 'My Art Gallery';

  settings.theme = {
    walls: getSelectedTexture('tex-walls') || settings.theme?.walls || 'white-plaster',
    floor: getSelectedTexture('tex-floor') || settings.theme?.floor || 'concrete',
    ceiling: getSelectedTexture('tex-ceiling') || settings.theme?.ceiling || 'white-plaster',
  };

  settings.lighting = {
    ambient: {
      color: document.getElementById('ambient-color').value,
      intensity: parseFloat(document.getElementById('ambient-intensity').value),
    },
    spotlight: {
      color: document.getElementById('spot-color').value,
      intensity: parseFloat(document.getElementById('spot-intensity').value),
      angle: parseFloat(document.getElementById('spot-angle').value),
    },
  };

  settings.audio = {
    ...settings.audio,
    volume: parseFloat(document.getElementById('audio-volume').value),
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Save failed');
    isDirty = false;
    showToast('Theme settings saved!', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}

init();
