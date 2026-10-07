/* ═══════════ ANALITIKA (GA4 / Meta Pixel — placeholder) ═══════════ */
/* Aktiviraj zamenom 'GA_MEASUREMENT_ID' i 'PIXEL_ID' i otkomentarisanjem CDN skripti u <head>. */
window.dataLayer = window.dataLayer || [];
if(typeof gtag!=='function'){ window.gtag=function(){ dataLayer.push(arguments); }; }
function trackEvent(name, data){
  if(typeof gtag==='function') gtag('event', name, data||{});
  const fbMap={view_item:'ViewContent', add_to_cart:'AddToCart', begin_checkout:'InitiateCheckout', purchase:'Purchase', search:'Search', sign_up:'CompleteRegistration'};
  if(typeof fbq==='function' && fbMap[name]) fbq('track', fbMap[name], data||{});
  console.log('[Analitika]', name, data||{});
}



/* ================= DATA ================= */
const fmt = n => Number(n ?? 0).toLocaleString('sr-RS',{
  minimumFractionDigits:2,
  maximumFractionDigits:2
});

let courier={
  zones:[ // gornja granica težine (kg) → cena (RSD)
    {kg:1, cena:350}, {kg:2, cena:420}, {kg:5, cena:550},
    {kg:10, cena:750}, {kg:20, cena:1100}, {kg:50, cena:1800},
    {kg:100, cena:3200}
  ],
  preko:99999,           // iznad ove težine: "po dogovoru"
  freeFrom:50000,        // besplatna dostava preko ovog iznosa (RSD); 0 = isključeno
  defWeight:1            // podrazumevana težina po artiklu ako nije definisana (kg)
};
function courierFee(totalRSD, weightKg){
  if(courier.freeFrom>0 && totalRSD>=courier.freeFrom) return {fee:0, free:true, label:'besplatno (preko '+fmt(courier.freeFrom)+' RSD)'};
  const z=courier.zones.find(z=>weightKg<=z.kg);
  if(!z) return {fee:null, free:false, label:'po dogovoru (težina preko '+courier.zones[courier.zones.length-1].kg+' kg)'};
  return {fee:z.cena, free:false, label:'do '+z.kg+' kg'};
}
// težina stavke: kg je PO PAKOVANJU; količina je u JM → broj paketa × težina paketa
function lineWeight(p, qtyJM){
  const pak=p.pak||1;
  const paketa=Math.round((qtyJM/pak)*1000)/1000; // količina je već zaokružena na cela pakovanja
  return paketa*(p.kg||courier.defWeight);
}
const shopUsers=[
  {name:'Petar Petrović', mail:'petar@mail.com', pass:'petar123', phone:'064 123 4567',
   addresses:[{label:'Kuća', addr:'Cara Dušana 14', city:'Beograd', def:true}],
   addr:'Cara Dušana 14', city:'Beograd',
   history:[], wishlist:[], savedSearches:[]}
];
let currentShopUser=null;
let openProductId=null;
let compareList=[];               // poređenje proizvoda (do 3)
const reviews={                   // ocene po proizvodu
  101:[{user:'Marko M.', stars:5, text:'Postavljeno u dnevnoj sobi 35 m² — odličan kvalitet i mat finiš. Preporuka!', date:'2026-05-12', verified:true}],
  104:[{user:'Jelena S.', stars:4, text:'Lepa baterija, montaža jednostavna. Voda teče malo blago, ali u redu.', date:'2026-04-22', verified:true}]
};

// Pitanja i odgovori po proizvodu (Q&A)
const questions={
  101:[{user:'Stefan', q:'Da li je pločica pogodna za podno grejanje?', a:'Da, pločica je u potpunosti kompatibilna sa podnim grejanjem do 60°C.', date:'2026-05-08'}],
  103:[{user:'Milica', q:'Koliko m² pokriva jedan džak lepka?', a:'U proseku 3–5 m² u zavisnosti od debljine sloja. Za nazubljenu lopaticu 8 mm računajte oko 4 m²/džak.', date:'2026-04-15'}]
};

// Sezonski/marketing banner na vrhu shopa (admin podešava)
let saleBanner = {
  active: true,
  title: '🌞 LETNJA AKCIJA',
  text: 'Do 30. juna — pločice i sanitarija sa dodatnih do 15% popusta',
  cta: 'Pogledaj akcije',
  bg: '#0c0c0c'
};

// Lokacije maloprodaje
let locations = [
  {name:'DOM EXTRA — Centrala Beograd', addr:'Bulevar Oslobođenja 123, 11000 Beograd', phone:'+381 11 000 0000', hours:'Pon–Pet 08–17h · Sub 09–13h', lat:44.7866, lng:20.4489},
  {name:'DOM EXTRA — Novi Sad', addr:'Bulevar oslobođenja 88, 21000 Novi Sad', phone:'+381 21 000 0000', hours:'Pon–Pet 08–17h · Sub 09–13h', lat:45.2671, lng:19.8335}
];
// akcijaDo se nalazi na samom artiklu (polje p.akcijaDo)

const coupons=[
  {code:'DOBRODOSLI10', tip:'%', vred:10, minIznos:0, rok:'2026-12-31', iskoriscen:0, maxKor:1000, opis:'Dobrodošlica — 10% na prvu porudžbinu'},
  {code:'PLOCICE5000', tip:'RSD', vred:5000, minIznos:30000, rok:'2026-09-30', iskoriscen:0, maxKor:200, opis:'5.000 RSD popusta za porudžbine preko 30.000'}
];

/* B2B: stanje + rabati (akcijski/avansni/logistički po artiklu; redovni po klasi; poseban po kupcu) */

// Web Shop koristi mpCena; B2B koristi price (VP)
function isActiveShopSale(p){
  const rab=Number(p.rabAk||0);
  if(rab<=0) return false;
  if(p.akcijaDo){
    const until=new Date(p.akcijaDo).getTime();
    if(Number.isFinite(until) && until < Date.now()) return false;
  }
  return true;
}
function wsPrice(p){
  const base=Number(p.mpCena||p.price||0);
  return isActiveShopSale(p) ? Math.max(0,base*(1-Number(p.rabAk||0)/100)) : base;
}
const products = [
  {id:101, ico:'🧱', img:'', grupa:'Pločice', name:'Granitna pločica Stone Grey 60×60', desc:'Mat, rektifikovana, R10, I klasa', sku:'PL-6060-SG', bar:'8606107330014', jm:'m²', pak:1.44, pakNaziv:'kutija', price:2410, stock:1240.56, rabAv:3, rabAk:5, rabLog:2, kg:23, mpCena:2890, oldPrice:3290, akcijaDo:'2026-06-30T23:59:00', brand:'StoneTech', gallery:['🧱','🏛️','🪨','📐','✨'], isNew:false},
  {id:102, ico:'🪨', img:'', grupa:'Pločice', name:'Podna pločica Beton Look 80×80', desc:'Polirana, rektifikovana, II izbor', sku:'PL-8080-BL', bar:'8606107330021', jm:'m²', pak:1.28, pakNaziv:'kutija', price:3120, stock:85.76, rabAv:3, rabAk:0, rabLog:2, kg:25, mpCena:3590, brand:'StoneTech', gallery:['🪨','🏛️','🧱'], isNew:true, datumDodavanja:'2026-06-01'},
  {id:103, ico:'🪣', img:'', grupa:'Lepkovi i mase', name:'Lepak za pločice C2TE 25kg', desc:'Fleksibilni cementni lepak, klasa C2TE S1, paleta 48 džak.', sku:'LEP-C2TE-25', bar:'8606107330038', jm:'džak', pak:1, pakNaziv:'džak', price:920, stock:0, rabAv:3, rabAk:10, rabLog:3, kg:25, mpCena:1190, brand:'BauMix', gallery:['🪣','🧱','⚒️'], isNew:false},
  {id:104, ico:'🚰', img:'', grupa:'Sanitarija', name:'Baterija za lavabo hrom Premium', desc:'Jednoručna, keramički uložak 35mm, garancija 5 god.', sku:'BAT-LAV-PR', bar:'8606107330045', jm:'kom', pak:1, pakNaziv:'kom', price:5890, stock:34, rabAv:3, rabAk:0, rabLog:1, kg:1.5, mpCena:7490, brand:'AquaLux', gallery:['🚰','💧','🔧'], isNew:false},
  {id:105, ico:'🚽', img:'', grupa:'Sanitarija', name:'Konzolna WC šolja Rimless + daska', desc:'Soft-close daska, skrivena montaža, bela sjaj', sku:'WC-RIM-SET', bar:'8606107330052', jm:'set', pak:1, pakNaziv:'set', price:14200, stock:7, rabAv:3, rabAk:7, rabLog:1, kg:28, mpCena:18900, brand:'AquaLux', gallery:['🚽','🪑','✨'], isNew:true, datumDodavanja:'2026-05-20'},
  {id:106, ico:'🧴', img:'', grupa:'Lepkovi i mase', name:'Fug masa antracit 5kg', desc:'Vodoodbojna, za fuge 2–8 mm', sku:'FUG-ANT-5', bar:'8606107330069', jm:'kom', pak:4, pakNaziv:'kutija', price:1120, stock:0, rabAv:3, rabAk:0, rabLog:3, kg:5, mpCena:1490, brand:'BauMix', gallery:['🧴','🎨','🧱'], isNew:false},
];

window.domextraProducts = products;

const klasaRab = {A:25, B:20, C:15};   // redovni rabat po klasifikaciji kupca

const buyers = [
  {name:'Gradnja Komerc DOO', addr:'Futoška 112', city:'21000 Novi Sad',
   pib:'104882193', mb:'20291847', acc:'160-0000005551122-33',
   mail:'nabavka@gradnjakomerc.rs', klasa:'A', valuta:30, rabPos:2,
   user:'gradnja.komerc', pass:'gradnja2026', active:true},
  {name:'Keramika Plus DOO', addr:'Bulevar oslobođenja 41', city:'34000 Kragujevac',
   pib:'107334812', mb:'20887341', acc:'205-0000009988776-12',
   mail:'office@keramikaplus.rs', klasa:'B', valuta:15, rabPos:0,
   user:'keramika.plus', pass:'keramika2026', active:true}
];
let currentBuyer=null;
let b2bLogged=false;

const admin = {user:'admin', pass:'admin2026'};
let admLogged=false;
const orders = [];                      // evidencija formiranih predračuna

let shopCart = {};            // id -> qty
try{ shopCart=JSON.parse(localStorage.getItem('domextra_shop_cart')||'{}')||{}; }catch(e){ shopCart={}; }
window.domextraShopCart = shopCart;
function saveShopCart(){
  window.domextraShopCart = shopCart; try{ localStorage.setItem('domextra_shop_cart', JSON.stringify(shopCart)); }catch(e){} }
let b2bCart  = {};            // id -> requested qty
let docCtx   = null;          // za toast posle slanja
let docSeq   = 41;

/* ================= WEB SHOP ================= */
function renderShopGrid(){
  const gSel=document.getElementById('fGrupa');
  if(gSel && !gSel.options.length){
    gSel.innerHTML='<option value="">Sve grupe</option>'+[...new Set(products.map(p=>p.grupa))].map(g=>`<option>${g}</option>`).join('');
  }
  const q=(document.getElementById('fSearch')?.value||'').toLowerCase().trim();
  const gr=gSel?.value||'', sort=document.getElementById('fSort')?.value||'';
  const brandUrl=(new URLSearchParams(location.search).get('brend')||'').trim();
  const pMin=parseFloat(document.getElementById('fPriceMin')?.value)||0;
  const pMax=parseFloat(document.getElementById('fPriceMax')?.value)||Infinity;
  const onlyAkc=document.getElementById('chipAkc')?.classList.contains('on');
  const onlyNew=document.getElementById('chipNew')?.classList.contains('on');
  const onlyStock=document.getElementById('chipStock')?.classList.contains('on');
  let list=products.filter(p=>
    (!gr||p.grupa===gr) &&
    (!brandUrl||p.brand===brandUrl) &&
    (!q||String(p.name||'').toLowerCase().includes(q)||String(p.sku||'').toLowerCase().includes(q)) &&
    (wsPrice(p)>=pMin && wsPrice(p)<=pMax) &&
    (!onlyAkc || (isActiveShopSale(p) || (p.oldPrice&&p.oldPrice>wsPrice(p)))) &&
    (!onlyNew || p.isNew) &&
    (!onlyStock || (p.stock===undefined||p.stock>0))
  );
  if(sort==='pa') list=[...list].sort((a,b)=>wsPrice(a)-wsPrice(b));
  if(sort==='pd') list=[...list].sort((a,b)=>wsPrice(b)-wsPrice(a));
  if(sort==='nm') list=[...list].sort((a,b)=>a.name.localeCompare(b.name,'sr'));
  if(sort==='rt') list=[...list].sort((a,b)=>(avgRating(b.id)||0)-(avgRating(a.id)||0));
  if(sort==='nw') list=[...list].sort((a,b)=>(b.datumDodavanja||'').localeCompare(a.datumDodavanja||''));
  const countEl=document.getElementById('shopGridCount'); if(countEl) countEl.textContent=list.length+' od '+products.length+' artikala';
  const gridEl=document.getElementById('shopGrid'); if(!gridEl) return;
  gridEl.innerHTML = list.length ? list.map(p=>{
    const fav=currentShopUser&&currentShopUser.wishlist.includes(p.id);
    const akc=isActiveShopSale(p) || (p.oldPrice&&p.oldPrice>wsPrice(p));
    const outOfStock=p.stock!==undefined&&p.stock<=0;
    const avg=avgRating(p.id);
    const inComp=compareList.includes(p.id);
    return `
    <div class="p-item" onclick="openProduct(${JSON.stringify(p.id)})">
      <div class="p-badges">
        ${akc?'<span class="badge-akcija">AKCIJA</span>':''}
        ${p.isNew?'<span class="badge-new">NOVO</span>':''}
        ${outOfStock?'<span class="badge-out">Nema na stanju</span>':''}
      </div>
      <div class="p-card-actions">
        <button class="fav-btn ${fav?'on':''}" onclick="event.stopPropagation();toggleWishlist(${JSON.stringify(p.id)})" title="Lista želja">${fav?'♥':'♡'}</button>
        <button class="fav-btn ${inComp?'on':''}" onclick="event.stopPropagation();toggleCompare(${JSON.stringify(p.id)})" title="Dodaj u poređenje" style="${inComp?'color:var(--ink);border-color:var(--ink);background:#fcfff2':''}">⇄</button>
      </div>
      ${prodImg(p,'p-img')}
      <h3>${p.name}</h3>
      <div class="p-meta">${p.sku} · ${p.grupa}${avg?'<br>'+starsHTML(avg,11)+' '+avg.toFixed(1):''}${pakInfo(p)?'<br>'+pakInfo(p):''}</div>
      <div class="p-price">${akc?`<small style="text-decoration:line-through;color:var(--muted);font-weight:500">${fmt(p.oldPrice)}</small> `:''}${fmt(wsPrice(p))} <small>RSD/${p.jm}</small></div>
      <button class="add-btn" data-product-id="${String(p.id).replace(/\"/g, "&quot;")}" onclick='event.stopPropagation();window.shopAdd(${JSON.stringify(p.id)})' ${outOfStock?'disabled style="opacity:.4;cursor:not-allowed"':''}>${outOfStock?'Nedostupno':'Dodaj u porudžbinu'}</button>
    </div>`;}).join('') : '<div class="empty" style="grid-column:1/-1">Nema artikala za zadate filtere.</div>';
}
function renderHero(){
  const el=document.getElementById('heroSections'); if(!el) return;
  const akcije = products.filter(p=>p.oldPrice&&p.oldPrice>wsPrice(p)).slice(0,4);
  const novo = products.filter(p=>p.isNew).slice(0,4);
  // najprodavanije: zbir količina iz svih realizovanih/plaćenih shop porudžbina
  const sales={};
  orders.filter(o=>o.type==='SHOP').forEach(o=>(o.items||[]).forEach(it=>{sales[it.id]=(sales[it.id]||0)+it.qty;}));
  let top = products.filter(p=>sales[p.id]).sort((a,b)=>sales[b.id]-sales[a.id]).slice(0,4);
  if(top.length<3) top = [...products].sort((a,b)=>(avgRating(b.id)||0)-(avgRating(a.id)||0)).slice(0,4);
  const sectionHTML=(title, icon, list, cls)=>list.length?`
    <div class="hero-section ${cls||''}">
      <div class="hero-h"><span class="hero-ico">${icon}</span><h2>${title}</h2></div>
      <div class="hero-grid">${list.map(p=>{
        const akc=isActiveShopSale(p) || (p.oldPrice&&p.oldPrice>wsPrice(p));
        const out=p.stock!==undefined&&p.stock<=0;
        return `<div class="hero-item" onclick="openProduct(${JSON.stringify(p.id)})">
          ${prodImg(p,'hero-img')}
          <div class="hero-name">${p.name}</div>
          <div class="hero-price">${akc?`<small style="text-decoration:line-through;color:var(--muted)">${fmt(p.oldPrice)}</small> `:''}<b>${fmt(wsPrice(p))}</b> <small>RSD/${p.jm}</small></div>
        </div>`;}).join('')}</div>
    </div>`:'';
  // Newsletter card
  const subscribed = currentShopUser?.newsletter;
  const newsletter = `
    <div class="newsletter">
      <div class="nl-text">
        <h3>📬 Prijavite se na newsletter</h3>
        <p>${subscribed?'Hvala što ste prijavljeni — primaćete obaveštenja o akcijama i novim proizvodima.':'Dobićete kod <span class="mono"><b>NEW10</b></span> za <b>10% popusta</b> na prvu porudžbinu, plus obaveštenja o akcijama.'}</p>
      </div>
      ${!subscribed?`<div class="nl-form">
        <input id="nlMail" type="email" placeholder="vasa@email.com" value="${currentShopUser?currentShopUser.mail:''}">
        <button class="cta" style="margin:0;padding:12px 22px" onclick="subscribeNewsletter()">Prijavi se</button>
      </div>`:''}
    </div>`;
  el.innerHTML = sectionHTML('Akcija — pohitajte!', '🔥', akcije, 'hero-akc')
              + sectionHTML('Novo u ponudi', '✨', novo, 'hero-new')
              + sectionHTML('Najprodavanije', '⭐', top, 'hero-top')
              + newsletter;
}
function subscribeNewsletter(){
  const mail=document.getElementById('nlMail').value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){ toast('Unesite ispravan e-mail.'); return; }
  if(currentShopUser) currentShopUser.newsletter=true;
  if(!coupons.find(c=>c.code==='NEW10')){
    coupons.push({code:'NEW10', tip:'%', vred:10, minIznos:0, rok:'2026-12-31', iskoriscen:0, maxKor:99999, opis:'Newsletter — 10% prva porudžbina'});
  }
  toast('Hvala! Kod NEW10 za 10% popusta važi do isteka prve porudžbine.');
  renderHero();
}

