// ─── SAMPLE DATA GENERATION ───
function generateSampleData(){
  const now=new Date();
  const items=[
    {id:1,name:"Samba Rice 5kg",price:1250,category:"Grains",qty:2,stock:18},
    {id:2,name:"Fresh Milk 1L",price:280,category:"Dairy",qty:4,stock:4},
    {id:3,name:"Coca-Cola 1.5L",price:420,category:"Beverages",qty:3,stock:3},
    {id:4,name:"Munchee Biscuits",price:150,category:"Snacks",qty:6,stock:25},
    {id:5,name:"Chicken (Full)",price:1450,category:"Meat",qty:1,stock:2},
    {id:6,name:"Sunlight Soap",price:110,category:"Personal Care",qty:5,stock:6},
    {id:7,name:"Dhal 1kg",price:380,category:"Grains",qty:3,stock:12},
    {id:8,name:"Nestomalt 400g",price:640,category:"Health",qty:2,stock:8}
  ];
  const offsets=[0,0,0,0,1,1,2,3,4,5,7,8,10,14,18,21];
  const hours=[9,10,11,12,13,14,15,16,17,18,19,20,8,11,14,17];
  return offsets.map((offset,i)=>{
    const a=items[i%items.length],b=items[(i+2)%items.length];
    const d=new Date(now);
    d.setDate(now.getDate()-offset);
    d.setHours(hours[i],(i*11)%60,0,0);
    const saleItems=[
      {productId:a.id,name:a.name,quantity:a.qty,price:a.price,category:a.category},
      {productId:b.id,name:b.name,quantity:Math.max(1,a.qty-1),price:b.price,category:b.category}
    ];
    return {
      id:i+1, timestamp:d.getTime(), items:saleItems,
      total:saleItems.reduce((s,x)=>s+x.price*x.quantity,0),
      paymentMethod:i%3===0?"Card":"Cash"
    };
  });
}

const salesData=generateSampleData();
const products=JSON.parse(localStorage.getItem('quickpos-products'))||[
  {name:"Samba Rice 5kg",stock:18,category:"Grains"},
  {name:"Fresh Milk 1L",stock:4,category:"Dairy"},
  {name:"Coca-Cola 1.5L",stock:3,category:"Beverages"},
  {name:"Munchee Biscuits",stock:25,category:"Snacks"},
  {name:"Chicken (Full)",stock:2,category:"Meat"},
  {name:"Sunlight Soap",stock:6,category:"Personal Care"},
  {name:"Dhal 1kg",stock:12,category:"Grains"},
  {name:"Nestomalt 400g",stock:8,category:"Health"}
];

