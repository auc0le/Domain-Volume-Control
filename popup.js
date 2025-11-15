// popup.js
let currentDomain = '';
let currentTabId = null;

// Helper functions for managing excluded domains
async function getExcludedDomains() {
  const result = await browser.storage.local.get('excludedDomains');
  return result.excludedDomains || ['youtube.com']; // Default to excluding YouTube
}

async function addExcludedDomain(domain) {
  const excludedDomains = await getExcludedDomains();
  if (!excludedDomains.includes(domain)) {
    excludedDomains.push(domain);
    await browser.storage.local.set({ excludedDomains });
  }
  return excludedDomains;
}

async function removeExcludedDomain(domain) {
  const excludedDomains = await getExcludedDomains();
  const updatedDomains = excludedDomains.filter(d => d !== domain);
  await browser.storage.local.set({ excludedDomains: updatedDomains });
  return updatedDomains;
}

function isDomainExcluded(hostname, excludedDomains) {
  return excludedDomains.some(excludedDomain => {
    return hostname === excludedDomain || hostname.endsWith('.' + excludedDomain);
  });
}

// Update the excluded domains list display
async function updateExcludedList() {
  const excludedDomains = await getExcludedDomains();
  const listContainer = document.getElementById('excludedList');
  const domainCount = document.getElementById('domainCount');
  
  // Update domain count
  domainCount.textContent = `(${excludedDomains.length})`;
  
  if (excludedDomains.length === 0) {
    listContainer.innerHTML = '<div class="no-domains">No excluded domains</div>';
    return;
  }
  
  listContainer.innerHTML = excludedDomains.map(domain => `
    <div class="excluded-item">
      <span class="domain-name" title="${domain}">${domain}</span>
      <button class="remove-btn" data-domain="${domain}">Remove</button>
    </div>
  `).join('');
  
  // Add event listeners to remove buttons
  listContainer.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const domain = e.target.getAttribute('data-domain');
      await removeExcludedDomain(domain);
      await updateUI();
    });
  });
}

// Update the entire UI based on current state
async function updateUI() {
  const excludedDomains = await getExcludedDomains();
  const isCurrentDomainExcluded = isDomainExcluded(currentDomain, excludedDomains);

  // Update domain display
  document.getElementById('currentDomain').textContent = currentDomain;

  // Show/hide appropriate elements
  if (isCurrentDomainExcluded) {
    document.getElementById('excludedMessage').style.display = 'block';
    document.getElementById('volumeControl').style.display = 'none';
    document.getElementById('excludeButton').style.display = 'none';
    document.getElementById('includeButton').style.display = 'inline-block';
  } else {
    document.getElementById('excludedMessage').style.display = 'none';
    document.getElementById('volumeControl').style.display = 'block';
    document.getElementById('excludeButton').style.display = 'inline-block';
    document.getElementById('includeButton').style.display = 'none';

    // Load saved volume for this domain
    const storageKey = currentDomain;
    const stickyKey = currentDomain + '_sticky';
    const result = await browser.storage.local.get([storageKey, stickyKey]);
    const volume = result[storageKey] !== undefined ? result[storageKey] : 100;
    const stickyVolume = result[stickyKey] !== undefined ? result[stickyKey] : (currentDomain === 'www.facebook.com');

    document.getElementById('volumeSlider').value = volume;
    document.getElementById('volumeValue').textContent = volume + '%';
    document.getElementById('stickyVolumeCheckbox').checked = stickyVolume;
  }

  // Update excluded domains list
  await updateExcludedList();
}

// Initialize popup
browser.tabs.query({active: true, currentWindow: true}).then(async tabs => {
  currentTabId = tabs[0].id;
  currentDomain = new URL(tabs[0].url).hostname;
  
  await updateUI();
  
  // Initialize accordion functionality
  initializeAccordion();
});

// Initialize accordion functionality
function initializeAccordion() {
  const settingsHeader = document.getElementById('settingsHeader');
  const settingsContent = document.getElementById('settingsContent');
  const expandIcon = document.getElementById('expandIcon');
  
  // Load saved accordion state (default to collapsed)
  const savedState = localStorage.getItem('excludedDomainsExpanded');
  const isExpanded = savedState === 'true';
  
  if (isExpanded) {
    settingsContent.classList.add('expanded');
    expandIcon.classList.add('expanded');
    expandIcon.textContent = '▼';
  }
  
  settingsHeader.addEventListener('click', () => {
    const isCurrentlyExpanded = settingsContent.classList.contains('expanded');
    
    if (isCurrentlyExpanded) {
      settingsContent.classList.remove('expanded');
      expandIcon.classList.remove('expanded');
      expandIcon.textContent = '▶';
      localStorage.setItem('excludedDomainsExpanded', 'false');
    } else {
      settingsContent.classList.add('expanded');
      expandIcon.classList.add('expanded');
      expandIcon.textContent = '▼';
      localStorage.setItem('excludedDomainsExpanded', 'true');
    }
  });
}

// Handle exclude button
document.getElementById('excludeButton').addEventListener('click', async () => {
  await addExcludedDomain(currentDomain);
  await updateUI();
  
  // Reload the current tab to apply the exclusion
  browser.tabs.reload(currentTabId);
});

// Handle include button
document.getElementById('includeButton').addEventListener('click', async () => {
  await removeExcludedDomain(currentDomain);
  await updateUI();
  
  // Reload the current tab to apply the inclusion
  browser.tabs.reload(currentTabId);
});

// Handle slider changes
document.getElementById('volumeSlider').addEventListener('input', async (e) => {
  const volume = parseInt(e.target.value);
  document.getElementById('volumeValue').textContent = volume + '%';

  // Check if domain is excluded before proceeding
  const excludedDomains = await getExcludedDomains();
  if (isDomainExcluded(currentDomain, excludedDomains)) {
    return;
  }

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

// Handle sticky volume checkbox changes
document.getElementById('stickyVolumeCheckbox').addEventListener('change', async (e) => {
  const stickyVolume = e.target.checked;

  // Check if domain is excluded before proceeding
  const excludedDomains = await getExcludedDomains();
  if (isDomainExcluded(currentDomain, excludedDomains)) {
    return;
  }

  // Save to storage
  const stickyKey = currentDomain + '_sticky';
  browser.storage.local.set({
    [stickyKey]: stickyVolume
  });

  // Send to content script
  browser.tabs.sendMessage(currentTabId, {
    command: 'setStickyVolume',
    stickyVolume: stickyVolume
  });
});