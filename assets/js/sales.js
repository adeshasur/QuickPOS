// ─── DATA ───
const demoProducts=[
  {id:1,name:"Samba Rice 5kg",price:1250,category:"groceries",stock:120,isWeighted:false},
  {id:2,name:"Fresh Milk 1L",price:280,category:"dairy",stock:45,isWeighted:false},
  {id:3,name:"Coca-Cola 1.5L",price:420,category:"beverages",stock:80,isWeighted:false},
  {id:4,name:"Munchee Biscuits",price:150,category:"snacks",stock:200,isWeighted:false},
  {id:5,name:"Carrots (kg)",price:320,category:"vegetables",stock:50,isWeighted:true,unitType:"kg"},
  {id:6,name:"Chicken Full",price:1450,category:"meat",stock:30,isWeighted:false},
  {id:7,name:"Sunlight Soap",price:110,category:"personal-care",stock:300,isWeighted:false},
  {id:8,name:"Harpic 500ml",price:580,category:"household",stock:40,isWeighted:false},
  {id:9,name:"Dhal 1kg",price:380,category:"groceries",stock:90,isWeighted:false},
  {id:10,name:"Nestomalt 400g",price:640,category:"groceries",stock:55,isWeighted:false},
  {id:11,name:"Anchor Butter",price:940,category:"dairy",stock:20,isWeighted:false},
  {id:12,name:"Sprite 1.5L",price:390,category:"beverages",stock:0,isWeighted:false}
];

const demoCustomers=[
  {id:1,name:"Anura Kumara",phone:"0771234567",balance:150},
  {id:2,name:"Samanthie Perera",phone:"0719876543",balance:0},
  {id:3,name:"Wimal Siri",phone:"0765558888",balance:250.50},
  {id:4,name:"Nalin Bandara",phone:"0114445555",balance:0}
];

let products=[...demoProducts];
let cart=[];
let currentCat="all";
let productToCustomize=null;
let priceEdited=false;
let selectedCustomer=null;

const fmt=n=>`LKR ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const cartTotal=()=>cart.reduce((s,i)=>s+i.price*i.quantity,0);
const stockText=s=>s===0?"OUT":s<10?`Low: ${s}`:`${s}`;
const stockClass=s=>s===0?"out":s<10?"low":"ok";

// ─── RENDER PRODUCTS ───
function renderProducts(){
  const grid=document.getElementById('productsGrid');
  const list=currentCat==="all"?products:products.filter(p=>p.category===currentCat);
  if(!list.length){grid.innerHTML='<div style="color:var(--text3);font-size:15px;padding:30px;grid-column:1/-1;text-align:center;">No products found</div>';return;}
  grid.innerHTML='';
  list.forEach(p=>{
    const out=p.stock===0;
    const card=document.createElement('div');
    card.className='product-card'+(out?' out-of-stock':'');
    card.innerHTML=`
      ${out?'<div class="out-label">OUT</div>':''}
      <button class="cust-btn" data-id="${p.id}" title="Customize qty/price"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
      <div class="pc-cat">${p.category.replace('-',' ')}</div>
      <div class="pc-name">${p.name}${p.unitType?` / ${p.unitType}`:''}</div>
      <div class="pc-price">${fmt(p.price)}</div>
      <div class="pc-footer">
        <span></span>
        <span class="stock-badge ${stockClass(p.stock)}">${stockText(p.stock)}</span>
      </div>`;
    if(!out){
      card.addEventListener('click',e=>{
        if(!e.target.closest('.cust-btn')) addToCart(p.id,1,p.price);
      });
    }
    card.querySelector('.cust-btn').addEventListener('click',e=>{
      e.stopPropagation();openCustomize(p.id);
    });
    grid.appendChild(card);
  });
}

// ─── CART ───
function addToCart(pid,qty,price){
  const p=products.find(x=>x.id===pid);
  if(!p)return;
  const ex=cart.find(i=>i.id===pid&&i.price===price);
  if(ex){
    if(ex.quantity+qty>p.stock){alert(`Max stock: ${p.stock}`);return;}
    ex.quantity=+(ex.quantity+qty).toFixed(2);
  }else{
    if(qty>p.stock){alert(`Max stock: ${p.stock}`);return;}
    cart.push({id:p.id,name:p.name,price,quantity:qty,unit:p.unitType||'pc'});
  }
  renderCart();
}

function renderCart(){
  const el=document.getElementById('cartItems');
  if(!cart.length){
    el.innerHTML=`<div class="empty-cart"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg><p>Cart is empty</p><small>Tap a product to add</small></div>`;
    document.getElementById('itemCount').textContent='0';
    document.getElementById('totalAmount').textContent=fmt(0);
    return;
  }
  let total=0,count=0,html='';
  cart.forEach((item,i)=>{
    const sub=item.price*item.quantity;total+=sub;count+=item.quantity;
    html+=`<div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-unit">${item.quantity.toFixed(2)} ${item.unit} × ${fmt(item.price)}</div>
      </div>
      <div class="ci-controls">
        <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
        <span class="qty-num">${item.quantity.toFixed(2)}</span>
        <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
      </div>
      <div class="ci-total">${fmt(sub)}</div>
    </div>`;
  });
  el.innerHTML=html;
  document.getElementById('itemCount').textContent=count.toFixed(2);
  document.getElementById('totalAmount').textContent=fmt(total);
}

window.changeQty = function(i,d){
  const item=cart[i];
  const p=products.find(x=>x.id===item.id);
  const nq=+(item.quantity+d).toFixed(2);
  if(nq<=0){cart.splice(i,1);}
  else if(nq>p.stock){alert(`Max stock: ${p.stock}`);return;}
  else item.quantity=nq;
  renderCart();
}

// ─── CUSTOMER ───
function renderCustomer(){
  const el=document.getElementById('custDisplay');
  const btn=document.getElementById('creditBtn');
  if(selectedCustomer){
    const ini=selectedCustomer.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    el.innerHTML=`<div class="selected-cust">
      <div class="sc-avatar">${ini}</div>
      <div class="sc-info">
        <div class="sc-name">${selectedCustomer.name}</div>
        <div class="sc-bal">Balance: ${fmt(selectedCustomer.balance)}</div>
      </div>
      <button class="sc-clear" onclick="clearCustomer()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
    btn.disabled=false;
  }else{
    el.innerHTML=`<div class="walkin-tag"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Walk-in customer — credit unavailable</div>`;
    btn.disabled=true;
  }
}

