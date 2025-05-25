# Domain Volume Control

Control and remember volume settings per domain in Firefox.

## Features

- **Per-domain volume control**: Set different volume levels for different websites
- **Persistent settings**: Volume levels are remembered across browser sessions
- **Domain exclusion**: Exclude specific domains from volume control
- **Easy management**: Add or remove domain exclusions through the popup interface
- **Automatic application**: Volume settings are applied instantly when visiting a domain

## Usage

1. Click the extension icon while on any website
2. Adjust the volume slider to your preferred level for that domain
3. Use "Exclude this domain" to disable volume control for the current site
4. Use "Include this domain" to re-enable volume control for excluded sites
5. View and manage all excluded domains in the settings section

## Default Exclusions

By default, YouTube domains (youtube.com and its subdomains) are excluded from volume control to avoid conflicts with YouTube's native volume controls.

## Installation

### Method 1: Install from Firefox Add-ons (Recommended)

Install directly from the official Firefox Add-ons catalog:
**[Domain Volume Control on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/domain-volume-control/)**

### Method 2: Load as Temporary Extension (For Testing/Development)

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to your extension folder and select the `manifest.json` file
5. The extension will be loaded and active until you restart Firefox

### Method 3: Package and Install

1. Run `package.bat` (Windows) or `package.ps1` (PowerShell) to create an XPI file
2. Drag and drop the generated `.xpi` file into Firefox to install
3. Or use `about:addons` → "Install Add-on From File" → select the `.xpi` file

### Method 4: Manual ZIP Package

1. Create a ZIP file containing: `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `icon.svg`
2. Rename the `.zip` file to `.xpi`
3. Drag and drop the `.xpi` file into Firefox to install

## Testing

1. Load the extension using one of the methods above
2. Navigate to any website with audio/video content (e.g., news sites, streaming sites)
3. Click the extension icon in the toolbar
4. Test the volume controls and domain exclusion features
5. Visit YouTube to verify it's excluded by default
6. Try excluding/including other domains to test the functionality
7. Add multiple domains to test the collapsible excluded domains list