/* ---- PRAVNE STRANICE ---- */
const legalPages={
  uslovi:{title:'Uslovi prodaje', html:`
    <h2>Uslovi prodaje</h2>
    <h3>1. Opšte odredbe</h3>
    <p>Ovi uslovi prodaje regulišu uslove kupovine putem web sajta. Naručivanjem proizvoda potvrđujete da ste saglasni sa uslovima.</p>
    <h3>2. Cene i plaćanje</h3>
    <p>Sve cene iskazane su u dinarima (RSD) sa uračunatim PDV-om. Plaćanje je moguće: pouzećem, IPS skeniraj, platnom karticom (Visa, Mastercard, DinaCard) i opštom uplatnicom po predračunu.</p>
    <h3>3. Isporuka</h3>
    <p>Isporuka se vrši kurirskom službom, dostavom sopstvenim vozilom ili ličnim preuzimanjem u maloprodaji. Rok isporuke je 2–5 radnih dana u zavisnosti od područja.</p>
    <h3>4. Pravo na odustanak</h3>
    <p>U skladu sa Zakonom o zaštiti potrošača, potrošač ima pravo da odustane od ugovora zaključenog na daljinu, bez navođenja razloga, u roku od <b>14 dana</b> od dana isporuke.</p>
    <h3>5. Garancija</h3>
    <p>Garancija na proizvode je usklađena sa Zakonom o zaštiti potrošača i dodatnom garancijom proizvođača koja se navodi za svaki artikal pojedinačno.</p>`},
  reklamacije:{title:'Reklamacije i povraćaj', html:`
    <h2>Reklamacije i povraćaj robe</h2>
    <h3>Reklamacija</h3>
    <p>Reklamaciju možete podneti u roku od <b>2 godine</b> od kupovine, na adresu sedišta ili e-mailom na <b>reklamacije@domextra.net</b>. Potrebno je priložiti račun ili predračun.</p>
    <h3>Postupak povraćaja</h3>
    <ol>
      <li>Popunite obrazac za reklamaciju (preuzima se sa sajta ili dobija u objektu)</li>
      <li>Robu spakujte u originalno pakovanje i priložite kopiju računa</li>
      <li>Pošaljite robu na adresu naše firme ili predajte u maloprodajni objekat</li>
      <li>Pisani odgovor na reklamaciju dobijate u roku od <b>8 dana</b></li>
      <li>Rok za rešavanje reklamacije je <b>15 dana</b> od dana prijema (30 dana za tehničku robu)</li>
    </ol>
    <h3>Povraćaj novca</h3>
    <p>U slučaju opravdane reklamacije, novac se vraća na isti način na koji je plaćanje izvršeno, u roku od 14 dana od prihvatanja reklamacije.</p>`},
  privatnost:{title:'Politika privatnosti', html:`
    <h2>Politika privatnosti i zaštita podataka</h2>
    <p>U skladu sa Zakonom o zaštiti podataka o ličnosti, obavezujemo se da ćemo čuvati privatnost svih korisnika.</p>
    <h3>Koji podaci se prikupljaju</h3>
    <ul>
      <li>Ime i prezime, e-mail adresa, broj telefona, adresa za isporuku — radi obrade porudžbine</li>
      <li>Podaci o kupovini — radi vođenja istorije, garancije i reklamacija</li>
      <li>Tehnički podaci (IP, kolačići) — radi rada sajta</li>
    </ul>
    <h3>Kako se podaci koriste</h3>
    <p>Vaši podaci se koriste isključivo za realizaciju porudžbine i komunikaciju u vezi sa njom. Ne prosleđujemo ih trećim licima osim kurirske službe radi isporuke.</p>
    <h3>Vaša prava</h3>
    <p>Imate pravo da u svakom trenutku zatražite uvid, ispravku ili brisanje vaših podataka pisanim zahtevom na <b>privatnost@domextra.net</b>.</p>
    <h3>Kolačići</h3>
    <p>Sajt koristi kolačiće (cookies) radi funkcionisanja korpe, prijave i analitike. Detalji o kolačićima dostupni su pri prvoj poseti sajtu.</p>`},
  faq:{title:'Često postavljana pitanja', html:`
    <h2>Često postavljana pitanja</h2>
    <h3>Da li mogu da naručim bez registracije?</h3>
    <p>Da, registracija nije obavezna. Međutim, registrovani kupci imaju listu želja, istoriju kupovine i brže poručivanje.</p>
    <h3>Koliko traje isporuka?</h3>
    <p>2–5 radnih dana za područje Srbije, u zavisnosti od mesta isporuke i raspoloživosti proizvoda na stanju.</p>
    <h3>Mogu li da promenim ili otkažem porudžbinu?</h3>
    <p>Da, dok porudžbina ima status „Novo" ili „U obradi". Kontaktirajte nas što pre na info telefon ili e-mail.</p>
    <h3>Šta ako proizvod nije na stanju?</h3>
    <p>Sistem automatski označava artikle bez stanja. Možete dodati proizvod u listu želja — obavestićemo vas čim ponovo bude dostupan.</p>
    <h3>Kako se obračunava dostava?</h3>
    <p>Cena dostave zavisi od težine pošiljke prema cenovniku kurirske službe. Za porudžbine preko <b>50.000 RSD</b> dostava je besplatna.</p>
    <h3>Kako da iskoristim promo kod?</h3>
    <p>Unesite kod u polje „Imate promo kod?" u korpi pre potvrde porudžbine. Popust će biti automatski primenjen.</p>`},
  kontakt:{title:'Kontakt', html:`
    <h2>Kontakt</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:14px">
      <div>
        <h3>Sedište</h3>
        <p><b>DOM EXTRA DOO</b><br>Bulevar Oslobođenja 123<br>11000 Beograd<br>PIB: 109876543<br>MB: 21345678</p>
      </div>
      <div>
        <h3>Komunikacija</h3>
        <p><b>Telefon:</b> +381 11 000 0000<br><b>E-mail:</b> prodaja@domextra.net<br><b>Reklamacije:</b> reklamacije@domextra.net<br><b>Radno vreme:</b> Pon–Pet 08–17h, Sub 09–13h</p>
      </div>
    </div>
    <h3 style="margin-top:24px">Maloprodajni objekat</h3>
    <p>Bulevar Oslobođenja 123, Beograd · Lično preuzimanje moguće svakog radnog dana 08–17h, subotom 09–13h.</p>`}
};
function openLegal(key){
  const p=legalPages[key]; if(!p) return;
  const o=document.getElementById('prodOverlay');
  o.innerHTML=`<div class="prod-detail">
    <div class="doc-tools"><b>${p.title}</b><div class="grp"><button class="tool-btn" onclick="closeProduct()">Zatvori</button></div></div>
    <div class="legal-body">${p.html}</div>
  </div>`;
  o.classList.add('open');
}
function renderSaleBanner(){
  const el=document.getElementById('saleBannerWrap'); if(!el) return;
  if(!saleBanner.active){ el.innerHTML=''; return; }
  el.innerHTML=`
    <div class="sale-banner" style="background:${saleBanner.bg||'#0c0c0c'}">
      <div class="sb-content">
        <h2>${saleBanner.title}</h2>
        <p>${saleBanner.text}</p>
      </div>
      ${saleBanner.cta?`<button class="cta sb-cta" onclick="document.getElementById('chipAkc').classList.add('on');renderShopGrid();document.getElementById('shopGrid').scrollIntoView({behavior:'smooth'})">${saleBanner.cta}</button>`:''}
    </div>`;
}


async function submitContactForm(){
  const name=(document.getElementById('contactName')?.value||'').trim();
  const email=(document.getElementById('contactEmail')?.value||'').trim();
  const phone=(document.getElementById('contactPhone')?.value||'').trim();
  const topic=(document.getElementById('contactTopic')?.value||'').trim();
  const message=(document.getElementById('contactMessage')?.value||'').trim();
  const err=document.getElementById('contactErr');
  if(err) err.textContent='';
  if(!name||!email||!message){ if(err) err.textContent='Ime, email i poruka su obavezni.'; return; }
  try{
    const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name,email,phone,topic,message})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Poruka nije poslata.');
    ['contactName','contactEmail','contactPhone','contactTopic','contactMessage'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; });
    toast('Hvala! Vaša poruka je poslata — javljamo se u roku od 24h.');
  }catch(e){ if(err) err.textContent=e.message||'Poruka nije poslata.'; else toast(e.message||'Poruka nije poslata.'); }
}
/* ---- Q&A: pitanja i odgovori ---- */
function submitQuestion(id){
  if(!currentShopUser){ toast('Prijavite se da biste postavili pitanje.'); return; }
  const q=document.getElementById('qInput').value.trim();
  if(!q){ toast('Unesite pitanje.'); return; }
  if(!questions[id]) questions[id]=[];
  questions[id].push({user:currentShopUser.name, q, a:null, date:new Date().toISOString().slice(0,10)});
  const qi=document.getElementById('qInput'); if(qi) qi.value='';
  toast('Vaše pitanje je poslato. Odgovor ćete dobiti uskoro.');
  openProduct(id);
}

/* ---- LOKACIJE MALOPRODAJE ---- */
function openLocations(){
  const o=document.getElementById('prodOverlay');
  const mapsLink=(l)=>`https://www.google.com/maps?q=${l.lat},${l.lng}`;
  o.innerHTML=`<div class="prod-detail">
    <div class="doc-tools"><b>Naše lokacije</b><div class="grp"><button class="tool-btn" onclick="closeProduct()">Zatvori</button></div></div>
    <div class="legal-body">
      <h2>Maloprodajni objekti</h2>
      <p>Posetite nas u nekoj od naših lokacija — naši savetnici su tu da vam pomognu u izboru.</p>
      <div class="loc-grid">${locations.map(l=>`
        <div class="loc-card">
          <h3>${l.name}</h3>
          <div class="loc-meta">📍 ${l.addr}</div>
          <div class="loc-meta">📞 ${l.phone}</div>
          <div class="loc-meta">🕐 ${l.hours}</div>
          <div class="loc-map" onclick="window.open('${mapsLink(l)}','_blank')">
            <div class="loc-pin">📍</div>
            <span>Otvori na Google Maps</span>
          </div>
        </div>`).join('')}</div>
    </div>
  </div>`;
  o.classList.add('open');
}
function toggleChip(id){ document.getElementById(id).classList.toggle('on'); }
function getCurrentFilters(){
  return {
    q:val('fSearch'), grupa:document.getElementById('fGrupa')?.value||'',
    sort:document.getElementById('fSort')?.value||'',
    pMin:val('fPriceMin'), pMax:val('fPriceMax'),
    akc:document.getElementById('chipAkc')?.classList.contains('on'),
    nov:document.getElementById('chipNew')?.classList.contains('on'),
    stock:document.getElementById('chipStock')?.classList.contains('on')
  };
}
function saveCurrentSearch(){
  if(!currentShopUser){ toast('Prijavite se da biste sačuvali pretragu.'); acctOpen='auth'; renderAcctBtns(); renderAcctPanel(); return; }
  const f=getCurrentFilters();
  // generiši opis
  const opis=[];
  if(f.q) opis.push('"'+f.q+'"');
  if(f.grupa) opis.push(f.grupa);
  if(f.pMin||f.pMax) opis.push((f.pMin||'0')+'–'+(f.pMax||'∞')+' RSD');
  if(f.akc) opis.push('akcije');
  if(f.nov) opis.push('novo');
  if(f.stock) opis.push('na stanju');
  if(!opis.length){ toast('Podesite makar jedan filter pre čuvanja.'); return; }
  if(!currentShopUser.savedSearches) currentShopUser.savedSearches=[];
  // ime opciono
  const name=prompt('Naziv pretrage (opciono):', opis.join(' · '));
  if(name===null) return;
  currentShopUser.savedSearches.push({name:name||opis.join(' · '), filters:f, kreirana:new Date().toISOString().slice(0,10), notify:true});
  renderAcctBtns(); if(acctOpen==='searches') renderAcctPanel();
  toast('Pretraga „'+(name||opis.join(' · '))+'" je sačuvana. Bićete obavešteni mejlom kad uđu novi proizvodi.');
}
function applySavedSearch(i){
  const s=currentShopUser.savedSearches[i]; if(!s) return;
  document.getElementById('fSearch').value=s.filters.q||'';
  document.getElementById('fGrupa').value=s.filters.grupa||'';
  document.getElementById('fSort').value=s.filters.sort||'';
  document.getElementById('fPriceMin').value=s.filters.pMin||'';
  document.getElementById('fPriceMax').value=s.filters.pMax||'';
  ['chipAkc','chipNew','chipStock'].forEach(id=>document.getElementById(id).classList.remove('on'));
  if(s.filters.akc) document.getElementById('chipAkc').classList.add('on');
  if(s.filters.nov) document.getElementById('chipNew').classList.add('on');
  if(s.filters.stock) document.getElementById('chipStock').classList.add('on');
  renderShopGrid();
  toggleAcct(null);
  const sg=document.getElementById('shopGrid'); if(sg.scrollIntoView) sg.scrollIntoView({behavior:'smooth'});
  toast('Pretraga primenjena: '+s.name);
}
function removeSavedSearch(i){
  currentShopUser.savedSearches.splice(i,1);
  renderAcctBtns(); renderAcctPanel();
}
function toggleSearchNotify(i){
  currentShopUser.savedSearches[i].notify=!currentShopUser.savedSearches[i].notify;
  renderAcctPanel();
}

function clearFilters(){
  ['fSearch','fPriceMin','fPriceMax'].forEach(i=>{const e=document.getElementById(i);if(e)e.value='';});
  const grupa=document.getElementById('fGrupa'); if(grupa) grupa.value='';
  const sort=document.getElementById('fSort'); if(sort) sort.value='';
  ['chipAkc','chipNew','chipStock'].forEach(i=>{const e=document.getElementById(i);if(e)e.classList.remove('on');});

  // Ako je shop otvoren preko /web-shop/?grupa=... ili ?brend=...,
  // URL parametar je takođe filter i mora da se ukloni pri resetovanju.
  try{
    const url=new URL(window.location.href);
    url.searchParams.delete('grupa');
    url.searchParams.delete('brend');
    window.history.replaceState({},'',url.pathname+(url.search?'?'+url.searchParams.toString():'')+url.hash);
  }catch(e){}

  renderShopGrid();
}
function shopAdd(id){
  try{
    const key=String(id);
    const p=(window.products||products||[]).find(x=>String(x.id)===key);
    if(!p){ toast('Artikal nije pronađen. Osvežite stranicu.'); return false; }
    if(p.stock!==undefined && Number(p.stock)<=0){ toast('Artikal trenutno nije na stanju.'); return false; }
    const pack=Math.max(Number(p.pak)||Number(p.packQty)||1,0.001);
    const current=Number(shopCart[key])||0;
    const next=round2(current+pack);
    if(p.stock!==undefined && next>Number(p.stock)){
      toast('Nema dovoljno artikla na stanju.');
      return false;
    }
    shopCart[key]=next;
    saveShopCart();
    if(typeof renderShopCart==='function') renderShopCart();
    if(typeof syncCartNavigation==='function') syncCartNavigation();
    try{ if(typeof trackEvent==='function') trackEvent('add_to_cart',{content_ids:[p.sku],value:wsPrice(p),currency:'RSD',content_name:p.name}); }catch(e){}
    toast(p.name+' je dodat u korpu.');
    return true;
  }catch(e){
    console.error('shopAdd error',e);
    toast('Greška pri dodavanju u korpu.');
    return false;
  }
}
function shopRem(id){ const key=String(id); delete shopCart[key]; saveShopCart(); if(typeof renderShopCart==='function') renderShopCart(); if(typeof syncCartNavigation==='function') syncCartNavigation(); if(Object.keys(shopCart).length===0 && typeof resetCheckoutToFirstStep==='function') resetCheckoutToFirstStep(); }
function shopQtyPreview(id,v,input){
  try{
    const key=String(id);
    const plist=window.domextraProducts || products || [];
    const p=plist.find(x=>String(x.id)===key);
    if(!p) return;
    const raw=String(v??'').replace(',','.');
    if(raw==='' || raw==='-' || raw==='.') return;
    const q=Math.max(0,parseFloat(raw)||0);
    const stock=(p.stock===undefined||p.stock===null||p.stock==='')?Infinity:Number(p.stock);
    if(stock!==Infinity && q>stock+1e-9){
      if(input){ const committed=Number((window.domextraShopCart||shopCart||{})[key])||0; input.value=String(committed); }
      toast(`Nema dovoljno artikla na stanju. Dostupno: ${qf(stock)} ${p.jm||''}`);
      return;
    }
    const cart=window.domextraShopCart || shopCart || {};
    if(q<=0) delete cart[key]; else cart[key]=q;
    window.domextraShopCart=cart;
    try{shopCart=cart;}catch(e){}
    saveShopCart();
    const row=input?.closest?.('.cart-line');
    if(row){
      const priceEl=row.querySelector('.pr');
      if(priceEl) priceEl.textContent=fmt(wsPrice(p)*q);
    }
    refreshShopCartSummaryOnly();
    syncCartNavigation();
  }catch(e){ console.warn('shopQtyPreview',e); }
}
window.shopQtyPreview=shopQtyPreview;

function shopQty(id,v){
  const key=String(id);
  v=Math.max(0,parseFloat(String(v).replace(',','.'))||0);
  const p=(window.products||products||[]).find(x=>String(x.id)===key);
  if(!p) return;
  if(v===0){ delete shopCart[key]; saveShopCart(); renderShopCart(); if(typeof syncCartNavigation==='function') syncCartNavigation(); if(Object.keys(shopCart).length===0 && typeof resetCheckoutToFirstStep==='function') resetCheckoutToFirstStep(); return; }
  const pak=Math.max(Number(p.pak)||1,0.001);
  const kut=Math.ceil(round2(v/pak)-1e-9);
  const adj=round2(kut*pak);
  if(p.stock!==undefined && adj>Number(p.stock)){ toast('Nema dovoljno artikla na stanju.'); return; }
  if(Math.abs(adj-v)>0.001){ toast(`${p.name}: ${qf(v)} ${p.jm} → zaokruženo na ${kut} ${p.pakNaziv}${kut>1?'e':''} = ${qf(adj)} ${p.jm}`); }
  shopCart[key]=adj; saveShopCart(); renderShopCart(); if(typeof syncCartNavigation==='function') syncCartNavigation();
}
window.shopAdd=shopAdd; window.shopRem=shopRem; window.shopQty=shopQty;

/* ---- DETALJNA STRANICA PROIZVODA ---- */
function avgRating(id){ const r=reviews[id]||[]; if(!r.length) return null;
  return r.reduce((s,x)=>s+x.stars,0)/r.length; }
function starsHTML(n, size){
  const f=Math.round(n||0);
  return `<span class="stars" style="font-size:${size||14}px">${'★★★★★'.split('').map((_,i)=>`<span style="color:${i<f?'#f4b400':'#dcdcdc'}">★</span>`).join('')}</span>`;
}
function countdownHTML(rok){
  const ms=new Date(rok)-Date.now();
  if(ms<=0) return '';
  const d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
  return `<div class="countdown"><span>Akcija ističe:</span> <b>${d}d ${h}h ${m}m</b></div>`;
}
function openProduct(id){
  const p=products.find(x=>x.id==id); if(!p) return;
  openProductId=id;
  trackEvent('view_item', {content_ids:[p.sku], value:wsPrice(p), currency:'RSD', content_name:p.name, content_category:p.grupa});
  const fav=currentShopUser&&currentShopUser.wishlist.includes(id);
  const akc=isActiveShopSale(p) || (p.oldPrice&&p.oldPrice>wsPrice(p));
  const out=p.stock!==undefined&&p.stock<=0;
  let related=products.filter(x=>x.id!==id && x.grupa===p.grupa);
  if(related.length<3) related=related.concat(products.filter(x=>x.id!==id && x.grupa!==p.grupa)).slice(0,3);
  else related=related.slice(0,3);
  const inComp=compareList.includes(id);
  const avg=avgRating(id), revs=reviews[id]||[];
  const rok=p.akcijaDo;
  const o=document.getElementById('prodOverlay');
  o.innerHTML=`<div class="prod-detail">
    <div class="doc-tools"><b>${p.name}</b>
      <div class="grp">
        <button class="tool-btn" onclick="closeProduct()">Zatvori</button>
      </div>
    </div>
    <div class="prod-body">
      <nav class="breadcrumb">Početna › Web Shop › ${p.grupa} › <b>${p.name}</b></nav>
      <div class="prod-main">
        <div class="prod-gallery">
          <div class="pg-main" id="pgMain" onclick="openLightbox(${JSON.stringify(id)})" title="Klik za uvećanje">${p.gallery?p.gallery[0]:p.ico}<span class="pg-zoom">⊕ Klik za uvećanje</span></div>
          ${p.gallery&&p.gallery.length>1?`<div class="pg-thumbs">${p.gallery.map((g,i)=>`<button class="pg-thumb ${i===0?'on':''}" onclick="setPgMain(this,${i},${JSON.stringify(id)})">${g}</button>`).join('')}</div>`:''}
        </div>
        <div class="prod-info">
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            ${akc?'<span class="badge-akcija" style="position:static">AKCIJA</span>':''}
            ${p.isNew?'<span class="badge-new" style="position:static">NOVO</span>':''}
            ${out?'<span class="badge-out" style="position:static">Nema na stanju</span>':''}
            ${avg?`<span style="font-size:12px;font-weight:600">${starsHTML(avg,13)} ${avg.toFixed(1)} (${revs.length})</span>`:''}
          </div>
          <h1>${p.name}</h1>
          <div class="prod-meta">${p.brand?'<b>Brend:</b> '+p.brand+' · ':''}<b>Šifra:</b> ${p.sku} · <b>Grupa:</b> ${p.grupa}</div>
          <div class="prod-stock" style="color:${out?'var(--danger)':'var(--ok)'}">${out?'⊘ Nema na stanju':'✓ Na stanju'+(p.stock!==undefined?' ('+qf(p.stock)+' '+p.jm+')':'')}</div>
          <div class="prod-price">${akc?`<small style="text-decoration:line-through;color:var(--muted)">${fmt(p.oldPrice)}</small> `:''}<b>${fmt(wsPrice(p))}</b> <small>RSD / ${p.jm}</small></div>
          ${pakInfo(p)?`<div class="prod-pak">${pakInfo(p)}</div>`:''}
          ${rok?countdownHTML(rok):''}
          <div class="prod-desc">${p.longDesc||p.desc||''}</div>
          <div class="prod-actions">
            <button class="cta" style="flex:1;margin-top:0" onclick='window.shopAdd(${JSON.stringify(p.id)});closeProduct()' ${out?'disabled':''}>Dodaj u porudžbinu</button>
            <button class="fav-btn-lg ${fav?'on':''}" onclick="toggleWishlist(${JSON.stringify(p.id)})">${fav?'♥':'♡'}</button>
            <button class="fav-btn-lg ${inComp?'on':''}" onclick="toggleCompare(${JSON.stringify(p.id)})" title="Poređenje" style="${inComp?'color:var(--ink);border-color:var(--ink);background:#fcfff2':''}">⇄</button>
          </div>
        </div>
      </div>
      ${p.specs?`<div class="prod-section"><h3>Tehničke specifikacije</h3>
        <table class="spec-tbl">${p.specs.map(s=>`<tr><td>${s[0]}</td><td><b>${s[1]}</b></td></tr>`).join('')}</table></div>`:''}
      <div class="prod-section"><h3>Ocene i recenzije ${avg?`<span style="font-weight:500;color:var(--muted);font-size:12px">${avg.toFixed(1)} / 5 · ${revs.length} recenzija</span>`:''}</h3>
        ${revs.length?`<div class="reviews">${revs.map(r=>`
          <div class="review">
            <div class="rev-head"><b>${r.user}</b>${r.verified?'<span class="verified-badge">✓ verifikovan kupac</span>':''}<span class="rev-date">${r.date}</span></div>
            ${starsHTML(r.stars,15)}
            <p>${r.text}</p>
          </div>`).join('')}</div>`:'<div class="empty">Još nema ocena ovog proizvoda.</div>'}
        ${currentShopUser?`<button class="logout-btn" style="border-color:var(--ink);color:var(--ink);margin-top:14px" onclick="openReviewForm(${JSON.stringify(id)})">+ Ostavi recenziju</button>
          <div id="reviewForm" style="display:none;margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:var(--r-s);background:#fafaf8">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:6px">Ocena</label>
            <div id="starInput" style="display:flex;gap:4px;font-size:24px;cursor:pointer;margin-bottom:10px">${[1,2,3,4,5].map(n=>`<span data-n="${n}" onclick="setReviewStars(${n})" style="color:#dcdcdc">★</span>`).join('')}</div>
            <textarea id="revText" rows="3" placeholder="Vaš komentar..." style="width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:7px;font-family:inherit;font-size:13px"></textarea>
            <button class="cta" style="margin-top:10px" onclick="submitReview(${JSON.stringify(id)})">Pošalji recenziju</button>
          </div>`:'<div class="mail-hint" style="margin-top:14px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Prijavite se da biste ostavili recenziju.</span></div>'}
      </div>
      <div class="prod-section"><h3>Pitanja i odgovori ${(questions[id]||[]).length?`<span style="font-weight:500;color:var(--muted);font-size:12px">${questions[id].length} pitanja</span>`:''}</h3>
        ${(questions[id]||[]).length?`<div class="qa-list">${questions[id].map(item=>`
          <div class="qa-item">
            <div class="qa-q"><b>P:</b> ${item.q}<span class="qa-meta">${item.user} · ${item.date}</span></div>
            ${item.a?`<div class="qa-a"><b>O:</b> ${item.a}</div>`:'<div class="qa-pending">Čeka se odgovor prodavca...</div>'}
          </div>`).join('')}</div>`:'<div class="empty">Postavite prvo pitanje o ovom proizvodu.</div>'}
        ${currentShopUser?`<div style="margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:var(--r-s);background:#fafaf8">
            <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:6px">Postavite pitanje o proizvodu</label>
            <textarea id="qInput" rows="2" placeholder="Vaše pitanje..." style="width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:7px;font-family:inherit;font-size:13px"></textarea>
            <button class="cta" style="margin-top:10px" onclick="submitQuestion(${JSON.stringify(id)})">Pošalji pitanje</button>
          </div>`:'<div class="mail-hint" style="margin-top:14px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Prijavite se da biste postavili pitanje.</span></div>'}
      </div>
      ${related.length?`<div class="prod-section"><h3>Slični proizvodi iz grupe „${p.grupa}"</h3>
        <div class="related">${related.map(r=>`
          <div class="rel-item" onclick="openProduct(${JSON.stringify(r.id)})">
            <div class="rel-img">${r.ico}</div>
            <div class="rel-name">${r.name}</div>
            <div class="rel-price">${fmt(wsPrice(r))} <small>RSD/${r.jm}</small></div>
          </div>`).join('')}</div></div>`:''}
    </div>
  </div>`;
  o.classList.add('open');
}
let pendingStars=0;
function setReviewStars(n){
  pendingStars=n;
  document.querySelectorAll('#starInput span').forEach((s,i)=>s.style.color=i<n?'#f4b400':'#dcdcdc');
}
function openReviewForm(id){ document.getElementById('reviewForm').style.display='block'; pendingStars=0; }
function submitReview(id){
  const text=document.getElementById('revText').value.trim();
  if(!pendingStars){ toast('Molimo izaberite broj zvezdica.'); return; }
  if(!text){ toast('Unesite tekst recenzije.'); return; }
  const ver=currentShopUser.history.some(o=>o.status==='Realizovano');
  if(!reviews[id]) reviews[id]=[];
  reviews[id].push({user:currentShopUser.name, stars:pendingStars, text, date:new Date().toISOString().slice(0,10), verified:ver});
  toast('Hvala na recenziji!');
  openProduct(id);
}

