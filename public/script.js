// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const uploadSection = document.querySelector('.upload-section');
const loadingText = document.getElementById('loadingText');
const loadingStep = document.getElementById('loadingStep');
const errorMessage = document.getElementById('errorMessage');
const journalEntry = document.getElementById('journalEntry');
const processAnotherBtn = document.getElementById('processAnotherBtn');
const exportBtn = document.getElementById('exportBtn');
const retryBtn = document.getElementById('retryBtn');

let currentJournalData = null;

// Initialize event listeners
function initializeEventListeners() {
    // File input and drop zone events
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Button events
    processAnotherBtn.addEventListener('click', resetToUpload);
    retryBtn.addEventListener('click', resetToUpload);
    exportBtn.addEventListener('click', exportToCSV);
    
    // Prevent default drag behaviors on the document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// File selection handler
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// File validation
function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, or PDF files only.');
    }
    
    if (file.size > maxSize) {
        throw new Error('File size too large. Maximum size is 10MB.');
    }
}

// Main file processing function
async function processFile(file) {
    try {
        // Validate file
        validateFile(file);
        
        // Show loading state
        showLoadingState();
        
        // Create form data
        const formData = new FormData();
        formData.append('receipt', file);
        
        // Update loading steps
        updateLoadingStep('Uploading file...');
        
        // Upload and process file
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }
        
        updateLoadingStep('Processing OCR...');
        
        // Simulate processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateLoadingStep('Generating journal entry...');
        
        const result = await response.json();
        
        // Store result for export
        currentJournalData = result;
        
        // Show results
        showResults(result);
        
    } catch (error) {
        console.error('Processing error:', error);
        showError(error.message);
    }
}

// UI State Management
function showLoadingState() {
    uploadSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    loadingSection.style.display = 'block';
    loadingSection.classList.add('fade-in');
}

function showResults(data) {
    loadingSection.style.display = 'none';
    errorSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');
    
    renderJournalEntry(data.journalEntry);
}

function showError(message) {
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    uploadSection.style.display = 'none';
    errorSection.style.display = 'block';
    errorSection.classList.add('fade-in');
    
    errorMessage.textContent = message;
}

function resetToUpload() {
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    uploadSection.style.display = 'block';
    uploadSection.classList.add('fade-in');
    
    // Reset file input
    fileInput.value = '';
    currentJournalData = null;
}

function updateLoadingStep(step) {
    loadingStep.textContent = step;
}

// Journal Entry Rendering
function renderJournalEntry(entry) {
    const html = `
        <div class="journal-header">
            <h3>Transaction Details</h3>
            <div class="journal-info">
                <div class="journal-info-item">
                    <label>Date:</label>
                    <span>${entry.date || 'N/A'}</span>
                </div>
                <div class="journal-info-item">
                    <label>Merchant:</label>
                    <span>${entry.merchant || 'N/A'}</span>
                </div>
                <div class="journal-info-item">
                    <label>Description:</label>
                    <span>${entry.description || 'N/A'}</span>
                </div>
                <div class="journal-info-item">
                    <label>Reference:</label>
                    <span>${entry.reference || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        ${entry.lineItems && entry.lineItems.length > 0 ? `
        <div class="line-items-section">
            <h4>Line Items</h4>
            <table class="entries-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                        <th>Category</th>
                    </tr>
                </thead>
                <tbody>
                    ${entry.lineItems.map(item => `
                        <tr>
                            <td>${item.description || 'N/A'}</td>
                            <td>${item.quantity || 1}</td>
                            <td class="amount">€${formatCurrency(item.unitPrice || 0)}</td>
                            <td class="amount">€${formatCurrency(item.total || 0)}</td>
                            <td><span class="category-badge">${item.category || 'General'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="journal-entries">
            <h4>Journal Entries</h4>
            <table class="entries-table">
                <thead>
                    <tr>
                        <th>Account</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Amount (EUR)</th>
                    </tr>
                </thead>
                <tbody>
                    ${entry.entries ? entry.entries.map(entryItem => `
                        <tr>
                            <td>${entryItem.account}</td>
                            <td>${entryItem.description || ''}</td>
                            <td style="text-transform: capitalize;">${entryItem.type}</td>
                            <td class="amount ${entryItem.type}">€${formatCurrency(entryItem.amount)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="4">No entries available</td></tr>'}
                </tbody>
            </table>
        </div>
        
        ${entry.vatBreakdown ? `
        <div class="vat-breakdown">
            <h4>VAT Breakdown</h4>
            <div class="vat-grid">
                <div class="vat-item">
                    <label>Net Amount:</label>
                    <span>€${formatCurrency(entry.vatBreakdown.netAmount)}</span>
                </div>
                <div class="vat-item">
                    <label>VAT Amount:</label>
                    <span>€${formatCurrency(entry.vatBreakdown.vatAmount)}</span>
                </div>
                <div class="vat-item">
                    <label>Gross Amount:</label>
                    <span>€${formatCurrency(entry.vatBreakdown.grossAmount)}</span>
                </div>
                <div class="vat-item">
                    <label>VAT Rate:</label>
                    <span>${(entry.vatBreakdown.vatRate * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="totals">
            <div class="totals-grid">
                <div class="total-item total-debit">
                    <label>Total Debits:</label>
                    <span>€${formatCurrency(entry.totalDebit || 0)}</span>
                </div>
                <div class="total-item total-credit">
                    <label>Total Credits:</label>
                    <span>€${formatCurrency(entry.totalCredit || 0)}</span>
                </div>
            </div>
            ${entry.totalDebit === entry.totalCredit ? 
                '<p style="text-align: center; margin-top: 15px; color: #38a169; font-weight: 600;">✓ Journal entry is balanced</p>' : 
                '<p style="text-align: center; margin-top: 15px; color: #e53e3e; font-weight: 600;">⚠ Warning: Journal entry is not balanced</p>'
            }
        </div>
    `;
    
    journalEntry.innerHTML = html;
}

// Utility Functions
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        return '0.00';
    }
    return amount.toFixed(2);
}

// Export to CSV functionality
function exportToCSV() {
    if (!currentJournalData || !currentJournalData.journalEntry) {
        alert('No journal entry data to export');
        return;
    }
    
    const entry = currentJournalData.journalEntry;
    
    // Create CSV content with enhanced data
    let csvContent = 'Date,Merchant,Description,Reference,Account,Account Description,Type,Amount\n';
    
    if (entry.entries) {
        entry.entries.forEach(item => {
            csvContent += `"${entry.date || ''}","${entry.merchant || ''}","${entry.description || ''}","${entry.reference || ''}","${item.account}","${item.description || ''}","${item.type}","${formatCurrency(item.amount)}"\n`;
        });
    }
    
    // Add line items section if available
    if (entry.lineItems && entry.lineItems.length > 0) {
        csvContent += '\n\nLine Items\n';
        csvContent += 'Description,Quantity,Unit Price,Total,Category,VAT Rate\n';
        entry.lineItems.forEach(item => {
            csvContent += `"${item.description || ''}","${item.quantity || 1}","${formatCurrency(item.unitPrice || 0)}","${formatCurrency(item.total || 0)}","${item.category || ''}","${((item.vatRate || 0) * 100).toFixed(0)}%"\n`;
        });
    }
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `journal_entry_${entry.merchant || 'receipt'}_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Health check function
async function checkServerHealth() {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) {
            throw new Error('Server health check failed');
        }
        console.log('Server is healthy');
    } catch (error) {
        console.warn('Server health check failed:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkServerHealth();
    console.log('Expense Management System initialized');
});