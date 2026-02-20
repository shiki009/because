(function () {
  document.body.classList.add('because-extension-loaded');
  const contentEl = document.getElementById('content');
  if (!contentEl) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'because-tab-picker-wrapper';
  contentEl.parentNode.insertBefore(wrapper, contentEl);
  wrapper.appendChild(contentEl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'because-tab-picker-btn';
  btn.title = 'Pick from open tabs';
  btn.setAttribute('aria-label', 'Pick from open tabs');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
  wrapper.appendChild(btn);

  const dropdown = document.createElement('div');
  dropdown.className = 'because-tab-picker-dropdown';
  dropdown.hidden = true;
  wrapper.appendChild(dropdown);

  function close() {
    dropdown.hidden = true;
    document.removeEventListener('click', outside);
  }

  function outside(e) {
    if (!wrapper.contains(e.target)) close();
  }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!dropdown.hidden) {
      close();
      return;
    }
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_TABS' });
      const tabs = res?.tabs || [];
      if (tabs.length === 0) {
        dropdown.innerHTML = '<div class="because-tab-picker-empty">No suitable tabs found</div>';
      } else {
        dropdown.innerHTML = tabs
          .slice(0, 50)
          .map(
            (t) =>
              `<button type="button" class="because-tab-picker-item" data-url="${escapeHtml(t.url)}" data-title="${escapeHtml(t.title || '')}">
                <span class="because-tab-picker-title">${escapeHtml(truncate(t.title || t.url, 50))}</span>
                <span class="because-tab-picker-url">${escapeHtml(truncate(t.url, 60))}</span>
              </button>`
          )
          .join('');
        dropdown.querySelectorAll('.because-tab-picker-item').forEach((b) => {
          b.addEventListener('click', () => {
            contentEl.value = b.dataset.url;
            contentEl.focus();
            document.getElementById('because')?.focus();
            close();
          });
        });
      }
      dropdown.hidden = false;
      document.addEventListener('click', outside);
    } catch {
      dropdown.innerHTML = '<div class="because-tab-picker-empty">Could not load tabs</div>';
      dropdown.hidden = false;
      document.addEventListener('click', outside);
    }
  });

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function truncate(s, len) {
    return s.length <= len ? s : s.slice(0, len) + '…';
  }
})();
