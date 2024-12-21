// background.js
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.command === 'volumeChanged') {
    const domain = new URL(sender.tab.url).hostname;
    browser.storage.local.set({
      [domain]: message.volume
    });
  }
});