window.clearCustomer = function(){selectedCustomer=null;renderCustomer();}

// ─── CUSTOMIZE MODAL ───
window.openCustomize = function(pid){
  const p=products.find(x=>x.id===pid);
  if(!p)return;
  productToCustomize=p;priceEdited=false;
  document.getElementById('custModalTitle').textContent=p.name;
  document.getElementById('unitPriceShow').textContent=fmt(p.price);
  document.getElementById('custQty').value='1.00';
  document.getElementById('custPrice').value=p.price.toFixed(2);
  document.getElementById('custModal').classList.add('open');
}

// ─── SALES ───
function completeSale(method,msg){
  cart.forEach(item=>{
    const p=products.find(x=>x.id===item.id);
    if(p)p.stock=Math.max(0,p.stock-item.quantity);
  });
  const total=cartTotal();
  document.getElementById('scTitle').textContent=`${method} Sale Complete!`;
  document.getElementById('scAmount').textContent=fmt(total);
  document.getElementById('scMsg').textContent=msg;
  document.getElementById('saleCompleteModal').classList.add('open');
  cart=[];renderCart();renderProducts();
  document.getElementById('cashModal').classList.remove('open');
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded',()=>{
  
  // Set User Info from localStorage
  const user = JSON.parse(localStorage.getItem('quickpos-user'));
  if(user) {
      document.getElementById('cashierNameDisplay').textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
  }

  renderProducts();renderCart();renderCustomer();

  // Category pills
  document.getElementById('catPills').addEventListener('click',e=>{
    const pill=e.target.closest('.cat-pill');
    if(!pill)return;
    document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    currentCat=pill.dataset.cat;
    renderProducts();
  });

  // Stock search
  document.getElementById('stockSearch').addEventListener('input',e=>{
    const v=e.target.value.toLowerCase().trim();
    const res=document.getElementById('stockResult');
    if(!v){res.textContent='';return;}
    const p=products.find(x=>x.name.toLowerCase().includes(v));
    res.textContent=p?`${p.name}: ${stockText(p.stock)} in stock`:'Not found';
  });

  // Customer search
  const custSearch=document.getElementById('custSearch');
  const custDrop=document.getElementById('custDropdown');
  custSearch.addEventListener('input',e=>{
    const v=e.target.value.toLowerCase().trim();
    if(!v){custDrop.classList.remove('open');return;}
    const results=demoCustomers.filter(c=>c.name.toLowerCase().includes(v)||c.phone.includes(v)).slice(0,5);
    if(!results.length){custDrop.innerHTML='<div class="cust-result" style="justify-content:center;color:var(--text3)">No customers found</div>';custDrop.classList.add('open');return;}
    custDrop.innerHTML=results.map(c=>`
      <div class="cust-result" data-id="${c.id}">
        <div><div class="cust-result-name">${c.name}</div><div class="cust-result-phone">${c.phone}</div></div>
        <div class="cust-result-bal">${fmt(c.balance)}</div>
      </div>`).join('');
    custDrop.classList.add('open');
    custDrop.querySelectorAll('.cust-result').forEach(row=>{
      row.addEventListener('click',()=>{
        selectedCustomer=demoCustomers.find(c=>c.id===+row.dataset.id);
        custSearch.value='';custDrop.classList.remove('open');
        renderCustomer();
      });
    });
  });
  document.addEventListener('click',e=>{
    if(!custSearch.contains(e.target)&&!custDrop.contains(e.target))custDrop.classList.remove('open');
  });

  // Customize modal
  document.getElementById('closeCustModal').addEventListener('click',()=>document.getElementById('custModal').classList.remove('open'));
  document.getElementById('cancelCustModal').addEventListener('click',()=>document.getElementById('custModal').classList.remove('open'));
  document.getElementById('custQty').addEventListener('input',()=>{
    if(priceEdited||!productToCustomize)return;
    const q=parseFloat(document.getElementById('custQty').value)||0;
    document.getElementById('custPrice').value=(q*productToCustomize.price).toFixed(2);
  });
  document.getElementById('custPrice').addEventListener('input',()=>{priceEdited=true;});
  document.getElementById('addCustToCart').addEventListener('click',()=>{
    if(!productToCustomize)return;
    const qty=parseFloat(document.getElementById('custQty').value)||0;
    const price=parseFloat(document.getElementById('custPrice').value)||0;
    if(qty<=0){alert('Enter valid quantity');return;}
    addToCart(productToCustomize.id,qty,price);
    document.getElementById('custModal').classList.remove('open');
  });

  // Payment buttons
  document.getElementById('cashBtn').addEventListener('click',()=>{
    if(!cart.length)return;
    document.getElementById('cashModalTotal').textContent=fmt(cartTotal());
    document.getElementById('amtReceived').value='';
    document.getElementById('changeAmt').textContent=fmt(0);
    document.getElementById('cashModal').classList.add('open');
  });
  document.getElementById('cardBtn').addEventListener('click',()=>{
    if(!cart.length)return;
    completeSale('Card','Card payment processed successfully');
  });
  document.getElementById('creditBtn').addEventListener('click',()=>{
    if(!cart.length||!selectedCustomer)return;
    const total=cartTotal();
    selectedCustomer.balance+=total;
    completeSale('Credit',`Added to ${selectedCustomer.name}'s account. New balance: ${fmt(selectedCustomer.balance)}`);
    renderCustomer();
  });

  // Cash modal
  document.getElementById('closeCashModal').addEventListener('click',()=>document.getElementById('cashModal').classList.remove('open'));
  document.getElementById('cancelCashModal').addEventListener('click',()=>document.getElementById('cashModal').classList.remove('open'));
  document.getElementById('amtReceived').addEventListener('input',updateChange);
  document.querySelectorAll('.quick-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      const cur=parseFloat(document.getElementById('amtReceived').value)||0;
      document.getElementById('amtReceived').value=(cur+parseFloat(b.dataset.add)).toFixed(2);
      updateChange();
    });
  });
  function updateChange(){
    const total=cartTotal();
    const rec=parseFloat(document.getElementById('amtReceived').value)||0;
    document.getElementById('changeAmt').textContent=fmt(Math.max(0,rec-total));
  }
  document.getElementById('finalizeCash').addEventListener('click',()=>{
    const total=cartTotal();
    const rec=parseFloat(document.getElementById('amtReceived').value)||0;
    if(rec<total){alert('Insufficient amount received');return;}
    completeSale('Cash',`Change returned: ${fmt(rec-total)}`);
  });

  // Sale complete
  document.getElementById('scDone').addEventListener('click',()=>document.getElementById('saleCompleteModal').classList.remove('open'));

});
