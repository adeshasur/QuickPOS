const STORAGE_KEY='quickpos-customers';
const AVATAR_COLORS=['av-blue','av-green','av-purple','av-amber','av-cyan'];
const defaultCustomers=[
  {id:1,name:'Kamal Perera',phone:'0771234567',address:'Colombo 03',balance:0},
  {id:2,name:'Sunimal Silva',phone:'0719876543',address:'Maharagama',balance:150.50},
  {id:3,name:'Anura Bandara',phone:'0765551234',address:'Kandy',balance:0},
  {id:4,name:'Nirosha Fernando',phone:'0114449999',address:'Gampaha',balance:320}
];

let customers=[];
let deleteCandidateId=null;

// ─── HELPERS ───
const fmt=n=>`LKR ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc=s=>s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):'';
const initials=n=>n.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const avatarColor=id=>AVATAR_COLORS[id%AVATAR_COLORS.length];
const nextId=()=>customers.length?Math.max(...customers.map(c=>c.id))+1:1;

function load(){
  const s=localStorage.getItem(STORAGE_KEY);
  customers=s?JSON.parse(s):[...defaultCustomers];
  save();
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(customers));}

// ─── TOAST ───
let toastTimer;
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.className='toast '+type;
  document.getElementById('toastMsg').textContent=msg;
  clearTimeout(toastTimer);
  setTimeout(()=>t.classList.add('show'),10);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

// ─── RENDER ───
function render(filter=''){
  const q=filter.toLowerCase().trim();
  const list=q?customers.filter(c=>c.name.toLowerCase().includes(q)||c.phone.includes(q)):customers;
  document.getElementById('countDisplay').textContent=list.length;
  const body=document.getElementById('tableBody');
  if(!list.length){
    body.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p>${q?'No results found':'No customers yet'}</p><small>${q?'Try a different search':'Click "Add Customer" to get started'}</small></div>`;
    return;
  }
  body.innerHTML=list.map(c=>{
    const bal=c.balance||0;
    const balClass=bal>0?'pos':'zero';
    const col=avatarColor(c.id);
    return`<div class="cust-row" data-id="${c.id}">
      <div class="td">
        <div class="cust-name-cell">
          <div class="cust-avatar ${col}">${initials(c.name)}</div>
          <div>
            <div class="cust-fullname">${esc(c.name)}</div>
            <div class="cust-id">#${String(c.id).padStart(4,'0')}</div>
          </div>
        </div>
      </div>
      <div class="td"><span class="phone-val">${esc(c.phone)}</span></div>
      <div class="td"><span class="addr-val" title="${esc(c.address||'')}">${esc(c.address)||'—'}</span></div>
      <div class="td"><span class="bal-val ${balClass}">${fmt(bal)}</span></div>
      <div class="td">
        <div class="row-actions">
          <button class="row-btn edit" data-id="${c.id}" title="Edit">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="row-btn del" data-id="${c.id}" title="Delete">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── FORM MODAL ───
function openAdd(){
  document.getElementById('formModalTitle').textContent='Add Customer';
  document.getElementById('editId').value='';
  document.getElementById('fName').value='';
  document.getElementById('fPhone').value='';
  document.getElementById('fAddress').value='';
  document.getElementById('formModal').classList.add('open');
  setTimeout(()=>document.getElementById('fName').focus(),200);
}
function openEdit(id){
  const c=customers.find(x=>x.id===id);
  if(!c)return;
  document.getElementById('formModalTitle').textContent='Edit Customer';
  document.getElementById('editId').value=c.id;
  document.getElementById('fName').value=c.name;
  document.getElementById('fPhone').value=c.phone;
  document.getElementById('fAddress').value=c.address||'';
  document.getElementById('formModal').classList.add('open');
  setTimeout(()=>document.getElementById('fName').focus(),200);
}
function closeForm(){document.getElementById('formModal').classList.remove('open');}

function saveCustomer(){
  const name=document.getElementById('fName').value.trim();
  const phone=document.getElementById('fPhone').value.trim();
  const address=document.getElementById('fAddress').value.trim();
  const editId=document.getElementById('editId').value;
  
  if(!name){showToast('Full name is required','error');document.getElementById('fName').focus();return;}
  if(!phone){showToast('Phone number is required','error');document.getElementById('fPhone').focus();return;}
  
  if(editId){
    const i=customers.findIndex(c=>c.id===+editId);
    if(i!==-1){customers[i]={...customers[i],name,phone,address};showToast('Customer updated');}
  }else{
    customers.push({id:nextId(),name,phone,address,balance:0});
    showToast('Customer added');
  }
  
  save();
  render(document.getElementById('searchInput').value);
  closeForm();
}

// ─── DELETE MODAL ───
function openDelete(id){
  const c=customers.find(x=>x.id===id);
  if(!c)return;
  deleteCandidateId=id;
  document.getElementById('delName').textContent=c.name;
  document.getElementById('deleteModal').classList.add('open');
}
function closeDelete(){document.getElementById('deleteModal').classList.remove('open');deleteCandidateId=null;}
function confirmDelete(){
  if(!deleteCandidateId)return;
  customers=customers.filter(c=>c.id!==deleteCandidateId);
  save();render(document.getElementById('searchInput').value);
  showToast('Customer deleted');
  closeDelete();
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded',()=>{
  load();
  render();

  // Shift display loading from settings
  const shift=localStorage.getItem('quickpos-shift-time')||'08:00 – 16:00';
  document.getElementById('shiftDisplay').textContent='Shift: '+shift;

  // Role check
  const user=JSON.parse(localStorage.getItem('quickpos-user')||'null');
  if(!user){window.location.href='login.html'; return;}
  if(user.role==='cashier'){
      document.querySelectorAll('.owner-only').forEach(el=>el.style.display='none');
  }

  // Search
  document.getElementById('searchInput').addEventListener('input',e=>render(e.target.value));

  // Add button
  document.getElementById('addBtn').addEventListener('click',openAdd);

  // Form modal
  document.getElementById('closeFormModal').addEventListener('click',closeForm);
  document.getElementById('cancelFormModal').addEventListener('click',closeForm);
  document.getElementById('formModal').addEventListener('click',e=>{if(e.target===document.getElementById('formModal'))closeForm();});
  document.getElementById('saveCustomer').addEventListener('click',saveCustomer);

  // Enter to save
  ['fName','fPhone','fAddress'].forEach(id=>{
    document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')saveCustomer();});
  });

  // Delete modal
  document.getElementById('closeDeleteModal').addEventListener('click',closeDelete);
  document.getElementById('cancelDelete').addEventListener('click',closeDelete);
  document.getElementById('deleteModal').addEventListener('click',e=>{if(e.target===document.getElementById('deleteModal'))closeDelete();});
  document.getElementById('confirmDelete').addEventListener('click',confirmDelete);

  // Row action delegation
  document.getElementById('tableBody').addEventListener('click',e=>{
    const editBtn=e.target.closest('.row-btn.edit');
    const delBtn=e.target.closest('.row-btn.del');
    if(editBtn)openEdit(+editBtn.dataset.id);
    else if(delBtn)openDelete(+delBtn.dataset.id);
  });
});