/* ---- POREĐENJE PROIZVODA ---- */
function toggleCompare(id){
  const i=compareList.indexOf(id);
  if(i>=0){ compareList.splice(i,1); toast('Uklonjeno iz poređenja.'); }
  else{
    if(compareList.length>=3){ toast('Maksimalno 3 proizvoda u poređenju.'); return; }
    compareList.push(id); toast('Dodato u poređenje ('+compareList.length+'/3).');
  }
  renderShopGrid(); renderCompareBar();
  if(openProductId===id) openProduct(id);
}
function renderCompareBar(){
  const bar=document.getElementById('compareBar');
  if(!compareList.length){ bar.style.display='none'; return; }
  bar.style.display='flex';
  bar.innerHTML=`<span>Poređenje: <b>${compareList.length}/3</b></span>
    ${compareList.map(id=>{const p=products.find(x=>x.id===id);return `<span class="cmp-chip">${p.name} <button onclick="toggleCompare(${JSON.stringify(id)})">✕</button></span>`;}).join('')}
    <button class="cta" style="margin:0;padding:8px 16px;width:auto" onclick="openCompare()" ${compareList.length<2?'disabled':''}>Uporedi (${compareList.length})</button>`;
}
function openCompare(){
  if(compareList.length<2) return;
  const items=compareList.map(id=>products.find(p=>p.id===id));
  const allKeys=[...new Set(items.flatMap(p=>(p.specs||[]).map(s=>s[0])))];
  const o=document.getElementById('prodOverlay');
  o.innerHTML=`<div class="prod-detail" style="max-width:1100px">
    <div class="doc-tools"><b>Poređenje proizvoda (${items.length})</b>
      <div class="grp"><button class="tool-btn" onclick="closeProduct()">Zatvori</button></div>
    </div>
    <div class="prod-body">
      <table class="cmp-tbl">
        <tr><td></td>${items.map(p=>`<td class="cmp-head"><div class="cmp-img">${p.ico}</div><b>${p.name}</b><div class="cmp-price">${fmt(wsPrice(p))} <small>RSD/${p.jm}</small></div></td>`).join('')}</tr>
        <tr><td class="cmp-lab">Brend</td>${items.map(p=>`<td>${p.brand||'—'}</td>`).join('')}</tr>
        <tr><td class="cmp-lab">Grupa</td>${items.map(p=>`<td>${p.grupa}</td>`).join('')}</tr>
        <tr><td class="cmp-lab">Šifra</td>${items.map(p=>`<td class="mono">${p.sku}</td>`).join('')}</tr>
        ${allKeys.map(k=>`<tr><td class="cmp-lab">${k}</td>${items.map(p=>{const s=(p.specs||[]).find(x=>x[0]===k);return `<td>${s?'<b>'+s[1]+'</b>':'—'}</td>`;}).join('')}</tr>`).join('')}
        <tr><td></td>${items.map(p=>`<td><button class="cta" style="margin:0;padding:10px 14px;width:100%" onclick='window.shopAdd(${JSON.stringify(p.id)});closeProduct()'>U porudžbinu</button></td>`).join('')}</tr>
      </table>
    </div>
  </div>`;
  o.classList.add('open');
}
let lightboxIdx=0, lightboxPid=null;
function setPgMain(btn, i, pid){
  const p=products.find(x=>x.id===pid); if(!p) return;
  document.getElementById('pgMain').firstChild.textContent=p.gallery[i];
  document.getElementById('pgMain').dataset.idx=i;
  btn.parentElement.querySelectorAll('.pg-thumb').forEach(x=>x.classList.remove('on'));
  btn.classList.add('on');
}
function openLightbox(pid){
  const p=products.find(x=>x.id===pid); if(!p||!p.gallery) return;
  lightboxPid=pid;
  lightboxIdx=parseInt(document.getElementById('pgMain').dataset.idx||0);
  renderLightbox();
}
function renderLightbox(){
  const p=products.find(x=>x.id===lightboxPid);
  const lb=document.getElementById('lightbox');
  lb.innerHTML=`
    <button class="lb-close" onclick="closeLightbox()" aria-label="Zatvori">✕</button>
    ${p.gallery.length>1?`<button class="lb-nav lb-prev" onclick="lbPrev()" aria-label="Prethodna">‹</button>`:''}
    <div class="lb-img">${p.gallery[lightboxIdx]}</div>
    ${p.gallery.length>1?`<button class="lb-nav lb-next" onclick="lbNext()" aria-label="Sledeća">›</button>`:''}
    <div class="lb-info">
      <div class="lb-count">${lightboxIdx+1} / ${p.gallery.length}</div>
      <div class="lb-name">${p.name}</div>
    </div>
    ${p.gallery.length>1?`<div class="lb-thumbs">${p.gallery.map((g,i)=>`<button class="lb-thumb ${i===lightboxIdx?'on':''}" onclick="lbGoTo(${i})">${g}</button>`).join('')}</div>`:''}`;
  lb.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow='';
  lightboxPid=null;
}
function lbPrev(){ const p=products.find(x=>x.id===lightboxPid); lightboxIdx=(lightboxIdx-1+p.gallery.length)%p.gallery.length; renderLightbox(); }
function lbNext(){ const p=products.find(x=>x.id===lightboxPid); lightboxIdx=(lightboxIdx+1)%p.gallery.length; renderLightbox(); }
function lbGoTo(i){ lightboxIdx=i; renderLightbox(); }
function closeProduct(){ openProductId=null; document.getElementById('prodOverlay').classList.remove('open'); }

