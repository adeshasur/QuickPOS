(function() {
    'use strict';
    
    let products = [];
    let categories = [];
    let quoteItems = [];
    let currentCategory = "all";
    let productToCustomize = null;
    let priceManuallyEdited = false;
    let currentPdfElement = null;

    // DOM elements
    const productsGrid = document.getElementById('productsGrid');
    const quotationItemsDiv = document.getElementById('quotationItems');
    const quoteItemCount = document.getElementById('quoteItemCount');
    const quoteTotalSpan = document.getElementById('quoteTotal');
    const categoryFilter = document.getElementById('categoryFilter');
    const generatePDFBtn = document.getElementById('generatePDFBtn');
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    const validUntil = document.getElementById('validUntil');
    const pdfPreviewModal = document.getElementById('pdfPreviewModal');
    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const editQuoteBtn = document.getElementById('editQuoteBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    // Customize modal
    const customizeModal = document.getElementById('customizeModal');
    const closeCustomizeBtn = document.getElementById('closeCustomizeBtn');
    const cancelCustomizeBtn = document.getElementById('cancelCustomizeBtn');
    const addCustomToCartBtn = document.getElementById('addCustomToCartBtn');
    const customQty = document.getElementById('customQty');
    const customPrice = document.getElementById('customPrice');
    const customizeProductName = document.getElementById('customizeProductName');
    const unitPriceDisplay = document.getElementById('unitPriceDisplay');

    // Formatting utilities
    const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatCurrencyPlain = (amt) => amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    const normalizeCategory = (name) => String(name || 'general').toLowerCase().trim().replace(/\s+/g, '-');

    // Safe localStorage wrapper
    const safeStorage = {
        get: (key) => {
            try { return localStorage.getItem(key); } 
            catch (e) { console.warn('Storage access denied'); return null; }
        },
        set: (key, value) => {
            try { localStorage.setItem(key, value); return true; } 
            catch (e) { console.warn('Storage access denied'); return false; }
        },
        remove: (key) => {
            try { localStorage.removeItem(key); return true; } 
            catch (e) { console.warn('Storage access denied'); return false; }
        },
        getJSON: (key) => {
            try { 
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) { 
                console.warn('Storage access denied'); 
                return null; 
            }
        }
    };

    // Add item to quotation
    function addToQuote(productId, quantity = 1, overridePrice = null) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const finalPrice = overridePrice !== null ? overridePrice : product.price;
        const existing = quoteItems.find(i => i.id === product.id && Math.abs(i.overridePrice - finalPrice) < 0.01);
        
        if (existing) {
            existing.quantity += quantity;
        } else {
            quoteItems.push({
                id: product.id,
                name: product.name,
                price: finalPrice,
                overridePrice: finalPrice,
                quantity: quantity,
                unit: product.unit || 'pc'
            });
        }
        renderQuotation();
    }

    // Render product grid
    function renderProducts() {
        if(!productsGrid) return;
        productsGrid.innerHTML = '';
        const filtered = currentCategory === 'all' ? products : products.filter(p => p.category === currentCategory);
        
        if (!filtered.length) {
            productsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;">No products</div>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.id = p.id;
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'product-name';
            nameDiv.textContent = p.name;
            
            const detailDiv = document.createElement('div');
            detailDiv.className = 'product-detail';
            
            const unitSpan = document.createElement('span');
            unitSpan.className = 'product-unit';
            unitSpan.textContent = p.unit;
            
            const priceSpan = document.createElement('span');
            priceSpan.className = 'product-price';
            priceSpan.textContent = formatCurrency(p.price);
            
            detailDiv.appendChild(unitSpan);
            detailDiv.appendChild(priceSpan);
            
            card.appendChild(nameDiv);
            card.appendChild(detailDiv);
            
            // Unified interaction: clicking any product opens the customize modal
            // so quantity/price can be adjusted before adding.
            card.addEventListener('click', () => {
                openCustomizeModal(p);
            });
            
            fragment.appendChild(card);
        });
        
        productsGrid.appendChild(fragment);
    }

    function renderCategoryButtons() {
        if (!categoryFilter) return;
        categoryFilter.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = `category-btn${currentCategory === 'all' ? ' active' : ''}`;
        allBtn.dataset.category = 'all';
        allBtn.textContent = 'All';
        categoryFilter.appendChild(allBtn);

        categories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.className = `category-btn${currentCategory === cat.key ? ' active' : ''}`;
            btn.dataset.category = cat.key;
            btn.textContent = cat.label;
            categoryFilter.appendChild(btn);
        });
    }

    // Render quotation items
    function renderQuotation() {
        if(!quotationItemsDiv) return;
        if (!quoteItems.length) {
            quotationItemsDiv.innerHTML = '<div class="empty-quote"><div class="empty-quote-icon"><span class="material-symbols-rounded s48">description</span></div><p>No items added</p><p>Click products to add</p></div>';
            if(quoteItemCount) quoteItemCount.textContent = '0';
            if(quoteTotalSpan) quoteTotalSpan.textContent = '0.00';
            return;
        }
        
        let total = 0, count = 0;
        const fragment = document.createDocumentFragment();
        
        quoteItems.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            count += item.quantity;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'quote-item';
            itemDiv.dataset.index = index;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'item-info';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'item-name';
            nameDiv.textContent = item.name;
            
            const unitPriceDiv = document.createElement('div');
            unitPriceDiv.className = 'item-unit-price';
            unitPriceDiv.textContent = `${item.unit} @ ${formatCurrency(item.price)}`;
            
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(unitPriceDiv);
            
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'item-controls';
            
            const decBtn = document.createElement('button');
            decBtn.className = 'quantity-btn decrease';
            decBtn.innerHTML = '<span class="material-symbols-rounded s18">remove</span>';
            decBtn.addEventListener('click', () => updateQuantity(index, -0.1));
            
            const qtySpan = document.createElement('span');
            qtySpan.className = 'item-quantity';
            qtySpan.textContent = item.quantity.toFixed(2);
            
            const incBtn = document.createElement('button');
            incBtn.className = 'quantity-btn increase';
            incBtn.innerHTML = '<span class="material-symbols-rounded s18">add</span>';
            incBtn.addEventListener('click', () => updateQuantity(index, 0.1));
            
            controlsDiv.appendChild(decBtn);
            controlsDiv.appendChild(qtySpan);
            controlsDiv.appendChild(incBtn);
            
            const totalDiv = document.createElement('div');
            totalDiv.className = 'item-total';
            totalDiv.textContent = formatCurrency(itemTotal);
            
            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(controlsDiv);
            itemDiv.appendChild(totalDiv);
            
            fragment.appendChild(itemDiv);
        });
        
        count = Math.round(count * 100) / 100;
        quotationItemsDiv.innerHTML = '';
        quotationItemsDiv.appendChild(fragment);
        if (quoteItemCount) {
            const isWhole = Math.abs(count - Math.round(count)) < 1e-9;
            quoteItemCount.textContent = isWhole ? String(Math.round(count)) : count.toFixed(2);
        }
        if(quoteTotalSpan) quoteTotalSpan.textContent = formatCurrencyPlain(total);
    }

    // Update quantity
    function updateQuantity(index, delta) {
        if (index < 0 || index >= quoteItems.length) return;
        
        const newQty = quoteItems[index].quantity + delta;
        if (newQty <= 0) {
            quoteItems.splice(index, 1);
        } else {
            quoteItems[index].quantity = Math.round(newQty * 100) / 100;
        }
        renderQuotation();
    }

    // Open customize modal
    function openCustomizeModal(product) {
        if(!customizeModal) return;
        productToCustomize = product;
        if(customizeProductName) customizeProductName.textContent = product.name;
        if(unitPriceDisplay) unitPriceDisplay.textContent = formatCurrency(product.price);
        if(customQty) customQty.value = '1.00';
        if(customPrice) customPrice.value = product.price.toFixed(2);
        priceManuallyEdited = false;
        customizeModal.classList.add('active');
    }

    // Close customize modal
    function closeCustomizeModal() {
        if(customizeModal) customizeModal.classList.remove('active');
        productToCustomize = null;
        priceManuallyEdited = false;
    }

    // Add customized item to cart
    function addCustomizedToCart() {
        if (!productToCustomize) return;
        
        const qty = parseFloat(customQty.value) || 0;
        const finalPrice = parseFloat(customPrice.value) || 0;
        
        if (qty <= 0) { 
            alert('Please enter a valid quantity greater than 0'); 
            return; 
        }
        if (finalPrice < 0) { 
            alert('Please enter a valid price'); 
            return; 
        }

        addToQuote(productToCustomize.id, qty, finalPrice);
        closeCustomizeModal();
    }

    // Build A4 PDF HTML content - PERFECTLY CENTERED
    function buildPdfContent() {
        const quoteNo = 'Q-HW-' + Date.now().toString().slice(-6);
        const today = new Date();
        const validDate = validUntil.value || (() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d.toISOString().split('T')[0];
        })();
        
        const custNameStr = customerName.value.trim() || 'Walk-in Customer';
        const custPhoneStr = customerPhone.value.trim() || '-';

        let itemsHtml = '';
        let total = 0;

        quoteItems.forEach((item, idx) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHtml += `
                <tr>
                    <td style="border:1px solid #ddd; padding:8px; text-align:left;">${idx + 1}. ${escapeHtml(item.name)}</td>
                    <td style="border:1px solid #ddd; padding:8px; text-align:center; width:60px;">${item.quantity.toFixed(2)}</td>
                    <td style="border:1px solid #ddd; padding:8px; text-align:center; width:50px;">${escapeHtml(item.unit || 'pc')}</td>
                    <td style="border:1px solid #ddd; padding:8px; text-align:right; width:90px;">${formatCurrencyPlain(item.price)}</td>
                    <td style="border:1px solid #ddd; padding:8px; text-align:right; width:100px; font-weight:600;">${formatCurrencyPlain(itemTotal)}</td>
                </tr>
            `;
        });

        return `
            <div class="a4-page">
                <div class="a4-header">
                    <h1>HARDWARE CENTRE</h1>
                    <p>No.123, Galle Road, Colombo 03 | Tel: 011-2345678 | Email: info@hardwarecentre.lk</p>
                </div>
                
                <div class="a4-info">
                    <div class="a4-info-left">
                        <p><strong>Quotation No:</strong> ${escapeHtml(quoteNo)}</p>
                        <p><strong>Date:</strong> ${today.toLocaleDateString('en-GB')}</p>
                    </div>
                    <div class="a4-info-right">
                        <p><strong>Customer Name:</strong> ${escapeHtml(custNameStr)}</p>
                        <p><strong>Valid Until:</strong> ${new Date(validDate).toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                
                <table class="a4-table">
                    <thead>
                        <tr>
                            <th style="width:auto;">Item Description</th>
                            <th style="width:60px; text-align:center;">Qty</th>
                            <th style="width:50px; text-align:center;">Unit</th>
                            <th style="width:90px; text-align:right;">Unit Price</th>
                            <th style="width:100px; text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="a4-total">
                    TOTAL AMOUNT: LKR ${formatCurrencyPlain(total)}
                </div>
                
                <div class="a4-footer">
                    <div class="a4-terms">
                        <strong>Terms & Conditions:</strong><br>
                        • Prices are subject to change without prior notice<br>
                        • This quotation is valid until the date specified above
                    </div>
                    
                    <div class="a4-signature">
                        <div style="color:#666; font-size:9pt;">
                            <p>Thank you for your business!</p>
                            <p>Computer generated by QuickPOS Hardware</p>
                        </div>
                        <div class="a4-signature-line">
                            Authorized Signature
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Generate and show PDF preview
    function generatePDF() {
        if (quoteItems.length === 0) {
            alert('Please add at least one item to generate a quotation.');
            return;
        }

        const pdfHtml = buildPdfContent();
        if(pdfPreviewContainer) pdfPreviewContainer.innerHTML = pdfHtml;
        currentPdfElement = pdfPreviewContainer.querySelector('.a4-page');
        
        // Show preview modal
        if(pdfPreviewModal) {
            pdfPreviewModal.classList.add('active');
            // Store quote data for download
            pdfPreviewModal.dataset.quoteNo = 'Q-HW-' + Date.now().toString().slice(-6);
        }
    }

    // Download PDF from preview
    function downloadPDF() {
        if (!currentPdfElement) return;
        
        const quoteNo = pdfPreviewModal.dataset.quoteNo || 'Quotation';
        
        // Configure for A4 output
        const opt = {
            margin: 0,
            filename: `Hardware_Quotation_${quoteNo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                width: 794,
                height: 1123,
                windowWidth: 794,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4',
                orientation: 'portrait',
                putOnlyUsedFonts: true,
                floatPrecision: 16
            }
        };

        if(downloadPdfBtn) {
            downloadPdfBtn.textContent = 'Generating...';
            downloadPdfBtn.disabled = true;
        }

        html2pdf().set(opt).from(currentPdfElement).save()
            .then(() => {
                if(downloadPdfBtn) {
                    downloadPdfBtn.textContent = '📥 Download PDF';
                    downloadPdfBtn.disabled = false;
                }
            })
            .catch(err => {
                console.error('PDF Error:', err);
                alert('PDF generation failed. Please try again.');
                if(downloadPdfBtn) {
                    downloadPdfBtn.textContent = '📥 Download PDF';
                    downloadPdfBtn.disabled = false;
                }
            });
    }

    // Close PDF preview
    function closePdfPreview() {
        if(pdfPreviewModal) pdfPreviewModal.classList.remove('active');
        currentPdfElement = null;
    }


    // Set category filter
    function setCategory(cat) {
        currentCategory = cat;
        renderCategoryButtons();
        renderProducts();
    }

    async function loadProductsFromDb() {
        try {
            const dbProducts = await window.api.getProducts();
            if (!Array.isArray(dbProducts) || dbProducts.length === 0) {
                products = [];
                categories = [];
                return;
            }

            products = dbProducts.map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.selling_price || 0),
                unit: p.unit_type || 'pc',
                category: normalizeCategory(p.category_name || 'General')
            }));

            const seen = new Set();
            categories = [];
            products.forEach((p) => {
                if (p.category === 'all' || seen.has(p.category)) return;
                seen.add(p.category);
                const label = (p.category || 'General').replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
                categories.push({ key: p.category, label });
            });
        } catch (err) {
            console.error('Failed to load products for quotations:', err);
            products = [];
            categories = [];
        }
    }

    // Setup event listeners
    function setupListeners() {
        // Category filters (delegated for dynamic buttons)
        if (categoryFilter) {
            categoryFilter.addEventListener('click', (e) => {
                const btn = e.target.closest('.category-btn');
                if (!btn) return;
                setCategory(btn.dataset.category);
            });
        }

        // Modal controls
        if(closeCustomizeBtn) closeCustomizeBtn.addEventListener('click', closeCustomizeModal);
        if(cancelCustomizeBtn) cancelCustomizeBtn.addEventListener('click', closeCustomizeModal);
        if(addCustomToCartBtn) addCustomToCartBtn.addEventListener('click', addCustomizedToCart);

        // Auto-calculate price based on quantity
        if(customQty) {
            customQty.addEventListener('input', () => {
                if (!productToCustomize || priceManuallyEdited) return;
                const qty = parseFloat(customQty.value) || 0;
                if(customPrice) customPrice.value = (qty * productToCustomize.price).toFixed(2);
            });
        }

        if(customPrice) {
            customPrice.addEventListener('input', () => {
                priceManuallyEdited = true;
            });
        }

        // Close modal on outside click
        if(customizeModal) {
            customizeModal.addEventListener('click', (e) => {
                if (e.target === customizeModal) closeCustomizeModal();
            });
        }

        // PDF controls
        if(generatePDFBtn) generatePDFBtn.addEventListener('click', generatePDF);
        if(closePreviewBtn) closePreviewBtn.addEventListener('click', closePdfPreview);
        if(editQuoteBtn) editQuoteBtn.addEventListener('click', closePdfPreview);
        if(downloadPdfBtn) downloadPdfBtn.addEventListener('click', downloadPDF);

        // Close preview on outside click
        if(pdfPreviewModal) {
            pdfPreviewModal.addEventListener('click', (e) => {
                if (e.target === pdfPreviewModal) closePdfPreview();
            });
        }

        // Set default valid until date (7 days from now)
        if(validUntil) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            validUntil.value = d.toISOString().split('T')[0];
        }
    }


    // Initialize
    async function init() {
        // Security check
        const user = safeStorage.getJSON('quickpos-user');
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize Components
        Components.init({
            title: 'Quotations'
        });
        
        await loadProductsFromDb();
        renderCategoryButtons();
        renderProducts();
        renderQuotation();
        setupListeners();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
