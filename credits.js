const photos = globalThis.FELDMAN_PHOTOS || [];
const list = document.querySelector('#list');
document.querySelector('#count').textContent = photos.length;

for (const photo of photos) {
  const item = document.createElement('li');

  const thumb = document.createElement('img');
  thumb.src = `images/${photo.file}`;
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.style.objectPosition = photo.focus;

  const text = document.createElement('div');
  const title = document.createElement('a');
  title.href = photo.source;
  title.textContent = photo.title;

  const meta = document.createElement('span');
  const license = document.createElement('a');
  license.href = photo.licenseUrl;
  license.textContent = photo.license;
  meta.append(`${photo.author} · `, license);

  text.append(title, meta);
  item.append(thumb, text);
  list.append(item);
}
