/**
 * Admin Artwork Manager — handles upload, CRUD, and artwork list display.
 */
import { showToast } from './toast.js';

// ─── DOM refs ───
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewArea = document.getElementById('preview-area');
const previewBefore = document.getElementById('preview-before');
const previewAfter = document.getElementById('preview-after');
const artworkForm = document.getElementById('artwork-form');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const artworkGrid = document.getElementById('artwork-grid');
const artworkCount = document.getElementById('artwork-count');
const positionSlider = document.getElementById('form-position');
const positionValue = document.getElementById('position-value');
const roomSelect = document.getElementById('form-room');
const toast = document.getElementById('toast');

let editMode = false; // true when editing existing artwork

// ─── Init ───

async function init() {
  await loadRooms();
  await loadArtworks();
  bindEvents();
}

// ─── Load rooms into dropdown ───

async function loadRooms() {
  const res = await fetch('/api/admin/rooms');
  const data = await res.json();
  const rooms = data.rooms || [];

  roomSelect.innerHTML = '';
  for (const room of rooms) {
    const opt = document.createElement('option');
    opt.value = room.id;
    opt.textContent = room.name + ' (' + room.id + ')';
    roomSelect.appendChild(opt);
  }
}

// ─── Load and render artwork list ───

async function loadArtworks() {
  const res = await fetch('/api/admin/artworks');
  const artworks = await res.json();

  artworkCount.textContent = '(' + artworks.length + ')';
  artworkGrid.innerHTML = '';

  for (const art of artworks) {
    const card = document.createElement('div');
    card.className = 'art-card';
    card.innerHTML = `
      <img src="/${art.thumbnail || art.image}" alt="${escapeHtml(art.title)}" loading="lazy">
      <div class="art-card-body">
        <div class="art-card-title">${escapeHtml(art.title)}</div>
        <div class="art-card-meta">${escapeHtml(art.room)} &middot; ${escapeHtml(art.wall)} &middot; ${art.position}</div>
        <div class="art-card-actions">
          <button class="btn-edit" data-id="${art.id}">Edit</button>
          <button class="btn-delete" data-id="${art.id}">Delete</button>
        </div>
      </div>
    `;
    artworkGrid.appendChild(card);
  }

  // Bind card buttons
  artworkGrid.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => startEdit(btn.dataset.id, artworks));
  });
  artworkGrid.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteArtwork(btn.dataset.id));
  });
}

// ─── Events ───

function bindEvents() {
  // Drag and drop
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  // Click dropzone
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  // Position slider
  positionSlider.addEventListener('input', () => {
    positionValue.textContent = parseFloat(positionSlider.value).toFixed(2);
  });

  // Form submit
  artworkForm.addEventListener('submit', onFormSubmit);

  // Cancel
  cancelBtn.addEventListener('click', resetForm);
}

// ─── Upload ───

async function uploadFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  showToast('Uploading...', '');
  try {
    const res = await fetch('/api/admin/artworks/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');

    const data = await res.json();

    // Show preview
    previewBefore.src = data.preview.before;
    previewAfter.src = data.preview.after;
    document.getElementById('form-temp-file').value = data.tempFile;
    document.getElementById('form-edit-id').value = '';
    editMode = false;
    saveBtn.textContent = 'Save Artwork';
    previewArea.classList.remove('hidden');
    showToast('Image uploaded! Fill in details below.', 'success');
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
}

// ─── Save / Edit ───

async function onFormSubmit(e) {
  e.preventDefault();

  // Validate required fields
  const title = document.getElementById('form-title').value.trim();
  const wall = document.getElementById('form-wall').value;
  if (!title) {
    showToast('Title is required', 'error');
    return;
  }
  if (!roomSelect.value) {
    showToast('Please select a room', 'error');
    return;
  }

  const editId = document.getElementById('form-edit-id').value;

  if (editMode && editId) {
    // Update existing artwork
    const body = {
      title: document.getElementById('form-title').value,
      date: document.getElementById('form-date').value,
      medium: document.getElementById('form-medium').value,
      description: document.getElementById('form-description').value,
      room: roomSelect.value,
      wall: document.getElementById('form-wall').value,
      position: positionSlider.value,
    };

    try {
      const res = await fetch('/api/admin/artworks/' + editId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Update failed');

      showToast('Artwork updated!', 'success');
      resetForm();
      await loadArtworks();
    } catch (err) {
      showToast('Update failed: ' + err.message, 'error');
    }
  } else {
    // New artwork
    const tempFile = document.getElementById('form-temp-file').value;
    if (!tempFile) {
      showToast('Upload an image first', 'error');
      return;
    }

    const body = {
      tempFile,
      title: document.getElementById('form-title').value,
      date: document.getElementById('form-date').value,
      medium: document.getElementById('form-medium').value,
      description: document.getElementById('form-description').value,
      room: roomSelect.value,
      wall: document.getElementById('form-wall').value,
      position: positionSlider.value,
    };

    saveBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Save failed');

      showToast('Artwork saved!', 'success');
      resetForm();
      await loadArtworks();
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }
}

// ─── Edit existing artwork ───

function startEdit(id, artworks) {
  const art = artworks.find(a => a.id === id);
  if (!art) return;

  editMode = true;
  document.getElementById('form-edit-id').value = art.id;
  document.getElementById('form-temp-file').value = '';
  document.getElementById('form-title').value = art.title;
  document.getElementById('form-date').value = art.date || '';
  document.getElementById('form-medium').value = art.medium || '';
  document.getElementById('form-description').value = art.description || '';
  roomSelect.value = art.room;
  document.getElementById('form-wall').value = art.wall;
  positionSlider.value = art.position;
  positionValue.textContent = parseFloat(art.position).toFixed(2);

  // Show preview with current artwork images
  previewBefore.src = '/' + art.image;
  previewAfter.src = '/' + (art.thumbnail || art.image);
  previewArea.classList.remove('hidden');
  saveBtn.textContent = 'Update Artwork';

  // Scroll to form
  previewArea.scrollIntoView({ behavior: 'smooth' });
}

// ─── Delete ───

async function deleteArtwork(id) {
  if (!confirm('Delete this artwork? This cannot be undone.')) return;

  try {
    const res = await fetch('/api/admin/artworks/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');

    showToast('Artwork deleted', 'success');
    await loadArtworks();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// ─── Reset form ───

function resetForm() {
  editMode = false;
  artworkForm.reset();
  previewArea.classList.add('hidden');
  document.getElementById('form-edit-id').value = '';
  document.getElementById('form-temp-file').value = '';
  positionSlider.value = 0.5;
  positionValue.textContent = '0.50';
  saveBtn.textContent = 'Save Artwork';
  fileInput.value = '';
}

// ─── Helpers ───

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─── Start ───
init();
