
        // Initialize data storage
        let categories = JSON.parse(localStorage.getItem('quickpos-categories')) || [
            { id: 1, name: "Food", description: "All food items including meals and snacks", productCount: 2 },
            { id: 2, name: "Drinks", description: "Beverages, juices, and hot drinks", productCount: 3 },
            { id: 3, name: "Snacks", description: "Quick bites and light snacks", productCount: 1 },
            { id: 4, name: "Bakery", description: "Freshly baked goods and pastries", productCount: 1 }
        ];
        
        // Load products to count per category
        let products = JSON.parse(localStorage.getItem('quickpos-products')) || [];

        // DOM elements
        const sidebar = document.getElementById('sidebar');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const logo = document.getElementById('logo');
        const logoutBtn = document.getElementById('logoutBtn');
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        const categoriesTableBody = document.getElementById('categoriesTableBody');
        const emptyRow = document.getElementById('emptyRow');
        const totalCategories = document.getElementById('totalCategories');
        const totalProducts = document.getElementById('totalProducts');
        
        // Category Modal
        const categoryModal = document.getElementById('categoryModal');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const categoryForm = document.getElementById('categoryForm');
        const modalTitle = document.getElementById('modalTitle');
        const categoryId = document.getElementById('categoryId');
        const categoryName = document.getElementById('categoryName');
        const categoryDescription = document.getElementById('categoryDescription');
        const saveBtn = document.getElementById('saveBtn');

        // Initialize the app
        function init() {
            updateProductCounts();
            renderCategoriesTable();
            updateStats();
            setupEventListeners();
            
            // Set initial sidebar state from localStorage
            const sidebarState = localStorage.getItem('quickpos-sidebar');
            if (sidebarState === 'collapsed') {
                toggleSidebar();
            }
            
            // Log initial data
            consoleData();
        }

        // Toggle sidebar between expanded and collapsed
        function toggleSidebar() {
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            // Update hamburger icon
            if (sidebar.classList.contains('collapsed')) {
                hamburgerIcon.textContent = 'â†’';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                hamburgerIcon.textContent = 'â˜°';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        }

        // Update product counts for each category
        function updateProductCounts() {
            // Reset all counts to 0
            categories.forEach(category => {
                category.productCount = 0;
            });
            
            // Count products in each category
            products.forEach(product => {
                const category = categories.find(cat => cat.id === product.categoryId);
                if (category) {
                    category.productCount++;
                }
            });
            
            // Save updated categories
            saveCategories();
        }

        // Render categories table
        function renderCategoriesTable() {
            if (categories.length === 0) {
                emptyRow.style.display = '';
                return;
            }
            
            emptyRow.style.display = 'none';
            categoriesTableBody.innerHTML = '';
            
            // Sort categories by name
            const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
            
            sortedCategories.forEach(category => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="category-name-cell">${category.name}</td>
                    <td class="description-cell">
                        ${category.description ? category.description : '<span class="empty-description">No description</span>'}
                    </td>
                    <td class="products-count-cell">
                        <span class="count-badge">${category.productCount} product${category.productCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td class="actions-cell">
                        <button class="action-btn edit-btn" data-id="${category.id}">
                            <span>âœï¸</span> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="${category.id}">
                            <span>ðŸ—‘ï¸</span> Delete
                        </button>
                    </td>
                `;
                categoriesTableBody.appendChild(row);
            });
        }

        // Update statistics
        function updateStats() {
            totalCategories.textContent = categories.length;
            
            const totalProductsCount = categories.reduce((sum, category) => sum + category.productCount, 0);
            totalProducts.textContent = totalProductsCount;
        }

        // Open add category modal
        function openAddCategoryModal() {
            // Reset form
            categoryForm.reset();
            categoryId.value = '';
            modalTitle.textContent = 'Add New Category';
            saveBtn.textContent = 'Save Category';
            
            // Show modal
            categoryModal.classList.add('active');
            
            // Focus on first input
            setTimeout(() => {
                categoryName.focus();
            }, 300);
        }

        // Open edit category modal
        function openEditCategoryModal(categoryIdValue) {
            const category = categories.find(cat => cat.id === parseInt(categoryIdValue));
            
            if (!category) return;
            
            // Set form values
            categoryId.value = category.id;
            categoryName.value = category.name;
            categoryDescription.value = category.description || '';
            modalTitle.textContent = 'Edit Category';
            saveBtn.textContent = 'Update Category';
            
            // Show modal
            categoryModal.classList.add('active');
            
            // Focus on first input
            setTimeout(() => {
                categoryName.focus();
            }, 300);
        }

        // Save or update category
        function saveCategory(event) {
            event.preventDefault();
            
            const name = categoryName.value.trim();
            const description = categoryDescription.value.trim();
            
            if (!name) {
                alert('Please enter a category name');
                categoryName.focus();
                return;
            }
            
            // Check for duplicate category name (excluding current category if editing)
            const existingId = categoryId.value ? parseInt(categoryId.value) : null;
            const duplicate = categories.find(cat => 
                cat.name.toLowerCase() === name.toLowerCase() && 
                cat.id !== existingId
            );
            
            if (duplicate) {
                alert('A category with this name already exists');
                categoryName.focus();
                return;
            }
            
            if (existingId) {
                // Update existing category
                const categoryIndex = categories.findIndex(cat => cat.id === existingId);
                if (categoryIndex !== -1) {
                    categories[categoryIndex] = {
                        ...categories[categoryIndex],
                        name: name,
                        description: description
                    };
                    
                    saveCategories();
                    renderCategoriesTable();
                    updateStats();
                    categoryModal.classList.remove('active');
                    
                    consoleData();
                    alert('Category updated successfully!');
                }
            } else {
                // Add new category
                const newId = categories.length > 0 ? Math.max(...categories.map(cat => cat.id)) + 1 : 1;
                const newCategory = {
                    id: newId,
                    name: name,
                    description: description,
                    productCount: 0
                };
                
                categories.push(newCategory);
                saveCategories();
                renderCategoriesTable();
                updateStats();
                categoryModal.classList.remove('active');
                
                consoleData();
                alert('Category added successfully!');
            }
        }

        // Delete category
        function deleteCategory(categoryIdValue) {
            const category = categories.find(cat => cat.id === parseInt(categoryIdValue));
            
            if (!category) return;
            
            // Check if category has products
            if (category.productCount > 0) {
                if (!confirm(`This category has ${category.productCount} product(s). Deleting it will remove these products from the system. Are you sure you want to delete?`)) {
                    return;
                }
            } else {
                if (!confirm('Are you sure you want to delete this category?')) {
                    return;
                }
            }
            
            // Remove category
            categories = categories.filter(cat => cat.id !== parseInt(categoryIdValue));
            saveCategories();
            renderCategoriesTable();
            updateStats();
            
            // If category had products, remove those products too
            if (category.productCount > 0) {
                products = products.filter(product => product.categoryId !== parseInt(categoryIdValue));
                localStorage.setItem('quickpos-products', JSON.stringify(products));
            }
            
            consoleData();
            alert('Category deleted successfully!');
        }

        // Save categories to localStorage
        function saveCategories() {
            localStorage.setItem('quickpos-categories', JSON.stringify(categories));
        }

        // Console log data for backend
        function consoleData() {
            console.log('=== QuickPOS Categories Data (Ready for MySQL) ===');
            console.log('Categories:', JSON.stringify(categories, null, 2));
            console.log('===================================================');
        }

        // Set up event listeners
        function setupEventListeners() {
            // Hamburger menu toggle
            hamburgerBtn.addEventListener('click', toggleSidebar);
            
            // Logout button
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
            
            // Add category button
            addCategoryBtn.addEventListener('click', openAddCategoryModal);
            
            // Category modal
            closeModalBtn.addEventListener('click', () => {
                categoryModal.classList.remove('active');
            });
            
            cancelBtn.addEventListener('click', () => {
                categoryModal.classList.remove('active');
            });
            
            // Form submission
            categoryForm.addEventListener('submit', saveCategory);
            
            // Category table actions (event delegation)
            categoriesTableBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                const deleteBtn = e.target.closest('.delete-btn');
                
                if (editBtn) {
                    const categoryIdValue = editBtn.dataset.id;
                    openEditCategoryModal(categoryIdValue);
                } else if (deleteBtn) {
                    const categoryIdValue = deleteBtn.dataset.id;
                    deleteCategory(categoryIdValue);
                }
            });
            
            // Close modal on background click
            categoryModal.addEventListener('click', (e) => {
                if (e.target === categoryModal) {
                    categoryModal.classList.remove('active');
                }
            });
            
            // Close modal on ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    categoryModal.classList.remove('active');
                }
            });
        }

        // Initialize app when DOM is loaded
        document.addEventListener('DOMContentLoaded', init);

        document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the user data from storage
    const user = JSON.parse(localStorage.getItem('quickpos-user'));

    // 2. Security Check: If someone tries to open the file without logging in
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 3. Role Check: If user is a Cashier, hide the Owner-only buttons
    if (user.role === 'cashier') {
        const ownerLinks = document.querySelectorAll('.owner-only');
        ownerLinks.forEach(link => {
            link.style.display = 'none'; 
        });
    }

    // 4. Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Do you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }
});
    
