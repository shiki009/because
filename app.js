/**
 * Because — Remember why.
 * Production-ready: export, import, robust storage, accessibility.
 */

import { loadItems, saveItems } from './storage.js';
import { computeRadarData, renderRadarChart } from './chart.js';
import { classifyWithUserKey, getUserAIConfig, saveUserAIConfig, clearUserAIConfig } from './ai.js';

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

function filterItems(items, query, topicFilter = null) {
  let result = items;
  if (topicFilter) {
    result = result.filter(item =>
      (item.topics?.length ? item.topics : ['Other']).includes(topicFilter)
    );
  }
  if (!query.trim()) return result;
  const q = query.toLowerCase().trim();
  return result.filter(item =>
    item.content.toLowerCase().includes(q) ||
    item.because.toLowerCase().includes(q)
  );
}

function renderItem(item, onDelete, onEdit, onTopicClick, onReclassify) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = item.id;
  li.setAttribute('role', 'article');

  const isUrl = /^https?:\/\//i.test(item.content);
  const contentHtml = isUrl
    ? `<a href="${escapeHtml(item.content)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.content)}</a>`
    : escapeHtml(item.content);

  const topics = item.topics?.length ? item.topics : ['Other'];
  const isOther = topics.length === 1 && topics[0] === 'Other';
  const topicsHtml = item._classifying
    ? `<div class="item-topics"><span class="item-topic-loading">classifying…</span></div>`
    : `<div class="item-topics">${topics.map(t => `<button type="button" class="item-topic" data-topic="${escapeHtml(t)}" title="Filter by ${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}${isOther ? `<button type="button" class="item-reclassify" title="Re-classify with AI" aria-label="Re-classify">↻</button>` : ''}</div>`;

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

  li.querySelectorAll('.item-topic').forEach(btn => {
    btn.addEventListener('click', () => onTopicClick?.(btn.dataset.topic));
  });

  li.querySelector('.item-reclassify')?.addEventListener('click', () => onReclassify?.(item));

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

function renderList(items, searchQuery, limit, onRefresh, topicFilter = null, onTopicClick = null, onReclassify = null) {
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty-state');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  const loadMoreBtn = document.getElementById('load-more');

  // Active topic filter chip
  let filterChip = document.getElementById('topic-filter-chip');
  if (topicFilter) {
    if (!filterChip) {
      filterChip = document.createElement('div');
      filterChip.id = 'topic-filter-chip';
      filterChip.className = 'topic-filter-chip';
      listEl.parentNode.insertBefore(filterChip, listEl);
    }
    filterChip.innerHTML = `Showing: <strong>${escapeHtml(topicFilter)}</strong> <button type="button" class="topic-filter-clear" aria-label="Clear filter">×</button>`;
    filterChip.querySelector('.topic-filter-clear').addEventListener('click', () => onTopicClick?.(null));
  } else if (filterChip) {
    filterChip.remove();
  }

  listEl.innerHTML = '';
  loadMoreWrap.hidden = true;

  // No items at all → onboarding
  if (items.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const filtered = filterItems(items, searchQuery, topicFilter);
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  // No results for search/filter
  let noResults = document.getElementById('no-results');
  if (sorted.length === 0) {
    if (!noResults) {
      noResults = document.createElement('p');
      noResults.id = 'no-results';
      noResults.className = 'no-results';
      listEl.parentNode.insertBefore(noResults, loadMoreWrap);
    }
    const label = topicFilter ? `topic "${topicFilter}"` : `"${searchQuery}"`;
    noResults.textContent = `No results for ${label}.`;
    return;
  }
  noResults?.remove();

  const toShow = limit != null ? sorted.slice(0, limit) : sorted;
  const onDelete = (id) => deleteItem(id, items, onRefresh);
  const onEdit = (it) => editItem(it, items, onRefresh);
  toShow.forEach(item => {
    listEl.appendChild(renderItem(item, onDelete, onEdit, onTopicClick, onReclassify));
  });
  if (limit != null && sorted.length > limit) {
    loadMoreWrap.hidden = false;
    loadMoreBtn.textContent = `Load more (${sorted.length - limit} remaining)`;
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
        item.topics = await classifyItem(newContent, newBecause);
        await saveItems(items);
      } catch {
        item.topics = ['Other'];
        await saveItems(items);
      }
      finish();
    } catch (e) {
      if (isQuotaError(e)) showQuotaToast(() => exportData(items));
      else showToast(e.message || 'Failed to save', 'error');
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

function deleteItem(id, items, onRefresh) {
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const [removed] = items.splice(idx, 1);
  (onRefresh || (() => {}))();

  let undone = false;
  const timer = setTimeout(async () => {
    if (undone) return;
    try { await saveItems(items); } catch { /* silent */ }
  }, 5000);

  showUndoToast('Deleted', async () => {
    undone = true;
    clearTimeout(timer);
    items.splice(idx, 0, removed);
    try { await saveItems(items); } catch { /* silent */ }
    (onRefresh || (() => {}))();
  });
}

function isQuotaError(e) {
  return e?.name === 'QuotaExceededError' || /quota|storage.*(full|exceeded)/i.test(e?.message || '');
}

function showQuotaToast(onExport) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast toast-undo';
  toast.setAttribute('role', 'alert');

  const msg = document.createElement('span');
  msg.textContent = 'Storage full.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast-undo-btn';
  btn.textContent = 'Export now';
  btn.addEventListener('click', () => {
    onExport();
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });

  toast.appendChild(msg);
  toast.appendChild(btn);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

function showNudgeToast(message, onAction, actionLabel) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast toast-undo';
  toast.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.textContent = message;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast-undo-btn';
  btn.textContent = actionLabel;
  btn.addEventListener('click', () => {
    onAction();
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });

  toast.appendChild(msg);
  toast.appendChild(btn);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 7000);
}

