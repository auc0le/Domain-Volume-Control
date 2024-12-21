// content.js
let mediaElements = new Set();
let currentVolume = 1;

// Track all media elements on the page
function trackMediaElement(element) {
  if (mediaElements.has(element)) return;
  
  mediaElements.add(element);
  
  // Immediately apply current volume
  element.volume = currentVolume;
  
  // Use a more aggressive approach to maintain volume
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const originalSet = descriptor.set;
  
    // We'll use a flag to allow our own volume changes
  let isSettingOurVolume = false;
  
  Object.defineProperty(element, 'volume', {
    get: descriptor.get,
    set: function(value) {
      // Allow our own volume changes
      if (isSettingOurVolume) {
        originalSet.call(this, value);
        return;
      }
      
      // For other volume changes, maintain our volume setting
      originalSet.call(this, currentVolume);
    }
  });
  
  // Add our setter method to the element
  element.setExtensionVolume = function(value) {
    isSettingOurVolume = true;
    this.volume = value;
    isSettingOurVolume = false;
  };
  
  // Also handle volume changes through the Web Audio API if used
  if (element.webkitAudioContext || element.audioContext) {
    // TODO: Implement Web Audio API volume control if needed
  }
  
  element.addEventListener('volumechange', (e) => {
    // Only handle trusted user events
    if (!e.isTrusted) return;
    const newVolume = Math.round(element.volume * 100);
    browser.runtime.sendMessage({
      command: 'volumeChanged',
      volume: newVolume
    });
  });
  
  // Ensure volume is set even if the video is loaded later
  element.addEventListener('loadstart', () => {
    element.volume = currentVolume;
  });
  
  element.addEventListener('play', () => {
    element.volume = currentVolume;
  });
}

// Watch for new media elements more aggressively
const observer = new MutationObserver(mutations => {
  // Check all mutations
  for (const mutation of mutations) {
    // Handle added nodes
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLMediaElement) {
        trackMediaElement(node);
      }
      if (node.querySelectorAll) {
        node.querySelectorAll('video, audio').forEach(trackMediaElement);
      }
    }
    
    // Also check the target and its children
    if (mutation.target instanceof HTMLMediaElement) {
      trackMediaElement(mutation.target);
    }
    if (mutation.target.querySelectorAll) {
      mutation.target.querySelectorAll('video, audio').forEach(trackMediaElement);
    }
  }
});

// Use a more aggressive observation strategy
observer.observe(document, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'poster'] // Watch for video source changes
});

// Also periodically scan for new media elements that might have been missed
setInterval(() => {
  document.querySelectorAll('video, audio').forEach(trackMediaElement);
}, 1000);

observer.observe(document, {
  childList: true,
  subtree: true
});

// Apply volume settings from storage
const domain = window.location.hostname;
browser.storage.local.get(domain).then(result => {
  const volume = result[domain] || 100;
  currentVolume = volume / 100;
  setPageVolume(currentVolume);
});

// Listen for volume change commands
browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'setVolume') {
    setPageVolume(message.volume);
  }
});

function setPageVolume(volume) {
  currentVolume = volume;
  for (const media of mediaElements) {
    if (media.setExtensionVolume) {
      media.setExtensionVolume(volume);
    } else {
      console.warn('Media element missing setExtensionVolume method');
      media.volume = volume;
    }
  }
}

// Find existing media elements
document.querySelectorAll('video, audio').forEach(trackMediaElement);