/* ---- LISTA ŽELJA ---- */
async function toggleWishlist(id){
  if(!currentShopUser){
    toast('Prijavite se da biste koristili listu želja.');
    acctOpen='auth'; renderAcctBtns(); renderAcctPanel(); return;
  }
  const pid=String(id);
  try{
    let items=[];
    const exists=(currentShopUser.wishlist||[]).some(x=>String(x)===pid);
    const headers={};
    const shopToken=localStorage.getItem('domextra_shop_token')||'';
    if(shopToken) headers.Authorization='Bearer '+shopToken;
    if(exists){
      const r=await fetch('/api/wishlist/'+encodeURIComponent(pid),{method:'DELETE',headers,credentials:'same-origin'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'Artikal nije uklonjen iz liste želja.');
      items=d.items||[];
      toast('Uklonjeno iz liste želja.');
    }else{
      headers['Content-Type']='application/json';
      const r=await fetch('/api/wishlist',{method:'POST',headers,credentials:'same-origin',body:JSON.stringify({productId:pid})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'Artikal nije dodat u listu želja.');
      items=d.items||[];
      toast('Dodato u listu želja ♥');
    }
    currentShopUser.wishlist=items.map(String);
    renderShopGrid();
    if(openProductId===id) openProduct(id);
    if(acctOpen==='wishlist') renderAcctPanel();
    renderAcctBtns();
  }catch(e){ toast(e.message||'Lista želja nije ažurirana.'); }
}

/* ---- KUPONI ---- */
let appliedCoupon=null;
async function applyCoupon(){
  const code=document.getElementById('couponCode').value.trim().toUpperCase();
  const err=document.getElementById('couponErr');
  if(!code){ appliedCoupon=null; if(err) err.textContent=''; renderShopCart(); return; }
  try{
    const subtotal=shopTotals().subTotal;
    const r=await fetch('/api/coupons/validate?code='+encodeURIComponent(code)+'&amount='+encodeURIComponent(subtotal),{credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok || !d.valid) throw new Error(d.error||'Kupon nije važeći.');
    appliedCoupon={
      id:d.coupon.id, code:d.coupon.code, opis:d.coupon.description||'', tip:d.coupon.type,
      vred:Number(d.coupon.value||0), minIznos:Number(d.coupon.minAmount||0),
      rok:d.coupon.validUntil||'', iskoriscen:Number(d.coupon.used||0), maxKor:Number(d.coupon.maxUses||0)
    };
    if(err) err.textContent='';
    renderShopCart();
    toast('Kupon primenjen: '+appliedCoupon.opis);
  }catch(e){
    appliedCoupon=null;
    if(err) err.textContent=e.message||'Kupon nije važeći.';
    renderShopCart();
  }
}

/* ---- nalozi web shop kupaca ---- */
let acctOpen=null; // 'auth' | 'profile' | 'history' | null
function renderAcctBtns(){
  const el=document.getElementById('acctBtns');
  if(currentShopUser){
    const wl=currentShopUser.wishlist.length;
    const ss=(currentShopUser.savedSearches||[]).length;
    el.innerHTML=`
      <span class="badge"><span class="pulse"></span> ${currentShopUser.name}</span>
      <button class="tab-btn ${acctOpen==='profile'?'active':''}" onclick="toggleAcct('profile')">Moj profil</button>
      <button class="tab-btn ${acctOpen==='wishlist'?'active':''}" onclick="toggleAcct('wishlist')">Lista želja${wl?' ('+wl+')':''}</button>
      <button class="tab-btn ${acctOpen==='searches'?'active':''}" onclick="toggleAcct('searches')">Pretrage${ss?' ('+ss+')':''}</button>
      <button class="tab-btn ${acctOpen==='history'?'active':''}" onclick="toggleAcct('history')">Istorija kupovine</button>
      <button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="shopUserLogout()">Odjava</button>`;
  }else{
    el.innerHTML=`
      <span class="badge"><span class="pulse"></span> Gost</span>
      <button class="tab-btn ${acctOpen==='auth'?'active':''}" onclick="toggleAcct('auth')">Prijava / Registracija</button>`;
  }
}
function toggleAcct(panel){
  acctOpen = acctOpen===panel ? null : panel;
  renderAcctBtns(); renderAcctPanel();
}
function renderAcctPanel(){
  const el=document.getElementById('acctPanel');
  if(!acctOpen){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  if(acctOpen==='auth'){
    el.innerHTML=`
    <div class="set-grid">
      <div class="card"><div class="card-h"><h2>Prijava</h2></div><div class="card-b">
        <div class="f-row one"><div class="f-g"><label>E-mail</label><input id="suMail" placeholder="vas@mail.com"></div></div>
        <div class="f-row one"><div class="f-g"><label>Lozinka</label><input id="suPass" type="password" onkeydown="if(event.key==='Enter')shopUserLogin()"></div></div>
        <div class="login-err" id="suErr"></div>
        <button class="cta" style="margin-top:6px" onclick="shopUserLogin()">Prijavi se</button>
        <div class="demo-cred">Demo: <span class="mono">petar@mail.com</span> / <span class="mono">petar123</span></div>
      </div></div>
      <div class="card"><div class="card-h"><h2>Registracija novog kupca</h2></div><div class="card-b">
        <div class="f-row">
          <div class="f-g"><label>Ime i prezime</label><input id="rName"></div>
          <div class="f-g"><label>Telefon</label><input id="rPhone"></div>
        </div>
        <div class="f-row">
          <div class="f-g"><label>E-mail</label><input id="rMail"></div>
          <div class="f-g"><label>Lozinka</label><input id="rPass" type="password"></div>
        </div>
        <div class="f-row">
          <div class="f-g"><label>Adresa</label><input id="rAddr"></div>
          <div class="f-g"><label>Grad</label><input id="rCity"></div>
        </div>
        <div class="login-err" id="rErr"></div>
        <button class="cta" style="margin-top:6px" onclick="shopRegister()">Registruj se</button>
      </div></div>
    </div>`;
  }
  if(acctOpen==='profile'){
    const u=currentShopUser;
    if(!u.addresses) u.addresses=[{label:'Glavna', addr:u.addr||'', city:u.city||'', def:true}];
    el.innerHTML=`
    <div class="card"><div class="card-h"><h2>Moj profil</h2><span class="hint">Podaci se automatski popunjavaju pri poručivanju</span></div><div class="card-b">
      <div class="f-row">
        <div class="f-g"><label>Ime i prezime</label><input id="prName" value="${u.name}"></div>
        <div class="f-g"><label>Telefon</label><input id="prPhone" value="${u.phone||''}"></div>
      </div>
      <div class="f-row">
        <div class="f-g"><label>E-mail (korisničko ime)</label><input id="prMail" value="${u.mail}" disabled style="background:#f4f4f2;color:var(--muted)"></div>
        <div class="f-g"><label>Nova lozinka (ostaviti prazno ako se ne menja)</label><input id="prPass" type="password"></div>
      </div>
      <button class="cta" style="margin-top:6px;max-width:280px" onclick="saveProfile()">Sačuvaj osnovne podatke</button>
    </div></div>
    <div class="card" style="margin-top:18px"><div class="card-h"><h2>Adrese za isporuku</h2><span class="hint">${u.addresses.length} sačuvano</span></div><div class="card-b">
      <div id="addrList">${u.addresses.map((a,i)=>`
        <div class="addr-item ${a.def?'def':''}">
          <div><b>${a.label}</b>${a.def?' <span class="addr-def-mark">PODRAZUMEVANA</span>':''}<br><span style="color:var(--muted);font-size:12.5px">${a.addr}, ${a.city}</span></div>
          <div class="addr-actions">
            ${!a.def?`<button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="setDefaultAddr(${i})">Postavi kao podrazumevanu</button>`:''}
            <button class="x-btn" onclick="removeAddr(${i})" title="Obriši">✕</button>
          </div>
        </div>`).join('')}</div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)">
        <div class="f-row">
          <div class="f-g"><label>Naziv adrese (Kuća, Posao...)</label><input id="naLab" placeholder="Kuća"></div>
          <div class="f-g"><label>Grad</label><input id="naCity" placeholder="Beograd"></div>
        </div>
        <div class="f-row one"><div class="f-g"><label>Adresa</label><input id="naAddr" placeholder="Ulica i broj"></div></div>
        <button class="cta" style="margin-top:6px;max-width:280px" onclick="addAddress()">+ Dodaj adresu</button>
      </div>
    </div></div>`;
  }
  if(acctOpen==='wishlist'){
    const wl=currentShopUser.wishlist.map(id=>products.find(p=>p.id===id)).filter(Boolean);
    el.innerHTML=`
    <div class="card"><div class="card-h"><h2>Lista želja</h2><span class="hint">${wl.length} proizvoda</span></div><div class="card-b">
      ${wl.length?`<div class="p-grid">${wl.map(p=>`
        <div class="p-item" onclick="openProduct(${JSON.stringify(p.id)})">
          <button class="fav-btn on" onclick="event.stopPropagation();toggleWishlist(${JSON.stringify(p.id)})" title="Ukloni">♥</button>
          <div class="p-img">${p.ico}</div>
          <h3>${p.name}</h3>
          <div class="p-meta">${p.sku}</div>
          <div class="p-price">${fmt(wsPrice(p))} <small>RSD/${p.jm}</small></div>
          <button class="add-btn" data-product-id="${String(p.id).replace(/\"/g, "&quot;")}" onclick='event.stopPropagation();window.shopAdd(${JSON.stringify(p.id)})'>Dodaj u porudžbinu</button>
        </div>`).join('')}</div>`:'<div class="empty">Lista želja je prazna. Klikom na ♡ na proizvodu dodajte ih ovde.</div>'}
    </div></div>`;
  }
  if(acctOpen==='searches'){
    const ss=currentShopUser.savedSearches||[];
    el.innerHTML=`
    <div class="card"><div class="card-h"><h2>Sačuvane pretrage</h2><span class="hint">${ss.length} sačuvano · obaveštenja mejlom kad uđu novi proizvodi</span></div><div class="card-b">
      ${ss.length?`<div class="ss-list">${ss.map((s,i)=>{
        const tags=[];
        if(s.filters.q) tags.push('🔍 "'+s.filters.q+'"');
        if(s.filters.grupa) tags.push('🏷️ '+s.filters.grupa);
        if(s.filters.pMin||s.filters.pMax) tags.push('💰 '+(s.filters.pMin||'0')+'–'+(s.filters.pMax||'∞'));
        if(s.filters.akc) tags.push('🔥 akcije');
        if(s.filters.nov) tags.push('✨ novo');
        if(s.filters.stock) tags.push('✓ na stanju');
        return `<div class="ss-item">
          <div class="ss-main">
            <div class="ss-name">${s.name}</div>
            <div class="ss-tags">${tags.map(t=>`<span class="ss-tag">${t}</span>`).join('')}</div>
            <div class="ss-meta">Sačuvana ${s.kreirana} · ${s.notify?'<span style="color:var(--ok)">🔔 Obaveštenja uključena</span>':'<span style="color:var(--muted)">🔕 Obaveštenja isključena</span>'}</div>
          </div>
          <div class="ss-actions">
            <button class="cta" style="margin:0;padding:8px 14px" onclick="applySavedSearch(${i})">Primeni</button>
            <button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2);padding:8px 12px" onclick="toggleSearchNotify(${i})">${s.notify?'Isključi 🔔':'Uključi 🔔'}</button>
            <button class="x-btn" onclick="removeSavedSearch(${i})" title="Obriši">✕</button>
          </div>
        </div>`;
      }).join('')}</div>`:'<div class="empty">Nemate sačuvanih pretraga. U katalogu podesite filtere i kliknite na „🔖 Sačuvaj pretragu".</div>'}
    </div></div>`;
  }
  if(acctOpen==='history'){
    const h=currentShopUser.history;
    el.innerHTML=`
    <div class="card"><div class="card-h"><h2>Istorija kupovine</h2><span class="hint">${h.length} porudžbina</span></div>
      <div class="tbl-wrap"><table class="b2b" style="min-width:0;width:100%">
        <thead><tr><th>Broj</th><th>Datum</th><th>Artikli</th><th>Plaćanje</th><th>Isporuka</th><th>Iznos</th><th>Status / Praćenje</th><th></th></tr></thead>
        <tbody>${h.length?h.map(o=>`
          <tr><td><button class="doc-link" onclick="reopenDoc('${o.num}')">${o.num}</button></td><td class="mono">${o.date}</td>
          <td style="min-width:180px">${(o.items&&o.items.length)?o.items.map(it=>`<div style="font-size:12px">${it.name||it.productId} <span class="mono">× ${it.qty}</span></div>`).join(''):'—'}</td>
          <td>${o.pay||'—'}</td><td>${o.ship||'—'}</td>
          <td class="mono"><b>${o.total}</b></td>
          <td><span class="st st-big ${stClass[o.status]}">${o.status}</span>${o.status==='Plaćeno'?'<br><span style="font-size:10px;color:var(--ok)">uplata potvrđena</span>':o.status==='Realizovano'?'<br><span style="font-size:10px;color:var(--accent-ink)">isporučeno i plaćeno</span>':''}${o.tracking?`<br><a href="#" class="track-link" onclick="event.preventDefault();toast('U produkciji vodi na ${o.trackingCarrier||'kurirsku'} službu — broj ${o.tracking}')">📦 Prati: ${o.tracking}</a>`:''}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap"><button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="viewOrderDocument('${o.orderId||''}','${o.pdfUrl||''}')">Pogledaj dokument</button><button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="downloadOrderDocument('${o.orderId||''}','${o.pdfUrl||''}')">Preuzmi PDF</button></td></tr>`).join('')
          :'<tr><td colspan="8"><div class="empty">Još nema kupovina na ovom nalogu.</div></td></tr>'}</tbody>
      </table></div></div>`;
  }
}
function refreshShopHistory(){ if(acctOpen==='history') renderAcctPanel(); }
function checkAbandonedCart(){
  const banner=document.getElementById('abandonBanner');
  const itemCount=Object.keys(shopCart).length;
  // Provera B2B sugestije: ulogovan kupac sa 3+ porudžbinama
  if(currentShopUser && currentShopUser.history.length>=3 && !currentShopUser.b2bSuggestionDismissed){
    banner.style.display='block';
    banner.innerHTML=`<div class="abandon b2b-sugg">
      <div><b>🏢 Vaše porudžbine rastu — vreme za B2B nalog?</b> Kao redovan kupac (${currentShopUser.history.length}+ porudžbina) možete imati posebne uslove: <b>redovni rabat 15–25%</b>, plaćanje po valuti i posebnu B2B podršku. Pošaljite zahtev za B2B nalog na <span class="mono">prodaja@domextra.net</span> sa PIB-om vaše firme.</div>
      <button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="currentShopUser.b2bSuggestionDismissed=true;this.parentElement.parentElement.style.display='none'">✕</button>
    </div>`;
    return;
  }
  if(itemCount===0 || appliedCoupon){ banner.style.display='none'; return; }
  banner.style.display='block';
  banner.innerHTML=`<div class="abandon">
    <div><b>👋 Završite porudžbinu uz popust!</b> Imate ${itemCount} ${itemCount===1?'artikal':'artikala'} u korpi. Iskoristite kod <span class="mono"><b>VRATI5</b></span> za dodatnih 5% popusta.</div>
    <button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="this.parentElement.parentElement.style.display='none'">✕</button>
  </div>`;
}
// VRATI5 kupon
coupons.push({code:'VRATI5', tip:'%', vred:5, minIznos:0, rok:'2026-12-31', iskoriscen:0, maxKor:9999, opis:'Vraćeni kupac — 5%'});
function fillCheckout(u){
  document.getElementById('cName').value=u.name||'';
  document.getElementById('cPhone').value=u.phone||'';
  document.getElementById('cMail').value=u.mail||'';
  document.getElementById('cAddr').value=u.addr||'';
  document.getElementById('cCity').value=u.city||'';
}
async function shopUserLogin(){
  const m=val('suMail').trim().toLowerCase(), p=val('suPass');
  const err=document.getElementById('suErr');
  try{
    const r=await fetch('/api/auth/shop/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email:m,password:p})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Prijava nije uspela.');
    const u={name:d.user.name,mail:d.user.email,pass:p,phone:d.user.phone||'',addr:d.user.address||'',city:d.user.city||'',history:d.user.history||[],wishlist:(d.user.wishlist||[]).map(String),savedSearches:d.user.savedSearches||[]};
    try{localStorage.setItem('domextra_shop_token',d.token||''); localStorage.setItem('domextra_token',d.token||'');}catch(e){}
    currentShopUser=u;
    try{localStorage.setItem('domextra_shop_session','1');}catch(e){}
    acctOpen=null; renderAcctBtns(); renderAcctPanel(); fillCheckout(u);
    toast('Dobrodošli, '+u.name+'! Podaci za isporuku su popunjeni iz profila.');
    checkAbandonedCart();
  }catch(e){ err.textContent=e.message; }
}
async function shopRegister(){
  const name=val('rName').trim(), mail=val('rMail').trim().toLowerCase(), pass=val('rPass');
  const err=document.getElementById('rErr');
  if(!name||!mail||!pass){ err.textContent='Ime, e-mail i lozinka su obavezni.'; return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){ err.textContent='Unesite ispravan e-mail.'; return; }
  if(pass.length<6){ err.textContent='Lozinka mora imati najmanje 6 karaktera.'; return; }
  try{
    const r=await fetch('/api/auth/shop/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name,email:mail,password:pass,phone:val('rPhone'),address:val('rAddr'),city:val('rCity')})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Registracija nije uspela.');
    const u={name:d.user.name,mail:d.user.email,pass,phone:d.user.phone||'',addr:d.user.address||'',city:d.user.city||'',history:d.user.history||[],wishlist:(d.user.wishlist||[]).map(String),savedSearches:d.user.savedSearches||[]};
    try{localStorage.setItem('domextra_shop_token',d.token||''); localStorage.setItem('domextra_token',d.token||'');}catch(e){}
    currentShopUser=u;
    try{localStorage.setItem('domextra_shop_session','1');}catch(e){}
    acctOpen=null; renderAcctBtns(); renderAcctPanel(); fillCheckout(u);
    toast('Nalog je kreiran. Dobrodošli, '+name+'!');
  }catch(e){ err.textContent=e.message; }
}
async function shopUserLogout(){
  try{await fetch('/api/auth/shop/logout',{method:'POST',credentials:'same-origin'});}catch(e){}
  try{localStorage.removeItem('domextra_shop_session'); localStorage.removeItem('domextra_shop_token'); localStorage.removeItem('domextra_token');}catch(e){}
  currentShopUser=null; acctOpen=null; renderAcctBtns(); renderAcctPanel();
  ['cName','cPhone','cMail','cAddr','cCity'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
function saveProfile(){
  const u=currentShopUser;
  u.name=val('prName')||u.name; u.phone=val('prPhone');
  if(val('prPass')) u.pass=val('prPass');
  renderAcctBtns(); fillCheckout(u);
  toast('Profil je sačuvan.');
}
function addAddress(){
  const lab=val('naLab')||'Adresa', addr=val('naAddr'), city=val('naCity');
  if(!addr||!city){ toast('Unesite adresu i grad.'); return; }
  if(!currentShopUser.addresses) currentShopUser.addresses=[];
  const def=currentShopUser.addresses.length===0;
  currentShopUser.addresses.push({label:lab, addr, city, def});
  if(def){ currentShopUser.addr=addr; currentShopUser.city=city; }
  ['naLab','naAddr','naCity'].forEach(id=>document.getElementById(id).value='');
  renderAcctPanel(); fillCheckout(currentShopUser);
  toast('Adresa dodata.');
}
function setDefaultAddr(i){
  currentShopUser.addresses.forEach((a,j)=>a.def=(i===j));
  const a=currentShopUser.addresses[i];
  currentShopUser.addr=a.addr; currentShopUser.city=a.city;
  renderAcctPanel(); fillCheckout(currentShopUser);
  toast('Podrazumevana adresa postavljena.');
}
function removeAddr(i){
  const wasDefault=currentShopUser.addresses[i].def;
  currentShopUser.addresses.splice(i,1);
  if(wasDefault && currentShopUser.addresses.length){
    currentShopUser.addresses[0].def=true;
    currentShopUser.addr=currentShopUser.addresses[0].addr;
    currentShopUser.city=currentShopUser.addresses[0].city;
  }
  renderAcctPanel(); fillCheckout(currentShopUser);
}

/* ---- NBS IPS QR (po specifikaciji NBS IPS QR koda) ---- */
function translit(t){ // latinica bez dijakritika u QR poljima
  return String(t).replace(/[čć]/g,'c').replace(/[ČĆ]/g,'C').replace(/š/g,'s').replace(/Š/g,'S')
    .replace(/ž/g,'z').replace(/Ž/g,'Z').replace(/đ/g,'dj').replace(/Đ/g,'Dj').replace(/\|/g,' ');
}
function ipsAmount(n){ return 'RSD'+n.toFixed(2).replace('.',','); } // bez separatora hiljada, decimalni zarez
function ipsAccount(acc){ return String(acc).replace(/\D/g,'').padEnd(18,'0').slice(0,18); } // 18 cifara bez crtica
function ipsString({s, payerName, payerAddr, totalNum, num}){
  // Obavezni tagovi: K,V,C,R,N,I · opcioni: P,SF,S,RO — separator |
  return [
    'K:PR','V:01','C:1',
    'R:'+ipsAccount(s.acc),
    'N:'+translit(s.firm).slice(0,70),
    'I:'+ipsAmount(totalNum),
    'P:'+translit(payerName+(payerAddr&&payerAddr!=='—'?', '+payerAddr:'')).slice(0,70),
    'SF:189',
    'S:'+translit('Uplata po predracunu '+num).slice(0,35),
    'RO:97'+num.replace(/\D/g,'')
  ].join('|');
}
function renderQrInto(elId, text, size){
  const el=document.getElementById(elId);
  if(!el) return;
  el.innerHTML='';
  if(typeof QRCode==='undefined'){
    el.innerHTML='<div style="font-size:10px;color:var(--muted);padding:6px;text-align:center">QR biblioteka nije učitana<br>(potrebna internet konekcija)</div>';
    return;
  }
  new QRCode(el,{text, width:size, height:size, correctLevel:QRCode.CorrectLevel.M});
}

/* ---- kartica: formatiranje ---- */
function ccFormat(el){ el.value=el.value.replace(/\D/g,'').slice(0,16).replace(/(\d{4})(?=\d)/g,'$1 '); }
function ccExpFormat(el){
  let v=el.value.replace(/\D/g,'').slice(0,4);
  el.value=v.length>2?v.slice(0,2)+'/'+v.slice(2):v;
}

/* shopAdd/shopRem/shopQty definisani uz renderShopGrid (logika pakovanja) */

function shopTotals(){
  let subTotal=0, lines=[], weight=0;
  const cart = window.domextraShopCart || shopCart || {};
  const plist = window.domextraProducts || products || [];
  for(const id in cart){
    const p=plist.find(x=>String(x.id)===String(id));
    const q=Number(cart[id])||0;
    if(!p || q<=0) continue;
    const sum=wsPrice(p)*q;
    subTotal+=sum; weight+=lineWeight(p,q); lines.push({...p, qty:q, sum});
  }
  // popust od kupona
  let popust=0;
  if(appliedCoupon){
    if(appliedCoupon.tip==='%') popust=Math.round(subTotal*appliedCoupon.vred/100);
    else popust=Math.min(appliedCoupon.vred, subTotal);
  }
  const total=subTotal-popust;
  const ship=radioVal('ship');
  let dostava=0, dInfo=null;
  if(ship==='dostava' || ship==='kurir'){
    const c=courierFee(total, weight);
    dostava=c.fee||0; dInfo=c;
  }
  const grand=total+dostava;
  return {lines, subTotal, popust, total, weight, dostava, dInfo, grand, base:grand/1.2, vat:grand-grand/1.2};
}
function renderRateKalk(){
  const tot=shopTotals().grand;
  const n=parseInt(document.getElementById('rateBroj')?.value)||3;
  const kamate={3:0,6:0,12:0.04,18:0.06,24:0.08};
  const k=kamate[n]||0;
  const sum=tot*(1+k);
  const monthly=sum/n;
  if(document.getElementById('rkTotal')){
    document.getElementById('rkTotal').textContent=fmt(tot)+' RSD';
    document.getElementById('rkN').textContent=n;
    document.getElementById('rkMonthly').textContent=fmt(monthly)+' RSD';
    document.getElementById('rkSum').textContent=fmt(sum)+' RSD'+(k?' (kamata '+(k*100)+'%)':'');
  }
}

function getShopStockIssues(){
  const cart = window.domextraShopCart || shopCart || {};
  const plist = window.domextraProducts || products || [];
  const issues=[];
  for(const id in cart){
    const q=Number(cart[id])||0;
    if(q<=0) continue;
    const p=plist.find(x=>String(x.id)===String(id));
    if(!p || p.stock===undefined || p.stock===null || p.stock==='') continue;
    const stock=Number(p.stock);
    if(!Number.isFinite(stock) || q > stock + 1e-9){
      issues.push({id:String(id), name:p?.name||'Artikal', qty:q, stock:Number.isFinite(stock)?stock:0, unit:p?.jm||''});
    }
  }
  return issues;
}

function renderShopStockWarning(issues){
  const el=document.getElementById('shopStockWarning');
  const btn=document.getElementById('shopConfirm');
  if(!el || !btn) return;
  if(!issues.length){
    el.style.display='none';
    el.innerHTML='';
    return;
  }
  el.style.display='block';
  el.innerHTML='<b>Porudžbina nije moguća</b><br>'+issues.map(x=>
    `${x.name}: traženo <b>${qf(x.qty)} ${x.unit}</b>, dostupno <b>${qf(x.stock)} ${x.unit}</b>.`
  ).join('<br>');
  btn.disabled=true;
}

function validateShopCartStock(showToast=true){
  const issues=getShopStockIssues();
  renderShopStockWarning(issues);
  if(issues.length && showToast){
    const x=issues[0];
    toast(`${x.name}: nema dovoljno na stanju. Traženo ${qf(x.qty)} ${x.unit}, dostupno ${qf(x.stock)} ${x.unit}.`);
  }
  return issues.length===0;
}
window.validateShopCartStock=validateShopCartStock;

function refreshShopCartSummaryOnly(){
  try{
    const t=shopTotals();
    const count=document.getElementById('shopCount');
    if(count) count.textContent=t.lines.length+' artikala';
    if(!t.lines.length){ if(typeof renderShopCart==='function') renderShopCart(); return; }
    const dRow=document.getElementById('sShipRow');
    if(dRow){
      if(radioVal('ship')==='dostava' || radioVal('ship')==='kurir'){
        dRow.style.display='flex';
        const sShip=document.getElementById('sShip');
        const sShipNote=document.getElementById('sShipNote');
        if(sShip) sShip.textContent=t.dInfo&&t.dInfo.fee===null ? 'po dogovoru' : (t.dostava===0?'besplatno':fmt(t.dostava));
        if(sShipNote) sShipNote.textContent=t.dInfo ? '('+t.dInfo.label+' · ~'+qf(Math.round(t.weight*10)/10)+' kg)' : '';
      }else dRow.style.display='none';
    }
    const sSubRow=document.getElementById('sSubRow');
    const sPopRow=document.getElementById('sPopRow');
    if(sSubRow) sSubRow.style.display=t.popust>0?'flex':'none';
    if(sPopRow) sPopRow.style.display=t.popust>0?'flex':'none';
    const sSub=document.getElementById('sSub'); if(sSub) sSub.textContent=fmt(t.subTotal);
    const sPop=document.getElementById('sPop'); if(sPop) sPop.textContent='−'+fmt(t.popust);
    const sPopLab=document.getElementById('sPopLab'); if(sPopLab) sPopLab.textContent='Kupon '+(appliedCoupon?appliedCoupon.code:'');
    const sBase=document.getElementById('sBase'); if(sBase) sBase.textContent=fmt(t.base);
    const sVat=document.getElementById('sVat'); if(sVat) sVat.textContent=fmt(t.vat);
    const sTotal=document.getElementById('sTotal'); if(sTotal) sTotal.textContent=fmt(t.grand)+' RSD';
    const confirm=document.getElementById('shopConfirm'); if(confirm) confirm.disabled=false;
    renderShopStockWarning(getShopStockIssues());
    if(radioVal('pay')==='rate' && typeof renderRateKalk==='function') renderRateKalk();
  }catch(e){ console.warn('refreshShopCartSummaryOnly',e); }
}
window.refreshShopCartSummaryOnly=refreshShopCartSummaryOnly;

function renderShopCart(){
  const cart=document.getElementById('shopCart');
  const count=document.getElementById('shopCount');
  if(!cart || !count) return;
  const {lines,subTotal,popust,total,weight,dostava,dInfo,grand,base,vat}=shopTotals();
  count.textContent = lines.length+' artikala';
  if(!lines.length){
    cart.innerHTML='<div class="empty">Korpa je prazna — dodajte artikle.</div>';
    document.getElementById('shopTots').style.display='none';
    document.getElementById('shopConfirm').disabled=true; return;
  }
  cart.innerHTML = lines.map(l=>`
    <div class="cart-line">
      <div class="nm"><b>${l.name}</b><span>${l.sku} · ${fmt(wsPrice(l))} RSD/${l.jm}</span></div>
      <input class="qty-in" type="number" min="0" step="any" value="${l.qty}" data-cart-id="${String(l.id)}" aria-label="Količina">
      <div class="pr">${fmt(l.sum)}</div>
      <button class="x-btn" onclick="shopRem(${JSON.stringify(l.id)})" aria-label="Ukloni">✕</button>
    </div>`).join('');
  document.getElementById('shopTots').style.display='block';
  const dRow=document.getElementById('sShipRow');
  if(radioVal('ship')==='dostava' || radioVal('ship')==='kurir'){
    dRow.style.display='flex';
    document.getElementById('sShip').textContent = dInfo&&dInfo.fee===null ? 'po dogovoru' : (dostava===0?'besplatno':fmt(dostava));
    document.getElementById('sShipNote').textContent = dInfo ? '('+dInfo.label+' · ~'+qf(Math.round(weight*10)/10)+' kg)' : '';
  }else dRow.style.display='none';
  document.getElementById('sSubRow').style.display=popust>0?'flex':'none';
  document.getElementById('sSub').textContent=fmt(subTotal);
  document.getElementById('sPopRow').style.display=popust>0?'flex':'none';
  document.getElementById('sPop').textContent='−'+fmt(popust);
  document.getElementById('sPopLab').textContent='Kupon '+(appliedCoupon?appliedCoupon.code:'');
  document.getElementById('sBase').textContent=fmt(base);
  document.getElementById('sVat').textContent=fmt(vat);
  document.getElementById('sTotal').textContent=fmt(grand)+' RSD';
  document.getElementById('shopConfirm').disabled=false;
  renderShopStockWarning(getShopStockIssues());
  if(radioVal('pay')==='rate') renderRateKalk();
}

function radioVal(name){ const el=document.querySelector(`input[name="${name}"]:checked`); return el?el.value:''; }
const shipLabels={lično:'Lično preuzimanje u objektu',dostava:'Dostava sopstvenim vozilom na adresu',kurir:'Slanje kurirskom službom'};
const payLabels={pouzećem:'Plaćanje prilikom preuzimanja',IPS:'IPS skeniraj (instant plaćanje)',kartica:'Platna kartica online',uplatnica:'Uplata na tekući račun po predračunu (uplatnica)',rate:'Plaćanje na rate kroz banku partnera'};

function uplatnicaHTML(s,name,addr,total,num){
  const cell=(lab,con,extra)=>`<div class="up-cell" ${extra||''}><label>${lab}</label><div>${con}</div></div>`;
  return `
  <div class="uplatnica">
    <div class="up-title">НАЛОГ ЗА УПЛАТУ / NALOG ZA UPLATU</div>
    <div class="up-grid">
      <div class="up-left">
        ${cell('uplatilac',`${name}<br>${addr}`)}
        ${cell('svrha uplate',`Uplata po predračunu ${num}`)}
        ${cell('primalac',`${s.firm}<br>${s.addr}, ${s.city}`)}
      </div>
      <div class="up-right">
        <div class="up-row3">
          ${cell('šifra plaćanja','189')}
          ${cell('valuta','RSD')}
          ${cell('iznos','='+total.replace(' RSD',''))}
        </div>
        ${cell('račun primaoca',`<span class="mono">${s.acc}</span>`)}
        <div class="up-row2">
          ${cell('model','97')}
          ${cell('poziv na broj (odobrenje)',`<span class="mono">${num.replace(/[^0-9]/g,'')}</span>`)}
        </div>
        <div class="up-foot">
          <div class="up-qr-cell"><label>NBS IPS QR — skenirajte u m-banking aplikaciji</label><div id="upQr" class="qr-holder qr-s"></div></div>
          <div class="up-sign"><span>pečat i potpis uplatioca</span><span>mesto i datum prijema</span></div>
        </div>
      </div>
    </div>
  </div>`;
}
function toggleFirmaPolja(){
  document.getElementById('firmaPolja').style.display=document.getElementById('cFirma').checked?'block':'none';
}

async function apiJson(path, options={}){
  const headers={'Content-Type':'application/json', ...(options.headers||{})};
  const token=localStorage.getItem('domextra_token'); if(token) headers.Authorization='Bearer '+token;
  const r=await fetch('/api'+path,{...options,headers,credentials:'same-origin'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||'Greška servera');
  return data;
}
function autoDownloadInvoice(url){
  if(!url) return;
  const a=document.createElement('a'); a.href=url; a.download=''; document.body.appendChild(a); a.click(); a.remove();
}

function resetCheckoutToFirstStep(){
  try{

    // ==========================================
    // 1. PRAZNA KORPA
    // ==========================================
    shopCart = {};
    window.domextraShopCart = {};

    try{
      localStorage.setItem(
        'domextra_shop_cart',
        '{}'
      );
    }catch(e){}

    if(typeof saveShopCart === 'function'){
      saveShopCart();
    }


    // ==========================================
    // 2. OBRIŠI PODATKE KUPCA
    // ==========================================
    [
      'cName',
      'cPhone',
      'cMail',
      'cAddr',
      'cCity',
      'cFirma1',
      'cPib',
      'cMb',
      'cFirmaAddr',
      'ccNum',
      'ccName',
      'ccExp',
      'ccCvv',
      'couponCode'
    ].forEach(id => {

      const el = document.getElementById(id);

      if(el){
        el.value = '';
      }

    });


    // ==========================================
    // 3. FIRMA
    // ==========================================
    const firma = document.getElementById('cFirma');

    if(firma){
      firma.checked = false;
    }

    const firmaPolja = document.getElementById('firmaPolja');

    if(firmaPolja){
      firmaPolja.style.display = 'none';
    }


    // ==========================================
    // 4. RESETUJ ISPORUKU I PLAĆANJE
    // ==========================================
    ['ship','pay'].forEach(name => {

      const radios = document.querySelectorAll(
        `input[name="${name}"]`
      );

      radios.forEach((r,index) => {

        r.checked = index === 0;

        const box = r.closest('.opt');

        if(box){
          box.classList.toggle(
            'sel',
            r.checked
          );
        }

      });

    });


    // ==========================================
    // 5. SAKRIJ PANELS
    // ==========================================
    ['cardPanel','ratePanel'].forEach(id => {

      const el = document.getElementById(id);

      if(el){
        el.style.display = 'none';
      }

    });


    // ==========================================
    // 6. OBRIŠI PROMO KOD
    // ==========================================
    appliedCoupon = null;

    const couponCode = document.getElementById('couponCode');

    if(couponCode){
      couponCode.value = '';
    }

    const couponErr = document.getElementById('couponErr');

    if(couponErr){
      couponErr.textContent = '';
    }


    // ==========================================
    // 7. RESET CHECKOUT PROGRESS
    // ==========================================
    try{

      sessionStorage.removeItem(
        'domextra_checkout_max_step'
      );

      sessionStorage.setItem(
        'domextra_checkout_step',
        '1'
      );

    }catch(e){}


    // ==========================================
    // 8. URL STEP=1
    // ==========================================
    const url = new URL(
      window.location.href
    );

    url.searchParams.set(
      'step',
      '1'
    );

    history.replaceState(
      {},
      '',
      url.toString()
    );


    // ==========================================
    // 9. PRIKAŽI PRAZNU KORPU
    // ==========================================
    if(typeof renderShopCart === 'function'){
      renderShopCart();
    }


    // ==========================================
    // 10. VRATI WIZARD NA 1
    // ==========================================
    if(typeof ensureWizard === 'function'){
      ensureWizard();
    }


    // ==========================================
    // 11. OSVEŽI NAVIGACIJU KORPE
    // ==========================================
    if(typeof syncCartNavigation === 'function'){
      syncCartNavigation();
    }


    // ==========================================
    // 12. VRATI NA VRH STRANICE
    // ==========================================
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }catch(e){

    console.error(
      'resetCheckoutToFirstStep',
      e
    );

  }
}

async function confirmShop(){
  try{
    const {lines,total,weight,dostava,dInfo,grand,base,vat}=shopTotals();
    if(!lines.length){ toast('Korpa je prazna.'); resetCheckoutToFirstStep(); 
  



return; }
    if(!validateShopCartStock(true)) return;
    const pay=radioVal('pay');
    if(pay==='kartica'){
      const num=val('ccNum').replace(/\s/g,''), nm=val('ccName').trim(), ex=val('ccExp'), cv=val('ccCvv');
      if(num.length<16||!nm||ex.length<5||cv.length<3){ toast('Popunite sve podatke o kartici.'); return; }
    }
    const name=document.getElementById('cName')?.value||'Kupac';
    const mail=document.getElementById('cMail')?.value||'';
    const addr=[document.getElementById('cAddr')?.value,document.getElementById('cCity')?.value].filter(Boolean).join(', ');
    const phone=document.getElementById('cPhone')?.value||'';
    if(!name||!mail||!addr){ toast('Popunite podatke kupca.'); return; }
    const firmaCheck=document.getElementById('cFirma')?.checked;
    const firmaNaziv=val('cFirma1'), firmaPib=val('cPib'), firmaMb=val('cMb'), firmaAddr=val('cFirmaAddr');
    if(firmaCheck && (!firmaNaziv||!firmaPib)){ toast('Za fakturu pravnom licu unesite naziv firme i PIB.'); return; }
    const items=lines.map(l=>({productId:String(l.id),qty:Number(l.qty)}));
    const payload={
      items, customer:{name,phone,email:mail,address:document.getElementById('cAddr')?.value||'',city:document.getElementById('cCity')?.value||'',company:firmaCheck?firmaNaziv:'',pib:firmaCheck?firmaPib:'',mb:firmaCheck?firmaMb:'',companyAddress:firmaCheck?firmaAddr:''},
      shippingMethod:radioVal('ship'), paymentMethod:pay, couponCode:appliedCoupon?.code||null
    };
    const result=await apiJson('/orders/shop',{method:'POST',body:JSON.stringify(payload)});
    const s=settings();
    const buyerName=firmaCheck?firmaNaziv:name;
    const buyerBlock=firmaCheck?`<b>${firmaNaziv}</b><br>${firmaAddr||addr}<br>PIB: ${firmaPib}${firmaMb?' · MB: '+firmaMb:''}<br>Tel: ${phone} · E-mail: ${mail}`:`<b>${name}</b><br>${addr}<br>Tel: ${phone}<br>E-mail: ${mail}`;
    const num=result.order?.invoiceNumber||docNum('SHOP');
    let payDetail=payLabels[pay]||pay;
    let extra=`<div class="doc-pay"><b>Isporuka:</b> ${shipLabels[radioVal('ship')]}<br><b>Plaćanje:</b> ${payDetail}</div>`;
    let rows=lines.map(l=>`<tr><td><b>${l.name}</b><br><span class="mono" style="color:var(--muted)">${l.sku}</span></td><td class="r">${qf(l.qty)} ${l.jm}</td><td class="r">${fmt(wsPrice(l))}</td><td class="r">${fmt(l.sum)}</td></tr>`).join('');
    if(radioVal('ship')==='dostava' || radioVal('ship')==='kurir'){ const dCena=dInfo&&dInfo.fee===null?'po dogovoru':(dostava===0?'0,00':fmt(dostava)); rows+=`<tr><td><b>Dostava</b></td><td class="r">1</td><td class="r">${dCena}</td><td class="r">${dCena}</td></tr>`; }
    openDoc({type:'SHOP',title:'Predračun — Web Shop',logBuyer:buyerName,items:items,shopMeta:{pay:payDetail,ship:shipLabels[radioVal('ship')]},buyerBlock, mails:[s.mailOff,mail].filter(Boolean),rows,head:'<th>Artikal</th><th class="r">Količina</th><th class="r">Cena (RSD)</th><th class="r">Iznos (RSD)</th>',tots:[['Osnovica',fmt(base)],['PDV 20%',fmt(vat)]],total:fmt(grand)+' RSD',extra,ipsText:null,orderId:result.order?.id,pdfUrl:result.order?.pdfUrl,emailSent:!!result.order?.emailSent,emailError:result.order?.emailError||null});
    shopCart={}; window.domextraShopCart={}; saveShopCart(); renderShopCart(); document.getElementById('abandonBanner').style.display='none'; appliedCoupon=null; const cc=document.getElementById('couponCode'); if(cc) cc.value=''; const ce=document.getElementById('couponErr'); if(ce) ce.textContent='';
    if(typeof window.domextraReloadPublic==='function') await window.domextraReloadPublic();
    if(currentShopUser && typeof window.domextraRefreshShopUser==='function'){ try{ await window.domextraRefreshShopUser(); }catch(e){} }
    resetCheckoutToFirstStep();
    if(result.order?.pdfUrl) setTimeout(()=>autoDownloadInvoice(result.order.pdfUrl),300);
    if(result.order?.emailError && !result.order.emailSent) toast('Porudžbina je sačuvana. E-mail nije poslat: '+result.order.emailError);
    else toast('Porudžbina je sačuvana. Predračun se preuzima.');
  }catch(e){ console.error('confirmShop',e); toast(e.message||'Porudžbina nije uspešno sačuvana.'); }
}

/* ================= B2B ================= */
function cb(){ return currentBuyer||buyers[0]; }
function redRab(){ return klasaRab[cb().klasa]; }
function initials(n){ return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(); }
function renderBuyerStrip(){
  const b=cb();
  const mine=orders.filter(o=>o.type==='B2B'&&o.buyer===b.name);
  document.getElementById('buyerStrip').innerHTML=`
    <div class="avatar">${initials(b.name)}</div>
    <div class="who"><b>${b.name}, ${b.city.replace(/^\d+\s*/,'')}</b><span>ulogovan: ${b.user}</span></div>
    <span class="klasa">KLASA ${b.klasa} · redovni rabat ${klasaRab[b.klasa]}%</span>
    <div class="meta"><b>PIB</b> ${b.pib} &nbsp;·&nbsp; <b>MB</b> ${b.mb} &nbsp;·&nbsp; <b>Valuta</b> ${b.valuta} dana<br>${b.addr}, ${b.city}</div>
    <button class="tab-btn ${myB2bOpen?'active':''}" style="background:${myB2bOpen?'var(--accent)':'transparent'};color:${myB2bOpen?'var(--accent-ink)':'#fff'};border-color:${myB2bOpen?'var(--accent)':'#3c3c3c'}" onclick="toggleMyB2B()">Moje porudžbenice (${mine.length})</button>
    <button class="logout-btn" onclick="b2bLogout()">Odjava</button>`;
}
let myB2bOpen=false;
function toggleMyB2B(){
  myB2bOpen=!myB2bOpen;
  document.getElementById('myB2bPanel').style.display=myB2bOpen?'block':'none';
  renderBuyerStrip(); renderMyB2B();
  if(myB2bOpen){ const p=document.getElementById('myB2bPanel'); if(p.scrollIntoView) p.scrollIntoView({behavior:'smooth',block:'start'}); }
}
function isAvans(){ const c=document.getElementById('avansChk'); return c?c.checked:true; }
function isLicno(){ const c=document.getElementById('licnoChk'); return c?c.checked:false; }
function syncLicno(){ const sel=document.getElementById('b2bShip'); if(sel) sel.value=isLicno()?'licno':'dostava'; }
function syncShip(){ const sel=document.getElementById('b2bShip'), c=document.getElementById('licnoChk'); if(sel&&c) c.checked=(sel.value==='licno'); }
function posRab(){ return cb().rabPos||0; }
function posArt(p){ return p.rabPosA||0; }
function posLabel(p){ const a=[posRab(),posArt(p)].filter(x=>x); return a.length?a.join('+')+'%':'—'; }
function netPrice(p){ // kaskadno: redovni (klasa) → poseban (kupac) → akcijski → avansni (ako avans) → logistički (ako lično preuzima)
  let n=p.price*(1-redRab()/100)*(1-posRab()/100)*(1-posArt(p)/100)*(1-p.rabAk/100);
  if(isAvans()) n*=(1-p.rabAv/100);
  if(isLicno()) n*=(1-p.rabLog/100);
  return n;
}
function lineCalc(p,qty){ // iznos svakog rabata ponaosob, kaskadno
  const gross=p.price*qty;
  const a1=gross*(1-redRab()/100), redAmt=gross-a1;
  const a2=a1*(1-posRab()/100)*(1-posArt(p)/100), posAmt=a1-a2;
  const a3=a2*(1-p.rabAk/100), akAmt=a2-a3;
  const a4=isAvans()?a3*(1-p.rabAv/100):a3, avAmt=a3-a4;
  const a5=isLicno()?a4*(1-p.rabLog/100):a4, logAmt=a4-a5;
  return {gross, redAmt, posAmt, akAmt, avAmt, logAmt, net:a5};
}
function stockPill(s){
  if(s===0) return '<span class="stock-pill stock-out">0 — nema</span>';
  if(s<=10) return `<span class="stock-pill stock-low">${qf(s)} — nisko</span>`;
  return `<span class="stock-pill stock-ok">${qf(s)}</span>`;
}
function prodImg(p,cls){
  return p.img
    ? `<img src="${p.img}" class="${cls}" style="object-fit:cover" alt="${p.name}" onerror="this.outerHTML='<div class=&quot;${cls}&quot;>${p.ico}</div>'">`
    : `<div class="${cls}">${p.ico}</div>`;
}
function renderGrupaFilter(){
  const el=document.getElementById('grupaFilter'); if(!el) return;
  const cur=el.value||'';
  const grupe=[...new Set(products.map(p=>p.grupa))];
  el.innerHTML='<option value="">Sve grupe</option>'+grupe.map(g=>`<option ${g===cur?'selected':''}>${g}</option>`).join('');
}
function renderB2BRows(){
  if(!document.getElementById('b2bRows') && !document.getElementById('b2bCards')) return;
  renderGrupaFilter();
  const av=isAvans(), li=isLicno();
  const filt=document.getElementById('grupaFilter')?.value||'';
  const q=(document.getElementById('bSearch')?.value||'').toLowerCase().trim();
  const st=document.getElementById('stockFilter')?.value||'';
  const list=products.filter(p=>
    (!filt||p.grupa===filt) &&
    (!q||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||String(p.bar).includes(q)) &&
    (!st || (st==='ok'&&p.stock>STOCK_MIN) || (st==='low'&&p.stock>0&&p.stock<=STOCK_MIN) || (st==='out'&&p.stock===0))
  );
  const cc=document.getElementById('b2bCatCount');
  if(cc) cc.textContent=list.length+' od '+products.length+' artikala';
  document.getElementById('b2bRows').innerHTML = list.length ? list.map(p=>`
    <tr>
      <td>${prodImg(p,'t-img')}</td>
      <td class="mono">${p.sku}<br><span style="color:var(--muted)">${p.bar}</span></td>
      <td><div class="t-name">${p.name}</div><div class="t-desc">${p.desc}</div><div class="t-desc" style="color:var(--accent-ink);background:#f3ffd6;display:inline-block;padding:1px 7px;border-radius:99px;font-size:10px;margin-top:3px">${p.grupa}</div></td>
      <td>${stockPill(p.stock)}</td>
      <td><div style="display:flex;gap:6px;align-items:center"><input class="qty-in" type="number" min="0" step="any" placeholder="0" value="${b2bCart[p.id]||''}" oninput="b2bQtyLive(${JSON.stringify(p.id)},this.value)" onchange="b2bQty(${JSON.stringify(p.id)},this.value)" aria-label="Količina ${p.name}"><button type="button" class="x-btn" style="border:1px solid var(--line);padding:6px 9px" data-b2b-add-id="${String(p.id)}">Dodaj</button></div></td>
      <td>${p.jm}${pakInfo(p)?`<br><span style="font-size:10px;color:var(--muted);white-space:nowrap">${pakInfo(p)}</span>`:''}</td>
      <td class="mono">${fmt(p.price)}</td>
      <td class="mono rab-cell">${redRab()}%<br><span style="color:var(--muted);font-size:10px">klasa ${cb().klasa}</span></td>
      <td class="mono rab-cell">${posLabel(p)}</td>
      <td class="mono rab-cell">${p.rabAk?p.rabAk+'%':'—'}</td>
      <td class="mono rab-cell ${av?'':'rab-off'}">${p.rabAv}%${av?'':'<br><span style="font-size:9.5px">neaktivan</span>'}</td>
      <td class="mono rab-cell ${li?'':'rab-off'}">${p.rabLog}%${li?'':'<br><span style="font-size:9.5px">neaktivan</span>'}</td>
      <td class="mono"><b>${fmt(netPrice(p))}</b></td>
    </tr>`).join('') : '<tr><td colspan="13"><div class="empty">Nema artikala za zadate filtere.</div></td></tr>';
  // mobilni kartični prikaz
  const cards=document.getElementById('b2bCards');
  if(cards) cards.innerHTML=list.length ? list.map(p=>`
    <div class="bc">
      <div class="bc-top">
        ${prodImg(p,'bc-img')}
        <div class="bc-info">
          <b>${p.name}</b>
          <span class="mono">${p.sku} · ${p.bar}</span>
          <span class="bc-grupa">${p.grupa}</span>
        </div>
        ${stockPill(p.stock)}
      </div>
      <div class="bc-desc">${p.desc}</div>
      <div class="bc-rab">
        <i>Red. <b>${redRab()}%</b></i>
        <i>Pos. <b>${posLabel(p)}</b></i>
        <i>Akc. <b>${p.rabAk?p.rabAk+'%':'—'}</b></i>
        <i class="${av?'':'bc-off'}">Av. <b>${p.rabAv}%</b></i>
        <i class="${li?'':'bc-off'}">Log. <b>${p.rabLog}%</b></i>
      </div>
      <div class="bc-bot">
        <div class="bc-price"><span>VP ${fmt(p.price)}</span><b>${fmt(netPrice(p))} <small>RSD/${p.jm} neto</small></b>${pakInfo(p)?`<span style="font-size:10px;color:var(--muted)">${pakInfo(p)}</span>`:''}</div>
        <div style="display:flex;gap:6px;align-items:center"><input class="qty-in bc-qty" type="number" min="0" step="any" placeholder="0" value="${b2bCart[p.id]||''}" oninput="b2bQtyLive(${JSON.stringify(p.id)},this.value)" onchange="b2bQty(${JSON.stringify(p.id)},this.value)" aria-label="Količina ${p.name}"><button type="button" class="x-btn" style="border:1px solid var(--line);padding:6px 9px" data-b2b-add-id="${String(p.id)}">Dodaj</button></div>
      </div>
    </div>`).join('') : '<div class="empty">Nema artikala za zadate filtere.</div>';
}
const qf = n => n%1===0 ? n.toLocaleString('sr-RS') : n.toLocaleString('sr-RS',{minimumFractionDigits:2,maximumFractionDigits:2});
const round2 = n => Math.round(n*100)/100;
function pakInfo(p){ return p.pak>1||p.jm==='m²' ? `1 ${p.pakNaziv} = ${qf(p.pak)} ${p.jm}` : ''; }
function b2bQtyLive(id,v){
  const n=parseFloat(String(v).replace(',', '.'));
  if(!Number.isFinite(n) || n<=0) delete b2bCart[id];
  else b2bCart[String(id)]=n;
  // Donja porudžbenica se osvežava odmah, ali katalog/input ostaje netaknut.
  try{ renderB2BCart(); }catch(e){ console.error('B2B cart render:',e); }
}

// Pouzdano rukovanje B2B dugmetom "Dodaj" za dinamički renderovane proizvode.
document.addEventListener('click', function(e){
  const btn=e.target.closest('[data-b2b-add-id]');
  if(!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const wrap=btn.parentElement;
  const input=wrap ? wrap.querySelector('input.qty-in') : null;
  const id=btn.getAttribute('data-b2b-add-id');
  const value=input ? input.value : '';
  b2bAddFromInput(id,value);
});

function b2bAddFromInput(id,v){
  const p=products.find(x=>String(x.id)===String(id));
  const n=parseFloat(String(v).replace(',', '.'));
  if(!p){ toast('Proizvod nije pronađen.'); return; }
  if(!Number.isFinite(n) || n<=0){ toast('Unesite količinu veću od 0.'); return; }
  b2bQty(id,n);
  // Osiguraj da je stavka stvarno prisutna čak i ako je količina promenjena
  // neposredno pre klika na Dodaj.
  b2bCart[String(id)] = b2bCart[String(id)] || b2bCart[id] || n;
  renderB2BCart();
}

function b2bQty(id,v){
  v=Math.max(0,parseFloat(String(v).replace(',', '.'))||0);
  const p=products.find(x=>x.id==id);
  if(!p) return;
  if(v===0){ delete b2bCart[id]; renderB2BRows(); renderB2BCart(); return; }
  // Zaokruživanje naviše na cela pakovanja tek kada korisnik završi unos.
  const pak=Math.max(Number(p.pak)||1,1);
  const kut=Math.ceil(round2(v/pak)-1e-9);
  const adj=round2(kut*pak);
  if(Math.abs(adj-v)>0.001){
    toast(`${p.name}: ${qf(v)} ${p.jm} → zaokruženo na ${kut} ${p.pakNaziv}${kut>1?'e':''} = ${qf(adj)} ${p.jm}`);
  }
  b2bCart[id]=adj;
  renderB2BRows();
  renderB2BCart();
}

function b2bCompute(){
  let gross=0, net=0, redAmt=0, posAmt=0, akAmt=0, avAmt=0, logAmt=0, weight=0, lines=[], missing=[];
  for(const id in b2bCart){
    const p=products.find(x=>String(x.id)===String(id));
    const req=Number(b2bCart[id]);
    if(!p || !Number.isFinite(req) || req<=0) continue;
    if(p.stock===0){ missing.push({p, req, got:0}); continue; }
    let got=Math.min(req,p.stock);
    if(got<req){ // svesti na cela pakovanja koja staju u stanje
      got=round2(Math.floor((p.stock+1e-9)/p.pak)*p.pak);
      if(got<=0){ missing.push({p, req, got:0}); continue; }
      missing.push({p, req, got});
    }
    const lc=lineCalc(p,got), np=netPrice(p);
    gross+=lc.gross; net+=lc.net;
    redAmt+=lc.redAmt; posAmt+=lc.posAmt; akAmt+=lc.akAmt; avAmt+=lc.avAmt; logAmt+=lc.logAmt;
    weight+=lineWeight(p,got);
    lines.push({p, qty:got, np, sum:lc.net, lc});
  }
  const ship=document.getElementById('b2bShip')?.value || (isLicno()?'licno':'dostava');
  let dostava=0, dInfo=null;
  if(ship==='kurir'){ const c=courierFee(net, weight); dostava=c.fee||0; dInfo=c; }
  const baseWithShip=net+dostava;
  const vat=baseWithShip*0.2;
  return {lines, missing, gross, net, redAmt, posAmt, akAmt, avAmt, logAmt, weight, ship, dostava, dInfo, rab:gross-net, vat, total:baseWithShip+vat};
}
function missingNoteHTML(missing){
  if(!missing.length) return '';
  const items=missing.map(m=> m.got===0
    ? `<b style="display:inline">${m.p.name}</b> (${m.p.sku}) — traženo ${qf(m.req)} ${m.p.jm}, <u>nema na stanju</u>`
    : `<b style="display:inline">${m.p.name}</b> (${m.p.sku}) — traženo ${qf(m.req)} ${m.p.jm}, uneto ${qf(m.got)} ${m.p.jm} (raspoloživo stanje)`
  ).join('<br>');
  return items;
}
function renderB2BCart(){
  if(!document.getElementById('b2bCart') && !document.getElementById('b2bTots')) return;
  const c=b2bCompute();
  document.getElementById('avansHint').textContent=isAvans()
    ?'Valuta: uplata 5 dana · avansni rabat se obračunava'
    :'Valuta: '+cb().valuta+' dana po uslovima kupca · bez avansnog rabata';
  document.getElementById('licnoHint').textContent=isLicno()
    ?'Kupac sam preuzima robu — logistički rabat se obračunava'
    :'Nije čekirano — isporuka po dogovoru, bez logističkog rabata';
  const cart=document.getElementById('b2bCart');
  document.getElementById('b2bCount').textContent=c.lines.length+' stavki';
  const noteEl=document.getElementById('b2bNote');
  noteEl.innerHTML = c.missing.length
    ? `<div class="note-box"><b>⚠ Napomena o stanju</b>${missingNoteHTML(c.missing)}<br><span style="color:#a96d6d">Navedeno nije uneto (ili je umanjeno) u porudžbenicu jer nije bilo na stanju.</span></div>`
    : '';
  if(!c.lines.length){
    cart.innerHTML='<div class="empty">Unesite količine u katalogu.</div>';
    document.getElementById('b2bTots').style.display='none';
    document.getElementById('b2bConfirm').disabled=true; return;
  }
  cart.innerHTML=c.lines.map(l=>`
    <div class="cart-line">
      <div class="nm"><b>${l.p.name}</b><span>${l.p.sku} · ${qf(l.qty)} ${l.p.jm} × ${fmt(l.np)} neto</span></div>
      <div class="pr">${fmt(l.sum)}</div>
      <button class="x-btn" onclick="b2bQty(${JSON.stringify(l.p.id)},0);renderB2BRows()" aria-label="Ukloni">✕</button>
    </div>`).join('');
  document.getElementById('b2bTots').style.display='block';
  const av=isAvans(), li=isLicno();
  document.getElementById('bGross').textContent=fmt(c.gross);
  document.getElementById('bRabRedL').textContent='Redovni rabat (klasa '+cb().klasa+')';
  document.getElementById('bRabRed').textContent='−'+fmt(c.redAmt);
  document.getElementById('rowRabPos').style.display=posRab()?'flex':'none';
  document.getElementById('bRabPos').textContent='−'+fmt(c.posAmt);
  document.getElementById('bRabAk').textContent='−'+fmt(c.akAmt);
  document.getElementById('rowRabAv').style.display=av?'flex':'none';
  document.getElementById('bRabAv').textContent='−'+fmt(c.avAmt);
  document.getElementById('rowRabLog').style.display=li?'flex':'none';
  document.getElementById('bRabLog').textContent='−'+fmt(c.logAmt);
  const rs=document.getElementById('rowShip');
  if(c.ship==='kurir'){
    rs.style.display='flex';
    document.getElementById('bShip').textContent = c.dInfo&&c.dInfo.fee===null ? 'po dogovoru' : (c.dostava===0?'besplatno':fmt(c.dostava));
    document.getElementById('bShipNote').textContent = c.dInfo ? '('+c.dInfo.label+' · ~'+qf(Math.round(c.weight*10)/10)+' kg)' : '';
  }else rs.style.display='none';
  document.getElementById('bBase').textContent=fmt(c.net);
  document.getElementById('bVat').textContent=fmt(c.vat);
  document.getElementById('bTotal').textContent=fmt(c.total)+' RSD';
  document.getElementById('bValuta').textContent=av?'5 dana (avans)':cb().valuta+' dana (po uslovima kupca)';
  document.getElementById('b2bConfirm').disabled=false;
}

async function confirmB2B(){
  const c=b2bCompute();
  const av=isAvans(), li=isLicno();
  // Stanje se skida na serveru kada se kreira B2B porudžbina.
  const tots=[
    ['Vrednost bez rabata',fmt(c.gross)],
    ['Redovni rabat (klasa '+cb().klasa+')','−'+fmt(c.redAmt)]
  ];
  if(c.posAmt>0) tots.push(['Poseban rabat','−'+fmt(c.posAmt)]);
  tots.push(['Akcijski rabat','−'+fmt(c.akAmt)]);
  if(av) tots.push(['Avansni rabat','−'+fmt(c.avAmt)]);
  if(li) tots.push(['Logistički rabat (lično preuzimanje)','−'+fmt(c.logAmt)]);
  if(c.ship==='kurir'){
    const dCena=c.dInfo&&c.dInfo.fee===null?'po dogovoru':(c.dostava===0?'0,00':fmt(c.dostava));
    tots.push(['Dostava — kurirska služba ('+(c.dInfo?c.dInfo.label:'')+')', dCena]);
  }
  tots.push(['Osnovica',fmt(c.net + (c.ship==='kurir'?c.dostava:0))],['PDV 20%',fmt(c.vat)]);
  const shipTxt = c.ship==='kurir'
      ? `kurirska služba (${c.dInfo?c.dInfo.label:''}${c.dostava===0&&c.dInfo&&c.dInfo.free?', besplatno':''}, ~${qf(Math.round(c.weight*10)/10)} kg)`
      : c.ship==='licno' ? 'lično preuzimanje od strane kupca' : 'dostava sopstvenim vozilom';
  const b2bRowsHtml = c.lines.map(l=>`<tr>
      <td><b>${l.p.name}</b><br><span class="mono" style="color:var(--muted)">${l.p.sku} · ${l.p.bar}</span></td>
      <td class="r">${qf(l.qty)} ${l.p.jm}</td>
      <td class="r">${fmt(l.p.price)}</td>
      <td class="r">${redRab()}%</td>
      <td class="r">${posLabel(l.p)}</td>
      <td class="r">${l.p.rabAk?l.p.rabAk+'%':'—'}</td>
      <td class="r">${av?l.p.rabAv+'%':'—'}</td>
      <td class="r">${li?l.p.rabLog+'%':'—'}</td>
      <td class="r">${fmt(l.np)}</td>
      <td class="r">${fmt(l.sum)}</td></tr>`).join('')
    + ((c.ship==='dostava' || c.ship==='kurir') ? `<tr><td><b>Dostava</b><br><span class="mono" style="color:var(--muted)">Slanje kurirskom službom${c.dInfo?' · '+c.dInfo.label:''}${c.dostava===0&&c.dInfo&&c.dInfo.free?' (besplatno)':''}</span></td><td class="r">1</td><td class="r">${c.dInfo&&c.dInfo.fee===null?'po dog.':fmt(c.dostava)}</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">${c.dInfo&&c.dInfo.fee===null?'po dog.':fmt(c.dostava)}</td><td class="r">${c.dInfo&&c.dInfo.fee===null?'po dogovoru':fmt(c.dostava)}</td></tr>` : '');
  await openDoc({
    type:'B2B', title:'Predračun — B2B porudžbenica', logBuyer:cb().name,
    rokDana: av?5:cb().valuta,
    buyerBlock:`<b>${cb().name}</b><br>${cb().addr}, ${cb().city}<br>PIB: ${cb().pib} · MB: ${cb().mb}<br>Tek. račun: ${cb().acc}<br>E-mail: ${cb().mail} · Klasa: ${cb().klasa}`,
    mails:[cb().mail, settings().mailOff],
    rows: b2bRowsHtml,
    head:'<th>Proizvod (SKU / barkod)</th><th class="r">Kol.</th><th class="r">VP cena</th><th class="r">Red.</th><th class="r">Pos.</th><th class="r">Akc.</th><th class="r">Av.</th><th class="r">Log.</th><th class="r">Neto cena</th><th class="r">Iznos (RSD)</th>',
    tots, total:fmt(c.total)+' RSD',
    extra:`<div class="doc-pay"><b>Plaćanje:</b> ${av?'avansno, na tekući račun dobavljača':'po uslovima kupca, na tekući račun dobavljača'} · <b>Valuta plaćanja:</b> ${av?'5 dana (avans)':cb().valuta+' dana'}<br><b>Isporuka:</b> ${shipTxt}${li?' (obračunat logistički rabat)':''} · <b>Poziv na broj:</b> ${docNum('B2B')}<br>Rezervisane količine su skinute sa stanja po potvrdi kupca.</div>`,
    note: c.missing.length ? `<div class="doc-note"><b>Napomena — artikli koji nisu bili na stanju</b>${missingNoteHTML(c.missing)}<br>Iz tog razloga navedene stavke nisu unete u porudžbenicu (ili su unete u umanjenoj količini).</div>` : ''
  });
  // Korpu čistimo tek kada je backend uspešno napravio B2B porudžbinu.
  b2bCart={}; renderB2BRows(); renderB2BCart();
}

/* ================= DOKUMENT ================= */
function settings(){
  const db = (window.domextraSettings && typeof window.domextraSettings === 'object') ? window.domextraSettings : {};
  const read = (id, key) => {
    const el = document.getElementById(id);
    return el ? el.value : (db[key] ?? '');
  };
  return {
    firm:read('sFirm','firm'),
    addr:read('sAddr','address'),
    city:read('sCity','city'),
    pib:read('sPib','pib'),
    mb:read('sMb','mb'),
    acc:read('sAcc','account'),
    mailOff:read('sMailOff','officialMail'),
    pref:read('sPref','invoicePrefix'),
    days:read('sDays','paymentDays')
  };
}
function val(id){ const el=document.getElementById(id); return el ? el.value : ''; }

function docNum(type){ const s=settings(); return `${s.pref}${type==='SHOP'?'-WS':''}-2026-${String(docSeq).padStart(4,'0')}`; }
function openDoc(d){
  const s=settings();
  const num=docNum(d.type);
  const today=new Date().toLocaleDateString('sr-RS');
  docCtx={...d};
  const ord={num, orderId:d.orderId||null, pdfUrl:d.pdfUrl||null, emailSent:!!d.emailSent, date:today, type:d.type, buyer:d.logBuyer||'—', total:d.total, status:'Novo',
             kreiranTs:Date.now(),
             items:d.items||[],
             pay:d.shopMeta?.pay, ship:d.shopMeta?.ship,
             rokDana:d.rokDana||null,
             rokTs: d.rokDana ? Date.now()+d.rokDana*86400000 : null,
             title:d.title, mails:d.mails, ipsText:d.ipsText||null};
  document.getElementById('docTitle').textContent=d.title;
  const bodyHTML=`
    <div class="doc-head">
      <div class="firm">
        <b>${s.firm}</b><br>${s.addr}, ${s.city}<br>
        PIB: ${s.pib} · Matični broj: ${s.mb}<br>
        Tekući račun: <span class="mono">${s.acc}</span><br>
        E-mail: ${s.mailOff}
      </div>
      <div style="text-align:right">
        <h2>PREDRAČUN</h2>
        <div class="num">Broj: <b>${num}</b><br>Datum: ${today}<br>Mesto: ${s.city}</div>
      </div>
    </div>
    <div class="parties">
      <div><h4>Dobavljač</h4><div class="firm"><b>${s.firm}</b><br>${s.addr}, ${s.city}<br>PIB: ${s.pib} · MB: ${s.mb}<br>Tekući račun: <span class="mono">${s.acc}</span><br>E-mail: ${s.mailOff}</div></div>
      <div><h4>Kupac</h4><div class="firm">${d.buyerBlock}</div></div>
    </div>
    <table class="doc-t"><thead><tr>${d.head}</tr></thead><tbody>${d.rows}</tbody></table>
    <div class="doc-tots">
      ${d.tots.map(t=>`<div class="tot-row"><span>${t[0]}</span><span class="mono">${t[1]}</span></div>`).join('')}
      <div class="tot-row big"><span>Za uplatu</span><span class="mono">${d.total}</span></div>
    </div>
    ${d.note}
    ${d.extra}
    <div class="doc-foot">
      <span>Predračun nije fiskalni račun. Roba se isporučuje po evidentiranoj uplati.</span>
      <span class="mono">${num}</span>
    </div>`;
  document.getElementById('docBody').innerHTML=bodyHTML;
  ord.docHTML=bodyHTML;
  logOrder(ord);
  if(d.type==='SHOP' && currentShopUser){
    currentShopUser.history.unshift(ord);
    setTimeout(checkAbandonedCart, 500);
  }
  if(d.type==='SHOP'){
    const totalNum=parseFloat(d.total.replace(/\./g,'').replace(',','.'))||0;
    trackEvent('purchase', {transaction_id:num, value:totalNum, currency:'RSD', items:(d.items||[]).map(it=>({item_id:products.find(x=>x.id===it.id)?.sku, quantity:it.qty}))});
  }
  document.getElementById('docOverlay').classList.add('open');
  if(d.ipsText){
    renderQrInto('ipsQr', d.ipsText, 150);
    renderQrInto('upQr', d.ipsText, 110);
  }
  docSeq++;
}
function viewOrderDocument(orderId, pdfUrl){
  const url = pdfUrl || (orderId ? '/api/orders/'+encodeURIComponent(orderId)+'/invoice.pdf' : '');
  if(!url){ toast('Dokument nije povezan sa porudžbinom.'); return; }
  const viewUrl = url + (url.includes('?') ? '&' : '?') + 'view=1';
  window.open(viewUrl, '_blank', 'noopener');
}

function downloadOrderDocument(orderId, pdfUrl){
  const url = pdfUrl || (orderId ? '/api/orders/'+encodeURIComponent(orderId)+'/invoice.pdf' : '');
  if(!url){ toast('Dokument nije povezan sa porudžbinom.'); return; }
  const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.click();
}

function reopenDoc(num){
  const o=orders.find(x=>x.num===num);
  if(!o){ toast('Porudžbina nije pronađena.'); return; }
  if(!o.docHTML){
    viewOrderDocument(o.orderId||o.id, o.pdfUrl);
    return;
  }
  docCtx={mails:o.mails||[],orderId:o.orderId||o.id||null,pdfUrl:o.pdfUrl||null};
  document.getElementById('docTitle').textContent=o.title||'Predračun';
  document.getElementById('docBody').innerHTML=o.docHTML;
  document.getElementById('docOverlay').classList.add('open');
  if(o.ipsText){ renderQrInto('ipsQr', o.ipsText, 150); renderQrInto('upQr', o.ipsText, 110); }
}
function closeDoc(){ document.getElementById('docOverlay').classList.remove('open'); }
async function sendDoc(){
  if(!docCtx) return;
  if(!docCtx.orderId){ toast('Dokument još nije povezan sa porudžbinom.'); return; }
  try{
    const r=await apiJson('/orders/'+encodeURIComponent(docCtx.orderId)+'/send-email',{method:'POST',body:JSON.stringify({recipients:docCtx.mails||[]})});
    toast('Predračun je poslat na: '+(r.sentTo||docCtx.mails||[]).join(' i '));
  }catch(e){ toast(e.message||'Slanje mejla nije uspelo.'); }
}
function toast(msg){
  document.getElementById('toastMsg').textContent=msg;
  const t=document.getElementById('toast');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),4200);
}

/* ================= IZVOZ CSV (Excel) ================= */
function dlCSV(name, rows){
  const csv='\ufeff'+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
  URL.revokeObjectURL(a.href);
  toast('Izvezeno: '+name+' — otvara se u Excel-u.');
}
function exportKupci(){
  dlCSV('kupci.csv',[
    ['Naziv','Adresa','Grad','PIB','Matični broj','Tekući račun','E-mail','Klasa','Redovni rabat %','Poseban rabat %','Valuta (dana)','Korisničko ime','Status'],
    ...buyers.map(b=>[b.name,b.addr,b.city,b.pib,b.mb,b.acc,b.mail,b.klasa,klasaRab[b.klasa],b.rabPos||0,b.valuta,b.user,b.active?'aktivan':'blokiran'])
  ]);
}
function exportPorudzbine(){
  dlCSV('porudzbine.csv',[
    ['Broj','Datum','Kanal','Kupac','Iznos (RSD)','Status','Plaćanje','Isporuka'],
    ...orders.map(o=>[o.num,o.date,o.type==='B2B'?'B2B':'Web Shop',o.buyer,o.total.replace(' RSD',''),o.status,o.pay||'',o.ship||''])
  ]);
}
function exportArtikli(){
  dlCSV('artikli.csv',[
    ['SKU','Barkod','Naziv','Opis','Grupa','JM','Pakovanje','Naziv pakovanja','VP cena','Akcijski rabat %','Avansni rabat %','Logistički rabat %','Stanje'],
    ...products.map(p=>[p.sku,p.bar,p.name,p.desc,p.grupa,p.jm,String(p.pak).replace('.',','),p.pakNaziv,String(p.price).replace('.',','),p.rabAk,p.rabAv,p.rabLog,String(p.stock).replace('.',',')])
  ]);
}

function renderLocations(){
  const el=document.getElementById('locList'); if(!el) return;
  document.getElementById('locCount').textContent=locations.length+' lokacija';
  el.innerHTML=locations.map((l,i)=>`
    <div class="addr-item">
      <div>
        <b>${l.name}</b><br>
        <span style="color:var(--muted);font-size:12.5px">${l.addr}<br>📞 ${l.phone} · 🕐 ${l.hours}<br>📍 ${l.lat}, ${l.lng}</span>
      </div>
      <div class="addr-actions">
        <button class="x-btn" onclick="locations.splice(${i},1);renderLocations()" title="Obriši">✕</button>
      </div>
    </div>`).join('') || '<div class="empty">Nema definisanih lokacija.</div>';
}
function addLocation(){
  const name=val('lcName'), addr=val('lcAddr');
  if(!name||!addr){ toast('Unesite naziv i adresu lokacije.'); return; }
  locations.push({
    name, addr, phone:val('lcPhone')||'—', hours:val('lcHours')||'—',
    lat:parseFloat(val('lcLat'))||0, lng:parseFloat(val('lcLng'))||0
  });
  ['lcName','lcAddr','lcPhone','lcHours','lcLat','lcLng'].forEach(id=>document.getElementById(id).value='');
  renderLocations();
  toast('Lokacija dodata.');
}
function renderContacts(list){
  const el=document.getElementById('contactsRows'); if(!el) return;
  const arr=Array.isArray(list)?list:[];
  const count=document.getElementById('contactsCount'); if(count) count.textContent=arr.length+' poruka';
  el.innerHTML=arr.length?arr.map(c=>`
    <div class="qa-admin">
      <div class="qa-admin-h"><b>${c.name||'Kupac'}</b><span class="qa-meta">${c.email||''} · ${(c.createdAt||'').slice(0,16).replace('T',' ')}</span></div>
      <div class="qa-q" style="margin-top:6px"><b>Tema:</b> ${c.topic||'—'}</div>
      <div class="qa-q" style="margin-top:6px"><b>Poruka:</b> ${c.message||''}</div>
      ${c.phone?`<div class="qa-meta" style="margin-top:5px">Telefon: ${c.phone}</div>`:''}
    </div>`).join(''):'<div class="empty">Nema novih poruka sa kontakt forme.</div>';
}

function renderQA(){
  const el=document.getElementById('qaRows'); if(!el) return;
  const all=[];
  Object.keys(questions).forEach(id=>{
    const p=products.find(x=>x.id==id);
    if(p) questions[id].forEach((item,idx)=>all.push({...item, prod:p, pid:p.id, idx}));
  });
  all.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  document.getElementById('qaCount').textContent=all.length+' pitanja · '+all.filter(x=>!x.a).length+' bez odgovora';
  el.innerHTML = all.length ? all.map(item=>`
    <div class="qa-admin">
      <div class="qa-admin-h"><b>${item.prod.name}</b><span class="qa-meta">${item.user} · ${item.date}</span></div>
      <div class="qa-q" style="margin-top:6px"><b>P:</b> ${item.q}</div>
      ${item.a?`<div class="qa-a"><b>O:</b> ${item.a}</div>
        <button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2);margin-top:8px" onclick="removeAnswer(${JSON.stringify(item.pid)},${item.idx})">Ukloni odgovor</button>`:`
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <input id="qaAns_${item.pid}_${item.idx}" placeholder="Vaš odgovor..." style="flex:1;min-width:240px;padding:9px 12px;border:1px solid var(--line-2);border-radius:7px">
          <button class="cta" style="margin:0;padding:9px 16px" onclick="answerQuestion(${JSON.stringify(item.pid)},${item.idx})">Pošalji odgovor</button>
        </div>`}
    </div>`).join('') : '<div class="empty">Nema pitanja od kupaca.</div>';
}
function answerQuestion(pid, idx){
  const ans=document.getElementById('qaAns_'+pid+'_'+idx).value.trim();
  if(!ans){ toast('Unesite odgovor.'); return; }
  questions[pid][idx].a=ans;
  toast('Odgovor je objavljen.');
  renderQA();
}

function renderReviews(){
  const el=document.getElementById('revRows'); if(!el) return;
  const all=[];
  Object.keys(reviews).forEach(id=>{
    const p=products.find(x=>x.id==id);
    if(p) reviews[id].forEach(r=>all.push({...r, prod:p}));
  });
  all.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  document.getElementById('revCount').textContent=all.length+' recenzija';
  el.innerHTML = all.length ? all.map(r=>`
    <tr>
      <td><div class="t-name">${r.prod.name}</div><div class="t-desc">${r.prod.sku}</div></td>
      <td>${r.user}</td>
      <td>${starsHTML(r.stars,12)} ${r.stars}/5</td>
      <td style="font-size:12px;color:var(--ink-2)">${r.text}</td>
      <td class="mono">${r.date}</td>
      <td>${r.verified?'<span class="verified-badge">✓ da</span>':'<span style="color:var(--muted);font-size:11px">ne</span>'}</td>
      <td><button class="x-btn" title="Obriši" onclick="reviews[${JSON.stringify(r.prod.id)}]=reviews[${JSON.stringify(r.prod.id)}].filter(x=>x!==this._r);renderReviews()" ref="${r.user}">✕</button></td>
    </tr>`).join('') : '<tr><td colspan="7"><div class="empty">Još nema recenzija.</div></td></tr>';
}
function addCoupon(){
  const code=val('kpCode').trim().toUpperCase();
  if(!code){ toast('Unesite kod.'); return; }
  if(coupons.some(c=>c.code===code)){ toast('Kod već postoji.'); return; }
  const vred=parseFloat(val('kpVred'));
  if(!vred){ toast('Unesite vrednost popusta.'); return; }
  coupons.push({
    code, opis:val('kpOpis')||'—',
    tip:document.getElementById('kpTip').value, vred,
    minIznos:parseFloat(val('kpMin'))||0,
    maxKor:parseInt(val('kpMax'))||100,
    rok:val('kpRok')||'2026-12-31',
    iskoriscen:0
  });
  ['kpCode','kpOpis','kpVred','kpRok'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('kpMin').value='0'; document.getElementById('kpMax').value='100';
  renderCoupons();
  toast('Promo kod "'+code+'" je aktivan.');
}
function renderCoupons(){
  const el=document.getElementById('couponsRows'); if(!el) return;
  document.getElementById('couponsCount').textContent=coupons.length+' aktivnih kodova';
  el.innerHTML=coupons.map((c,i)=>`
    <tr>
      <td class="mono"><b>${c.code}</b></td>
      <td>${c.opis}</td>
      <td>${c.tip==='%'?'Procenat':'Fiksni'}</td>
      <td class="mono"><b>${c.tip==='%'?c.vred+'%':fmt(c.vred)+' RSD'}</b></td>
      <td class="mono">${c.minIznos?fmt(c.minIznos):'—'}</td>
      <td class="mono">${c.iskoriscen} / ${c.maxKor}</td>
      <td class="mono">${c.rok}</td>
      <td><button class="x-btn" onclick="coupons.splice(${i},1);renderCoupons()" title="Obriši">✕</button></td>
    </tr>`).join('') || '<tr><td colspan="8"><div class="empty">Nema definisanih promo kodova.</div></td></tr>';
}

/* ================= DOSTAVA (kurir) ================= */
async function saveCourierZoneToServer(kg, price){
  if(typeof window.domextraAdminCourierSave==='function'){
    await window.domextraAdminCourierSave(kg,price);
  }
}
async function deleteCourierZoneFromServer(kg){
  if(typeof window.domextraAdminCourierDelete==='function'){
    await window.domextraAdminCourierDelete(kg);
  }
}
function renderCourier(){
  const el=document.getElementById('courierRows'); if(!el) return;
  courier.zones.sort((a,b)=>a.kg-b.kg);
  el.innerHTML=courier.zones.map((z,i)=>`
    <tr>
      <td>do <b>${qf(z.kg)} kg</b></td>
      <td><input class="qty-in" style="width:96px" type="number" min="0" value="${z.cena}" onchange="(async()=>{const v=parseFloat(this.value); if(!Number.isFinite(v)||v<0){this.value=${Number(z.cena)||0};return;} courier.zones[${i}].cena=v; try{await saveCourierZoneToServer(${Number(z.kg)},v); toast('Cena dostave je sačuvana.');}catch(e){toast(e.message||'Cena nije sačuvana.');} renderShopCart();renderB2BCart();})()" aria-label="Cena zone"></td>
      <td><button class="x-btn" onclick="(async()=>{try{await deleteCourierZoneFromServer(${Number(z.kg)});courier.zones.splice(${i},1);renderCourier();renderShopCart();renderB2BCart();toast('Zona je obrisana.');}catch(e){toast(e.message||'Zona nije obrisana.');}})()" aria-label="Obriši zonu">✕</button></td>
    </tr>`).join('');
}
async function addCourierZone(){
  const kg=parseFloat(val('czKg')), cena=parseFloat(val('czCena'));
  if(!kg||cena===''||isNaN(cena)){ toast('Unesite težinu i cenu zone.'); return; }
  try{
    await saveCourierZoneToServer(kg,cena||0);
    const fresh=typeof window.domextraAdminCourierReload==='function' ? await window.domextraAdminCourierReload() : null;
    if(fresh) courier=Object.assign(courier,{freeFrom:Number(fresh.freeFrom||0),defWeight:Number(fresh.defWeight||1),zones:(fresh.zones||[]).map(z=>({kg:Number(z.kg),cena:Number(z.price)}))});
    else courier.zones.push({kg,cena:cena||0});
    document.getElementById('czKg').value=''; document.getElementById('czCena').value='';
    renderCourier(); renderShopCart(); renderB2BCart();
    toast('Zona „do '+qf(kg)+' kg" sačuvana.');
  }catch(e){toast(e.message||'Zona nije sačuvana.');}
}

/* ================= ADMIN ================= */
function admLogin(){
  const u=document.getElementById('aUser').value.trim(), p=document.getElementById('aPass').value;
  const err=document.getElementById('aErr');
  if(u===admin.user && p===admin.pass){
    admLogged=true; err.textContent='';
    document.getElementById('admLogin').style.display='none';
    document.getElementById('admApp').style.display='block';
    renderBuyers(); renderOrders(); renderStock(); renderAdmStats(); renderGrupaDatalist(); renderGroupSelect(); renderCourier(); renderCoupons(); renderReviews(); renderLocations(); renderQA();
    document.getElementById('cFree').value=courier.freeFrom; document.getElementById('cDef').value=courier.defWeight;
    document.getElementById('sbActive').checked=saleBanner.active;
    document.getElementById('sbTitle').value=saleBanner.title;
    document.getElementById('sbText').value=saleBanner.text;
    document.getElementById('sbCta').value=saleBanner.cta;
    document.getElementById('sbBg').value=saleBanner.bg;
  }else err.textContent='Pogrešni administratorski parametri.';
}
function admLogout(){
  admLogged=false;
  document.getElementById('admApp').style.display='none';
  document.getElementById('admLogin').style.display='block';
  document.getElementById('aPass').value='';
}
function setTab(t){
  document.querySelectorAll('.tab-view').forEach(x=>x.classList.remove('active'));
  if(t==='marketing' && window.domextraLoadMarketing){ window.domextraLoadMarketing(); }
  document.getElementById('tab-'+t).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
}
function slug(n){
  return n.toLowerCase().replace(/doo|d\.o\.o\.?/g,'').trim()
    .replace(/[čć]/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/đ/g,'dj')
    .replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
}
function genPass(){ return Math.random().toString(36).slice(2,8)+Math.floor(100+Math.random()*900); }
function addBuyer(){
  const name=val('nName').trim();
  if(!name){ toast('Unesite naziv firme.'); return; }
  const b={
    name, addr:val('nAddr')||'—', city:val('nCity')||'—',
    pib:val('nPib')||'—', mb:val('nMb')||'—', acc:val('nAcc')||'—',
    mail:val('nMail')||'—', klasa:document.getElementById('nKlasa').value,
    valuta:parseInt(val('nVal'))||30, rabPos:parseFloat(val('nPos'))||0,
    user:slug(name), pass:genPass(), active:true
  };
  buyers.push(b);
  ['nName','nAddr','nCity','nPib','nMb','nAcc','nMail'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nPos').value='0';
  renderBuyers(); renderAdmStats();
  toast(`Kupac registrovan. Pristupni parametri: ${b.user} / ${b.pass} — dostaviti kupcu.`);
}
function renderBuyers(){
  document.getElementById('buyersCount').textContent=buyers.length+' kupaca';
  document.getElementById('buyersRows').innerHTML=buyers.map((b,i)=>`
    <tr style="${b.active?'':'opacity:.5'}">
      <td><div class="t-name">${b.name}</div><div class="t-desc">${b.addr}, ${b.city}<br>${b.mail}</div></td>
      <td class="mono">${b.pib}<br><span style="color:var(--muted)">${b.mb}</span></td>
      <td>
        <select class="sel-in" onchange="buyers[${i}].klasa=this.value;renderBuyers();if(currentBuyer===buyers[${i}]){renderBuyerStrip();renderB2BRows();renderB2BCart()}">
          ${['A','B','C'].map(k=>`<option value="${k}" ${b.klasa===k?'selected':''}>Klasa ${k} — ${klasaRab[k]}%</option>`).join('')}
        </select>
      </td>
      <td><input class="qty-in" type="number" min="0" value="${b.valuta}" onchange="buyers[${i}].valuta=parseInt(this.value)||0;if(currentBuyer===buyers[${i}]){renderBuyerStrip();renderB2BCart()}" aria-label="Valuta"> dana</td>
      <td><input class="qty-in" type="number" min="0" value="${b.rabPos||0}" onchange="buyers[${i}].rabPos=parseFloat(this.value)||0;if(currentBuyer===buyers[${i}]){renderB2BRows();renderB2BCart()}" aria-label="Poseban rabat"> %</td>
      <td class="mono">${b.user}<br><span style="color:var(--muted)">${b.pass}</span></td>
      <td class="mono">${(()=>{const z=orders.filter(o=>o.type==='B2B'&&o.buyer===b.name&&UNPAID.includes(o.status)).reduce((s,o)=>s+parseTotal(o.total),0);return z>0?'<b style="color:#b97a00">'+fmt(z)+'</b>':'<span style="color:var(--muted)">0,00</span>';})()}</td>
      <td><span class="stock-pill ${b.active?'stock-ok':'stock-out'}">${b.active?'aktivan':'blokiran'}</span></td>
      <td><button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="buyers[${i}].active=!buyers[${i}].active;renderBuyers()">${b.active?'Blokiraj':'Aktiviraj'}</button></td>
    </tr>`).join('');
}
const stClass={'Novo':'st-new','U obradi':'st-prep','Poslato':'st-sent','Isporučeno':'st-del','Plaćeno':'st-paid','Realizovano':'st-done','Stornirano':'st-storn'};
const parseTotal=t=>parseFloat(String(t).replace(/\./g,'').replace(',','.'))||0;
function renderMyB2B(){
  const el=document.getElementById('myB2bRows'); if(!el) return;
  const mine=orders.filter(o=>o.type==='B2B'&&o.buyer===cb().name);
  const mf=document.getElementById('myB2bFilter')?.value||'';
  const shown=mine.filter(o=>{
    if(mf==='__unpaid') return UNPAID.includes(o.status);
    if(mf==='__overdue') return UNPAID.includes(o.status)&&o.rokTs&&Date.now()>o.rokTs;
    return true;
  });
  document.getElementById('myB2bCount').textContent=shown.length+' od '+mine.length+' porudžbenica';
  // finansijski pregled
  const open=mine.filter(o=>UNPAID.includes(o.status));
  const zaUplatu=open.reduce((s,o)=>s+parseTotal(o.total),0);
  const placeno=mine.filter(o=>PAID.includes(o.status)).reduce((s,o)=>s+parseTotal(o.total),0);
  const istekle=open.filter(o=>o.rokTs&&Date.now()>o.rokTs);
  const fin=document.getElementById('b2bFinance');
  if(fin) fin.innerHTML=`
    <div class="stat-card" style="${zaUplatu>0?'border-color:#e8c982;background:#fffaf0':''}"><span>Stoji za uplatu</span><b>${fmt(zaUplatu)}</b><small>RSD · ${open.length} otvorenih predračuna${istekle.length?` · <span style="color:var(--danger);font-weight:700">${istekle.length} sa isteklim rokom</span>`:''}</small></div>
    <div class="stat-card"><span>Plaćeno (potvrđene uplate)</span><b>${fmt(placeno)}</b><small>RSD · ${mine.filter(o=>PAID.includes(o.status)).length} porudžbenica</small></div>
    <div class="stat-card"><span>Ukupno porudžbenica</span><b>${mine.length}</b><small>${mine.filter(o=>o.status==='Stornirano').length} stornirano</small></div>`;
  el.innerHTML = shown.length ? shown.map(o=>{
    const overdue=o.rokTs&&Date.now()>o.rokTs&&UNPAID.includes(o.status);
    const rok=o.rokTs?new Date(o.rokTs).toLocaleDateString('sr-RS'):'—';
    return `
    <tr style="${overdue?'background:#fff7f7':''}">
      <td><button class="doc-link" onclick="reopenDoc('${o.num}')">${o.num}</button></td>
      <td class="mono">${o.date}</td>
      <td class="mono"><b>${o.total}</b></td>
      <td class="mono">${rok}${o.rokDana?`<br><span style="font-size:10px;color:var(--muted)">${o.rokDana} dana</span>`:''}${overdue?'<br><span style="font-size:10px;color:var(--danger);font-weight:700">ISTEKAO ROK</span>':''}</td>
      <td><span class="st st-big ${stClass[o.status]}">${o.status}</span>${o.status==='Plaćeno'?'<br><span style="font-size:10px;color:var(--ok)">uplata potvrđena</span>':o.status==='Isporučeno'?'<br><span style="font-size:10px;color:#0d7a66">preuzeto — čeka uplatu</span>':o.status==='Realizovano'?'<br><span style="font-size:10px;color:var(--accent-ink)">isporučeno i plaćeno</span>':''}</td>
      <td><button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="reopenDoc('${o.num}')">Predračun</button></td>
    </tr>`;}).join('') : '<tr><td colspan="6"><div class="empty">'+(mine.length?'Nema porudžbenica za zadati filter.':'Još nema porudžbenica na ovom nalogu.')+'</div></td></tr>';
}
const orderStatuses=['Novo','U obradi','Poslato','Isporučeno','Plaćeno','Realizovano','Stornirano'];
const PAID=['Plaćeno','Realizovano'];
const UNPAID=['Novo','U obradi','Poslato','Isporučeno'];
function logOrder(o){ orders.unshift(o); if(admLogged){ renderOrders(); renderAdmStats(); } renderMyB2B(); if(currentBuyer) renderBuyerStrip(); }
function renderOrders(){
  const k=document.getElementById('ordKanal')?.value||'';
  const st=document.getElementById('ordStatus')?.value||'';
  const list=orders.map((o,i)=>({o,i})).filter(x=>{
    if(k && x.o.type!==k) return false;
    if(st==='__unpaid') return UNPAID.includes(x.o.status);
    if(st==='__overdue') return UNPAID.includes(x.o.status) && x.o.rokTs && Date.now()>x.o.rokTs;
    if(st) return x.o.status===st;
    return true;
  });
  const cEl=document.getElementById('ordCount');
  if(cEl) cEl.textContent=list.length+' od '+orders.length;
  document.getElementById('ordersRows').innerHTML = list.length ? list.map(({o,i})=>`
    <tr>
      <td><button class="doc-link" onclick="reopenDoc('${o.num}')">${o.num}</button></td>
      <td class="mono">${o.date}</td>
      <td><span class="stock-pill ${o.type==='B2B'?'stock-ok':'stock-low'}">${o.type==='B2B'?'B2B':'Web Shop'}</span></td>
      <td><div class="t-name">${o.buyer}</div></td>
      <td class="mono"><b>${o.total}</b></td>
      <td><select class="sel-in" onchange="orders[${i}].status=this.value;renderAdmStats();renderMyB2B();renderBuyers();refreshShopHistory()">
        ${orderStatuses.map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <input class="qty-in" style="margin-top:5px;width:130px" placeholder="Broj pošiljke" value="${o.tracking||''}" onchange="orders[${i}].tracking=this.value;refreshShopHistory();renderMyB2B()" title="Broj otpremnice"></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Nema porudžbina za zadati filter.</div></td></tr>';
}
let nextProdId=200;
let editProdIdx=null;
// Šabloni specifikacija po grupi proizvoda (V.1.1)
const specsTemplates={
  'Pločice':[
    ['Dimenzije','npr. 60×60 cm'],
    ['Debljina','npr. 9 mm'],
    ['Finiš','Mat / Sjaj / Polirana / Rektifikovana'],
    ['Klasa habanja (PEI)','I–V'],
    ['Otpornost na klizanje','R9 / R10 / R11'],
    ['Otpornost na mraz','Da / Ne'],
    ['Klasa upijanja vode','BIa / BIb / BIIa'],
    ['Pakovanje','npr. 1,44 m² / kutija (4 ploče)'],
    ['Težina po kutiji','npr. 23 kg'],
    ['Zemlja porekla',''],
    ['Garancija','npr. 5 godina']
  ],
  'Sanitarija':[
    ['Materijal','npr. Mesing hromirano / Keramika'],
    ['Dimenzije',''],
    ['Tip','npr. Konzolna / Stojeća / Jednoručna'],
    ['Tehničke karakteristike','npr. soft-close, ESG staklo, eko-protok'],
    ['Sertifikati','CE / RoHS / EN'],
    ['Garancija','npr. 5 godina']
  ],
  'Lepkovi i mase':[
    ['Tip / Klasa','npr. C2TE S1'],
    ['Potrošnja','npr. 3–5 kg/m²'],
    ['Otvoreno vreme','npr. 30 min'],
    ['Hodanje (početno opterećenje)','npr. 24 h'],
    ['Pun pogon','npr. 7 dana'],
    ['Boja','npr. Siva / Antracit / Bela'],
    ['Pakovanje','npr. 25 kg džak'],
    ['Rok upotrebe','npr. 12 meseci od datuma proizvodnje']
  ],
  'Grejanje':[
    ['Snaga (W)',''],
    ['Tip','npr. Električni / Vodeno / Infracrveni'],
    ['Dimenzije',''],
    ['Boja',''],
    ['Sertifikati','npr. CE, IPX4'],
    ['Garancija','']
  ],
  'Bela tehnika':[
    ['Tip uređaja',''],
    ['Klasa energetske efikasnosti','npr. A+++'],
    ['Dimenzije',''],
    ['Zapremina / Kapacitet',''],
    ['Potrošnja godišnje',''],
    ['Buka','npr. 42 dB'],
    ['Garancija','']
  ]
};
function fillSpecsTemplate(){
  const g=val('pGrupa').trim();
  const t=specsTemplates[g];
  if(!g){ toast('Prvo unesite/izaberite grupu proizvoda iznad.'); return; }
  if(!t){
    toast('Za grupu „'+g+'" još nema šablona — možete sami uneti polja u formatu Naziv | Vrednost.');
    return;
  }
  const current=val('pSpecs').trim();
  if(current && !confirm('Postojeće specifikacije će biti zamenjene. Nastaviti?')) return;
  document.getElementById('pSpecs').value = t.map(([naziv,hint])=>`${naziv} | ${hint||''}`).join('\n');
  toast('Šablon „'+g+'" je učitan. Unesite vrednosti pored svakog polja.');
}

function readProdForm(){
  const specsText=val('pSpecs')||'';
  const specs = specsText.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const i=l.indexOf('|'); return i<0?[l,'']:[l.slice(0,i).trim(),l.slice(i+1).trim()];
  });
  const gal=val('pGallery').split(',').map(x=>x.trim()).filter(Boolean);
  return {
    ico:val('pIco')||'📦', img:val('pImg').trim(),
    grupa:val('pGrupa').trim()||'Ostalo',
    name:val('pName').trim(), desc:val('pDesc')||'—',
    sku:val('pSku')||'ART-'+(nextProdId), bar:val('pBar')||'—',
    jm:val('pJm')||'kom', pak:parseFloat(val('pPak'))||1, pakNaziv:val('pPakNaziv')||'kom',
    price:parseFloat(val('pPrice'))||0,
    mpCena:parseFloat(val('pMp'))||parseFloat(val('pPrice'))||0,
    oldPrice:parseFloat(val('pOld'))||null,
    akcijaDo:val('pAkcDo')||null,
    brand:val('pBrand')||null,
    isNew:document.getElementById('pNew').checked,
    datumDodavanja:new Date().toISOString().slice(0,10),
    longDesc:val('pLongDesc')||'',
    gallery:gal.length?gal:[val('pIco')||'📦'],
    specs:specs.length?specs:null,
    stock:parseFloat(val('pStock'))||0,
    rabAk:parseFloat(val('pAk'))||0, rabPosA:parseFloat(val('pPos'))||0,
    rabAv:parseFloat(val('pAv'))||0, rabLog:parseFloat(val('pLog'))||0,
    kg:parseFloat(val('pKg'))||courier.defWeight
  };
}
function resetProdForm(){
  ['pImg','pName','pDesc','pGrupa','pSku','pBar','pJm','pPrice','pMp','pOld','pAkcDo','pBrand','pLongDesc','pGallery','pSpecs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pIco').value='📦';
  document.getElementById('pPak').value='1'; document.getElementById('pPakNaziv').value='kom';
  document.getElementById('pStock').value='0'; document.getElementById('pAk').value='0';
  document.getElementById('pPos').value='0';
  document.getElementById('pAv').value='3'; document.getElementById('pLog').value='2';
  document.getElementById('pKg').value='1';
  document.getElementById('pNew').checked=false;
  editProdIdx=null;
  document.getElementById('prodFormTitle').textContent='Unos novog artikla';
  document.getElementById('prodFormHint').textContent='Vidljiv u B2B katalogu i Web Shop-u';
  document.getElementById('prodSaveBtn').textContent='Sačuvaj artikal';
  document.getElementById('prodCancelBtn').style.display='none';
}
function addProduct(){
  const d=readProdForm();
  if(!d.name){ toast('Unesite naziv proizvoda.'); return; }
  if(!d.price&&!d.mpCena){ toast('Unesite VP ili MP cenu.'); return; }
  if(editProdIdx!==null){
    Object.assign(products[editProdIdx], d);
    toast('Artikal "'+d.name+'" je izmenjen.');
  }else{
    products.push({id:nextProdId++, ...d});
    toast('Artikal "'+d.name+'" je sačuvan i vidljiv u B2B i Web Shop-u.');
  }
  resetProdForm();
  renderStock(); renderB2BRows(); renderB2BCart(); renderAdmStats(); renderGrupaDatalist(); renderGroupSelect(); renderShopGrid();
}
function editProduct(i){
  const p=products[i];
  editProdIdx=i;
  document.getElementById('pImg').value=p.img||''; document.getElementById('pIco').value=p.ico;
  document.getElementById('pName').value=p.name; document.getElementById('pDesc').value=p.desc==='—'?'':p.desc;
  document.getElementById('pGrupa').value=p.grupa; document.getElementById('pSku').value=p.sku;
  document.getElementById('pBar').value=p.bar==='—'?'':p.bar; document.getElementById('pJm').value=p.jm;
  document.getElementById('pPak').value=p.pak; document.getElementById('pPakNaziv').value=p.pakNaziv;
  document.getElementById('pPrice').value=p.price;
  document.getElementById('pMp').value=p.mpCena||p.price;
  document.getElementById('pOld').value=p.oldPrice||'';
  document.getElementById('pAkcDo').value=p.akcijaDo?p.akcijaDo.slice(0,16):'';
  document.getElementById('pBrand').value=p.brand||'';
  document.getElementById('pNew').checked=!!p.isNew;
  document.getElementById('pLongDesc').value=p.longDesc||p.desc||'';
  document.getElementById('pGallery').value=(p.gallery||[]).join(', ');
  document.getElementById('pSpecs').value=(p.specs||[]).map(s=>s[0]+' | '+s[1]).join('\n');
  document.getElementById('pStock').value=p.stock;
  document.getElementById('pAk').value=p.rabAk; document.getElementById('pPos').value=p.rabPosA||0;
  document.getElementById('pAv').value=p.rabAv; document.getElementById('pLog').value=p.rabLog;
  document.getElementById('pKg').value=p.kg||courier.defWeight;
  document.getElementById('prodFormTitle').textContent='Izmena artikla: '+p.sku;
  document.getElementById('prodFormHint').textContent='Izmene se odmah primenjuju i u B2B i u Web Shop';
  document.getElementById('prodSaveBtn').textContent='Sačuvaj izmene';
  document.getElementById('prodCancelBtn').style.display='block';
  const ft=document.getElementById('prodFormTitle'); if(ft.scrollIntoView) ft.scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelEditProduct(){ resetProdForm(); }
function renderGroupSelect(){
  const el=document.getElementById('grK'); if(!el) return;
  const cur=el.value;
  el.innerHTML=[...new Set(products.map(p=>p.grupa))].map(g=>`<option ${g===cur?'selected':''}>${g}</option>`).join('');
}
function applyGroupRab(){
  const g=val('grK'), ak=val('grAk'), pos=val('grPos');
  if(ak===''&&pos===''){ toast('Unesite akcijski i/ili poseban rabat.'); return; }
  let n=0;
  products.forEach(p=>{
    if(p.grupa===g){
      if(ak!=='') p.rabAk=parseFloat(ak)||0;
      if(pos!=='') p.rabPosA=parseFloat(pos)||0;
      n++;
    }
  });
  document.getElementById('grAk').value=''; document.getElementById('grPos').value='';
  renderStock(); renderB2BRows(); renderB2BCart(); 
  toast(`Rabat primenjen na grupu "${g}" — ${n} artikala.`);
}
function renderGrupaDatalist(){
  const dl=document.getElementById('grupeList'); if(!dl) return;
  dl.innerHTML=[...new Set(products.map(p=>p.grupa))].map(g=>`<option value="${g}">`).join('');
}
function renderStock(){
  document.getElementById('prodCount').textContent=products.length+' artikala';
  document.getElementById('stockRows').innerHTML=products.map((p,i)=>`
    <tr>
      <td>${prodImg(p,'t-img')}</td>
      <td class="mono">${p.sku}<br><span style="color:var(--muted)">${p.bar}</span></td>
      <td><button class="doc-link" style="font-family:inherit;text-align:left" onclick="editProduct(${i})">${p.name}</button><div class="t-desc">${p.desc}</div></td>
      <td>${p.grupa}</td>
      <td>${p.jm}${pakInfo(p)?`<br><span style="font-size:10px;color:var(--muted);white-space:nowrap">${pakInfo(p)}</span>`:''}</td>
      <td class="mono">${fmt(p.price)}</td>
      <td><input class="qty-in" type="number" min="0" value="${p.rabAk}" onchange="products[${i}].rabAk=parseFloat(this.value)||0;renderB2BRows();renderB2BCart();renderStock()" aria-label="Akcijski rabat"></td>
      <td><input class="qty-in" type="number" min="0" value="${p.rabPosA||0}" onchange="products[${i}].rabPosA=parseFloat(this.value)||0;renderB2BRows();renderB2BCart();renderStock()" aria-label="Poseban rabat"></td>
      <td><input class="qty-in" type="number" min="0" value="${p.rabAv}" onchange="products[${i}].rabAv=parseFloat(this.value)||0;renderB2BRows();renderB2BCart();renderStock()" aria-label="Avansni rabat"></td>
      <td><input class="qty-in" type="number" min="0" value="${p.rabLog}" onchange="products[${i}].rabLog=parseFloat(this.value)||0;renderB2BRows();renderB2BCart();renderStock()" aria-label="Logistički rabat"></td>
      <td><input class="qty-in" type="number" min="0" step="any" value="${p.kg||courier.defWeight}" onchange="products[${i}].kg=parseFloat(this.value)||0;renderShopCart();renderB2BCart()" aria-label="Težina kg"></td>
      <td><input class="qty-in" type="number" min="0" step="any" value="${p.stock}" onchange="products[${i}].stock=parseFloat(this.value)||0;renderB2BRows();renderB2BCart();renderStock();renderAdmStats()" aria-label="Stanje"><br>${stockPill(p.stock)}</td>
      <td><button class="logout-btn" style="border-color:var(--line-2);color:var(--ink-2)" onclick="editProduct(${i})">✎</button></td>
    </tr>`).join('');
}
const STOCK_MIN=10; // prag za "na minimumu"
function renderAdmStats(){
  const el=document.getElementById('admStats'); if(!el) return;
  const cnt=(s,type)=>orders.filter(o=>o.status===s&&(!type||o.type===type)).length;
  const parse=t=>parseFloat(t.replace(/\./g,'').replace(',','.'))||0;
  const valWS=orders.filter(o=>o.type==='SHOP'&&o.status!=='Stornirano').reduce((s,o)=>s+parse(o.total),0);
  const valB2B=orders.filter(o=>o.type==='B2B'&&o.status!=='Stornirano').reduce((s,o)=>s+parse(o.total),0);
  const cntWS=orders.filter(o=>o.type==='SHOP').length, cntB2B=orders.filter(o=>o.type==='B2B').length;
  const zero=products.filter(p=>p.stock===0).length;
  const low=products.filter(p=>p.stock>0&&p.stock<=STOCK_MIN).length;
  const okS=products.length-zero-low;

  // kupci: B2B aktivni (poručivali u <3 mes), neaktivni (>3 mes ili nikad), blokirani
  const tromesec=Date.now()-90*86400000;
  const lastOrder=b=>{ const os=orders.filter(o=>o.type==='B2B'&&o.buyer===b.name); if(!os.length) return 0;
    return Math.max(...os.map(o=>o.kreiranTs||0)); };
  const blok=buyers.filter(b=>!b.active).length;
  const b2bAkt=buyers.filter(b=>b.active && lastOrder(b)>=tromesec).length;
  const b2bNeakt=buyers.filter(b=>b.active && lastOrder(b)<tromesec).length;

  const stDef=[['Novo','st-new'],['U obradi','st-prep'],['Poslato','st-sent'],['Isporučeno','st-del'],['Plaćeno','st-paid'],['Realizovano','st-done'],['Stornirano','st-storn']];
  // statusne kolone po kanalu za grafikon
  const statusBars=(type)=>{
    const max=Math.max(1,...stDef.map(([s])=>cnt(s,type)));
    return stDef.map(([s,cls])=>{const v=cnt(s,type);return `<div class="bar-row"><span class="bar-lab">${s}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${v/max*100}%"></div></div><span class="bar-val">${v}</span></div>`;}).join('');
  };
  const naplaceno=orders.filter(o=>PAID.includes(o.status)).reduce((s,o)=>s+parse(o.total),0);
  const zaUplatu=orders.filter(o=>UNPAID.includes(o.status)).reduce((s,o)=>s+parse(o.total),0);
  const isteklo=orders.filter(o=>o.rokTs&&Date.now()>o.rokTs&&UNPAID.includes(o.status)).length;
  const donut=(a,b,ca,cb)=>{const t=a+b||1;const pa=a/t*100;return `<svg viewBox="0 0 36 36" class="donut"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#eee" stroke-width="4"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="${ca}" stroke-width="4" stroke-dasharray="${pa} ${100-pa}" stroke-dashoffset="25" transform="rotate(-90 18 18)"/></svg>`;};
  const barH=(items,unit)=>{const max=Math.max(1,...items.map(i=>i[1]));return items.map(i=>`<div class="bar-row"><span class="bar-lab">${i[0]}</span><div class="bar-track"><div class="bar-fill ${i[2]||'st-paid'}" style="width:${i[1]/max*100}%"></div></div><span class="bar-val">${unit?fmt(i[1]):i[1]}</span></div>`).join('');};

  el.innerHTML=`
  <!-- BLOK 1: PORUDŽBINE I ARTIKLI -->
  <div class="dash-block">
    <h3 class="dash-h">Porudžbine i artikli</h3>
    <div class="dash-grid">
      <div class="stat-card"><span>Porudžbine ukupno</span><b>${orders.length}</b>
        <div class="ch-split"><div><b class="ch-num">${cntWS}</b><small>Web Shop</small></div><div class="ch-div"></div><div><b class="ch-num">${cntB2B}</b><small>B2B</small></div></div></div>
      <div class="stat-card chart-card"><span>Web Shop — po statusu</span><div class="bars">${statusBars('SHOP')}</div></div>
      <div class="stat-card chart-card"><span>B2B — po statusu</span><div class="bars">${statusBars('B2B')}</div></div>
      <div class="stat-card"><span>Artikli u katalogu</span><b>${products.length}</b>
        <div class="bars" style="margin-top:10px">${barH([['Na stanju',okS,'st-paid'],['Na minimumu (≤'+STOCK_MIN+')',low,'st-prep'],['Stanje nula',zero,'st-storn']])}</div></div>
    </div>
  </div>

  <!-- BLOK 2: KUPCI -->
  <div class="dash-block">
    <h3 class="dash-h">Kupci</h3>
    <div class="dash-grid">
      <div class="stat-card"><span>Registrovani kupci ukupno</span><b>${buyers.length+shopUsers.length}</b><small>${buyers.length} B2B · ${shopUsers.length} Web Shop</small></div>
      <div class="stat-card"><span>B2B — aktivni</span><b>${b2bAkt}</b><small>poručivali u poslednja 3 meseca</small></div>
      <div class="stat-card"><span>B2B — neaktivni</span><b>${b2bNeakt}</b><small>bez porudžbina &gt; 3 meseca</small></div>
      <div class="stat-card"><span>B2B — blokirani</span><b>${blok}</b><small>nalozi onemogućeni</small></div>
      <div class="stat-card"><span>Web Shop nalozi</span><b>${shopUsers.length}</b><small>registrovani kupci maloprodaje</small></div>
      <div class="stat-card chart-card" style="grid-column:span 3"><span>Struktura B2B kupaca</span>
        <div class="bars" style="margin-top:8px">${barH([['Aktivni',b2bAkt,'st-paid'],['Neaktivni',b2bNeakt,'st-prep'],['Blokirani',blok,'st-storn']])}</div></div>
    </div>
  </div>

  <!-- BLOK 3: FINANSIJE -->
  <div class="dash-block">
    <h3 class="dash-h">Finansije</h3>
    <div class="dash-grid">
      <div class="stat-card"><span>Vrednost ukupno</span><b>${fmt(valWS+valB2B)}</b><small>RSD sa PDV · bez storniranih</small></div>
      <div class="stat-card"><span>Vrednost — Web Shop</span><b>${fmt(valWS)}</b><small>RSD sa PDV</small></div>
      <div class="stat-card"><span>Vrednost — B2B</span><b>${fmt(valB2B)}</b><small>RSD sa PDV</small></div>
      <div class="stat-card chart-card"><span>Web Shop / B2B</span>
        <div class="donut-wrap">${donut(valWS,valB2B,'#6b3fc4','#1f9d4d')}<div class="donut-leg"><i><span class="dot" style="background:#6b3fc4"></span>WS ${fmt(valWS)}</i><i><span class="dot" style="background:#1f9d4d"></span>B2B ${fmt(valB2B)}</i></div></div></div>
      <div class="stat-card" style="border-color:#bfe3c6;background:#f4fbf5"><span>Naplaćeno (Plaćeno)</span><b>${fmt(naplaceno)}</b><small>RSD · ${orders.filter(o=>PAID.includes(o.status)).length} porudžbina · realizovano ${orders.filter(o=>o.status==='Realizovano').length}</small></div>
      <div class="stat-card" style="border-color:#e8c982;background:#fffaf0"><span>Za uplatu (nenaplaćeno)</span><b>${fmt(zaUplatu)}</b><small>RSD · ${orders.filter(o=>UNPAID.includes(o.status)).length} otvorenih${isteklo?` · <span style="color:var(--danger);font-weight:700">${isteklo} sa isteklim rokom</span>`:''}</small></div>
      <div class="stat-card chart-card" style="grid-column:span 2"><span>Naplaćeno vs Za uplatu</span>
        <div class="donut-wrap">${donut(naplaceno,zaUplatu,'#1f9d4d','#e8a200')}<div class="donut-leg"><i><span class="dot" style="background:#1f9d4d"></span>Naplaćeno ${fmt(naplaceno)}</i><i><span class="dot" style="background:#e8a200"></span>Za uplatu ${fmt(zaUplatu)}</i></div></div></div>
    </div>
  </div>`;
}

/* ================= NAV / OPTIONS ================= */
function b2bLogin(){
  const u=document.getElementById('lUser').value.trim(), p=document.getElementById('lPass').value;
  const err=document.getElementById('lErr');
  const found=buyers.find(b=>b.user===u && b.pass===p);
  if(found && !found.active){
    err.textContent='Nalog je blokiran. Kontaktirajte komercijalu.'; return;
  }
  if(found){
    currentBuyer=found; b2bLogged=true; myB2bOpen=false; err.textContent='';
    document.getElementById('myB2bPanel').style.display='none';
    document.getElementById('b2bLogin').style.display='none';
    document.getElementById('b2bApp').style.display='block';
    renderBuyerStrip(); renderB2BRows(); renderB2BCart(); renderMyB2B();
    toast('Prijava uspešna — dobrodošli, '+found.name);
  }else{
    err.textContent='Pogrešno korisničko ime ili lozinka. Parametre dodeljuje administrator nakon registracije.';
  }
}
function b2bLogout(){
  b2bLogged=false; currentBuyer=null; b2bCart={};
  document.getElementById('b2bApp').style.display='none';
  document.getElementById('b2bLogin').style.display='block';
  document.getElementById('lPass').value='';
  renderB2BRows(); renderB2BCart();
}
function setView(v){
  const t=document.getElementById('view-'+v); if(!t) return;
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
}
// Page-aware init — pozovi samo ono što postoji na trenutnoj stranici
(function(){
  const has=id=>!!document.getElementById(id);
  document.querySelectorAll('.opt input').forEach(r=>{
    r.addEventListener('change',()=>{
      document.querySelectorAll('input[name="'+r.name+'"]').forEach(x=>x.closest('.opt').classList.toggle('sel',x.checked));
      if(r.name==='pay'){
        const cp=document.getElementById('cardPanel'); if(cp) cp.style.display = radioVal('pay')==='kartica' ? 'block' : 'none';
        const rp=document.getElementById('ratePanel'); if(rp){ rp.style.display = radioVal('pay')==='rate' ? 'block' : 'none'; if(radioVal('pay')==='rate') renderRateKalk(); }
      }
      if(r.name==='ship') renderShopCart();
    });
  });
  try{ if(has('shopGrid')){ renderShopGrid(); renderShopCart(); } }catch(e){console.warn(e);}
  try{ if(has('b2bRows')){ renderB2BRows(); renderB2BCart(); } }catch(e){console.warn(e);}
  try{ if(has('compareBar')) renderCompareBar(); }catch(e){}
  try{ if(has('heroSections')) renderHero(); }catch(e){}
  try{ if(has('saleBannerWrap')) renderSaleBanner(); }catch(e){}
  try{ if(has('acctBtns')){ renderAcctBtns(); renderAcctPanel(); } }catch(e){}
  // URL parametri za web-shop (grupa filter)
  try{
    const p=new URLSearchParams(location.search);
    if(has('fGrupa') && p.get('grupa')){ renderShopGrid(); const g=document.getElementById('fGrupa'); const opt=[...g.options].find(o=>o.value===p.get('grupa')); if(opt){ g.value=p.get('grupa'); renderShopGrid(); } }
  }catch(e){}
})();

// Lightbox tastatura
document.addEventListener('keydown', e=>{
  if(typeof lightboxPid==='undefined' || !lightboxPid) return;
  if(e.key==='Escape') closeLightbox();
  if(e.key==='ArrowLeft') lbPrev();
  if(e.key==='ArrowRight') lbNext();
});


/* ═══════════ DOM EXTRA — VIŠESTRANIČNA NAVIGACIJA ═══════════ */
function deScroll(id){
  const el=document.getElementById(id);
  if(el){ el.scrollIntoView({behavior:'smooth'}); }
  else { window.location.href='/#'+id; }   // sa drugih stranica → početna pa skrol
}
function deCloseMob(){ const m=document.getElementById('deMobileNav'); if(m) m.classList.remove('open'); }
function deGo(view){
  if(view==='b2b') window.location.href='/b2b/';
  else window.location.href='/web-shop/';
}
function deCat(grupa){ window.location.href='/web-shop/?grupa='+encodeURIComponent(grupa); }
function deBrand(brand){ window.location.href='/web-shop/?brend='+encodeURIComponent(brand); }
function openAdmin(){ window.location.href='/admin/'; }

/* sinhronizacija brojača korpe u nav-u sa modulom */
(function(){
  function syncCart(){
    try{
      const n=Object.keys(shopCart||{}).length;
      const el=document.getElementById('deCartCount');
      if(el){ el.textContent=n; el.classList.toggle('hidden',n===0); }
    }catch(e){}
  }
  const _rsc=window.renderShopCart;
  if(typeof _rsc==='function'){ window.renderShopCart=function(){ const r=_rsc.apply(this,arguments); syncCart(); return r; }; }
  window.addEventListener('load',syncCart);
})();

/* reveal animacije */
(function(){
  function run(){
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});},{threshold:0.1});
      document.querySelectorAll('.de-reveal').forEach(el=>io.observe(el));
    }else document.querySelectorAll('.de-reveal').forEach(el=>el.classList.add('visible'));
  }
  if(document.readyState!=='loading') run(); else window.addEventListener('DOMContentLoaded',run);
})();

