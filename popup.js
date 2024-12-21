// popup.js
let currentDomain = '';
let currentTabId = null;

// Initialize popup
browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
  currentTabId = tabs[0].id;
  currentDomain = new URL(tabs[0].url).hostname;
  
  // Load saved volume for this domain
  browser.storage.local.get(currentDomain).then(result => {
    const volume = result[currentDomain] || 100;
    document.getElementById('volumeSlider').value = volume;
    document.getElementById('volumeValue').textContent = volume + '%';
  });
});

// Handle slider changes
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  const volume = parseInt(e.target.value);
  document.getElementById('volumeValue').textContent = volume + '%';
  
  // Save to storage
  browser.storage.local.set({
    [currentDomain]: volume
  });
  
  // Send to content script
  browser.tabs.sendMessage(currentTabId, {
    command: 'setVolume',
    volume: volume / 100
  });
});