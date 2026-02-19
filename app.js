/**
 * Because — Remember why.
 * Production-ready: export, import, robust storage, accessibility.
 */

import { loadItems, saveItems } from './storage.js';

function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createItem(content, because) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    content: content.trim(),
    because: because.trim(),
    createdAt: new Date().toISOString()
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function filterItems(items, query) {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item =>
    item.content.toLowerCase().includes(q) ||
    item.because.toLowerCase().includes(q)
  );
}

function renderItem(item, onDelete) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = item.id;
  li.setAttribute('role', 'article');

  const isUrl = /^https?:\/\//i.test(item.content);
  const contentHtml = isUrl
    ? `<a href="${escapeHtml(item.content)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.content)}</a>`
    : escapeHtml(item.content);

  li.innerHTML = `
    <div class="item-content">${contentHtml}</div>
    <div class="item-because">${escapeHtml(item.because)}</div>
    <div class="item-meta">${formatDate(item.createdAt)}</div>
    <div class="item-actions">
      <button type="button" class="copy" title="Copy to clipboard" aria-label="Copy item">Copy</button>
      <button type="button" class="delete" aria-label="Delete item">Delete</button>
    </div>
  `;

  li.querySelector('.copy').addEventListener('click', () => {
    const text = `${item.content}\nBecause ${item.because}`;
    navigator.clipboard?.writeText(text).then(() => {
      const btn = li.querySelector('.copy');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  });
  li.querySelector('.delete').addEventListener('click', () => onDelete(item.id));
  return li;
}

function renderList(items, searchQuery) {
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty-state');

  listEl.innerHTML = '';
  emptyEl.hidden = items.length > 0;

  if (items.length > 0) {
    const filtered = filterItems(items, searchQuery);
    const sorted = [...filtered].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    sorted.forEach(item => {
      listEl.appendChild(renderItem(item, (id) => deleteItem(id, items)));
    });
  }
}

async function deleteItem(id, items) {
  const next = items.filter(i => i.id !== id);
  try {
    await saveItems(next);
  } catch (e) {
    showToast(e.message || 'Failed to save', 'error');
    return;
  }
  items.length = 0;
  items.push(...next);
  renderList(items, document.getElementById('search').value);
}

function exportData(items) {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `because-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  showToast('Export downloaded', 'success');
}

function importData(items, fileInput) {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      if (imported.length === 0) {
        showToast('No valid items in file', 'error');
        return;
      }
      const valid = imported.filter(x => x.content && x.because && x.id);
      const merged = [...valid, ...items].filter((item, i, arr) =>
        arr.findIndex(x => x.id === item.id) === i
      );
      await saveItems(merged);
      items.length = 0;
      items.push(...merged);
      renderList(items, document.getElementById('search').value);
      showToast(`Imported ${valid.length} items`, 'success');
    } catch {
      showToast('Invalid file format', 'error');
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', async () => {
  const contentInput = document.getElementById('content');
  const becauseInput = document.getElementById('because');
  const addBtn = document.getElementById('add');
  const searchInput = document.getElementById('search');
  const exportBtn = document.getElementById('export');
  const importBtn = document.getElementById('import-btn');
  const importInput = document.getElementById('import-input');

  let items = [];
  try {
    items = await loadItems();
  } catch {
    showToast('Could not load data. Using temporary storage.', 'error');
  }

  renderList(items, '');

  async function addNew() {
    const content = contentInput.value.trim();
    const because = becauseInput.value.trim();

    if (!content || !because) {
      showToast('Fill in both fields', 'error');
      return;
    }

    const item = createItem(content, because);
    items.unshift(item);

    try {
      await saveItems(items);
    } catch (e) {
      items.shift();
      showToast(e.message || 'Failed to save', 'error');
      return;
    }

    renderList(items, searchInput.value);
    contentInput.value = '';
    becauseInput.value = '';
    contentInput.focus();
  }

  addBtn.addEventListener('click', addNew);

  contentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      becauseInput.focus();
    }
  });

  becauseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNew();
    }
  });

  searchInput.addEventListener('input', () => renderList(items, searchInput.value));

  exportBtn?.addEventListener('click', () => exportData(items));
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => importData(items, importInput));

  contentInput.focus();
});
