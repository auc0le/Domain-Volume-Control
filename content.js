// content.js

// Helper function to check if domain is excluded
async function isDomainExcluded(hostname) {
  const result = await browser.storage.local.get('excludedDomains');
  const excludedDomains = result.excludedDomains || ['youtube.com']; // Default to excluding YouTube
  
  return excludedDomains.some(excludedDomain => {
    return hostname === excludedDomain || hostname.endsWith('.' + excludedDomain);
  });
}

// Check if this domain is excluded before initializing
(async function() {
  if (await isDomainExcluded(window.location.hostname)) {
    // Don't apply volume control on excluded domains
    return;
  }

  // Initialize the volume control system
  initializeVolumeControl();
})();

function initializeVolumeControl() {
  let mediaElements = new Set();
  let currentVolume = 0; // Start at 0% (muted) until storage loads to prevent loud spikes
  let volumeInitialized = false;
  let gainNodes = new Set(); // Track all gain nodes so we can update them when volume changes

  // Intercept Web Audio API to control GainNode volumes
  // Facebook uses Web Audio API for volume control, so we need to override it
  function setupWebAudioInterception() {
    // Override AudioContext.createMediaElementSource
    const AudioContextProto = (window.AudioContext || window.webkitAudioContext).prototype;
    const originalCreateMediaElementSource = AudioContextProto.createMediaElementSource;

    AudioContextProto.createMediaElementSource = function(mediaElement) {
      const source = originalCreateMediaElementSource.call(this, mediaElement);

      // Store reference to track this media element's audio graph
      if (!mediaElement._audioSource) {
        mediaElement._audioSource = source;
      }

      return source;
    };

    // Override AudioContext.createGain to intercept gain node creation
    const originalCreateGain = AudioContextProto.createGain;

    AudioContextProto.createGain = function() {
      const gainNode = originalCreateGain.call(this);

      // Track this gain node
      gainNode._originalGainValue = 1; // Store the intended gain value
      gainNodes.add(gainNode);
      console.log('[Volume Control] Tracking GainNode, total:', gainNodes.size);

      // Override the gain.value property
      const originalGainParam = gainNode.gain;
      const descriptor = Object.getOwnPropertyDescriptor(originalGainParam.__proto__, 'value');

      if (descriptor && descriptor.set) {
        const originalValueSetter = descriptor.set;

        Object.defineProperty(originalGainParam, 'value', {
          get: descriptor.get,
          set: function(value) {
            // Store the original value Google wants to set
            gainNode._originalGainValue = value;
            // Apply our volume adjustment
            const adjustedValue = value * currentVolume;
            console.log('[Volume Control] GainNode value set from', value, 'to', adjustedValue, 'currentVolume:', currentVolume);
            originalValueSetter.call(this, adjustedValue);
          },
          configurable: true
        });
      }

      return gainNode;
    };
  }

  // Set up Web Audio interception immediately
  setupWebAudioInterception();

  // Track all media elements on the page
  function trackMediaElement(element) {
    if (mediaElements.has(element)) return;

    mediaElements.add(element);
    console.log('[Volume Control] Tracking new media element, currentVolume:', currentVolume, 'element type:', element.tagName, 'src:', element.src || element.currentSrc);

    // Use a more aggressive approach to maintain volume
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    const originalSet = descriptor.set;

    // We'll use a timestamp to track when we last set the volume
    // This handles async volumechange events better than a simple flag
    element._lastExtensionVolumeChange = 0;

    Object.defineProperty(element, 'volume', {
      get: descriptor.get,
      set: function(value) {
        // Check if this is our own volume change (within 200ms of our last set)
        const isOurChange = (Date.now() - this._lastExtensionVolumeChange) < 200;

        // Allow our own volume changes
        if (isOurChange) {
          console.log('[Volume Control] Setting volume via extension to:', value);
          originalSet.call(this, value);
          return;
        }

        // For other volume changes, maintain our volume setting
        console.log('[Volume Control] Blocking external volume change from', value, 'to', currentVolume);
        originalSet.call(this, currentVolume);
      },
      configurable: true
    });

    // Add our setter method to the element
    element.setExtensionVolume = function(value) {
      this._lastExtensionVolumeChange = Date.now();
      this.volume = value;
    };

    // Immediately apply current volume AFTER setting up the descriptor
    element.setExtensionVolume(currentVolume);

    // Add loadedmetadata - fires very early, before video can play
    element.addEventListener('loadedmetadata', () => {
      console.log('[Volume Control] loadedmetadata event, applying volume:', currentVolume);
      if (element.setExtensionVolume) {
        element.setExtensionVolume(currentVolume);
      }
    });

    // Add loadeddata - fires when first frame is loaded
    element.addEventListener('loadeddata', () => {
      console.log('[Volume Control] loadeddata event, applying volume:', currentVolume);
      if (element.setExtensionVolume) {
        element.setExtensionVolume(currentVolume);
      }
    });

    element.addEventListener('volumechange', (e) => {
      // Ignore volume changes that WE are making (within 200ms of our last set)
      const timeSinceOurChange = Date.now() - element._lastExtensionVolumeChange;
      if (timeSinceOurChange < 200) {
        return;
      }

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
      // Verify our setExtensionVolume method is still there
      if (!element.setExtensionVolume) {
        mediaElements.delete(element);
        trackMediaElement(element);
        return;
      }
      element.setExtensionVolume(currentVolume);
    });

    element.addEventListener('play', () => {
      if (!element.setExtensionVolume) {
        mediaElements.delete(element);
        trackMediaElement(element);
        return;
      }
      element.setExtensionVolume(currentVolume);
    });

    element.addEventListener('seeked', () => {
      if (!element.setExtensionVolume) {
        mediaElements.delete(element);
        trackMediaElement(element);
        return;
      }
      element.setExtensionVolume(currentVolume);
    });

    // Also add a canplay event to handle when video is ready
    element.addEventListener('canplay', () => {
      if (Math.abs(element.volume - currentVolume) > 0.01) {
        if (element.setExtensionVolume) {
          element.setExtensionVolume(currentVolume);
        }
      }
    });

    // Add playing event - fires when playback starts after being paused or delayed
    element.addEventListener('playing', () => {
      if (Math.abs(element.volume - currentVolume) > 0.01) {
        if (element.setExtensionVolume) {
          element.setExtensionVolume(currentVolume);
        }
      }
    });

    // Monitor volume property periodically while video is playing
    element.addEventListener('timeupdate', function volumeMonitor() {
      // Only check occasionally (every ~2 seconds)
      if (!this._lastVolumeCheck || Date.now() - this._lastVolumeCheck > 2000) {
        this._lastVolumeCheck = Date.now();
        if (Math.abs(this.volume - currentVolume) > 0.01) {
          if (this.setExtensionVolume) {
            this.setExtensionVolume(currentVolume);
          }
        }
      }
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
    const allMedia = document.querySelectorAll('video, audio');
    allMedia.forEach(trackMediaElement);
  }, 1000);

  // Apply volume settings from storage
  // Try to use the top-level page's domain for storage, but handle cross-origin restrictions
  let domain = window.location.hostname;
  let isInIframe = false;
  let isCrossOriginIframe = false;

  try {
    if (window.top !== window) {
      isInIframe = true;
      // Try to access parent domain - this will throw SecurityError if cross-origin
      domain = window.top.location.hostname;
    }
  } catch (e) {
    // Cross-origin iframe - ask background script for the top-level domain
    console.log('[Volume Control] Cross-origin iframe detected, asking background for top-level domain');
    isInIframe = true;
    isCrossOriginIframe = true;
  }

  // Function to load and apply volume settings
  function loadVolumeSettings(domainToUse) {
    console.log('[Volume Control] Initializing for domain:', domainToUse, isInIframe ? (isCrossOriginIframe ? '(cross-origin iframe)' : '(iframe)') : '(main page)');
    browser.storage.local.get(domainToUse).then(result => {
      // Fix: Handle 0 volume correctly (0 is falsy, so use explicit undefined check)
      const volume = result[domainToUse] !== undefined ? result[domainToUse] : 100;
      console.log('[Volume Control] Loaded volume from storage:', volume, 'for domain:', domainToUse);
      currentVolume = volume / 100;
      volumeInitialized = true;

      // Apply to all existing media elements
      setPageVolume(currentVolume);

      // Also scan for any media elements that might have been added before storage loaded
      const elements = document.querySelectorAll('video, audio');
      console.log('[Volume Control] Found', elements.length, 'media elements on page');
      elements.forEach(trackMediaElement);
    });
  }

  // If cross-origin iframe, ask background script for the domain
  if (isCrossOriginIframe) {
    browser.runtime.sendMessage({ command: 'getTopLevelDomain' }).then(response => {
      if (response && response.domain) {
        domain = response.domain;
        console.log('[Volume Control] Background provided top-level domain:', domain);
        loadVolumeSettings(domain);
      } else {
        // Fallback to own domain if we can't get the top-level domain
        console.log('[Volume Control] Could not get top-level domain, using own:', domain);
        loadVolumeSettings(domain);
      }
    }).catch(err => {
      console.error('[Volume Control] Error getting top-level domain:', err);
      loadVolumeSettings(domain);
    });
  } else {
    // Not a cross-origin iframe, use the domain we already have
    loadVolumeSettings(domain);
  }

  // Listen for volume change commands
  browser.runtime.onMessage.addListener((message) => {
    if (message.command === 'setVolume') {
      console.log('[Volume Control] Received setVolume command:', message.volume);
      setPageVolume(message.volume);
    }
  });

  function setPageVolume(volume) {
    console.log('[Volume Control] setPageVolume called, volume:', volume, 'media elements:', mediaElements.size, 'gain nodes:', gainNodes.size);
    currentVolume = volume;

    // Update HTMLMediaElement volumes
    for (const media of mediaElements) {
      // Verify element is still in the document
      if (!document.contains(media)) {
        mediaElements.delete(media);
        continue;
      }

      if (media.setExtensionVolume) {
        console.log('[Volume Control] Setting volume on element via setExtensionVolume:', volume);
        media.setExtensionVolume(volume);
      } else {
        console.log('[Volume Control] Setting volume on element directly:', volume);
        media.volume = volume;
      }
    }

    // Update Web Audio API GainNode values
    for (const gainNode of gainNodes) {
      if (gainNode._originalGainValue !== undefined) {
        const newValue = gainNode._originalGainValue * currentVolume;
        console.log('[Volume Control] Updating GainNode from', gainNode.gain.value, 'to', newValue);
        // We need to use the original setter to bypass our interception
        const descriptor = Object.getOwnPropertyDescriptor(gainNode.gain.__proto__, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(gainNode.gain, newValue);
        }
      }
    }
  }

  // Don't scan for initial media elements here - wait for storage to load first
  // The storage.get callback will scan for media elements after volume is initialized
}