# 📸 Perfect Screenshot Capture Guide

## ⚠️ CRITICAL: What NOT to Capture

- ❌ **DO NOT** capture "Metrics Unavailable" error state
- ❌ **DO NOT** capture empty file browser
- ❌ **DO NOT** capture onboarding tour overlays
- ❌ **DO NOT** capture error dialogs

## ✅ What TO Capture

### 1. vfs-main-dark-latest.png (PRIMARY)

**Requirements:**

- **Tab**: Files tab active (NOT Metrics, NOT Settings)
- **Content**: File browser showing actual files/folders
  - Sidebar: Favorites, Storage locations visible
  - Main area: List of files with columns (Name, Date Modified, Size, Tier)
  - Files should be visible (not empty)
- **Header**: Files | Metrics | Settings tabs (Files highlighted)
- **Bottom Toolbar**: Shortcuts | Search (2 buttons only, NO Theme button)
- **Theme**: Dark mode active
- **NO onboarding tour**: Press Escape or click "Skip tour" if visible
- **NO errors**: Ensure app is fully loaded

**How to prepare:**

1. Start app: `npm run start:vfs`
2. Wait for app to fully load
3. Navigate to Files tab
4. Ensure files are visible in main area
5. Close any modals/dialogs
6. Dismiss onboarding if it appears
7. Capture screenshot

---

### 2. vfs-performance-metrics-latest.png (CRITICAL FIX)

**Requirements:**

- **Tab**: Metrics tab active (highlighted in header)
- **Content**: ACTUAL METRICS DASHBOARD (NOT "Metrics Unavailable")
  - CPU metrics visible (cores, usage percentages)
  - GPU metrics visible (temperature, usage, etc.)
  - RAM metrics visible (usage, available)
  - Disk I/O metrics visible
  - Network metrics visible
  - System load averages visible
- **Header**: Files | Metrics | Settings tabs (Metrics highlighted)
- **Bottom Toolbar**: Shortcuts | Search (2 buttons)
- **Theme**: Dark mode active
- **NO error messages**: Metrics MUST be showing actual data
- **NO onboarding tour**: Dismiss if visible

**How to prepare:**

1. Start app: `npm run start:vfs`
2. Wait for app to fully load AND metrics to populate
3. Click Metrics tab in header
4. **WAIT** until metrics dashboard shows actual data (not "Metrics Unavailable")
5. If metrics don't load, check:
   - App is running as Tauri (not browser)
   - Permissions granted (macOS: System Preferences > Privacy)
   - System info collection is working
6. Capture screenshot ONLY when metrics are visible

---

### 3. vfs-settings-dark-latest.png (NEW)

**Requirements:**

- **Tab**: Settings tab active (highlighted in header)
- **Content**: Settings page showing:
  - Theme Mode toggle (Dark/Light)
  - Accent Color grid (10 color swatches visible)
  - Selected color display
  - Onboarding section (Start Feature Tour, Reset buttons)
- **Header**: Files | Metrics | Settings tabs (Settings highlighted)
- **Bottom Toolbar**: Shortcuts | Search (2 buttons)
- **Theme**: Dark mode active
- **NO onboarding tour**: Dismiss if visible

**How to prepare:**

1. Start app: `npm run start:vfs`
2. Click Settings tab in header
3. Ensure all settings options are visible
4. Capture screenshot

---

### 4. vfs-keyboard-shortcuts-latest.png

**Requirements:**

- **Dialog**: Keyboard Shortcuts dialog open (press `?` key)
- **Content**: Shortcuts dialog showing:
  - All shortcut categories visible
  - Keyboard shortcuts listed
  - Close button visible
- **Background**: App visible behind dialog (blurred overlay)
- **Theme**: Dark mode active

**How to prepare:**

1. Start app: `npm run start:vfs`
2. Press `?` key to open shortcuts dialog
3. Ensure dialog is fully visible
4. Capture screenshot

---

### 5. vfs-add-storage-dark-latest.png

**Requirements:**

- **Modal**: Add Storage modal open
- **Content**: Modal showing:
  - Storage provider options (AWS S3, Azure, Google Cloud, etc.)
  - Connection form fields
  - Add/Cancel buttons
- **Background**: App visible behind modal (blurred overlay)
- **Theme**: Dark mode active

**How to prepare:**

1. Start app: `npm run start:vfs`
2. Click "+ Add Storage" in sidebar
3. Ensure modal is fully visible
4. Capture screenshot

---

## 🎯 Pre-Capture Checklist

Before capturing ANY screenshot:

- [ ] App is running (`npm run start:vfs`)
- [ ] App is Tauri (not browser) - check window title shows "Ursly VFS"
- [ ] Dark theme is active
- [ ] No onboarding tour visible (press Escape or "Skip tour")
- [ ] No error dialogs visible
- [ ] App is fully loaded (wait 2-3 seconds after startup)
- [ ] Content is visible (not empty/loading states)
- [ ] Bottom toolbar shows: Shortcuts | Search (2 buttons only)
- [ ] Header shows: Files | Metrics | Settings tabs

## 📋 Screenshot Quality Requirements

- **Resolution**: High resolution (at least 1920x1080 or Retina)
- **Format**: PNG (lossless)
- **Quality**: Crisp, clear text (no blur)
- **Composition**: Centered, well-framed
- **No artifacts**: No UI glitches, no partial renders

## 🚨 Common Mistakes to Avoid

1. ❌ Capturing "Metrics Unavailable" instead of actual metrics
2. ❌ Capturing empty file browser
3. ❌ Capturing with onboarding tour overlay
4. ❌ Capturing error states
5. ❌ Capturing wrong tab (e.g., Files tab when should be Metrics)
6. ❌ Capturing with Theme button in bottom toolbar (old UI)
7. ❌ Capturing with missing Settings tab in header

## ✅ Verification After Capture

Before saving screenshots, verify:

- [ ] Screenshot shows correct tab/content
- [ ] Bottom toolbar has 2 buttons (Shortcuts | Search)
- [ ] Header has 3 tabs (Files | Metrics | Settings)
- [ ] No error messages visible
- [ ] Content is populated (not empty/loading)
- [ ] Dark theme is active
- [ ] High quality, crisp image

## 📁 File Locations

Save screenshots to:

```
website/screenshots/
├── vfs-main-dark-latest.png
├── vfs-performance-metrics-latest.png
├── vfs-settings-dark-latest.png
├── vfs-keyboard-shortcuts-latest.png
└── vfs-add-storage-dark-latest.png
```

## 🔄 After Capturing

1. Replace old files in `website/screenshots/`
2. Verify images load correctly
3. Commit changes: `git add website/screenshots/*.png && git commit -m "chore: update screenshots with latest UI"`
4. Push to remote

---

**Remember**: The website represents your product. Screenshots MUST show the app working perfectly, not error states!
