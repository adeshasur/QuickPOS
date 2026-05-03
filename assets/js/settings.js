// ─── SETTINGS DATA ───
const defaultSettings={
  storeName:"My QuickPOS Store",storeAddress:"",storePhone:"",
  systemVersion:"pro",currencySymbol:"LKR",taxPercentage:0,
  shiftHours:"08:00 - 16:00",adminPassword:"admin123",cashierPassword:"cashier"
};
let settings=JSON.parse(localStorage.getItem('quickpos-settings'))||{...defaultSettings};

// ─── TOAST ───
let toastTimer;
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  const m=document.getElementById('toastMsg');
  t.className='toast '+type;
  m.textContent=msg;
  clearTimeout(toastTimer);
  setTimeout(()=>t.classList.add('show'),10);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}

// ─── TABS ───
document.querySelectorAll('.tab-btn, .tab-danger-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn,.tab-danger-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
  });
});

// ─── LOAD SETTINGS ───
function loadSettings(){
  document.getElementById('storeName').value=settings.storeName||'';
  document.getElementById('storeAddress').value=settings.storeAddress||'';
  document.getElementById('storePhone').value=settings.storePhone||'';
  document.getElementById('shiftHours').value=settings.shiftHours||'08:00 - 16:00';
  document.getElementById('taxPercentage').value=settings.taxPercentage||0;
  document.getElementById('currencyToggle').checked=(settings.currencySymbol==='LKR');
  document.querySelectorAll('.ver-card').forEach(c=>{
    c.classList.toggle('selected',c.dataset.version===settings.systemVersion);
  });
  
  // System info calculation
  try{
    const prods=JSON.parse(localStorage.getItem('quickpos-products'))||[];
    const sales=JSON.parse(localStorage.getItem('quickpos-sales'))||[];
    const custs=JSON.parse(localStorage.getItem('quickpos-customers'))||[];
    document.getElementById('sysProducts').textContent=prods.length;
    document.getElementById('sysSales').textContent=sales.length;
    document.getElementById('sysCustomers').textContent=custs.length;
    let size=0;
    for(let k in localStorage){if(localStorage.hasOwnProperty(k))size+=localStorage[k].length+k.length;}
    document.getElementById('sysCache').textContent=(size/1024).toFixed(1)+' KB';
  }catch(e){}
}

// ─── SAVE ───
function saveSettings(){
  const name=document.getElementById('storeName').value.trim();
  if(!name){showToast('Store Name is required','error');document.getElementById('storeName').focus();return;}
  settings.storeName=name;
  settings.storeAddress=document.getElementById('storeAddress').value.trim();
  settings.storePhone=document.getElementById('storePhone').value.trim();
  settings.shiftHours=document.getElementById('shiftHours').value.trim()||'08:00 - 16:00';
  settings.taxPercentage=parseFloat(document.getElementById('taxPercentage').value)||0;
  settings.currencySymbol='LKR';
  
  const selVer=document.querySelector('.ver-card.selected');
  settings.systemVersion=selVer?selVer.dataset.version:'pro';
  
  // Passwords Validation
  const ap=document.getElementById('adminPassword').value.trim();
  const apc=document.getElementById('adminPasswordConfirm').value.trim();
  if(ap){
    if(ap.length<6){showToast('Admin password min 6 characters','error');return;}
    if(ap!==apc){showToast('Admin passwords do not match','error');return;}
    settings.adminPassword=ap;
  }
  
  const cp=document.getElementById('cashierPassword').value.trim();
  const cpc=document.getElementById('cashierPasswordConfirm').value.trim();
  if(cp){
    if(cp.length<4){showToast('Cashier password min 4 characters','error');return;}
    if(cp!==cpc){showToast('Cashier passwords do not match','error');return;}
    settings.cashierPassword=cp;
  }
  
  localStorage.setItem('quickpos-settings',JSON.stringify(settings));
  localStorage.setItem('quickpos-shift-time',settings.shiftHours);
  showToast('Settings saved successfully');
  
  // Clear password fields after save
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminPasswordConfirm').value = '';
  document.getElementById('cashierPassword').value = '';
  document.getElementById('cashierPasswordConfirm').value = '';
}

// ─── VERSION CARDS ───
document.querySelectorAll('.ver-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.ver-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    const hint=document.getElementById('versionHint');
    if(card.dataset.version==='pro'){
      hint.className='field-hint warn';
      hint.innerHTML='<strong>Pro selected:</strong> Full inventory, reports and multi-user features enabled.';
    }else{
      hint.className='field-hint';
      hint.innerHTML='<strong>Lite selected:</strong> Stock management and advanced reports will be hidden.';
    }
  });
});

// ─── PASSWORD TOGGLE ───
document.querySelectorAll('.pw-eye').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const inp=document.getElementById(btn.dataset.target);
    inp.type=inp.type==='password'?'text':'password';
  });
});

// ─── DANGER ACTIONS ───
document.getElementById('clearCacheBtn').addEventListener('click',()=>{
  if(!confirm('Clear application cache? Your data will not be deleted.'))return;
  const s=JSON.stringify(settings);
  const u=localStorage.getItem('quickpos-user');
  const sb=localStorage.getItem('qp-sb');
  localStorage.clear();
  localStorage.setItem('quickpos-settings',s);
  if(u)localStorage.setItem('quickpos-user',u);
  if(sb)localStorage.setItem('qp-sb',sb);
  showToast('Cache cleared');
});

document.getElementById('resetSettingsBtn').addEventListener('click',()=>{
  if(!confirm('Reset all settings to factory defaults?'))return;
  settings={...defaultSettings};
  localStorage.setItem('quickpos-settings',JSON.stringify(settings));
  loadSettings();
  showToast('Settings reset to defaults');
});

document.getElementById('fullResetBtn').addEventListener('click',()=>{
  if(!confirm('⚠ WARNING: This will delete ALL data permanently.\n\nThis cannot be undone!'))return;
  const code=prompt('Type RESET to confirm:');
  if(code==='RESET'){localStorage.clear();showToast('System reset complete');setTimeout(()=>location.reload(),1200);}
  else showToast('Reset cancelled','error');
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  if(!confirm('Reset all settings to defaults?'))return;
  settings={...defaultSettings};
  localStorage.setItem('quickpos-settings',JSON.stringify(settings));
  loadSettings();
  showToast('Settings reset to defaults');
});

// ─── SAVE BUTTON & KEYBOARD ───
document.getElementById('saveBtn').addEventListener('click',saveSettings);
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveSettings();}});

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
    // Set User Info from localStorage
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    
    // Redirect if cashier tries to access settings
    if(user && user.role === 'cashier') {
        alert('Access Denied: Owner Only');
        window.location.href = 'sales.html';
        return;
    }

    if(user) {
        document.getElementById('userRoleDisplay').textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
    }
    
    loadSettings();
});
