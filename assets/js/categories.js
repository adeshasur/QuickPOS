(function () {
  'use strict';

  let categories = [];
  let products = [];
  let revenueData = [];
  let topSellingCategoryName = 'None';
  let deletingId = null;
  let chartInstance = null;
  let activeProductsCount = 0;

  async function openModal(id) { document.getElementById(id).classList.add('open'); }
  async function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  async function loadData() {
    const results = await Promise.all([
      window.api.getCategories(),
      window.api.getProducts(),
      window.api.getTopSellingCategory(),
      window.api.getCategoriesRevenue(),
      window.api.getActiveProductsCount()
    ]);
    categories = results[0];
    products = results[1];
    topSellingCategoryName = results[2] || 'None';
    revenueData = results[3] || [];
    activeProductsCount = results[4] || 0;
  }

  function renderChart() {
    const canvas = document.getElementById('categoryShareChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Filter categories with actual sales revenue > 0
    const activeData = revenueData.filter(d => Number(d.revenue) > 0);

    let labels, data, colors;
    if (activeData.length === 0) {
      labels = ['No Sales'];
      data = [1];
      colors = ['#cbd5e1']; // Sleek slate gray placeholder
    } else {
      labels = activeData.map(d => d.name);
      data = activeData.map(d => Number(d.revenue));
      colors = [
        '#1D2DBF', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#8b5cf6', // Violet
        '#f43f5e', // Rose
        '#06b6d4', // Sky/Cyan
        '#14b8a6', // Teal
        '#ef4444'  // Red
      ];
    }

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#1e293b',
            borderWidth: 1,
            padding: 12,
            boxPadding: 8,
            callbacks: {
              label: function (context) {
                if (activeData.length === 0) return ' No sales generated yet';
                const val = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: LKR ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percent}%)`;
              }
            },
            titleFont: {
              family: 'Inter',
              weight: 700
            },
            bodyFont: {
              family: 'Inter'
            }
          }
        },
        cutout: '72%'
      }
    });

    // Generate Premium Custom Vertical Legend
    const legendContainer = document.getElementById('customChartLegend');
    if (legendContainer) {
      if (activeData.length === 0) {
        legendContainer.innerHTML = `
          <div class="legend-row empty">
            <span class="legend-label">
              <span class="legend-dot" style="background-color: #cbd5e1;"></span>
              No sales share
            </span>
            <span class="legend-value">0%</span>
          </div>
        `;
      } else {
        const grandTotal = activeData.reduce((sum, d) => sum + Number(d.revenue), 0);
        legendContainer.innerHTML = activeData
          .sort((a, b) => Number(b.revenue) - Number(a.revenue)) // Optional: Sort by revenue descending for neatness!
          .map((d) => {
            const revenue = Number(d.revenue);
            const percent = grandTotal > 0 ? ((revenue / grandTotal) * 100).toFixed(0) : 0;
            
            // Match chart colors by original activeData index
            const origIndex = activeData.findIndex(item => item.id === d.id);
            const color = colors[origIndex % colors.length];
            const formattedRevenue = window.fmtLKR ? window.fmtLKR(revenue) : `LKR ${revenue.toLocaleString('en-US')}`;

            return `
              <div class="legend-row">
                <span class="legend-label">
                  <span class="legend-dot" style="background-color: ${color};"></span>
                  <span class="legend-text">${d.name}</span>
                </span>
                <span class="legend-value">${percent}% <span class="legend-currency">(${formattedRevenue})</span></span>
              </div>
            `;
          })
          .join('');
      }
    }
  }

  function render() {
    const tbody = document.getElementById('categoriesTableBody');
    const counts = new Map();
    products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));

    document.getElementById('totalCategories').textContent = categories.length;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('topSellingCategory').textContent = topSellingCategoryName;
    document.getElementById('totalActiveProducts').textContent = activeProductsCount;

    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>No categories found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = [...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cat) => {
        const pCount = counts.get(cat.id) || 0;
        const deleteDisabledAttr = pCount > 0
          ? 'disabled style="opacity: 0.4; cursor: not-allowed;" title="Cannot delete category with active products"'
          : '';
        const statusClass = (cat.description === 'Inactive') ? 'inactive' : 'active';
        const statusText = cat.description === 'Inactive' ? 'Inactive' : 'Active';
        const pluralizedText = pCount === 1 ? '1 Product' : `${pCount} Products`;
        return `<tr>
          <td class="td-name">${cat.name}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td><span class="count-badge">${pluralizedText}</span></td>
          <td>
            <div class="actions-cell">
              <button class="tbl-btn edit" data-id="${cat.id}">Edit</button>
              <button class="tbl-btn del" data-id="${cat.id}" ${deleteDisabledAttr}>Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  async function reload() {
    await loadData();
    render();
    renderChart();
  }

  function bindEvents() {
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      document.getElementById('categoryId').value = '';
      document.getElementById('categoryName').value = '';
      document.getElementById('categoryStatus').value = 'Active';
      document.getElementById('modalTitle').textContent = 'Add New Category';
      openModal('categoryModal');
    });

    document.getElementById('categoriesTableBody').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit');
      const delBtn = e.target.closest('.del');

      if (editBtn) {
        const cat = categories.find((c) => c.id === Number(editBtn.dataset.id));
        if (!cat) return;
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryName').value = cat.name;
        document.getElementById('categoryStatus').value = cat.description || 'Active';
        document.getElementById('modalTitle').textContent = 'Edit Category';
        openModal('categoryModal');
      }

      if (delBtn) {
        if (delBtn.disabled) return;
        deletingId = Number(delBtn.dataset.id);
        const cat = categories.find((c) => c.id === deletingId);
        document.getElementById('delMsg').textContent = `Are you sure you want to delete the category "${cat ? cat.name : ''}"? This action cannot be undone.`;
        openModal('deleteModal');
      }
    });

    document.getElementById('saveModalBtn').addEventListener('click', async () => {
      const id = Number(document.getElementById('categoryId').value || 0);
      const name = document.getElementById('categoryName').value.trim();
      const status = document.getElementById('categoryStatus').value;
      if (!name) return alert('Please enter a category name.');

      await window.api.saveCategory({ id: id || null, name, description: status });
      closeModal('categoryModal');
      await reload();
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
      if (!deletingId) return;
      const cat = categories.find((c) => c.id === deletingId);
      
      // Safety window confirmation dialog box checkpoint
      if (confirm(`Are you sure you want to delete the category "${cat ? cat.name : ''}"?`)) {
        const result = await window.api.deleteCategory(deletingId);
        if (!result.success) {
          alert(result.message || 'Cannot delete this category.');
          return;
        }
        deletingId = null;
        closeModal('deleteModal');
        await reload();
      }
    });

    ['closeModalBtn', 'cancelModalBtn'].forEach((id) => document.getElementById(id).addEventListener('click', () => closeModal('categoryModal')));
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    if (user.role !== 'owner') {
      alert('Access Denied: Owner Only');
      window.location.href = 'sales.html';
      return;
    }
    Components.init({ title: 'Categories' });

    bindEvents();
    try {
      await reload();
    } catch (err) {
      alert(`Failed to load categories: ${err.message}`);
    }
  });
})();