/* Escape zatvara mobilni meni */
document.addEventListener('keydown',e=>{ if(e.key==='Escape') deCloseMob(); });



// ===== DOM EXTRA DARK MODE =====
(function initDomExtraTheme(){
  const KEY='domextra_theme';
  function applyTheme(mode){
    const dark=mode==='dark';
    document.body.classList.toggle('dark-mode',dark);
    const btn=document.getElementById('domextraThemeToggle');
    if(btn){
      btn.setAttribute('aria-pressed',dark?'true':'false');
      btn.title=dark?'Prebaci na svetlu temu':'Prebaci na tamnu temu';
      const icon=btn.querySelector('.theme-icon');
      if(icon) icon.textContent=dark?'☀️':'🌙';
      const label=btn.querySelector('.theme-label');
      if(label) label.textContent=dark?'Svetla tema':'Tamna tema';
    }
    try{localStorage.setItem(KEY,dark?'dark':'light')}catch(e){}
  }
  function createToggle(){
    if(document.getElementById('domextraThemeToggle')) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='domextraThemeToggle';
    btn.className='theme-toggle';
    btn.setAttribute('aria-label','Promeni temu');
    btn.setAttribute('aria-pressed','false');
    btn.innerHTML='<span class="theme-icon" aria-hidden="true">🌙</span><span class="theme-label">Tamna tema</span>';
    btn.addEventListener('click',()=>applyTheme(document.body.classList.contains('dark-mode')?'light':'dark'));
    document.body.appendChild(btn);
    let saved='light';
    try{saved=localStorage.getItem(KEY)||'light'}catch(e){}
    applyTheme(saved);
  }
  function start(){
    // Apply before drawing the control to avoid a visible flash on reload.
    let saved='light';
    try{saved=localStorage.getItem(KEY)||'light'}catch(e){}
    document.body.classList.toggle('dark-mode',saved==='dark');
    createToggle();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
