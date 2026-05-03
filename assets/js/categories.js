(function() {
    'use strict';

    let categories = [];
    let currentEditId = null;

    // DOM Elements
    const categoriesTableBody = document.getElementById('categoriesTableBody');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoryModalOverlay = document.getElementById('categoryModalOverlay');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const modalTitle = document.getElementById('modalTitle');
    const catName = document.getElementById('catName');
    const catDesc = document.getElementById('catDesc');

    async function loadData() {
        try {
            categories = await window.api.getCategories();
            renderTable();
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    function renderTable() {
        if (!categoriesTableBody) return;

        if (categories.length === 0) {
            categoriesTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#718096;">No categories found. Click "Add New Category" to start.</td></tr>';
            return;
        }

        categoriesTableBody.innerHTML = categories.map(cat => `
            <tr>
                <td>#${String(cat.id).padStart(3, '0')}</td>
                <td class="category-name-cell">${cat.name}</td>
                <td style="color: #718096;">${cat.description || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" data-id="${cat.id}" title="Edit">
                            <span class="material-symbols-rounded s18">edit</span>
                        </button>
                        <button class="action-btn delete-btn" data-id="${cat.id}" title="Delete">
                            <span class="material-symbols-rounded s18">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach events
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(parseInt(btn.dataset.id)));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteCategory(parseInt(btn.dataset.id)));
        });
    }

    function openModal(id = null) {
        currentEditId = id;
        if (id) {
            const cat = categories.find(c => c.id === id);
            if (!cat) return;
            modalTitle.innerText = 'Edit Category';
            catName.value = cat.name;
            catDesc.value = cat.description || '';
        } else {
            modalTitle.innerText = 'Add Category';
            catName.value = '';
            catDesc.value = '';
        }
        categoryModalOverlay.classList.add('active');
        catName.focus();
    }

    function closeModal() {
        categoryModalOverlay.classList.remove('active');
        currentEditId = null;
    }

    async function handleSave() {
        const name = catName.value.trim();
        const description = catDesc.value.trim();

        if (!name) {
            alert('Please enter category name');
            return;
        }

        try {
            const result = await window.api.saveCategory({
                id: currentEditId,
                name: name,
                description: description
            });

            if (result.success) {
                closeModal();
                loadData();
            }
        } catch (err) {
            alert('Error saving category: ' + err.message);
        }
    }

    async function deleteCategory(id) {
        if (confirm('Are you sure you want to delete this category? Products linked to this category may appear as uncategorized.')) {
            try {
                const result = await window.api.deleteCategory(id);
                if (result.success) loadData();
            } catch (err) {
                alert('Error deleting category: ' + err.message);
            }
        }
    }

    function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { window.location.href = 'login.html'; return; }

        // Hide "Add" button if cashier
        if (user.role === 'cashier') {
            if (addCategoryBtn) addCategoryBtn.style.display = 'none';
            // In a real app we'd also hide edit/delete buttons in the table
        }

        loadData();

        if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => openModal());
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
        if (saveCategoryBtn) saveCategoryBtn.addEventListener('click', handleSave);

        window.addEventListener('click', (e) => {
            if (e.target === categoryModalOverlay) closeModal();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
