# Feldmanizer

A Chrome extension that replaces every picture on every webpage with a random photo of Corey Feldman.

It swaps regular images, responsive images (`srcset` and `<picture>`), CSS background images, and anything a page loads later, such as infinite scroll, lazy-loaded images and carousels. Each replacement is cropped to the original picture's exact size and shape, so page layouts don't shift, and the crop is centred on his face. Original pictures are hidden until they're swapped, so they never flash on screen.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder.
4. Optional: pin the extension from the puzzle-piece menu so the popup is one click away.

Pages that are already open will update after you reload them.

## Use

Click the extension icon to open the popup:

- **Replace pictures** switches it on and off. Open tabs update immediately, and switching it off puts the original pictures back.
- **Shuffle photos** picks new random photos on every open tab.
- **Credits** lists every photo with its photographer and license.

Limits:

- Chrome doesn't let extensions change `chrome://` pages or the Chrome Web Store.
- On local `file://` pages, it only works after you turn on **Allow access to file URLs** in the extension's details.

## The photos

There are 36 photos, all Creative Commons licensed, from Wikimedia Commons and Flickr. They were resized and nothing else was changed. To credit the photographers as their licenses require, `credits.html` lists each photo's author, license and source. Open it from the popup.

Four photos (`feldman-033.jpg` to `feldman-036.jpg`) are **CC BY-NC**: non-commercial use only. Delete those files and their entries in `photos.js` if you ever sell or monetize the extension. The other 32 allow any use with attribution. Photos licensed "No Derivatives" were left out.

### Adding your own

1. Put the image in `images/`.
2. Add an entry to `photos.js`:

```js
{"file": "my-photo.jpg", "focus": "50% 30%", "title": "…", "author": "…", "license": "…", "licenseUrl": "…", "source": "…"},
```

`focus` says where his face is in the photo, as a CSS position: `"50% 30%"` means halfway across and 30% of the way down. The popup count and the credits page pick up new entries automatically. Reload the extension in `chrome://extensions` after changing files.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Extension setup (Manifest V3). The only permission is `storage`, for the on/off switch. |
| `content.js` | Runs on every page and swaps the pictures. |
| `content.css` | Hides original pictures until they've been swapped. |
| `photos.js` | The photo list: file, face position and credits. |
| `popup.html`, `popup.css`, `popup.js` | The toolbar popup. |
| `credits.html`, `credits.js` | The photo credits page. |
| `images/` | The 36 photos. |
| `icons/` | Toolbar and extensions-page icons. |
