(() => {
 const root = document.querySelector('[data-de-products]');
 if (!root) return;
 const grid = root.querySelector('[data-de-grid]');
 const search = root.querySelector('[data-de-search]');
 const group = root.querySelector('[data-de-group]');
 const status = root.querySelector('[data-de-status]');
 let all = [];
 const money = (value) => {
   const n = Number(value);
   return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat('sr-RS',{style:'currency',currency:'RSD',maximumFractionDigits:0}).format(n) : 'Cena na upit';
 };
 const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const imageUrl = (p) => {
   const image = p.image || (Array.isArray(p.images) && p.images[0]) || '';
   if (!image) return '';
   if (/^https?:\/\//i.test(image) || image.startsWith('/')) return image;
   return image.startsWith('media/') ? '/' + image : '/media/' + image.replace(/^\/+/, '');
 };
 function render() {
   const q = (search?.value || '').trim().toLocaleLowerCase('sr');
   const g = group?.value || '';
   const filtered = all.filter(p => {
     const hay = [p.name,p.sku,p.barcode,p.brand,p.description,p.group].join(' ').toLocaleLowerCase('sr');
     return (!q || hay.includes(q)) && (!g || String(p.group || '') === g);
   });
   grid.innerHTML = filtered.map(p => {
     const img = imageUrl(p);
     return `<article class="de-product"><div class="de-product-image">${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(p.name)}" onerror="this.style.display='none'">` : `<span class="de-stock">DOM EXTRA</span>`}</div><div class="de-product-body"><h3>${esc(p.name)}</h3><div class="sku">Šifra: ${esc(p.sku || p.id || '—')}</div><div class="de-price">${money(p.mpPrice ?? p.mp_price)}</div><div class="de-stock">${Number(p.stock) > 0 ? 'Dostupno: ' + esc(p.stock) : 'Proverite dostupnost'}</div></div></article>`;
   }).join('') || '<div class="de-empty">Nema proizvoda za izabrane kriterijume.</div>';
   if(status) status.textContent = `Prikazano ${filtered.length} proizvoda`;
 }
 async function load() {
   try {
     const response = await fetch('/api/public', {headers:{Accept:'application/json'}});
     if (!response.ok) throw new Error('API je vratio ' + response.status);
     const data = await response.json();
     all = Array.isArray(data.products) ? data.products : [];
     const groups = Array.isArray(data.groups) ? data.groups : [];
     if(group) group.innerHTML = '<option value="">Sve kategorije</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
     render();
   } catch (error) {
     if(status) status.textContent = 'Katalog trenutno nije dostupan. Proverite Django API.';
     grid.innerHTML = '<div class="de-notice">Nije moguće učitati proizvode. Proverite da li je Django backend pokrenut i da li baza sadrži proizvode.</div>';
   }
 }
 search?.addEventListener('input', render);
 group?.addEventListener('change', render);
 load();
})();