// ─── UTILS ───
function fmt(n){return"LKR "+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtK(n){return n>=1000?"LKR "+(n/1000).toFixed(1)+"k":fmt(n)}

function filterData(range){
  const now=new Date(),start=new Date();
  if(range==='today'){start.setHours(0,0,0,0);}
  else if(range==='yesterday'){start.setDate(start.getDate()-1);start.setHours(0,0,0,0);now.setDate(now.getDate()-1);now.setHours(23,59,59,999);}
  else if(range==='last7'){start.setDate(start.getDate()-7);}
  else if(range==='thisMonth'){start.setDate(1);start.setHours(0,0,0,0);}
  else if(range==='lastMonth'){start.setMonth(start.getMonth()-1,1);start.setHours(0,0,0,0);now.setDate(0);now.setHours(23,59,59,999);}
  return salesData.filter(s=>new Date(s.timestamp)>=start&&new Date(s.timestamp)<=now);
}

function calcMetrics(data){
  const m={revenue:0,items:0,transactions:data.length,catSales:{},hourSales:new Array(24).fill(0),cash:0,card:0};
  data.forEach(s=>{
    m.revenue+=s.total;
    s.items.forEach(it=>{
      m.items+=it.quantity;
      m.catSales[it.category]=(m.catSales[it.category]||0)+it.price*it.quantity;
    });
    const h=new Date(s.timestamp).getHours();
    m.hourSales[h]+=s.total;
    if(s.paymentMethod==='Cash')m.cash+=s.total;
    else m.card+=s.total;
  });
  m.avg=m.transactions>0?m.revenue/m.transactions:0;
  return m;
}

// ─── UI UPDATES ───
function updateKPIs(m){
  document.getElementById('kpiRevenue').textContent=fmtK(m.revenue);
  document.getElementById('kpiItems').textContent=m.items;
  document.getElementById('kpiAvg').textContent=fmtK(m.avg);
  document.getElementById('kpiTxCount').textContent=m.transactions+' transactions';
  const totalStock=products.reduce((s,p)=>s+(p.stock||0),0);
  document.getElementById('kpiStock').innerHTML=totalStock.toLocaleString()+' <span style="font-size:14px;color:var(--text3)">units</span>';
  const low=products.filter(p=>p.stock>0&&p.stock<5).length;
  document.getElementById('kpiStockLow').textContent=low>0?`⚠ ${low} products low stock`:'All stock levels OK';
  document.getElementById('kpiStockLow').style.color=low>0?'var(--red)':'var(--text3)';
}

function updateOverview(todayM,weekM){
  document.getElementById('ovToday0').textContent=todayM.transactions;
  document.getElementById('ovWeek0').textContent=weekM.transactions;
  document.getElementById('ovToday1').textContent=fmtK(todayM.revenue);
  document.getElementById('ovWeek1').textContent=fmtK(weekM.revenue);
  document.getElementById('ovToday2').textContent=todayM.items;
  document.getElementById('ovWeek2').textContent=weekM.items;
}

function updateCatChart(catSales){
  const cats=Object.entries(catSales).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const max=Math.max(...cats.map(c=>c[1]),1);
  const colors=['var(--accent)','var(--green)','var(--amber)','var(--purple)','var(--cyan)'];
  document.getElementById('catChart').innerHTML=cats.map(([name,val],i)=>`
    <div class="cat-row">
      <span class="cat-name">${name}</span>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${(val/max*100).toFixed(1)}%;background:${colors[i%colors.length]}"></div></div>
      <span class="cat-val">${fmtK(val)}</span>
    </div>`).join('')||'<div style="color:var(--text3);font-size:13px;padding:10px 0">No data</div>';
}

function updateReorderList(data){
  const low=products.filter(p=>p.stock>0&&p.stock<5).sort((a,b)=>a.stock-b.stock);
  const badge=document.getElementById('reorderBadge');
  badge.textContent=low.length+' items';
  badge.className='section-badge '+(low.length>0?'badge-red':'badge-green');
  document.getElementById('reorderList').innerHTML=low.length===0
    ?'<div style="text-align:center;padding:30px 0;color:var(--green);font-size:13px;font-weight:600">✓ All stock levels are healthy</div>'
    :low.map(p=>{
      const crit=p.stock<=2;
      return`<div class="alert-item ${crit?'critical':'warn'}">
        <div class="alert-dot ${crit?'critical':'warn'}"></div>
        <div class="alert-info">
          <div class="alert-name">${p.name}</div>
          <div class="alert-meta">${p.category||'General'}</div>
        </div>
        <span class="alert-qty ${crit?'critical':'warn'}">${p.stock} left</span>
        <button class="alert-btn" onclick="alert('Opening inventory for: ${p.name}')">Reorder</button>
      </div>`;}).join('');
}

function updateTopItems(data){
  const map=new Map();
  data.forEach(s=>s.items.forEach(it=>{
    const k=it.productId||it.name;
    const ex=map.get(k)||{name:it.name,category:it.category,qty:0};
    ex.qty+=it.quantity;map.set(k,ex);
  }));
  const sorted=[...map.values()].sort((a,b)=>b.qty-a.qty).slice(0,6);
  const max=Math.max(...sorted.map(x=>x.qty),1);
  document.getElementById('topItemsList').innerHTML=sorted.length===0
    ?'<div style="text-align:center;padding:30px 0;color:var(--text3);font-size:13px">No sales data</div>'
    :sorted.map((it,i)=>`
    <div class="top-item">
      <span class="rank ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span>
      <div class="item-info">
        <div class="item-name">${it.name}</div>
        <div class="item-cat">${it.category||'—'}</div>
      </div>
      <div class="item-bar-wrap">
        <div class="item-bar-bg"><div class="item-bar-fill" style="width:${(it.qty/max*100).toFixed(1)}%"></div></div>
        <div class="item-qty">${it.qty} qty</div>
      </div>
    </div>`).join('');
}

function updateHourChart(hourSales){
  const showHours=[6,8,10,12,14,16,18,20,22];
  const vals=showHours.map(h=>hourSales[h]||0);
  const max=Math.max(...vals,1);
  const peakH=showHours[vals.indexOf(Math.max(...vals))];
  document.getElementById('hourChart').innerHTML=vals.map((v,i)=>{
    const h=showHours[i];
    const pct=Math.max(8,(v/max*100)).toFixed(1);
    const isPeak=h===peakH&&v>0;
    const label=h>=12?`${h===12?12:h-12}pm`:`${h}am`;
    return`<div class="hbar ${isPeak?'peak':''}" style="height:${pct}%"><span class="hbar-tip">${label}: ${fmtK(v)}</span></div>`;
  }).join('');
  document.getElementById('hourLabels').innerHTML=showHours.map(h=>{
    const label=h>=12?`${h===12?12:h-12}pm`:`${h}am`;
    return`<span class="hl">${label}</span>`;
  }).join('');
}

function updatePayment(m){
  const total=m.cash+m.card||1;
  const cp=Math.round(m.cash/total*100),kp=100-cp;
  document.getElementById('cashPct').textContent=cp+'%';
  document.getElementById('cardPct').textContent=kp+'%';
  document.getElementById('cashRev').textContent=fmtK(m.cash);
  document.getElementById('cardRev').textContent=fmtK(m.card);
}

function updateSlowItems(){
  const slowItems=[
    {name:"Seasonal Tea Bags",lastSold:5,stock:15,category:"Beverages"},
    {name:"Special Coffee Blend",lastSold:4,stock:8,category:"Beverages"},
    {name:"Premium Cookies",lastSold:6,stock:12,category:"Snacks"},
    {name:"Coconut Milk 400ml",lastSold:3,stock:20,category:"Dairy"}
  ];
  document.getElementById('slowList').innerHTML=slowItems.map(it=>`
    <div class="slow-item">
      <div style="flex:1;min-width:0">
        <div class="slow-name">${it.name}</div>
        <div class="slow-meta" style="font-size:12px; color:var(--text3); margin-top:2px;">${it.category} · ${it.stock} units in stock</div>
      </div>
      <span class="slow-badge">${it.lastSold}d ago</span>
      <button class="alert-btn" style="margin-left:12px;" onclick="alert('Create promotion for: ${it.name}')">Promote</button>
    </div>`).join('');
}

function updateDashboard(range){
  const filtered=filterData(range);
  const m=calcMetrics(filtered);
  const todayM=calcMetrics(filterData('today'));
  const weekM=calcMetrics(filterData('last7'));
  updateKPIs(m);
  updateOverview(todayM,weekM);
  updateCatChart(m.catSales);
  updateReorderList(filtered);
  updateTopItems(filtered);
  updateHourChart(m.hourSales);
  updatePayment(m);
  updateSlowItems();
}

document.addEventListener('DOMContentLoaded', () => {
    // ─── DATE FILTERS ───
    document.querySelectorAll('.filter-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        updateDashboard(btn.dataset.range);
      });
    });

    // ─── REFRESH ───
    const refreshBtn = document.getElementById('refreshBtn');
    if(refreshBtn){
        refreshBtn.addEventListener('click',()=>{
          const active=document.querySelector('.filter-btn.active');
          updateDashboard(active?active.dataset.range:'today');
        });
    }

    // ─── INIT ───
    updateDashboard('today');
});
