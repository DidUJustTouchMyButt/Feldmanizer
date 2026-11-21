// Feldmanizer: swaps every picture on the page for a random photo of Corey Feldman.
//
// Covers <img> (including srcset and <picture>), CSS background images, and anything
// added to the page later. Turning the extension off puts the original pictures back.

(() => {
  'use strict';

  // The photo list lives in photos.js, which loads just before this script.
  const PHOTOS = (globalThis.FELDMAN_PHOTOS || []).map((photo) => ({
    url: chrome.runtime.getURL(`images/${photo.file}`),
    focus: photo.focus || '50% 30%',
  }));
  if (!PHOTOS.length) return;
  const OURS = chrome.runtime.getURL('images/');
  const MARK = 'data-feldman';      // on every element we've changed: "loading" | "img" | "bg" | "source"
  const OFF = 'data-feldman-off';   // on <html> while the extension is switched off
  const BATCH = 250;                // elements handled per animation frame

  const saved = new WeakMap();      // element -> what its attributes/styles were before we touched it
  const waiting = new WeakSet();    // images whose original is still loading
  const queue = new Set();
  let enabled = false;
  let scheduled = false;

  const pick = () => PHOTOS[Math.floor(Math.random() * PHOTOS.length)];
  const isOurs = (value) => typeof value === 'string' && value.includes(OURS);

  // ---- Remembering originals so we can restore them ------------------------------------

  function record(el) {
    let rec = saved.get(el);
    if (!rec) {
      rec = { attrs: {}, styles: {} };
      saved.set(el, rec);
    }
    return rec;
  }

  // Remember an attribute the first time we change it.
  function saveAttr(rec, el, name) {
    if (!(name in rec.attrs)) rec.attrs[name] = el.getAttribute(name);
  }

  // Remember an attribute the page controls (src, srcset): take the page's newest value,
  // but never our own photo.
  function savePageAttr(rec, el, name) {
    const value = el.getAttribute(name);
    if (!isOurs(value)) rec.attrs[name] = value;
    else if (!(name in rec.attrs)) rec.attrs[name] = null;
  }

  function setStyle(rec, el, prop, value) {
    const current = el.style.getPropertyValue(prop);
    if (!(prop in rec.styles) || (prop === 'background-image' && !isOurs(current))) {
      rec.styles[prop] = [current, el.style.getPropertyPriority(prop)];
    }
    el.style.setProperty(prop, value, 'important');
  }

  function restore(el) {
    const rec = saved.get(el);
    if (rec) {
      for (const [name, value] of Object.entries(rec.attrs)) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      for (const [prop, [value, priority]] of Object.entries(rec.styles)) {
        if (value) el.style.setProperty(prop, value, priority);
        else el.style.removeProperty(prop);
      }
      saved.delete(el);
    }
    el.removeAttribute(MARK);
  }

  // ---- <img> ---------------------------------------------------------------------------

  function waitForLoad(img) {
    if (waiting.has(img)) return;
    waiting.add(img);
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      waiting.delete(img);
      enqueueOne(img);
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  }

  function reveal(img) {
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      if (img.getAttribute(MARK) === 'loading') img.setAttribute(MARK, 'img');
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  }

  function swapImg(img) {
    const picture = img.parentElement instanceof HTMLPictureElement ? img.parentElement : null;
    const sources = picture ? [...picture.querySelectorAll(':scope > source[srcset]')] : [];
    if (isOurs(img.getAttribute('src')) && !img.hasAttribute('srcset') && sources.length === 0) return;

    // The page put a new picture in an image we'd already swapped: hide it again.
    if (img.hasAttribute(MARK)) img.setAttribute(MARK, 'loading');

    // We need the original's shape to keep the layout identical. Use the loaded picture's size,
    // or the width/height attributes if both are set; otherwise wait for the original to load.
    let w = 0;
    let h = 0;
    if (img.complete) {
      w = img.naturalWidth;
      h = img.naturalHeight;
    } else {
      w = Number(img.getAttribute('width'));
      h = Number(img.getAttribute('height'));
      if (!(w > 0 && h > 0)) {
        waitForLoad(img);
        return;
      }
    }

    const rec = record(img);
    for (const name of ['src', 'srcset', 'sizes']) savePageAttr(rec, img, name);

    for (const source of sources) {
      savePageAttr(record(source), source, 'srcset');
      source.removeAttribute('srcset');
      source.setAttribute(MARK, 'source');
    }

    if (w && h) {
      // Lock the box to the original picture's size and shape; the photo is cropped to fit.
      saveAttr(rec, img, 'width');
      saveAttr(rec, img, 'height');
      const origW = rec.attrs.width;
      const origH = rec.attrs.height;
      if (origW === null && origH === null) {
        img.setAttribute('width', w);
        img.setAttribute('height', h);
      } else if (origH === null) {
        img.setAttribute('height', Math.round((parseFloat(origW) * h) / w) || h);
      } else if (origW === null) {
        img.setAttribute('width', Math.round((parseFloat(origH) * w) / h) || w);
      }
      setStyle(rec, img, 'aspect-ratio', `${w} / ${h}`);
    }
    const photo = pick();
    setStyle(rec, img, 'object-fit', 'cover');
    setStyle(rec, img, 'object-position', photo.focus);

    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.setAttribute(MARK, 'loading');
    reveal(img);
    img.src = photo.url;
  }

  // ---- CSS background images -------------------------------------------------------------

  function hasPageBackground(el) {
    const bg = getComputedStyle(el).backgroundImage;
    return bg !== 'none' && bg.includes('url(') && !isOurs(bg);
  }

  function swapBackground(el) {
    const rec = record(el);
    const photo = pick();
    setStyle(rec, el, 'background-image', `url("${photo.url}")`);
    setStyle(rec, el, 'background-size', 'cover');
    setStyle(rec, el, 'background-position', photo.focus);
    setStyle(rec, el, 'background-repeat', 'no-repeat');
    el.setAttribute(MARK, 'bg');
  }

  // ---- Work queue: handle elements in small batches so the page stays responsive ----------

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  }

  function enqueueOne(el) {
    queue.add(el);
    schedule();
  }

  function enqueueTree(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    queue.add(node);
    for (const el of node.getElementsByTagName('*')) queue.add(el);
    schedule();
  }

  function flush() {
    scheduled = false;
    if (!enabled) {
      queue.clear();
      return;
    }

    const batch = [];
    for (const el of queue) {
      queue.delete(el);
      if (el.isConnected) batch.push(el);
      if (batch.length >= BATCH) break;
    }

    // Read everything first, then write, so the browser recalculates styles once per batch.
    const images = new Set();
    const backgrounds = [];
    for (const el of batch) {
      if (el instanceof HTMLImageElement) images.add(el);
      else if (el instanceof HTMLSourceElement) {
        const img = el.parentElement?.querySelector(':scope > img');
        if (img) images.add(img);
      } else if (hasPageBackground(el)) backgrounds.push(el);
    }
    for (const img of images) swapImg(img);
    for (const el of backgrounds) swapBackground(el);

    if (queue.size) schedule();
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') m.addedNodes.forEach(enqueueTree);
      else enqueueOne(m.target);
    }
  });

  // ---- On / off / shuffle ----------------------------------------------------------------

  function start() {
    if (enabled) return;
    enabled = true;
    document.documentElement.removeAttribute(OFF);
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'style'],
    });
    enqueueTree(document.documentElement);
  }

  function stop() {
    enabled = false;
    observer.disconnect();
    queue.clear();
    document.documentElement.setAttribute(OFF, '');
    for (const el of document.querySelectorAll(`[${MARK}]`)) restore(el);
  }

  function shuffle() {
    for (const el of document.querySelectorAll(`[${MARK}]`)) {
      const kind = el.getAttribute(MARK);
      const photo = pick();
      if ((kind === 'img' || kind === 'loading') && isOurs(el.getAttribute('src'))) {
        el.style.setProperty('object-position', photo.focus, 'important');
        el.src = photo.url;
      } else if (kind === 'bg') {
        el.style.setProperty('background-image', `url("${photo.url}")`, 'important');
        el.style.setProperty('background-position', photo.focus, 'important');
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) {
      if (changes.enabled.newValue === false) stop();
      else start();
    }
    if (changes.shuffle && enabled) shuffle();
  });

  (async () => {
    let on = true;
    try {
      ({ enabled: on = true } = await chrome.storage.local.get('enabled'));
    } catch (err) {
      console.warn('Feldmanizer: could not read settings, staying on.', err);
    }
    if (on) start();
    else stop();
  })();
})();
