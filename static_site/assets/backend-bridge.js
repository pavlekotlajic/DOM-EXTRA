/* DOM EXTRA Django/MySQL bridge. Original app.js and style.css stay untouched. */
(function(){
  const API='/api';
  const tokenKey='domextra_token';
  const hasEl=id=>!!document.getElementById(id);
  const renderB2BSafely=()=>{ if(hasEl('b2bRows') || hasEl('b2bCards')){ renderB2BRows(); renderB2BCart(); } };
  const getToken=()=>{
    if(hasEl('admApp') || hasEl('admLogin')) return localStorage.getItem('domextra_admin_token') || localStorage.getItem(tokenKey) || '';
    if(hasEl('b2bApp') || hasEl('b2bLogin')) return localStorage.getItem('domextra_buyer_token') || localStorage.getItem(tokenKey) || '';
    return localStorage.getItem('domextra_shop_token') || localStorage.getItem(tokenKey) || '';
  };
  window.getToken=getToken;
  window.loadAdminData=function(){ return loadAdminData.apply(this,arguments); };
  const setToken=t=>t?localStorage.setItem(tokenKey,t):localStorage.removeItem(tokenKey);
  async function api(path, options={}){
    const baseHeaders={'Content-Type':'application/json', ...(options.headers||{})};
    const t=getToken();
    const headers={...baseHeaders};
    if(t) headers.Authorization='Bearer '+t;
    let r=await fetch(API+path,{...options,headers,credentials:'same-origin'});
    // A stale localStorage token must never prevent the Django session/cookie
    // from authenticating the request after refresh. Retry once without bearer.
    if(r.status===401 && headers.Authorization){
      const retryHeaders={...baseHeaders};
      r=await fetch(API+path,{...options,headers:retryHeaders,credentials:'same-origin'});
    }
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'Greška servera');
    return data;
  }
  function mapProduct(p, groups){
    const g=typeof p.group==='string' ? p.group : (groups[p.group] || p.group || 'Ostalo');
    return {id:p.id,ico:p.icon||'📦',img:p.image||'',grupa:g,name:String(p.name||'Artikal'),desc:String(p.description||'—'),sku:String(p.sku||''),bar:String(p.barcode||'—'),jm:String(p.unit||'kom'),pak:Number(p.packQty||1),pakNaziv:String(p.packName||'kom'),price:Number(p.vpPrice||0),stock:Number(p.stock||0),rabAv:Number(p.advanceDiscount||0),rabAk:Number(p.actionDiscount||0),rabLog:Number(p.logisticsDiscount||0),kg:Number(p.weightKg||1),mpCena:Number(p.mpPrice||p.vpPrice||0),oldPrice:Number(p.oldPrice||0)||null,akcijaDo:p.saleUntil||null,brand:String(p.brand||''),gallery:Array.isArray(p.gallery)&&p.gallery.length?p.gallery:[p.image||p.icon||'📦'],isNew:!!p.isNew,datumDodavanja:(p.createdAt||'').slice(0,10),longDesc:String(p.longDesc||p.description||''),specs:Array.isArray(p.specs)?p.specs:[],rabPosA:Number(p.specialDiscount||0)};
  }
  function mapBuyer(b){
    return {id:b.id,name:b.company,addr:b.address||'—',city:b.city||'—',pib:b.pib||'—',mb:b.mb||'—',acc:b.account||'—',mail:b.email||'—',klasa:b.class,valuta:Number(b.paymentDays||30),rabPos:Number(b.specialDiscount||0),user:b.username,pass:b.generatedPassword||'••••••••',active:!!b.active,createdAt:b.createdAt};
  }
  function mapOrder(o){
    const total=Number(o.total||0); const due=o.paymentDueDate?new Date(o.paymentDueDate):null;
    return {id:o.id,num:o.number,date:(o.createdAt||'').slice(0,10),type:o.channel,buyer:o.buyer||o.customer?.name||'—',total:fmt(total)+' RSD',status:o.status||'Novo',kreiranTs:o.createdAt?new Date(o.createdAt).getTime():Date.now(),items:(o.items||[]).map(x=>({id:x.productId,qty:Number(x.qty||1)})),pay:o.paymentMethod,ship:o.shipping?.method,rokDana:due?Math.max(0,Math.round((due.getTime()-Date.now())/86400000)):null,rokTs:due?due.getTime():null,docHTML:o.html||null,orderId:o.id,pdfUrl:o.pdfUrl||('/api/orders/'+encodeURIComponent(o.id)+'/invoice.pdf'),mails:o.customer?.email?[o.customer.email]:[],title:o.channel==='B2B'?'Predračun — B2B porudžbenica':'Predračun — Web Shop'};
  }
  function makeProductProxy(p){
    return new Proxy(p,{set(target,key,value){target[key]=value; const map={ico:'icon',img:'image',grupa:'group',name:'name',desc:'description',sku:'sku',bar:'barcode',jm:'unit',pak:'packQty',pakNaziv:'packName',price:'vpPrice',mpCena:'mpPrice',oldPrice:'oldPrice',akcijaDo:'saleUntil',brand:'brand',isNew:'isNew',longDesc:'longDesc',gallery:'gallery',specs:'specs',stock:'stock',kg:'weightKg',rabAk:'actionDiscount',rabPosA:'specialDiscount',rabAv:'advanceDiscount',rabLog:'logisticsDiscount'}; if(target.__serverId && map[key]) api('/admin/products/'+encodeURIComponent(target.__serverId),{method:'PUT',body:JSON.stringify({[map[key]]:value})}).catch(e=>console.warn('product sync',e)); return true;}});
  }
  function makeBuyerProxy(b){
    return new Proxy(b,{set(target,key,value){target[key]=value; const map={name:'company',addr:'address',city:'city',pib:'pib',mb:'mb',acc:'account',mail:'email',klasa:'class',valuta:'paymentDays',rabPos:'specialDiscount',active:'active'}; if(target.__serverId && map[key]) api('/admin/buyers/'+encodeURIComponent(target.__serverId),{method:'PATCH',body:JSON.stringify({[map[key]]:value})}).catch(e=>console.warn('buyer sync',e)); return true;}});
  }
  function makeOrderProxy(o){
    return new Proxy(o,{set(target,key,value){target[key]=value; if(key==='status'&&target.id) api('/admin/orders/'+encodeURIComponent(target.id)+'/status',{method:'PATCH',body:JSON.stringify({status:value})}).catch(e=>console.warn('order sync',e)); return true;}});
  }
  async function loadPublic(){
    if(hasEl('admApp') || hasEl('admLogin')) return;
    try{
      // Products have their own endpoint. Keep catalog loading independent
      // from optional public settings/banner/reviews payloads.
      const ps=await api('/products');
      const serverProducts=Array.isArray(ps)?ps:[];
      const groups={};
      serverProducts.forEach(p=>{ if(p.group && typeof p.group==='string') groups[p.group]=p.group; });
      const mapped=serverProducts.map(p=>{const x=mapProduct(p,groups); x.__serverId=p.id; return makeProductProxy(x);});
      if(mapped.length || products.length===0) products.splice(0,products.length,...mapped);
      window.domextraProducts=products; window.domextraShopCart=shopCart;

      // Load the rest of the public data separately. A failure here must not
      // hide products that were already loaded successfully.
      try{
        const d=await api('/public');
        if(d.settings){
          const s=d.settings;
          window.domextraSettings={...s, paymentDays:Number(s.paymentDays||30)};
          const vals={sFirm:s.firm,sAddr:s.address,sCity:s.city,sPib:s.pib,sMb:s.mb,sAcc:s.account,sMailOff:s.officialMail,sPref:s.invoicePrefix,sDays:String(s.paymentDays||30)};
          Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v||'';});
        }
        if(d.courier) courier=Object.assign(courier,{freeFrom:Number(d.courier.freeFrom||0),defWeight:Number(d.courier.defWeight||1),zones:(d.courier.zones||[]).map(z=>({kg:Number(z.kg),cena:Number(z.price)}))});
        if(d.saleBanner) saleBanner=d.saleBanner;
        if(Array.isArray(d.locations)) locations=d.locations.map(x=>({name:x.name,addr:x.address,phone:x.phone,hours:x.hours,lat:x.lat,lng:x.lng}));
        Object.keys(reviews).forEach(k=>delete reviews[k]); (d.reviews||[]).forEach(r=>{(reviews[r.productId] ||= []).push({user:r.buyer||'Kupac',stars:Number(r.rating||0),text:r.comment||'',date:(r.date||'').slice(0,10),verified:!!r.verified});});
        Object.keys(questions).forEach(k=>delete questions[k]); (d.qa||[]).forEach(q=>{(questions[q.productId] ||= []).push({id:q.id,user:'Kupac',q:q.question||'',a:q.answer||'',date:(q.date||'').slice(0,10)});});
      }catch(e){ console.warn('DOM EXTRA optional public data:',e); }

      try{
        if(hasEl('shopGrid')) renderShopGrid();
        if(hasEl('shopCart')) renderShopCart();
        if(hasEl('heroSections')) renderHero();
        if(hasEl('saleBannerWrap')) renderSaleBanner();
        renderB2BSafely();
        if(hasEl('stockRows')) renderStock();
        if(hasEl('admStats')) renderAdmStats();
        if(hasEl('grupeList')) renderGrupaDatalist();
        if(hasEl('grK')) renderGroupSelect();
        if(hasEl('courierOpts')) renderCourier();
      }catch(e){ console.error('DOM EXTRA catalog render:',e); }
    }catch(e){ console.error('DOM EXTRA products load:',e); }
  }

  window.domextraReloadPublic=loadPublic;
  window.domextraAdminCourierSave=async function(kg,price){
    return await api('/admin/courier/zones',{method:'POST',body:JSON.stringify({kg:Number(kg),price:Number(price)})});
  };
  window.domextraAdminCourierDelete=async function(kg){
    const data=await api('/admin/courier');
    const zone=(data.zones||[]).find(z=>Number(z.kg)===Number(kg));
    if(!zone) return data;
    // Existing API identifies zones by database id only internally, so update/delete
    // by weight through a small dedicated endpoint is preferable.
    return await api('/admin/courier/zones/by-kg/'+encodeURIComponent(kg),{method:'DELETE'});
  };
  window.domextraAdminCourierReload=async function(){
    return await api('/admin/courier');
  };
  window.domextraAdminCourierRulesSave=async function(freeFrom,defWeight){
    return await api('/admin/courier',{method:'PATCH',body:JSON.stringify({freeFrom:Number(freeFrom),defWeight:Number(defWeight)})});
  };

  async function loadAdminSettings(){
    const s=await api('/admin/settings');
    window.domextraSettings={...s,paymentDays:Number(s.paymentDays||30)};
    const vals={sFirm:s.firm,sAddr:s.address,sCity:s.city,sPib:s.pib,sMb:s.mb,sAcc:s.account,sMailOff:s.officialMail,sPref:s.invoicePrefix,sDays:String(s.paymentDays ?? 5),sPhone:s.phone,sPhone2:s.secondPhone,sHours:s.workingHours};
    Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v||'';});
  }
  window.saveModuleSettings=async function(){
    const btnMsg=document.getElementById('settingsSaveMsg');
    const payload={
      firm:document.getElementById('sFirm')?.value.trim()||'',
      address:document.getElementById('sAddr')?.value.trim()||'',
      city:document.getElementById('sCity')?.value.trim()||'',
      pib:document.getElementById('sPib')?.value.trim()||'',
      mb:document.getElementById('sMb')?.value.trim()||'',
      account:document.getElementById('sAcc')?.value.trim()||'',
      officialMail:document.getElementById('sMailOff')?.value.trim()||'',
      invoicePrefix:document.getElementById('sPref')?.value.trim()||'DE',
      paymentDays:Number(document.getElementById('sDays')?.value||0),
      phone:document.getElementById('sPhone')?.value.trim()||'',
      secondPhone:document.getElementById('sPhone2')?.value.trim()||'',
      workingHours:document.getElementById('sHours')?.value.trim()||''
    };
    try{
      const d=await api('/admin/settings',{method:'PATCH',body:JSON.stringify(payload)});
      window.domextraSettings={...d,paymentDays:Number(d.paymentDays||0)};
      if(btnMsg) btnMsg.textContent='Sačuvano.';
      toast('Podešavanja su sačuvana.');
      setTimeout(()=>{if(btnMsg)btnMsg.textContent='';},2500);
    }catch(e){
      if(btnMsg) btnMsg.textContent=e.message||'Greška pri čuvanju.';
      toast(e.message||'Podešavanja nisu sačuvana.');
    }
  };
  async function loadAdminData(){
    const applyBootstrap=(d)=>{
      const bs=Array.isArray(d?.buyers)?d.buyers:[];
      buyers.splice(0,buyers.length,...bs.map(mapBuyer).map(b=>{b.__serverId=b.id;return makeBuyerProxy(b);}));

      const ps=Array.isArray(d?.products)?d.products:[];
      products.splice(0,products.length,...ps.map(p=>{const x=mapProduct(p,{});x.__serverId=p.id;return makeProductProxy(x);}));
      window.domextraProducts=products; window.domextraShopCart=shopCart;

      const os=Array.isArray(d?.orders)?d.orders:[];
      orders.splice(0,orders.length,...os.map(mapOrder).map(makeOrderProxy));

      const co=Array.isArray(d?.coupons)?d.coupons:[];
      coupons.splice(0,coupons.length,...co.map(c=>({id:c.id,code:c.code,tip:c.type,vred:Number(c.value),minIznos:Number(c.minAmount),rok:c.validUntil,iskoriscen:Number(c.used),maxKor:Number(c.maxUses),opis:c.description})));

      try{ renderBuyers(); }catch(e){ console.warn('render buyers',e); }
      try{ renderOrders(); }catch(e){ console.warn('render orders',e); }
      try{ renderStock(); }catch(e){ console.warn('render stock',e); }
      try{ renderAdmStats(); }catch(e){ console.warn('render dashboard',e); }
      try{ renderGrupaDatalist(); }catch(e){}
      try{ renderGroupSelect(); }catch(e){}
      try{ renderCoupons(); }catch(e){}
      try{ renderB2BSafely(); }catch(e){}
      return {buyers:buyers.length,products:products.length,orders:orders.length,coupons:coupons.length};
    };

    try{
      const d=await api('/admin/bootstrap');
      const counts=applyBootstrap(d);
      // If the first request raced the session cookie on refresh, give the browser
      // one deterministic retry before declaring the bootstrap empty.
      if(!counts.buyers && !counts.products && !counts.orders && !counts.coupons){
        await new Promise(r=>setTimeout(r,250));
        const d2=await api('/admin/bootstrap');
        applyBootstrap(d2);
      }
    }catch(e){
      console.warn('admin bootstrap failed, falling back to independent requests',e);
      const results=await Promise.allSettled([api('/admin/buyers'),api('/admin/products'),api('/admin/orders'),api('/admin/coupons')]);
      const [buyersR,productsR,ordersR,couponsR]=results;
      if(buyersR.status==='fulfilled') buyers.splice(0,buyers.length,...buyersR.value.map(mapBuyer).map(b=>{b.__serverId=b.id;return makeBuyerProxy(b);}));
      if(productsR.status==='fulfilled') products.splice(0,products.length,...productsR.value.map(p=>{const x=mapProduct(p,{});x.__serverId=p.id;return makeProductProxy(x);}));
      if(ordersR.status==='fulfilled') orders.splice(0,orders.length,...ordersR.value.map(mapOrder).map(makeOrderProxy));
      if(couponsR.status==='fulfilled') coupons.splice(0,coupons.length,...(couponsR.value||[]).map(c=>({id:c.id,code:c.code,tip:c.type,vred:Number(c.value),minIznos:Number(c.minAmount),rok:c.validUntil,iskoriscen:Number(c.used),maxKor:Number(c.maxUses),opis:c.description})));
      try{renderBuyers();}catch(e){} try{renderOrders();}catch(e){} try{renderStock();}catch(e){} try{renderAdmStats();}catch(e){} try{renderCoupons();}catch(e){}
    }

    try{ await loadAdminQA(); }catch(e){ console.warn('admin Q&A bootstrap',e); }
    try{ const contacts=await adminApi('/admin/contacts'); if(typeof renderContacts==='function') renderContacts(contacts); }catch(e){ console.warn('contacts bootstrap',e); }
    try{ await loadAdminSettings(); }catch(e){ console.warn('settings bootstrap',e); }
    try{
      const c=await window.domextraAdminCourierReload();
      courier=Object.assign(courier,{freeFrom:Number(c.freeFrom||0),defWeight:Number(c.defWeight||1),zones:(c.zones||[]).map(z=>({kg:Number(z.kg),cena:Number(z.price)}))});
      const freeEl=document.getElementById('cFree'); if(freeEl) freeEl.value=String(courier.freeFrom);
      const defEl=document.getElementById('cDef'); if(defEl) defEl.value=String(courier.defWeight);
      renderCourier();
    }catch(e){ console.warn('courier bootstrap',e); }
  }
  async function loadB2BData(){
    const ps=await api('/b2b/products'); products.splice(0,products.length,...ps.map(p=>{const x=mapProduct(p,{});x.__serverId=p.id;return makeProductProxy(x);}));
    window.domextraProducts=products; window.domextraShopCart=shopCart;
    const os=await api('/b2b/orders'); orders.splice(0,orders.length,...os.map(mapOrder).map(makeOrderProxy));
    renderB2BSafely();renderMyB2B();
  }
  window.admLogin=async function(){
    const u=document.getElementById('aUser').value.trim(), p=document.getElementById('aPass').value, err=document.getElementById('aErr');
    try{const d=await api('/auth/admin/login',{method:'POST',body:JSON.stringify({username:u,password:p})});setToken(d.token);try{localStorage.setItem('domextra_admin_token',d.token||'');}catch(e){}admLogged=true;err.textContent='';document.getElementById('admLogin').style.display='none';document.getElementById('admApp').style.display='block';await loadAdminData();toast('Prijava uspešna.');}catch(e){err.textContent=e.message;}
  };
  window.admLogout=async function(){
    try{ await api('/auth/admin/logout',{method:'POST'}); }catch(e){}
    setToken('');
    try{localStorage.removeItem('domextra_admin_token');}catch(e){}
    admLogged=false;
    document.getElementById('admApp').style.display='none';
    document.getElementById('admLogin').style.display='block';
    document.getElementById('aPass').value='';
  };
  window.b2bLogin=async function(){
    const u=document.getElementById('lUser').value.trim(), p=document.getElementById('lPass').value, err=document.getElementById('lErr');
    try{const d=await api('/auth/b2b/login',{method:'POST',body:JSON.stringify({username:u,password:p})});setToken(d.token);try{localStorage.setItem('domextra_buyer_token',d.token||'');}catch(e){};const b=mapBuyer(d.buyer);b.__serverId=b.id;buyers.splice(0,buyers.length,b,...buyers.filter(x=>x.id!==b.id).map(x=>x));currentBuyer=buyers.find(x=>x.id===b.id)||b;b2bLogged=true;document.getElementById('b2bLogin').style.display='none';document.getElementById('b2bApp').style.display='block';await loadB2BData();renderBuyerStrip();renderB2BSafely();renderMyB2B();toast('Prijava uspešna — dobrodošli, '+b.name);}catch(e){err.textContent=e.message;}
  };
  window.b2bLogout=function(){setToken('');try{localStorage.removeItem('domextra_buyer_token');}catch(e){}b2bLogged=false;currentBuyer=null;b2bCart={};document.getElementById('b2bApp').style.display='none';document.getElementById('b2bLogin').style.display='block';document.getElementById('lPass').value='';};
  window.addBuyer=async function(){
    const name=val('nName').trim(); if(!name){toast('Unesite naziv firme.');return;}
    const payload={company:name,address:val('nAddr'),city:val('nCity'),pib:val('nPib'),mb:val('nMb'),account:val('nAcc'),email:val('nMail'),class:document.getElementById('nKlasa').value,paymentDays:Number(val('nVal'))||30,specialDiscount:Number(val('nPos'))||0};
    try{const d=await api('/admin/buyers',{method:'POST',body:JSON.stringify(payload)});const b=mapBuyer({...d,generatedPassword:d.generatedPassword});b.__serverId=b.id;buyers.push(makeBuyerProxy(b));['nName','nAddr','nCity','nPib','nMb','nAcc','nMail'].forEach(id=>document.getElementById(id).value='');document.getElementById('nPos').value='0';renderBuyers();renderAdmStats();toast('Kupac registrovan: '+b.user+' / '+b.pass);}catch(e){toast(e.message);}
  };
  window.addProduct=async function(){
    const d=readProdForm(); if(!d.name){toast('Unesite naziv proizvoda.');return;} if(!d.price&&!d.mpCena){toast('Unesite VP ili MP cenu.');return;}
    const payload={name:d.name,description:d.desc,group:d.grupa,sku:document.getElementById('pSku').value.trim(),barcode:d.bar,unit:d.jm,packQty:d.pak,packName:d.pakNaziv,vpPrice:d.price,mpPrice:d.mpCena,oldPrice:d.oldPrice||0,saleUntil:d.akcijaDo||null,brand:d.brand||'',isNew:d.isNew,longDesc:d.longDesc,gallery:d.gallery,specs:d.specs||[],stock:d.stock,weightKg:d.kg,actionDiscount:d.rabAk,specialDiscount:d.rabPosA,advanceDiscount:d.rabAv,logisticsDiscount:d.rabLog,image:d.img,icon:d.ico};
    try{
      if(editProdIdx!==null){const id=products[editProdIdx].__serverId||products[editProdIdx].id; const r=await api('/admin/products/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(payload)});const x=mapProduct(r,{});x.__serverId=r.id;products[editProdIdx]=makeProductProxy(x);toast('Artikal je izmenjen.');}
      else{const r=await api('/admin/products',{method:'POST',body:JSON.stringify(payload)});const x=mapProduct(r,{});x.__serverId=r.id;products.push(makeProductProxy(x));toast('Artikal je sačuvan i vidljiv u B2B i Web Shop-u.');}
      resetProdForm();if(hasEl('stockRows')) renderStock();renderB2BSafely();if(hasEl('admStats')) renderAdmStats();if(hasEl('grupeList')) renderGrupaDatalist();if(hasEl('grK')) renderGroupSelect();if(hasEl('shopGrid')) renderShopGrid();if(hasEl('heroSections')) renderHero();
    }catch(e){toast(e.message);}
  };
  window.applyGroupRab=async function(){
    const g=val('grK'), ak=val('grAk'), pos=val('grPos'); if(ak===''&&pos===''){toast('Unesite akcijski i/ili poseban rabat.');return;}
    try{await api('/admin/products/group-discount',{method:'POST',body:JSON.stringify({group:g,actionDiscount:ak,specialDiscount:pos})});const ps=await api('/admin/products');products.splice(0,products.length,...ps.map(p=>{const x=mapProduct(p,{});x.__serverId=p.id;return makeProductProxy(x);}));document.getElementById('grAk').value='';document.getElementById('grPos').value='';renderStock();renderB2BSafely();toast('Rabat je primenjen na grupu.');}catch(e){toast(e.message);}
  };
  const originalOpenDoc=window.openDoc;
  window.logOrder=function(o){ orders.unshift(makeOrderProxy(o)); if(admLogged){renderOrders();renderAdmStats();} if(currentBuyer)renderMyB2B(); };
  window.domextraRefreshShopUser=async function(){ if(window.domextraRestoreShopSession) { try{ await window.domextraRestoreShopSession(); }catch(e){} } };
  window.openDoc=async function(d){
    const cartSource=d.type==='B2B'?Object.entries(b2bCart):Object.entries(shopCart);
    try{
      // Web Shop order is already persisted by confirmShop(). Do not POST it a
      // second time here, otherwise stock would be deducted twice. B2B still
      // uses this bridge because confirmB2B only builds the document client-side.
      const items=cartSource.map(([id,qty])=>({productId:String(id),qty:Number(qty)})).filter(x=>x.qty>0);
      if(items.length && !d.orderId){
        const payload=d.type==='B2B'?{items,shippingMethod:(document.getElementById('b2bShip')?.value||'dostava'),avans:!!document.getElementById('avansChk')?.checked,paymentMethod:d.shopMeta?.pay||'po dogovoru'}:{items,customer:{name:document.getElementById('cName')?.value||d.logBuyer||'',email:document.getElementById('cMail')?.value||'',phone:document.getElementById('cPhone')?.value||'',address:[document.getElementById('cAddr')?.value,document.getElementById('cCity')?.value].filter(Boolean).join(', ')},shippingMethod:(document.querySelector('input[name="ship"]:checked')?.value||'lično'),paymentMethod:document.querySelector('input[name="pay"]:checked')?.value||'pouzećem',couponCode:window.appliedCoupon?.code||''};
        const r=await api(d.type==='B2B'?'/orders/b2b':'/orders/shop',{method:'POST',body:JSON.stringify(payload)});
        if(r.order){ d.total=fmt(Number(r.order.total))+' RSD'; d.orderId=r.order.id; d.pdfUrl=r.order.pdfUrl||null; }
      }
      // Refresh products from MySQL so the newly reduced stock is immediately
      // visible in the UI as well.
      if(typeof window.domextraReloadPublic==='function') await window.domextraReloadPublic();
    }catch(e){
      console.error('B2B order sync failed',e);
      if(d.type==='B2B'){
        toast('B2B porudžbina nije sačuvana u bazi: '+(e.message||'Greška servera'));
        throw e;
      }
      console.warn('order sync',e);
    }
    return originalOpenDoc.call(this,d);
  };
  window.addEventListener('DOMContentLoaded',()=>{loadPublic(); setTimeout(()=>loadPublic(),300);});
  window.addEventListener('load',()=>{ if(hasEl('shopGrid')) loadPublic(); });
})();

