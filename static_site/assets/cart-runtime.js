/* DOM EXTRA - hardened cart and product image runtime */
(function(){
  'use strict';
  const CART_KEY='domextra_shop_cart';
  const tokenKey='domextra_token';
  function toastSafe(msg){ try{ if(typeof toast==='function') toast(msg); else alert(msg); }catch(e){ console.warn(msg); } }
  function getCart(){
    let c=window.domextraShopCart;
    if(!c || typeof c!=='object'){
      try{ c=JSON.parse(localStorage.getItem(CART_KEY)||'{}')||{}; }catch(e){ c={}; }
      window.domextraShopCart=c;
    }
    try{ if(typeof shopCart!=='undefined' && shopCart!==c){ shopCart=c; } }catch(e){}
    return c;
  }
  function saveCart(){
    const c=getCart();
    try{ localStorage.setItem(CART_KEY, JSON.stringify(c)); }catch(e){}
    try{ if(typeof shopCart!=='undefined' && shopCart!==c){ shopCart=c; } }catch(e){}
  }
  function getProducts(){ return Array.isArray(window.domextraProducts)?window.domextraProducts:[]; }
  function sync(){
    const cart=getCart();
    const n=Object.keys(cart).filter(k=>Number(cart[k])>0).length;
    const el=document.getElementById('deCartCount');
    if(el){el.textContent=n;el.classList.toggle('hidden',n===0);}
    if(typeof renderShopCart==='function' && document.getElementById('shopCart')) { try{ renderShopCart(); }catch(e){ console.warn('renderShopCart',e); } }
  }
  window.getToken=function(){ return localStorage.getItem(tokenKey)||''; };
  window.shopAdd=function(id){
    const key=String(id);
    const products=getProducts();
    const p=products.find(x=>String(x.id)===key);
    if(!p){ toastSafe('Artikal nije pronađen. Osvežite Web Shop.'); return false; }
    const stock=(p.stock===undefined||p.stock===null||p.stock==='')?Infinity:Number(p.stock);
    if(!Number.isFinite(stock) && stock!==Infinity){ toastSafe('Neispravno stanje artikla.'); return false; }
    const pack=Math.max(Number(p.pak||p.packQty)||1,0.001);
    const cart=getCart();
    const current=Number(cart[key])||0;
    const next=Number((current+pack).toFixed(3));
    if(stock!==Infinity && stock<=0){ toastSafe('Artikal trenutno nije na stanju.'); return false; }
    if(stock!==Infinity && next>stock+1e-9){ toastSafe('Nema dovoljno artikla na stanju.'); return false; }
    cart[key]=next;
    window.domextraShopCart=cart;
    try{ if(typeof shopCart!=='undefined') shopCart=cart; }catch(e){}
    saveCart();
    sync();
    try{ if(typeof trackEvent==='function') trackEvent('add_to_cart',{content_ids:[p.sku],value:Number(p.mpCena||p.price||0),currency:'RSD',content_name:p.name}); }catch(e){}
    toastSafe(p.name+' je dodat u korpu.');
    return true;
  };
  window.shopRem=function(id){ const c=getCart(); delete c[String(id)]; window.domextraShopCart=c; try{ if(typeof shopCart!=='undefined') shopCart=c; }catch(e){} saveCart(); sync(); if(Object.keys(c).length===0 && typeof resetCheckoutToFirstStep==='function') resetCheckoutToFirstStep(); };
  function updateQuantityDom(id, qty, input){
    try{
      const products=getProducts();
      const p=products.find(x=>String(x.id)===String(id));
      const row=input && input.closest ? input.closest('.cart-line') : document.querySelector(`.cart-line input[data-cart-id="${CSS.escape(String(id))}"]`)?.closest('.cart-line');
      if(input) input.value=String(qty);
      if(row && p && typeof wsPrice==='function' && typeof fmt==='function'){
        const priceEl=row.querySelector('.pr');
        if(priceEl) priceEl.textContent=fmt(wsPrice(p)*Number(qty));
      }
      if(typeof refreshShopCartSummaryOnly==='function') refreshShopCartSummaryOnly();
      if(typeof syncCartNavigation==='function') syncCartNavigation();
    }catch(e){ console.warn('quantity DOM update',e); }
  }

  // Update quantity while typing/using the native +/- control.
  // IMPORTANT: do not re-render the entire cart here, otherwise the input is
  // replaced on every keypress and the visible price appears not to change.
  window.shopQtyPreview=function(id,v,input){
    const key=String(id);
    const p=getProducts().find(x=>String(x.id)===key);
    if(!p) return;
    const raw=String(v??'').replace(',','.');
    if(raw==='' || raw==='-' || raw==='.') return;
    const q=Math.max(0,Number(raw)||0);
    const stock=(p.stock===undefined||p.stock===null||p.stock==='')?Infinity:Number(p.stock);
    if(stock!==Infinity && q>stock+1e-9){
      const cart=getCart();
      const valid=Number(cart[key])||0;
      if(input) input.value=String(valid);
      toastSafe(`Nema dovoljno artikla na stanju. Dostupno: ${stock} ${p.jm||''}`);
      updateQuantityDom(key, valid, input);
      return;
    }
    const cart=getCart();
    if(q<=0) delete cart[key]; else cart[key]=q;
    window.domextraShopCart=cart;
    try{ if(typeof shopCart!=='undefined') shopCart=cart; }catch(e){}
    saveCart();
    updateQuantityDom(key, q, input);
  };

  window.shopQty=function(id,v){
    const key=String(id), p=getProducts().find(x=>String(x.id)===key); if(!p) return;
    const q=Math.max(0,Number(String(v).replace(',','.'))||0);
    const c=getCart();
    if(!q){
      delete c[key]; saveCart(); sync();
      if(Object.keys(c).length===0 && typeof resetCheckoutToFirstStep==='function') resetCheckoutToFirstStep();
      return;
    }
    const pack=Math.max(Number(p.pak||p.packQty)||1,0.001);
    const adj=Number((Math.ceil((q-1e-9)/pack)*pack).toFixed(3));
    const stock=(p.stock===undefined||p.stock===null||p.stock==='')?Infinity:Number(p.stock);
    if(stock!==Infinity && adj>stock+1e-9){
      const valid=Number(c[key])||0;
      const input=document.querySelector(`.cart-line input[data-cart-id="${CSS.escape(String(id))}"]`);
      if(input) input.value=String(valid);
      toastSafe(`Nema dovoljno artikla na stanju. Dostupno: ${stock} ${p.jm||''}`);
      updateQuantityDom(key, valid, input);
      return;
    }
    c[key]=adj;
    window.domextraShopCart=c;
    try{ if(typeof shopCart!=='undefined') shopCart=c; }catch(e){}
    saveCart();
    // Commit/normalize once, then render exactly once.
    if(typeof renderShopCart==='function'){ try{ renderShopCart(); }catch(e){ console.warn('renderShopCart after qty',e); } }
    sync();
  };

  window.syncCartNavigation=sync;

  let qtyInputDelegationBound=false;
  function initQtyInputDelegation(){
    if(qtyInputDelegationBound) return;
    const cartEl=document.getElementById('shopCart');
    if(!cartEl) return;
    qtyInputDelegationBound=true;
    cartEl.addEventListener('input',function(e){
      const input=e.target.closest && e.target.closest('input[data-cart-id]');
      if(!input) return;
      window.shopQtyPreview(input.dataset.cartId,input.value,input);
    });
    cartEl.addEventListener('change',function(e){
      const input=e.target.closest && e.target.closest('input[data-cart-id]');
      if(!input) return;
      window.shopQty(input.dataset.cartId,input.value);
    });
  }
  window.domextraQtyInputDelegation=initQtyInputDelegation;

  async function uploadImage(file){
    if(!file) return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif'];
    if(!allowed.includes(file.type)){ toastSafe('Dozvoljene su JPG, PNG, WEBP ili GIF slike.'); return; }
    if(file.size>10*1024*1024){ toastSafe('Slika može imati najviše 10 MB.'); return; }
    try{
      const form=new FormData(); form.append('file',file);
      const headers={}; const token=window.getToken(); if(token) headers.Authorization='Bearer '+token;
      const r=await fetch('/api/admin/product-image',{method:'POST',headers,body:form});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||('Upload slike nije uspeo ('+r.status+').'));
      const img=document.getElementById('pImg'); if(img) img.value=d.url;
      const prev=document.getElementById('pImgPreview'); if(prev){prev.src=d.url; prev.style.display='block';}
      toastSafe('Slika je uspešno dodata.');
    }catch(e){ console.error('image upload',e); toastSafe(e.message); }
  }
  window.domextraUploadProductImage=uploadImage;
  function wireDropzone(){
    const zone=document.getElementById('pImageDrop'), input=document.getElementById('pImageFile');
    if(!zone||!input||zone.dataset.runtime==='1') return;
    zone.dataset.runtime='1';
    zone.addEventListener('click',()=>input.click());
    input.addEventListener('change',()=>input.files&&input.files[0]&&uploadImage(input.files[0]));
    ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.add('dragover');}));
    ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('dragover');}));
    zone.addEventListener('drop',e=>{const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)uploadImage(f);});
  }
  document.addEventListener('DOMContentLoaded',()=>{ wireDropzone(); sync(); initQtyInputDelegation(); });
  window.addEventListener('load',()=>{ wireDropzone(); sync(); initQtyInputDelegation(); });
})();
