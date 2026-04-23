// ─── Dashboard Frontend Logic ───────────────────────────────────────
// Handles all fetch calls, table rendering, upload, edit, delete, search.

const API = '/api';

// ── State ────────────────────────────────────────────────────────────
let allFiles = [];

// ── DOM Refs ─────────────────────────────────────────────────────────
const tbody        = document.getElementById('file-tbody');
const emptyMsg     = document.getElementById('empty-msg');
const statTotal    = document.getElementById('stat-total');
const statSize     = document.getElementById('stat-size');
const statUploaders= document.getElementById('stat-uploaders');
const searchInput  = document.getElementById('search-input');
const uploadForm   = document.getElementById('upload-form');
const uploadBtn    = document.getElementById('upload-btn');
const editModal    = document.getElementById('edit-modal');
const editForm     = document.getElementById('edit-form');
const editIdInput  = document.getElementById('edit-id');
const editTitleInput = document.getElementById('edit-title');
const editCancel   = document.getElementById('edit-cancel');
const deleteModal  = document.getElementById('delete-modal');
const deleteName   = document.getElementById('delete-name');
const deleteConfirm= document.getElementById('delete-confirm');
const deleteCancel = document.getElementById('delete-cancel');

let pendingDeleteId = null;

// ── Fetch & Render ───────────────────────────────────────────────────

async function loadFiles() {
  try {
    const res = await fetch(`${API}/files`);
    allFiles  = await res.json();
    updateStats();
    renderTable(allFiles);
  } catch (err) {
    toast('Failed to load files', 'error');
    console.error(err);
  }
}

function updateStats() {
  statTotal.textContent    = allFiles.length;
  const totalBytes         = allFiles.reduce((s, f) => s + (f.size || 0), 0);
  statSize.textContent     = (totalBytes / 1024 / 1024).toFixed(1) + ' MB';
  const uploaders          = new Set(allFiles.map((f) => f.uploaderId));
  statUploaders.textContent = uploaders.size;
}

function renderTable(files) {
  tbody.innerHTML = '';

  if (files.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  files.forEach((f, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${esc(f.title)}</td>
      <td>${esc(f.uploaderName || f.uploaderId)}</td>
      <td>${(f.size / 1024 / 1024).toFixed(2)} MB</td>
      <td>${new Date(f.uploadDate).toLocaleDateString()}</td>
      <td title="${f.id}">${f.id.slice(0, 8)}…</td>
      <td class="actions-cell">
        <button class="btn-icon" title="Edit" data-edit="${f.id}">✏️</button>
        <button class="btn-icon danger" title="Delete" data-delete="${f.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Search ────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) return renderTable(allFiles);

  const filtered = allFiles.filter(
    (f) =>
      f.title.toLowerCase().includes(q) ||
      (f.uploaderName || '').toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q),
  );
  renderTable(filtered);
});

// ── Upload ────────────────────────────────────────────────────────────
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('upload-file');
  const titleInput = document.getElementById('upload-title');

  if (!fileInput.files.length) {
    toast('Please select an audio file', 'error');
    return;
  }

  const fd = new FormData();
  fd.append('audio', fileInput.files[0]);
  fd.append('title', titleInput.value || fileInput.files[0].name);

  uploadBtn.disabled = true;
  uploadBtn.querySelector('.btn-text').classList.add('hidden');
  uploadBtn.querySelector('.btn-loader').classList.remove('hidden');

  try {
    const res  = await fetch(`${API}/files/upload`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    toast(`Uploaded: ${data.title}`, 'success');
    uploadForm.reset();
    await loadFiles();
  } catch (err) {
    toast(err.message || 'Upload failed', 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.querySelector('.btn-text').classList.remove('hidden');
    uploadBtn.querySelector('.btn-loader').classList.add('hidden');
  }
});

// ── Edit Modal ────────────────────────────────────────────────────────
tbody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    const id   = editBtn.dataset.edit;
    const file = allFiles.find((f) => f.id === id);
    if (!file) return;

    editIdInput.value    = file.id;
    editTitleInput.value = file.title;
    editModal.classList.remove('hidden');
  }

  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    pendingDeleteId = delBtn.dataset.delete;
    const file = allFiles.find((f) => f.id === pendingDeleteId);
    deleteName.textContent = file ? file.title : pendingDeleteId;
    deleteModal.classList.remove('hidden');
  }
});

editCancel.addEventListener('click', () => editModal.classList.add('hidden'));

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id    = editIdInput.value;
  const title = editTitleInput.value.trim();

  if (!title) { toast('Title cannot be empty', 'error'); return; }

  try {
    const res  = await fetch(`${API}/files/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast(`Updated: ${data.title}`, 'success');
    editModal.classList.add('hidden');
    await loadFiles();
  } catch (err) {
    toast(err.message || 'Update failed', 'error');
  }
});

// ── Delete Modal ──────────────────────────────────────────────────────
deleteCancel.addEventListener('click', () => {
  deleteModal.classList.add('hidden');
  pendingDeleteId = null;
});

deleteConfirm.addEventListener('click', async () => {
  if (!pendingDeleteId) return;

  try {
    const res  = await fetch(`${API}/files/${pendingDeleteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Track deleted', 'info');
    deleteModal.classList.add('hidden');
    pendingDeleteId = null;
    await loadFiles();
  } catch (err) {
    toast(err.message || 'Delete failed', 'error');
  }
});

// ── Close modals on overlay click ─────────────────────────────────────
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.classList.add('hidden'); });
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) { deleteModal.classList.add('hidden'); pendingDeleteId = null; } });

// ── Toast Notifications ──────────────────────────────────────────────
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Helpers ──────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Boot ──────────────────────────────────────────────────────────────
loadFiles();