/* ==========================================================
   CLEAN URLS + DATABASE-DRIVEN FILTERS + CHECKOUT WIZARD
   ========================================================== */
(function(){
  const API='/api';
  let dbBrands=[];
  let dbGroups=[];

  async function bridgeApi(path, options={}){
    const headers={'Content-Type':'application/json', ...(options.headers||{})};
    const t=localStorage.getItem('domextra_shop_token')||'';
    if(t) headers.Authorization='Bearer '+t;
    const r=await fetch(API+path,{...options,headers,credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Greška servera');
    return d;
  }

  function renderHomeDatabaseModels(){
    const home=location.pathname==='/' || location.pathname==='';
    if(!home) return;
    const iconByGroup={
      'Sanitarija': '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 9h16v7H10zM14 16v9a10 10 0 0 0 20 0v-9M24 9V5M24 5h8M32 5v5"/><path d="M20 35h16M28 35v7M19 42h18"/></svg>',
      'Pločice': '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="16" height="16" rx="1"/><rect x="26" y="6" width="16" height="16" rx="1"/><rect x="6" y="26" width="16" height="16" rx="1"/><rect x="26" y="26" width="16" height="16" rx="1"/></svg>',
      'Grejanje': '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 10h30M9 18h30M9 26h30M9 34h30M13 7v34M21 7v34M29 7v34M37 7v34"/><path d="M24 3c-4 5 2 7 2 11 0 3-2 5-5 6M29 20c3 3 4 5 4 8"/></svg>',
      'Lepkovi i mase': '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 8h14M19 8v5h10V8M15 13h18v28H15z"/><path d="M19 21h10M19 27h10M19 33h7"/></svg>',
      'Bela Tehnika': '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="5" width="28" height="38" rx="2"/><circle cx="24" cy="27" r="8"/><circle cx="17" cy="11" r="1"/><circle cx="22" cy="11" r="1"/><path d="M28 11h5"/></svg>'
    };
    const defaultCategoryIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="7" width="13" height="13" rx="1"/><rect x="28" y="7" width="13" height="13" rx="1"/><rect x="7" y="28" width="13" height="13" rx="1"/><rect x="28" y="28" width="13" height="13" rx="1"/></svg>';
    const descByGroup={'Sanitarija':'WC šolje, lavaboi, baterije, tuš sistemi i kupatilski program.','Pločice':'Zidne i podne pločice, veliki formati, mermerni dezeni.','Grejanje':'Bojleri, radijatori, toplotne pumpe i prateća oprema.','Lepkovi i mase':'Lepkovi za pločice, fug mase, hidroizolacija i estrisi.','Bela Tehnika':'Veš mašine, sudo mašine, šporeti, ugradni aparati.'};
    const bg=document.querySelector('#brendovi .de-brands-grid');
    if(bg && dbBrands.length){ bg.innerHTML=dbBrands.map(b=>`<a href="/web-shop/?brend=${encodeURIComponent(b.name)}" class="de-brand-card"><div class="bn">${b.name}</div><div class="bc">${b.category||'Brend'}</div></a>`).join('') + `<a href="/web-shop/" class="de-brand-card"><div class="bn">+ ostali</div><div class="bc">Cela ponuda</div></a>`; }
    const hp=document.querySelector('#vrh .de-hero-panel');
    if(hp && dbBrands.length){ hp.innerHTML='<h4>Naši brendovi</h4>'+dbBrands.slice(0,5).map(b=>`<a href="/web-shop/?brend=${encodeURIComponent(b.name)}" class="de-hero-brand-row"><span class="hb-name">${b.name}</span><span class="hb-cat">${b.category||'Brend'}</span></a>`).join(''); }
    const cg=document.querySelector('#kategorije .de-cat-grid');
    if(cg && dbGroups.length){ cg.innerHTML=dbGroups.map((g,i)=>{ const n=typeof g==='string'?g:g.name; return `<a href="/web-shop/?grupa=${encodeURIComponent(n)}" class="de-cat-card ${i===0?'large':''}"><div class="de-cat-icon">${iconByGroup[n]||defaultCategoryIcon}</div><h3>${n}</h3><p>${descByGroup[n]||'Proizvodi iz kategorije '+n+'.'}</p><div class="arrow">Pogledaj →</div></a>`; }).join('') + `<a href="/web-shop/" class="de-cat-card"><div class="de-cat-icon">${defaultCategoryIcon}</div><h3>Kompletna ponuda</h3><p>Pretražite ceo asortiman u web shopu.</p><div class="arrow">Pogledaj →</div></a>`; }
  }

  function fillDatabaseLists(){
    const groups=[...new Set(dbGroups.map(x=>typeof x==='string'?x:x.name).filter(Boolean))];
    const brands=dbBrands.map(x=>x.name).filter(Boolean);
    const f=document.getElementById('fGrupa');
    if(f){
      const current=new URLSearchParams(location.search).get('grupa')||f.value||'';
      f.innerHTML='<option value="">Sve grupe</option>'+groups.map(x=>`<option value="${String(x).replaceAll('"','&quot;')}">${x}</option>`).join('');
      if(current) f.value=current;
    }
    const dl=document.getElementById('grupeList');
    if(dl) dl.innerHTML=groups.map(x=>`<option value="${String(x).replaceAll('"','&quot;')}">`).join('');
    const bdl=document.getElementById('brendoviList');
    if(bdl) bdl.innerHTML=brands.map(x=>`<option value="${String(x).replaceAll('"','&quot;')}">`).join('');
    const gk=document.getElementById('grK');
    if(gk){ const old=gk.value; gk.innerHTML=groups.map(x=>`<option value="${String(x).replaceAll('"','&quot;')}">${x}</option>`).join(''); if(old) gk.value=old; }
  }

  // Keep original functions, but make their data source MySQL through Django models.
  const oldLoadPublic=window.loadPublic;
  // backend-bridge's internal loadPublic isn't globally exposed, so refresh from API here.
  async function reloadCatalogModels(){
    try{
      const d=await bridgeApi('/public');
      dbGroups=d.groups||[]; dbBrands=d.brands||[];
      window.domextraGroups=dbGroups; window.domextraBrands=dbBrands;
      fillDatabaseLists();
      renderHomeDatabaseModels();
      if(document.getElementById('shopGrid') && typeof renderShopGrid==='function') renderShopGrid();
      if(typeof renderGrupaDatalist==='function') renderGrupaDatalist();
      if(typeof renderGroupSelect==='function') renderGroupSelect();
    }catch(e){ console.warn('DB models bootstrap:',e); }
  }
  window.renderGroupSelect=function(){
    const el=document.getElementById('grK'); if(!el) return;
    const cur=el.value;
    const groups=[...new Set(dbGroups.map(x=>typeof x==='string'?x:x.name).filter(Boolean))];
    el.innerHTML=groups.map(g=>`<option value="${String(g).replaceAll('\"','&quot;')}">${g}</option>`).join('');
    if(cur) el.value=cur;
  };
  window.renderGrupaDatalist=function(){
    const dl=document.getElementById('grupeList'); if(!dl) return;
    const groups=[...new Set(dbGroups.map(x=>typeof x==='string'?x:x.name).filter(Boolean))];
    dl.innerHTML=groups.map(g=>`<option value="${String(g).replaceAll('\"','&quot;')}">`).join('');
  };
  window.domextraReloadModels=reloadCatalogModels;
  window.domextraUploadProductImage=async function(file){
    if(!file) return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif'];
    if(!allowed.includes(file.type)){ toast('Dozvoljene su JPG, PNG, WEBP ili GIF slike.'); return; }
    if(file.size>5*1024*1024){ toast('Slika može imati najviše 5 MB.'); return; }
    try{
      const form=new FormData(); form.append('file',file);
      const headers={}; const t=(typeof window.getToken==='function'?window.getToken():localStorage.getItem('domextra_token')||''); if(t) headers.Authorization='Bearer '+t;
      const r=await fetch('/api/admin/product-image',{method:'POST',body:form,headers});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'Upload slike nije uspeo.');
      const img=document.getElementById('pImg'); if(img) img.value=d.url;
      const preview=document.getElementById('pImgPreview'); if(preview){preview.src=d.url; preview.style.display='block';}
      toast('Slika je dodata.');
    }catch(e){toast(e.message);}
  };
  function setupProductDropzone(){
    const zone=document.getElementById('pImageDrop'); const file=document.getElementById('pImageFile');
    if(!zone||!file||zone.dataset.ready) return; zone.dataset.ready='1';
    zone.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>file.files[0]&&window.domextraUploadProductImage(file.files[0]));
    ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('dragover');}));
    ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('dragover');}));
    zone.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(f) window.domextraUploadProductImage(f);});
  }
  document.addEventListener('DOMContentLoaded',setupProductDropzone);
  window.setupProductDropzone=setupProductDropzone;

  /* ----- Clean navigation ----- */
  window.deGo=function(view){ window.location.href=view==='b2b'?'/b2b/':'/web-shop/'; };
  window.deCat=function(group){ window.location.href='/web-shop/?grupa='+encodeURIComponent(group); };
  window.deBrand=function(brand){ window.location.href='/web-shop/?brend='+encodeURIComponent(brand); };
  window.openAdmin=function(){ window.location.href='/admin/'; };
  window.deScroll=function(id){ const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth'}); else window.location.href='/#'+id; };

  /* ----- Checkout wizard ----- */
  const STEP_KEY='domextra_checkout_step';
  const MAX_STEP_KEY='domextra_checkout_max_step';
  function getMaxStep(){
    try{
      const n=parseInt(sessionStorage.getItem(MAX_STEP_KEY)||'1',10);
      return Math.max(1,Math.min(4,n||1));
    }catch(e){ return 1; }
  }
  function setMaxStep(n){
    try{ sessionStorage.setItem(MAX_STEP_KEY,String(Math.max(1,Math.min(4,n)))); }catch(e){}
  }
  function resetCheckoutProgress(){
    try{ sessionStorage.removeItem(MAX_STEP_KEY); sessionStorage.setItem(STEP_KEY,'1'); }catch(e){}
  }
  function currentStep(){
    const q=new URLSearchParams(location.search).get('step');
    const requested=Math.max(1,Math.min(4,parseInt(q||'1',10)||1));
    return Math.min(requested,getMaxStep());
  }
  function checkoutActive(){ return location.pathname==='/web-shop/' || location.pathname==='/web-shop'; }
  function findCheckoutCards(){
    const split=document.querySelector('#view-shop .split');
    if(!split) return null;
    const cards=[...split.querySelectorAll(':scope > .stack > .card')];
    const sum=split.querySelector(':scope > .sum > .card');
    return {split,catalog:cards[0],customer:cards[1],shipping:cards[2],payment:cards[3],summary:sum};
  }
  function ensureWizard(){
    if(!checkoutActive()) return;

    const view=document.getElementById('view-shop');
    if(!view) return;

    let w=view.querySelector('#checkoutWizard');

    if(!w){
      w=document.createElement('div');
      w.id='checkoutWizard';
      w.className='checkout-wizard';

      w.innerHTML=`
        <div class="checkout-steps">
          <div class="checkout-step" data-step="1">
            <span class="num">1</span>
            <span>
              Korpa
              <small>Proizvodi</small>
            </span>
          </div>

          <div class="checkout-step" data-step="2">
            <span class="num">2</span>
            <span>
              Podaci
              <small>Kupac</small>
            </span>
          </div>

          <div class="checkout-step" data-step="3">
            <span class="num">3</span>
            <span>
              Isporuka
              <small>Adresa</small>
            </span>
          </div>

          <div class="checkout-step" data-step="4">
            <span class="num">4</span>
            <span>
              Plaćanje
              <small>Način plaćanja</small>
            </span>
          </div>
        </div>
      `;

      view.querySelector('#saleBannerWrap')?.after(w);

      // NAMERNO NEMA CLICK EVENTA NA KORAKE.
      // Korisnik ne može klikom na 1, 2, 3 ili 4
      // da promeni checkout korak.
    }

    const cards=findCheckoutCards();

    if(!cards) return;

    const step=currentStep();

    const all=[
      cards.catalog,
      cards.customer,
      cards.shipping,
      cards.payment,
      cards.summary
    ].filter(Boolean);

    // Sakrij sve checkout kartice
    all.forEach(x=>{
      x.classList.add('checkout-only-hidden');
    });

    // KORAK 1 - KORPA
    if(step===1){
      cards.summary?.classList.remove('checkout-only-hidden');
      cards.catalog?.classList.add('checkout-only-hidden');
    }

    // KORAK 2 - PODACI KUPCA
    if(step===2){
      cards.customer?.classList.remove('checkout-only-hidden');
    }

    // KORAK 3 - ISPORUKA
    if(step===3){
      cards.shipping?.classList.remove('checkout-only-hidden');
    }

    // KORAK 4 - PLAĆANJE
    if(step===4){
      cards.payment?.classList.remove('checkout-only-hidden');
      cards.summary?.classList.remove('checkout-only-hidden');
    }

    // Catalog remains on the normal shop
    // when there is no explicit checkout request.
    const checkoutQuery=
      new URLSearchParams(location.search).has('step');

    if(!checkoutQuery){

      all.forEach(x=>{
        x.classList.remove('checkout-only-hidden');
      });

      cards.customer?.classList.add('checkout-only-hidden');
      cards.shipping?.classList.add('checkout-only-hidden');
      cards.payment?.classList.add('checkout-only-hidden');
      cards.summary?.classList.add('checkout-only-hidden');

      document.body.classList.remove('checkout-mode');

      w.style.display='none';

      return;
    }

    // Checkout mode
    document.body.classList.add('checkout-mode');

    w.style.display='block';

    // Katalog proizvoda se ne prikazuje u checkout wizardu
    cards.catalog?.classList.add('checkout-only-hidden');

    // Ažuriraj vizuelni status koraka
    updateStepVisuals(step);

    // Postavi samo NASTAVI / NAZAD akcije
    wireStepActions(cards,step);
}
  function updateStepVisuals(step){
    document.querySelectorAll('#checkoutWizard .checkout-step').forEach(b=>{const n=Number(b.dataset.step); b.classList.toggle('active',n===step); b.classList.toggle('done',n<step);});
  }
  function validCustomer(){
    const name=document.getElementById('cName')?.value.trim();
    const mail=document.getElementById('cMail')?.value.trim();
    const addr=document.getElementById('cAddr')?.value.trim();
    const city=document.getElementById('cCity')?.value.trim();
    if(!name||!mail||!addr||!city){ toast('Popunite ime, e-mail, grad i adresu za isporuku.'); return false; }
    return true;
  }
  function goStep(n){
    n=Math.max(1,Math.min(4,Number(n)||1));
    const current=currentStep();
    const max=getMaxStep();
    if(n>max+1){
      toast('Prvo završite prethodni korak.');
      const url=new URL(location.href); url.searchParams.set('step',String(max)); history.replaceState({},'',url.toString());
      ensureWizard();
      return;
    }
    if(n===2 && Object.keys(shopCart||{}).length===0){toast('Korpa je prazna. Dodajte artikal.');return;}
    if(n===3 && !validCustomer()) return;
    if(n>max) setMaxStep(n);
    const url=new URL(location.href); url.searchParams.set('step',String(n)); history.pushState({},'',url.toString());
    ensureWizard(); window.scrollTo({top:0,behavior:'smooth'});
    trackEvent('begin_checkout',{step:n});
  }
  function wireStepActions(cards,step){
    const targets=[cards.summary,cards.customer,cards.shipping,cards.payment];
    targets.forEach((card,idx)=>{
      if(!card) return;
      let a=card.querySelector('.checkout-actions');
      if(!a){
        a=document.createElement('div'); a.className='checkout-actions';
        card.querySelector('.card-b')?.appendChild(a);
      }
      a.innerHTML='';
      if(idx>0){ const back=document.createElement('button'); back.className='back'; back.textContent='← Nazad'; back.onclick=()=>goStep(idx); a.appendChild(back); }
      const next=document.createElement('button'); next.className='next'; next.textContent=idx===3?'Potvrdi porudžbinu':'Nastavi →';
      if(idx===0) next.onclick=()=>goStep(2);
      if(idx===1) next.onclick=()=>goStep(3);
      if(idx===2) next.onclick=()=>goStep(4);
      if(idx===3) next.style.display='none';
      a.appendChild(next);
    });
    // Original confirm button belongs to summary. Move it into step 4 controls and keep only one confirmation CTA.
    const confirm=cards.summary?.querySelector('#shopConfirm');
    const payCard=cards.payment;
    if(confirm){ confirm.classList.toggle('checkout-only-hidden', step!==4); }
    const pa=payCard?.querySelector('.checkout-actions');
    if(pa){
      pa.innerHTML='';
      const back=document.createElement('button'); back.className='back'; back.textContent='← Nazad'; back.onclick=()=>goStep(3);
      const finish=document.createElement('button'); finish.className='next'; finish.textContent='Potvrdi porudžbinu'; finish.onclick=()=>{ if(confirm) confirm.click(); };
      pa.append(back,finish);
    }
    const sa=cards.summary?.querySelector('.checkout-actions');
    if(sa){sa.style.display=step===1?'flex':'none';}
  }
  window.checkoutGo=goStep;

  function syncCartNavigation(){
    const btn=document.getElementById('deCartCount')?.closest('a');
    if(btn) btn.setAttribute('href','/web-shop/?step=1');
  }

  window.addEventListener('popstate',()=>ensureWizard());
  async function restoreAdminSession(){
    if(!document.getElementById('admLogin')) return;
    try{
      // Do not depend only on localStorage. The server also keeps an HttpOnly
      // admin cookie, so refresh remains logged in even when storage is unavailable.
      const adminToken=localStorage.getItem('domextra_admin_token')||'';
      const headers=adminToken?{'Authorization':'Bearer '+adminToken}:{};
      let rr=await fetch('/api/auth/admin/me',{headers,credentials:'same-origin'});
      if(rr.status===401 && adminToken) rr=await fetch('/api/auth/admin/me',{credentials:'same-origin'});
      const me=await rr.json().catch(()=>({}));
      if(!rr.ok) throw new Error(me.error||'Niste prijavljeni.');
      if(me.kind && me.kind!=='admin') return;
      admLogged=true;
      document.getElementById('admLogin').style.display='none';
      document.getElementById('admApp').style.display='block';
      await window.loadAdminData();
      if(window.domextraLoadMarketing) await window.domextraLoadMarketing();
      // Second read closes the common refresh race with cached/static scripts.
      setTimeout(()=>{ if(admLogged) window.loadAdminData().catch(()=>{}); }, 500);
    }catch(e){
      // Only clear a stored token when the server explicitly rejects it.
      // A transient network error must not log the administrator out visually.
      if(e && /prijavljeni|token|korisnik/i.test(e.message||'')){
        localStorage.removeItem('domextra_admin_token');
        localStorage.removeItem('domextra_token');
      }
    }
  }
  window.domextraRestoreAdminSession=restoreAdminSession;
  async function restoreShopSession(){
    if(!document.getElementById('acctBtns')) return;
    try{
      const shopToken=localStorage.getItem('domextra_shop_token')||'';
      const headers=shopToken?{'Authorization':'Bearer '+shopToken}:{};
      const r=await fetch('/api/auth/shop/me',{headers,credentials:'same-origin'});
      if(!r.ok) return;
      const d=await r.json();
      if(!d.user) return;
      currentShopUser={name:d.user.name,mail:d.user.email,pass:'',phone:d.user.phone||'',addr:d.user.address||'',city:d.user.city||'',history:d.user.history||[],wishlist:(d.user.wishlist||[]).map(String),savedSearches:d.user.savedSearches||[]};
      acctOpen=null;
      renderAcctBtns();
      renderAcctPanel();
      fillCheckout(currentShopUser);
    }catch(e){ console.warn('restore shop session',e); }
  }
  window.domextraRestoreShopSession=restoreShopSession;
  document.addEventListener('DOMContentLoaded',()=>{
    reloadCatalogModels();
    restoreAdminSession();
    restoreShopSession();
    syncCartNavigation();
    setTimeout(()=>{ensureWizard();syncCartNavigation();},100);
  });
  window.addEventListener('load',()=>{ ensureWizard(); syncCartNavigation(); if(window.setupProductDropzone) window.setupProductDropzone(); setTimeout(()=>{ ensureWizard(); syncCartNavigation(); if(typeof window.domextraRestoreShopSession==='function') window.domextraRestoreShopSession(); if(typeof window.domextraRestoreAdminSession==='function') window.domextraRestoreAdminSession(); }, 250); window.domextraRestoreShopSessionRetry=true; });
})();


