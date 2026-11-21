const toggle = document.querySelector('#enabled');
const shuffle = document.querySelector('#shuffle');
document.querySelector('#count').textContent = (globalThis.FELDMAN_PHOTOS || []).length;

try {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  toggle.checked = enabled;
  shuffle.disabled = !enabled;
} catch (err) {
  console.error('Feldmanizer: could not read settings', err);
}

// Open tabs listen for these storage changes and update right away.
toggle.addEventListener('change', async () => {
  shuffle.disabled = !toggle.checked;
  try {
    await chrome.storage.local.set({ enabled: toggle.checked });
  } catch (err) {
    console.error('Feldmanizer: could not save setting', err);
  }
});

shuffle.addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ shuffle: Date.now() });
  } catch (err) {
    console.error('Feldmanizer: could not shuffle', err);
  }
});
