chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TABS') {
    chrome.tabs.query({}, (tabs) => {
      const list = tabs
        .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('edge://') && !t.url.startsWith('about:'))
        .map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title || t.url
        }));
      sendResponse({ tabs: list });
    });
    return true; // keep channel open for async sendResponse
  }
});