function showUndoToast(message, onUndo) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast toast-undo';
  toast.setAttribute('role', 'alert');

  const msg = document.createElement('span');
  msg.textContent = message;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast-undo-btn';
  btn.textContent = 'Undo';
  btn.addEventListener('click', () => {
    onUndo();
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });

  toast.appendChild(msg);
  toast.appendChild(btn);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
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

  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large (max 10 MB)', 'error');
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      if (imported.length === 0) {
        showToast('No valid items in file', 'error');
        return;
      }
      if (imported.length > 10000) {
        showToast('File contains too many items (max 10,000)', 'error');
        return;
      }
      const valid = imported.filter(x =>
        typeof x.content === 'string' && x.content &&
        typeof x.because === 'string' && x.because &&
        typeof x.id === 'string' && x.id
      );
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

function importBookmarks(items, fileInput, onRefresh) {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (file.size > 20 * 1024 * 1024) {
    showToast('File too large (max 20 MB)', 'error');
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const html = e.target.result;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href]'));

      const bookmarks = links
        .map(a => ({ url: a.href?.trim(), title: a.textContent?.trim() }))
        .filter(b => /^https?:\/\//i.test(b.url));

      if (bookmarks.length === 0) {
        showToast('No bookmarks found in file', 'error');
        fileInput.value = '';
        return;
      }

      if (bookmarks.length > 5000) {
        showToast(`Found ${bookmarks.length} bookmarks — importing first 5,000`, 'info');
        bookmarks.splice(5000);
      }

      const existingUrls = new Set(items.map(i => i.content));
      const newBookmarks = bookmarks.filter(b => !existingUrls.has(b.url));

      if (newBookmarks.length === 0) {
        showToast('All bookmarks already saved', 'info');
        fileInput.value = '';
        return;
      }

      const newItems = newBookmarks.map(b => createItem(
        b.url,
        b.title ? `Saved from browser: ${b.title}` : 'Imported from browser bookmarks'
      ));

      const merged = [...newItems, ...items];
      await saveItems(merged);
      items.length = 0;
      items.push(...merged);
      if (onRefresh) onRefresh();
      showToast(`Imported ${newItems.length} bookmarks — fill in the "Because" for each!`, 'success');
    } catch {
      showToast('Could not read bookmark file', 'error');
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
}

async function classifyItem(content, because) {
  const { provider, apiKey } = getUserAIConfig();
  if (apiKey) {
    return classifyWithUserKey(content, because, provider, apiKey);
  }
  const res = await fetch('/api/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, because })
  });
  if (!res.ok) return ['Other'];
  const { topics } = await res.json();
  return topics?.length ? topics : ['Other'];
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
  let activeTopicFilter = null;

  function onTopicClick(topic) {
    activeTopicFilter = topic;
    visibleCount = PAGE_SIZE;
    showList();
    if (topic) searchInput.value = '';
  }

  async function reclassifyItem(item) {
    if (item._classifying) return;
    item._classifying = true;
    showList();
    try {
      item.topics = await classifyItem(item.content, item.because);
    } catch {
      item.topics = ['Other'];
    } finally {
      delete item._classifying;
      await saveItems(items);
      showList();
    }
  }

  function showList() {
    renderList(items, searchInput.value, visibleCount, showList, activeTopicFilter, onTopicClick, reclassifyItem);
  }

  showList();

  async function addNew() {
    const content = contentInput.value.trim();
    const because = becauseInput.value.trim();

    if (!content || !because) {
      showToast('Fill in both fields', 'error');
      if (!content) contentInput.focus();
      else becauseInput.focus();
      return;
    }

    // Submit-time quality check on Because field
    const VAGUE = ['interesting', 'cool', 'good', 'nice', 'useful', 'great', 'awesome', 'ok', 'okay', 'fine', 'neat'];
    const becauseWords = because.toLowerCase().split(/\s+/);
    const isVague = becauseWords.length <= 2 && VAGUE.some(w => becauseWords.includes(w));
    const isTooShort = because.length < 8;
    if (isVague || isTooShort) {
      const hint = document.getElementById('because-hint');
      if (hint) {
        hint.textContent = isVague
          ? 'Try to be more specific — why does this matter to you?'
          : 'A bit more detail will help you remember why later.';
        hint.hidden = false;
      }
      becauseInput.focus();
      becauseInput.select();
      return;
    }

    const item = createItem(content, because);
    item._classifying = true;
    items.unshift(item);

    try {
      await saveItems(items);
    } catch (e) {
      items.shift();
      if (isQuotaError(e)) showQuotaToast(() => exportData(items));
      else showToast(e.message || 'Failed to save', 'error');
      return;
    }

    showList();
    contentInput.value = '';
    becauseInput.value = '';
    if (becauseHint) becauseHint.hidden = true;
    contentInput.focus();

    // First-save nudge: remind about backup
    if (items.length === 1 && !localStorage.getItem('because-nudge-backup')) {
      localStorage.setItem('because-nudge-backup', '1');
      setTimeout(() => showNudgeToast(
        '💾 Tip: use "Download backup" in the footer to keep your whys safe.',
        () => exportData(items),
        'Back up now'
      ), 1200);
    }

    // Third-save nudge: suggest AI key if none set
    if (items.length === 3 && !localStorage.getItem('because-ai-key') && !localStorage.getItem('because-nudge-ai')) {
      localStorage.setItem('because-nudge-ai', '1');
      setTimeout(() => showNudgeToast(
        '✨ Want smarter topic labels? Add a free AI key via the ✦ button.',
        () => document.getElementById('ai-settings-btn')?.click(),
        'Set up AI'
      ), 1200);
    }

    try {
      item.topics = await classifyItem(content, because);
    } catch {
      item.topics = ['Other'];
    } finally {
      delete item._classifying;
      await saveItems(items);
      showList();
    }
  }

  // Rotating "Because…" placeholder
  const becausePlaceholders = [
    'Because it changes how I think about…',
    'Because I keep forgetting that…',
    'Because this solves a problem I have with…',
    'Because I want to come back to this when…',
    'Because it made me question…',
    'Because someone I respect recommended it.',
    'Because I need this for…',
    'Because it explains why…',
  ];
  let placeholderIdx = 0;
  let placeholderTimer = null;

  function rotatePlaceholder() {
    placeholderIdx = (placeholderIdx + 1) % becausePlaceholders.length;
    becauseInput.placeholder = becausePlaceholders[placeholderIdx];
  }

  function startRotating() {
    if (placeholderTimer) return;
    placeholderTimer = setInterval(rotatePlaceholder, 3000);
  }

  function stopRotating() {
    clearInterval(placeholderTimer);
    placeholderTimer = null;
    becauseInput.placeholder = 'Because…';
  }

  becauseInput.addEventListener('focus', stopRotating);
  becauseInput.addEventListener('blur', () => {
    if (!becauseInput.value) startRotating();
  });
  startRotating();

  // Because field quality nudge
  const VAGUE = ['interesting', 'cool', 'good', 'nice', 'useful', 'great', 'awesome', 'ok', 'okay', 'fine', 'neat'];
  const becauseHint = document.getElementById('because-hint');
  becauseInput.addEventListener('input', () => {
    const val = becauseInput.value.trim();
    if (!val || !becauseHint) return;
    const words = val.toLowerCase().split(/\s+/);
    const isVague = words.length <= 2 && VAGUE.some(w => words.includes(w));
    const isTooShort = val.length < 15;
    if (isVague) {
      becauseHint.textContent = 'Try to be more specific — why does this matter to you?';
      becauseHint.hidden = false;
    } else if (isTooShort) {
      becauseHint.textContent = 'A bit more detail will help you remember why later.';
      becauseHint.hidden = false;
    } else {
      becauseHint.hidden = true;
    }
  });
  becauseInput.addEventListener('blur', () => {
    if (becauseHint) becauseHint.hidden = true;
  });

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
    activeTopicFilter = null;
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
    renderRadarChart(chartContainer, data, (topic) => {
      closeChart();
      onTopicClick(topic);
    });
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
    if (e.key === 'Escape') {
      if (chartOverlay?.classList.contains('is-open')) closeChart();
      if (aiSettingsOverlay?.classList.contains('is-open')) closeAISettings();
    }
    // Cmd/Ctrl+Shift+B → focus the save form
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      contentInput.focus();
    }
  });

  exportBtn?.addEventListener('click', () => exportData(items));
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', () => importData(items, importInput, showList));

  const importBookmarksBtn = document.getElementById('import-bookmarks-btn');
  const importBookmarksInput = document.getElementById('import-bookmarks-input');
  importBookmarksBtn?.addEventListener('click', () => importBookmarksInput?.click());
  importBookmarksInput?.addEventListener('change', () => importBookmarks(items, importBookmarksInput, showList));

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('because-theme', next);
  });

  // AI settings modal
  const aiSettingsBtn = document.getElementById('ai-settings-btn');
  const aiSettingsOverlay = document.getElementById('ai-settings-overlay');
  const aiSettingsClose = document.getElementById('ai-settings-close');
  const aiProviderSelect = document.getElementById('ai-provider-select');
  const aiKeyInput = document.getElementById('ai-key-input');
  const aiSettingsSave = document.getElementById('ai-settings-save');
  const aiSettingsClear = document.getElementById('ai-settings-clear');
  const aiSettingsStatus = document.getElementById('ai-settings-status');

  function updateAISettingsUI() {
    const { provider, apiKey } = getUserAIConfig();
    if (apiKey) {
      const providerName = { groq: 'Groq', openai: 'OpenAI', gemini: 'Gemini' }[provider] || provider;
      aiSettingsStatus.textContent = `Using your ${providerName} key for classification.`;
      aiSettingsStatus.classList.add('visible');
      aiSettingsBtn?.classList.add('has-key');
    } else {
      aiSettingsStatus.textContent = 'Using server key (fallback). Add your own key above.';
      aiSettingsStatus.classList.add('visible');
      aiSettingsBtn?.classList.remove('has-key');
    }
  }

  function openAISettings() {
    const { provider, apiKey } = getUserAIConfig();
    if (aiProviderSelect) aiProviderSelect.value = provider;
    if (aiKeyInput) aiKeyInput.value = apiKey;
    updateAISettingsUI();
    aiSettingsOverlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => aiKeyInput?.focus(), 50);
  }

  function closeAISettings() {
    aiSettingsOverlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  aiSettingsBtn?.addEventListener('click', openAISettings);
  aiSettingsClose?.addEventListener('click', closeAISettings);
  aiSettingsOverlay?.addEventListener('click', (e) => {
    if (e.target === aiSettingsOverlay) closeAISettings();
  });

  aiSettingsSave?.addEventListener('click', () => {
    const provider = aiProviderSelect?.value || 'groq';
    const key = aiKeyInput?.value.trim() || '';
    if (!key) {
      showToast('Paste an API key first', 'error');
      aiKeyInput?.focus();
      return;
    }
    saveUserAIConfig(provider, key);
    updateAISettingsUI();
    showToast('API key saved', 'success');
  });

  aiSettingsClear?.addEventListener('click', () => {
    clearUserAIConfig();
    if (aiKeyInput) aiKeyInput.value = '';
    if (aiProviderSelect) aiProviderSelect.value = 'groq';
    updateAISettingsUI();
    showToast('API key removed', 'info');
  });

  // Reflect saved key state on load
  if (localStorage.getItem('because-ai-key')) {
    aiSettingsBtn?.classList.add('has-key');
  }

  contentInput.focus();
});
