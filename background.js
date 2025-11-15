// background.js

// Helper function to check if domain is excluded
async function isDomainExcluded(hostname) {
  const result = await browser.storage.local.get('excludedDomains');
  const excludedDomains = result.excludedDomains || ['youtube.com']; // Default to excluding YouTube
  
  return excludedDomains.some(excludedDomain => {
    return hostname === excludedDomain || hostname.endsWith('.' + excludedDomain);
  });
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.command === 'volumeChanged') {
    const domain = new URL(sender.tab.url).hostname;

    // Skip storing volume changes for excluded domains
    if (await isDomainExcluded(domain)) {
      return;
    }

    browser.storage.local.set({
      [domain]: message.volume
    });
  }

  // Handle requests from iframes asking for the top-level domain
  if (message.command === 'getTopLevelDomain') {
    if (sender.tab && sender.tab.url) {
      const domain = new URL(sender.tab.url).hostname;
      return Promise.resolve({ domain: domain });
    }
    return Promise.resolve({ domain: null });
  }
});