/**
 * Because — Remember why.
 * Production-ready: export, import, robust storage, accessibility.
 */

import { loadItems, saveItems } from './storage.js';
import { computeRadarData, renderRadarChart } from './chart.js';

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

function createItem(content, because, topics = []) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    content: content.trim(),
    because: because.trim(),
    createdAt: new Date().toISOString(),
    topics: Array.isArray(topics) ? topics : []
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

function renderItem(item, onDelete, onEdit) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = item.id;
  li.setAttribute('role', 'article');

  const isUrl = /^https?:\/\//i.test(item.content);
  const contentHtml = isUrl
    ? `<a href="${escapeHtml(item.content)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.content)}</a>`
    : escapeHtml(item.content);

  const topics = item.topics?.length ? item.topics : ['Other'];
  const topicsHtml = `<div class="item-topics">${topics.map(t => `<span class="item-topic">${escapeHtml(t)}</span>`).join('')}</div>`;

  li.innerHTML = `
    ${topicsHtml}
    <div class="item-content">${contentHtml}</div>
    <div class="item-because">${escapeHtml(item.because)}</div>
    <div class="item-meta">${formatDate(item.createdAt)}</div>
    <div class="item-actions">
      <button type="button" class="edit" title="Edit" aria-label="Edit item">Edit</button>
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
  li.querySelector('.edit')?.addEventListener('click', () => onEdit?.(item));
  li.querySelector('.delete').addEventListener('click', () => onDelete(item.id));
  return li;
}

const PAGE_SIZE = 15;

function renderList(items, searchQuery, limit, onRefresh) {
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty-state');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  const loadMoreBtn = document.getElementById('load-more');

  listEl.innerHTML = '';
  emptyEl.hidden = items.length > 0;
  loadMoreWrap.hidden = true;

  if (items.length > 0) {
    const filtered = filterItems(items, searchQuery);
    const sorted = [...filtered].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    const toShow = limit != null ? sorted.slice(0, limit) : sorted;
    const onDelete = (id) => deleteItem(id, items, onRefresh);
    const onEdit = (it) => editItem(it, items, onRefresh);
    toShow.forEach(item => {
      listEl.appendChild(renderItem(item, onDelete, onEdit));
    });
    if (limit != null && sorted.length > limit) {
      loadMoreWrap.hidden = false;
      loadMoreBtn.textContent = `Load more (${sorted.length - limit} remaining)`;
    }
  }
}

async function editItem(item, items, onRefresh) {
  const li = document.querySelector(`.item[data-id="${item.id}"]`);
  if (!li) return;

  const contentEl = li.querySelector('.item-content');
  const becauseEl = li.querySelector('.item-because');
  const metaEl = li.querySelector('.item-meta');
  const topicsEl = li.querySelector('.item-topics');
  const actionsEl = li.querySelector('.item-actions');

  const origContent = item.content;
  const origBecause = item.because;

  const contentInput = document.createElement('input');
  contentInput.type = 'text';
  contentInput.value = item.content;
  contentInput.className = 'item-edit-input';
  const becauseInput = document.createElement('input');
  becauseInput.type = 'text';
  becauseInput.value = item.because;
  becauseInput.className = 'item-edit-input';

  contentEl.replaceWith(contentInput);
  becauseEl.replaceWith(becauseInput);
  topicsEl.hidden = true;
  metaEl.hidden = true;
  actionsEl.innerHTML = `
    <button type="button" class="save-edit" aria-label="Save">Save</button>
    <button type="button" class="cancel-edit" aria-label="Cancel">Cancel</button>
  `;

  const finish = () => {
    const newContentEl = document.createElement('div');
    newContentEl.className = 'item-content';
    if (/^https?:\/\//i.test(item.content)) {
      const a = document.createElement('a');
      a.href = item.content;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = item.content;
      newContentEl.appendChild(a);
    } else {
      newContentEl.textContent = item.content;
    }
    const newBecauseEl = document.createElement('div');
    newBecauseEl.className = 'item-because';
    newBecauseEl.textContent = item.because;
    contentInput.replaceWith(newContentEl);
    becauseInput.replaceWith(newBecauseEl);
    topicsEl.hidden = false;
    metaEl.hidden = false;
    onRefresh?.();
  };

  const save = async () => {
    const newContent = contentInput.value.trim();
    const newBecause = becauseInput.value.trim();
    if (!newContent || !newBecause) {
      showToast('Fill in both fields', 'error');
      return;
    }
    item.content = newContent;
    item.because = newBecause;
    try {
      await saveItems(items);
      showToast('Saved', 'success');
      try {
        const res = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent, because: newBecause })
        });
        if (res.ok) {
          const { topics } = await res.json();
          item.topics = (topics?.length ? topics : ['Other']);
          await saveItems(items);
        } else {
          item.topics = ['Other'];
          await saveItems(items);
        }
      } catch {
        item.topics = ['Other'];
        await saveItems(items);
      }
      finish();
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error');
    }
  };

  const cancel = () => {
    item.content = origContent;
    item.because = origBecause;
    finish();
  };

  actionsEl.querySelector('.save-edit').addEventListener('click', save);
  actionsEl.querySelector('.cancel-edit').addEventListener('click', cancel);
  contentInput.focus();
}

async function deleteItem(id, items, onRefresh) {
  const next = items.filter(i => i.id !== id);
  try {
    await saveItems(next);
  } catch (e) {
    showToast(e.message || 'Failed to save', 'error');
    return;
  }
  items.length = 0;
  items.push(...next);
  (onRefresh || (() => renderList(items, document.getElementById('search').value)))();
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

function importData(items, fileInput, onRefresh) {
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
      if (onRefresh) onRefresh();
      else renderList(items, document.getElementById('search').value);
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

  const listLoader = document.getElementById('list-loader');
  const listContent = document.getElementById('list-content');

  const hideLoader = () => {
    listLoader?.setAttribute('hidden', '');
    listContent?.removeAttribute('hidden');
  };

  listLoader?.removeAttribute('hidden');
  listContent?.setAttribute('hidden', '');

  let items = [];
  try {
    items = await loadItems();
  } catch {
    showToast('Could not load data. Using temporary storage.', 'error');
  } finally {
    hideLoader();
  }

  let visibleCount = PAGE_SIZE;
  function showList() {
    renderList(items, searchInput.value, visibleCount, showList);
  }

  showList();

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

    showList();
    contentInput.value = '';
    becauseInput.value = '';
    contentInput.focus();

    try {
      const res = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, because })
      });
      if (res.ok) {
        const { topics } = await res.json();
        item.topics = (topics?.length ? topics : ['Other']);
        await saveItems(items);
        showList();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Segment failed (${res.status})`, 'error');
        item.topics = ['Other'];
        await saveItems(items);
        showList();
      }
    } catch {
      item.topics = ['Other'];
      await saveItems(items);
      showList();
    }
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

  document.getElementById('load-more')?.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    showList();
  });

  searchInput.addEventListener('input', () => {
    visibleCount = PAGE_SIZE;
    showList();
  });

  const chartBtn = document.getElementById('chart-btn');
  const chartOverlay = document.getElementById('chart-overlay');
  const chartContainer = document.getElementById('chart-container');
  const chartClose = document.getElementById('chart-close');

  function openChart() {
    if (items.length < 2) {
      showToast('Add at least 2 bookmarks to see the chart', 'info');
      return;
    }
    const data = computeRadarData(items);
    renderRadarChart(chartContainer, data);
    chartOverlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeChart() {
    chartOverlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  chartBtn?.addEventListener('click', openChart);

  chartClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeChart();
  });

  chartOverlay?.addEventListener('click', (e) => {
    if (e.target === chartOverlay) closeChart();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chartOverlay?.classList.contains('is-open')) closeChart();
  });

  exportBtn?.addEventListener('click', () => exportData(items));
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => importData(items, importInput, showList));

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('because-theme', next);
  });

  contentInput.focus();
});