/* ==========================================================
   PERSISTENT MARKETING + ROBUST SHOP CART
   ========================================================== */
(function(){
  const API='/api';
  const jsonHeaders={'Content-Type':'application/json'};
  const token=()=>localStorage.getItem('domextra_admin_token')||'';
  async function adminApi(path, options={}){
    const baseHeaders={...jsonHeaders,...(options.headers||{})};
    const t=token();
    let headers={...baseHeaders};
    if(t) headers.Authorization='Bearer '+t;
    let r=await fetch(API+path,{...options,headers,credentials:'same-origin'});
    if(r.status===401 && headers.Authorization){
      r=await fetch(API+path,{...options,headers:baseHeaders,credentials:'same-origin'});
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Greška servera');
    return d;
  }

  // Coupon persistence
  window.addCoupon=async function(){
    const code=(document.getElementById('kpCode')?.value||'').trim().toUpperCase();
    const description=(document.getElementById('kpOpis')?.value||'').trim();
    const type=document.getElementById('kpTip')?.value||'%';
    const value=Number(document.getElementById('kpVred')?.value||0);
    const minAmount=Number(document.getElementById('kpMin')?.value||0);
    const maxUses=Math.max(1,Number(document.getElementById('kpMax')?.value||100));
    const validUntil=document.getElementById('kpRok')?.value||null;
    if(!code){toast('Unesite kod.');return;}
    if(!value || value<0){toast('Unesite vrednost popusta.');return;}
    try{
      const c=await adminApi('/admin/coupons',{method:'POST',body:JSON.stringify({code,description,type,value,minAmount,maxUses,validUntil})});
      const mapped={id:c.id,code:c.code,opis:c.description||'—',tip:c.type,vred:Number(c.value),minIznos:Number(c.minAmount),maxKor:Number(c.maxUses),rok:c.validUntil||'',iskoriscen:Number(c.used||0)};
      const existing=coupons.findIndex(x=>x.code===mapped.code);
      if(existing>=0) coupons[existing]=mapped; else coupons.push(mapped);
      ['kpCode','kpOpis','kpVred','kpRok'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
      const mi=document.getElementById('kpMin'); if(mi) mi.value='0';
      const mx=document.getElementById('kpMax'); if(mx) mx.value='100';
      if(typeof renderCoupons==='function') renderCoupons();
      toast('Promo kod "'+mapped.code+'" je sačuvan u MySQL bazi.');
    }catch(e){toast(e.message);}
  };
  window.deleteCoupon=async function(id, code){
    if(!id){ toast('Promo kod nema ID iz baze. Osvežite Admin panel.'); return; }
    if(!window.confirm('Obrisati promo kod '+(code||'')+'?')) return;
    try{
      await adminApi('/admin/coupons/'+encodeURIComponent(String(id)),{method:'DELETE'});
      const idx=coupons.findIndex(x=>String(x.id)===String(id));
      if(idx>=0) coupons.splice(idx,1);
      renderCoupons();
      toast('Promo kod je obrisan.');
    }catch(e){
      toast(e.message||'Promo kod nije obrisan.');
    }
  };
  window.renderCoupons=function(){
    const el=document.getElementById('couponsRows'); if(!el) return;
    const count=document.getElementById('couponsCount'); if(count) count.textContent=coupons.length+' aktivnih kodova';
    el.innerHTML=coupons.length?coupons.map(c=>`
      <tr>
        <td class="mono"><b>${c.code}</b></td>
        <td>${c.opis||'—'}</td>
        <td>${c.tip==='%'?'Procenat':'Fiksni'}</td>
        <td class="mono"><b>${c.tip==='%'?c.vred+'%':fmt(c.vred)+' RSD'}</b></td>
        <td class="mono">${c.minIznos?fmt(c.minIznos):'—'}</td>
        <td class="mono">${c.iskoriscen||0} / ${c.maxKor}</td>
        <td class="mono">${c.rok||'—'}</td>
        <td><button class="x-btn" data-id="${String(c.id??'').replace(/"/g,'&quot;')}" data-code="${String(c.code??'').replace(/"/g,'&quot;')}" onclick="deleteCoupon(this.dataset.id,this.dataset.code)" title="Obriši">✕</button></td>
      </tr>`).join(''):'<tr><td colspan="8"><div class="empty">Nema definisanih promo kodova.</div></td></tr>';
  };

  // Banner persistence
  function readBannerForm(){
    return {
      active:!!document.getElementById('sbActive')?.checked,
      title:document.getElementById('sbTitle')?.value||'',
      text:document.getElementById('sbText')?.value||'',
      cta:document.getElementById('sbCta')?.value||'',
      bg:document.getElementById('sbBg')?.value||'#0c0c0c'
    };
  }
  function fillBannerForm(b){
    if(!b) return;
    const a=document.getElementById('sbActive'); if(a)a.checked=!!b.active;
    const t=document.getElementById('sbTitle'); if(t)t.value=b.title||'';
    const x=document.getElementById('sbText'); if(x)x.value=b.text||'';
    const c=document.getElementById('sbCta'); if(c)c.value=b.cta||'';
    const g=document.getElementById('sbBg'); if(g)g.value=b.bg||'#0c0c0c';
  }
  window.saveSaleBanner=async function(){
    const payload=readBannerForm();
    try{
      const b=await adminApi('/admin/banner',{method:'PATCH',body:JSON.stringify(payload)});
      saleBanner=b; fillBannerForm(b); if(typeof renderSaleBanner==='function') renderSaleBanner();
      toast('Banner je sačuvan u MySQL bazi.');
    }catch(e){toast(e.message);}
  };
  window.disableSaleBanner=async function(){
    try{
      const b=await adminApi('/admin/banner',{method:'PATCH',body:JSON.stringify({active:false})});
      saleBanner=b; fillBannerForm(b); if(typeof renderSaleBanner==='function') renderSaleBanner();
      toast('Banner je deaktiviran.');
    }catch(e){toast(e.message);}
  };
  async function loadAdminQA(){
    try{
      const qa=await adminApi('/admin/qa');
      Object.keys(questions).forEach(k=>delete questions[k]);
      (qa||[]).forEach(q=>{(questions[q.productId] ||= []).push({id:q.id,user:'Kupac',q:q.question||'',a:q.answer||'',date:(q.date||'').slice(0,10)});});
      if(typeof renderQA==='function') renderQA();
      return qa;
    }catch(e){
      console.warn('qa bootstrap',e);
      return [];
    }
  }
  window.domextraLoadMarketing=async function(){
    try{
      const d=await adminApi('/admin/marketing');
      if(d.saleBanner){saleBanner=d.saleBanner;fillBannerForm(d.saleBanner);}
      if(Array.isArray(d.coupons)){coupons.splice(0,coupons.length,...d.coupons.map(c=>({id:c.id,code:c.code,opis:c.description||'—',tip:c.type,vred:Number(c.value),minIznos:Number(c.minAmount),maxKor:Number(c.maxUses),rok:c.validUntil||'',iskoriscen:Number(c.used||0)})));}
      renderCoupons();
      await loadAdminQA();
      try{ const contacts=await adminApi('/admin/contacts'); if(typeof renderContacts==='function') renderContacts(contacts); }catch(e){}
    }catch(e){console.warn('marketing bootstrap',e);}
  };

  // Persist Q&A questions and admin answers in MySQL.
  window.submitQuestion=async function(id){
    if(!currentShopUser){ toast('Prijavite se da biste postavili pitanje.'); return; }
    const input=document.getElementById('qInput');
    const q=(input?.value||'').trim();
    if(!q){ toast('Unesite pitanje.'); return; }
    try{
      const saved=await api('/qa',{method:'POST',body:JSON.stringify({productId:String(id),question:q,user:currentShopUser.name||'Kupac'})});
      (questions[id] ||= []).push({id:saved.id,user:currentShopUser.name||'Kupac',q:saved.question,a:saved.answer||'',date:(saved.date||'').slice(0,10)});
      const qi=document.getElementById('qInput'); if(qi) qi.value='';
      toast('Vaše pitanje je sačuvano. Odgovor ćete dobiti uskoro.');
      openProduct(id);
    }catch(e){ toast(e.message||'Pitanje nije sačuvano.'); }
  };

  window.answerQuestion=async function(pid, idx){
    const item=questions[pid]?.[idx];
    if(!item || !item.id){ toast('Pitanje nema validan ID. Osvežite Admin panel.'); return; }
    const input=document.getElementById('qaAns_'+pid+'_'+idx);
    const ans=(input?.value||'').trim();
    if(!ans){ toast('Unesite odgovor.'); return; }
    try{
      const saved=await adminApi('/admin/qa/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({answer:ans})});
      item.a=saved.answer||ans;
      renderQA();
      toast('Odgovor je sačuvan i objavljen.');
    }catch(e){ toast(e.message||'Odgovor nije sačuvan.'); }
  };

  window.removeAnswer=async function(pid, idx){
    const item=questions[pid]?.[idx];
    if(!item || !item.id) return;
    try{
      await adminApi('/admin/qa/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({answer:''})});
      item.a='';
      renderQA();
      toast('Odgovor je uklonjen.');
    }catch(e){ toast(e.message||'Odgovor nije uklonjen.'); }
  };

  // Robust cart: browser-only cart, independent of admin/B2B authentication.
  function cartState(){
    if(!window.domextraShopCart){ window.domextraShopCart=shopCart||{}; }
    return window.domextraShopCart;
  }
  function productState(){ return window.domextraProducts || (typeof products!=='undefined'?products:[]); }
  function persistCart(){ try{ saveShopCart(); }catch(e){} }
  window.shopAdd=function(id){
    const key=String(id);
    try{
      const list=productState();
      const p=list.find(x=>String(x.id)===key);
      if(!p){toast('Artikal nije pronađen. Osvežite Web Shop.');return false;}
      const stock=p.stock==null?Infinity:Number(p.stock);
      const pack=Math.max(Number(p.pak)||Number(p.packQty)||1,0.001);
      const cart=cartState();
      const current=Number(cart[key])||0;
      const next=Number((current+pack).toFixed(3));
      if(stock < next){toast('Nema dovoljno artikla na stanju.');return false;}
      cart[key]=next;
      window.domextraShopCart=cart;
      persistCart();
      if(document.getElementById('shopCart') && typeof renderShopCart==='function') renderShopCart();
      syncCartNow();
      toast(p.name+' je dodat u korpu.');
      return true;
    }catch(e){console.error('shopAdd error',e);toast('Dodavanje u korpu nije uspelo: '+e.message);return false;}
  };
  window.shopRem=function(id){const cart=cartState();delete cart[String(id)];window.domextraShopCart=cart;persistCart();if(document.getElementById('shopCart')&&typeof renderShopCart==='function')renderShopCart();syncCartNow();if(Object.keys(cart).length===0&&typeof resetCheckoutToFirstStep==='function')resetCheckoutToFirstStep();};
  window.shopQty=function(id,v){const k=String(id), list=productState(), p=list.find(x=>String(x.id)===k);if(!p)return;const cart=cartState();const q=Math.max(0,parseFloat(String(v).replace(',','.'))||0);if(!q){delete cart[k];if(Object.keys(cart).length===0&&typeof resetCheckoutToFirstStep==='function')resetCheckoutToFirstStep();}else{const pack=Math.max(Number(p.pak)||Number(p.packQty)||1,0.001);const adj=Math.ceil(q/pack)*pack;if(p.stock!=null&&adj>Number(p.stock)){toast('Nema dovoljno artikla na stanju.');return;}cart[k]=Number(adj.toFixed(3));}window.domextraShopCart=cart;persistCart();if(document.getElementById('shopCart')&&typeof renderShopCart==='function')renderShopCart();syncCartNow();};
  function syncCartNow(){
    const cart=cartState();
    const n=Object.keys(cart).filter(k=>Number(cart[k])>0).length;
    const el=document.getElementById('deCartCount');
    if(el){el.textContent=n;el.classList.toggle('hidden',n===0);}
  }
  window.syncCartNavigation=syncCartNow;
  // When admin login/data load happens, also pull persistent marketing values.
  const _admLogin=window.admLogin;
  window.admLogin=async function(){
    const r=await _admLogin.apply(this,arguments);
    try{ await window.domextraLoadMarketing(); }catch(e){}
    return r;
  };
  // Admin refresh recovery lives here so it is defined after the backend bridge
  // and always uses the same API/auth path as the admin data loader.
  window.domextraRestoreAdminSession=async function(){
    if(!document.getElementById('admLogin')) return;
    try{
      const token=localStorage.getItem('domextra_admin_token')||localStorage.getItem('domextra_token')||'';
      const headers=token?{'Authorization':'Bearer '+token}:{};
      let r=await fetch('/api/auth/admin/me',{headers,credentials:'same-origin',cache:'no-store'});
      if(r.status===401 && token){
        r=await fetch('/api/auth/admin/me',{headers:{},credentials:'same-origin',cache:'no-store'});
      }
      const me=await r.json().catch(()=>({}));
      if(!r.ok || me.kind!=='admin') throw new Error(me.error||'Niste prijavljeni.');
      admLogged=true;
      document.getElementById('admLogin').style.display='none';
      document.getElementById('admApp').style.display='block';
      await window.loadAdminData();
      if(window.domextraLoadMarketing) await window.domextraLoadMarketing();
      // One additional fresh read protects against browser cache/race after refresh.
      setTimeout(()=>{ if(admLogged) window.loadAdminData().then(()=>window.domextraLoadMarketing&&window.domextraLoadMarketing()).catch(e=>console.warn('admin refresh reload',e)); },700);
    }catch(e){
      console.warn('admin session restore:',e);
      admLogged=false;
      document.getElementById('admApp').style.display='none';
      document.getElementById('admLogin').style.display='block';
    }
  };

  window.addEventListener('load',()=>{ syncCartNow(); });
})();
