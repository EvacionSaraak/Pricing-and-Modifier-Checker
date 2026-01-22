// Constants
const MAX_SEARCH_RESULTS = 50; // Maximum number of search results to display

// Global variables
let priceList = {}; // Will hold price data from Prices.xlsx
let modifiers = [];
let allPrices = []; // Array to hold all price records for searching
let processedClaims = []; // Store processed claims for filtering
let showOnlyInvalids = false; // Filter state

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeModifiers();
    loadPricesXLSX(); // Load Prices.xlsx on startup
    initializeResizeHandle(); // Initialize sidebar resizing
});

// Initialize resize handle for sidebar
function initializeResizeHandle() {
    const resizeHandle = document.getElementById('resizeHandle');
    const sidebar = document.getElementById('leftSidebar');
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const width = startWidth + (e.clientX - startX);
        const minWidth = 300;
        const maxWidth = 800;
        
        if (width >= minWidth && width <= maxWidth) {
            sidebar.style.width = width + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

// Initialize default modifiers based on code types
function initializeModifiers() {
    modifiers = [
        { type: 'Medical', thiqa: 1.3, lowEnd: 1.0, basic: 1.0 },
        { type: 'Radiology', thiqa: 1.0, lowEnd: 1.0, basic: 1.0 },
        { type: 'Laboratory', thiqa: 1.0, lowEnd: 1.0, basic: 1.0 },
        { type: 'Physiotherapy', thiqa: 1.0, lowEnd: 1.0, basic: 1.0 },
        { type: 'OP E&M', thiqa: 1.3, lowEnd: 1.08, basic: 1.0 }
    ];
    renderModifiers();
}

// Determine code type based on code prefix
function getCodeType(code) {
    if (!code) return null;
    const codeStr = code.toString();
    
    // Medical starts with 1, 2, 3, 4, 5, and 6
    if (/^[1-6]/.test(codeStr)) return 'Medical';
    
    // Radiology starts with 7
    if (codeStr.startsWith('7')) return 'Radiology';
    
    // Laboratory starts with 8
    if (codeStr.startsWith('8')) return 'Laboratory';
    
    // Physiotherapy starts with 97
    if (codeStr.startsWith('97')) return 'Physiotherapy';
    
    // OP E&M starts with 99
    if (codeStr.startsWith('99')) return 'OP E&M';
    
    return null;
}

// Get modifiers for a specific code
function getModifiersForCode(code) {
    const codeType = getCodeType(code);
    if (!codeType) return null;
    
    return modifiers.find(m => m.type === codeType);
}

// Load Prices.xlsx on startup
async function loadPricesXLSX() {
    try {
        const response = await fetch('Prices.xlsx');
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            // Process the data
            processLoadedPrices(jsonData);
            showPricelistStatus('Prices.xlsx loaded successfully! ' + allPrices.length + ' items available.', 'success');
        } else {
            console.error('Could not load Prices.xlsx');
            showPricelistStatus('Could not load Prices.xlsx', 'danger');
        }
    } catch (error) {
        console.error('Error loading Prices.xlsx:', error);
        showPricelistStatus('Error loading Prices.xlsx: ' + error.message, 'danger');
    }
}

// Process loaded price data
function processLoadedPrices(jsonData) {
    allPrices = [];
    priceList = {};
    
    jsonData.forEach(row => {
        // Support both formats: Prices.xlsx format (Code, Code Description, Price (AED))
        // and the old format (Code, Name, Thiqa, High-end, etc.)
        const code = row.Code || row.code;
        
        // Find description column (handles variations in column names)
        const description = row['Code Description'] || row.Name || row.name || row.Description || '';
        
        // Find price column (handles variations including newline in column name)
        let basePrice = 0;
        for (const key in row) {
            if (key.toLowerCase().includes('price') || key === 'Thiqa' || key === 'thiqa') {
                basePrice = parseFloat(row[key]) || 0;
                break;
            }
        }
        
        if (code) {
            const priceRecord = {
                code: code,
                description: description,
                basePrice: basePrice
            };
            
            allPrices.push(priceRecord);
            priceList[code] = priceRecord;
        }
    });
}

// Search prices
function searchPrices() {
    const searchTerm = document.getElementById('priceSearch').value.toLowerCase().trim();
    const tbody = document.getElementById('priceSearchBody');
    
    if (!searchTerm) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Type to search...</td></tr>';
        return;
    }
    
    // Filter prices based on search term
    const filtered = allPrices.filter(item => 
        item.code.toLowerCase().includes(searchTerm) || 
        item.description.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No results found</td></tr>';
        return;
    }
    
    // Limit results for performance
    const displayResults = filtered.slice(0, MAX_SEARCH_RESULTS);
    
    tbody.innerHTML = displayResults.map(item => {
        const basePrice = item.basePrice;
        const codeModifiers = getModifiersForCode(item.code);
        
        // Calculate prices with modifiers
        const thiqaPrice = codeModifiers ? (basePrice * codeModifiers.thiqa).toFixed(2) : 'N/A';
        const lowEndPrice = codeModifiers ? (basePrice * codeModifiers.lowEnd).toFixed(2) : 'N/A';
        const basicPrice = codeModifiers ? (basePrice * codeModifiers.basic).toFixed(2) : 'N/A';
        
        // Truncate description for table
        const shortDesc = item.description.length > 30 ? item.description.substring(0, 30) + '...' : item.description;
        
        return `
            <tr>
                <td>${escapeHtml(item.code)}</td>
                <td><a href="#" onclick="showDescriptionModal('${escapeHtml(item.code)}', '${escapeHtml(item.description)}', ${basePrice}); return false;" class="text-decoration-none">${escapeHtml(shortDesc)}</a></td>
                <td>${basePrice.toFixed(2)}</td>
                <td>${thiqaPrice}</td>
                <td>${lowEndPrice}</td>
                <td>${basicPrice}</td>
            </tr>
        `;
    }).join('');
    
    if (filtered.length > MAX_SEARCH_RESULTS) {
        tbody.innerHTML += `<tr><td colspan="6" class="text-center text-muted">Showing ${MAX_SEARCH_RESULTS} of ${filtered.length} results. Refine your search for more specific results.</td></tr>`;
    }
}

// Show description in modal
function showDescriptionModal(code, description, basePrice) {
    document.getElementById('modalCode').textContent = code;
    document.getElementById('modalDescription').textContent = description;
    document.getElementById('modalBasePrice').textContent = basePrice.toFixed(2) + ' AED';
    
    // Get modifiers for this code
    const codeModifiers = getModifiersForCode(code);
    const modifierPricesDiv = document.getElementById('modalModifierPrices');
    
    if (codeModifiers) {
        const codeType = getCodeType(code);
        modifierPricesDiv.innerHTML = `
            <p><strong>Code Category:</strong> ${codeType}</p>
            <ul>
                <li><strong>Thiqa (${codeModifiers.thiqa}):</strong> ${(basePrice * codeModifiers.thiqa).toFixed(2)} AED</li>
                <li><strong>Low-End (${codeModifiers.lowEnd}):</strong> ${(basePrice * codeModifiers.lowEnd).toFixed(2)} AED</li>
                <li><strong>Basic (${codeModifiers.basic}):</strong> ${(basePrice * codeModifiers.basic).toFixed(2)} AED</li>
            </ul>
        `;
    } else {
        modifierPricesDiv.innerHTML = '<p><em>No modifier category applicable for this code.</em></p>';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('descriptionModal'));
    modal.show();
}

// Update search results when modifiers change
// Render modifiers table
function renderModifiers() {
    const container = document.getElementById('modifiersList');
    
    const tableHTML = `
        <table class="modifiers-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Thiqa</th>
                    <th>Low-End</th>
                    <th>Basic</th>
                </tr>
            </thead>
            <tbody>
                ${modifiers.map((mod, index) => `
                    <tr>
                        <td><strong>${mod.type}</strong></td>
                        <td><input type="number" step="0.01" value="${mod.thiqa}" onchange="updateModifier(${index}, 'thiqa', this.value)"></td>
                        <td><input type="number" step="0.01" value="${mod.lowEnd}" onchange="updateModifier(${index}, 'lowEnd', this.value)"></td>
                        <td><input type="number" step="0.01" value="${mod.basic}" onchange="updateModifier(${index}, 'basic', this.value)"></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    
    // Update search results with new modifier values
    searchPrices();
}

// Update modifier value
function updateModifier(index, field, value) {
    modifiers[index][field] = parseFloat(value);
    searchPrices(); // Refresh search results with new modifier values
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle price list file upload - safely check if element exists
// Note: This element is not currently in the HTML but code is defensive
const pricelistFileInput = document.getElementById('pricelistFile');
if (pricelistFileInput) {
    pricelistFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    // Validate format - must have Code column
                    if (jsonData.length === 0) {
                        console.error('Error: File is empty');
                        showPricelistStatus('Error: File is empty', 'danger');
                        return;
                    }
                    
                    const firstRow = jsonData[0];
                    const hasCode = 'Code' in firstRow || 'code' in firstRow;
                    const hasDescription = 'Code Description' in firstRow || 'Name' in firstRow || 'name' in firstRow;
                    const hasPrice = 'Price \n(AED)' in firstRow || 'Price' in firstRow || 'Thiqa' in firstRow || 'thiqa' in firstRow;
                    
                    if (!hasCode) {
                        console.error('Error: Invalid format - missing Code column');
                        showPricelistStatus('Error: Invalid format - file must have a "Code" column', 'danger');
                        return;
                    }
                    
                    if (!hasDescription && !hasPrice) {
                        console.error('Error: Invalid format - missing description and price columns');
                        showPricelistStatus('Error: Invalid format - file must have description and/or price columns', 'danger');
                        return;
                    }
                    
                    // Process the data
                    processLoadedPrices(jsonData);
                    
                    showPricelistStatus('Price list uploaded successfully! ' + allPrices.length + ' items loaded.', 'success');
                    
                    // Clear search and refresh
                    document.getElementById('priceSearch').value = '';
                    searchPrices();
                } catch (error) {
                    console.error('Error reading Excel file:', error);
                    showPricelistStatus('Error reading Excel file: ' + error.message, 'danger');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    });
}

// Show pricelist status message
function showPricelistStatus(message, type) {
    const statusDiv = document.getElementById('pricelistStatus');
    statusDiv.className = `alert alert-${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// Show general status message
function showStatus(message, type) {
    // You can implement a toast or alert here
    console.log(message);
}

// Process XML file
function processXML() {
    const xmlFile = document.getElementById('xmlFile').files[0];
    
    if (!xmlFile) {
        alert('Please select an XML file');
        return;
    }
    
    if (Object.keys(priceList).length === 0) {
        alert('Please upload a price list first');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const xmlText = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                alert('Error parsing XML file');
                return;
            }
            
            // Parse claims from XML
            const claims = parseXMLClaims(xmlDoc);
            
            // Process and display results
            displayResults(claims);
        } catch (error) {
            alert('Error processing XML: ' + error.message);
        }
    };
    reader.readAsText(xmlFile);
}

// Parse claims from XML document
function parseXMLClaims(xmlDoc) {
    const claims = [];
    
    // Handle both generic and HAAD-specific XML formats
    const claimElements = xmlDoc.querySelectorAll('Claim, claim');
    
    claimElements.forEach(claimEl => {
        const claimId = claimEl.querySelector('ID')?.textContent || 
                       claimEl.querySelector('ClaimID')?.textContent || 
                       claimEl.querySelector('claimId')?.textContent || 'N/A';
        
        // Get encounter type if available
        const encounterType = claimEl.querySelector('Encounter Type')?.textContent || 'N/A';
        
        // Get activities/services within the claim
        const activities = claimEl.querySelectorAll('Activity, activity, Service, service, Item, item');
        
        activities.forEach(activity => {
            const claim = {
                claimId: claimId,
                type: encounterType,
                code: activity.querySelector('Code')?.textContent || 
                      activity.querySelector('code')?.textContent || 
                      activity.querySelector('ServiceCode')?.textContent || 
                      activity.querySelector('ActivityCode')?.textContent || 'N/A',
                net: parseFloat(activity.querySelector('Net')?.textContent || 
                               activity.querySelector('net')?.textContent || 
                               activity.querySelector('NetAmount')?.textContent || 
                               activity.querySelector('Amount')?.textContent || '0'),
                quantity: parseInt(activity.querySelector('Quantity')?.textContent || 
                                  activity.querySelector('quantity')?.textContent || 
                                  activity.querySelector('Qty')?.textContent || '1'),
                clinician: activity.querySelector('Clinician')?.textContent || 
                          activity.querySelector('clinician')?.textContent || 
                          activity.querySelector('Doctor')?.textContent || 
                          activity.querySelector('Provider')?.textContent || 
                          activity.querySelector('OrderingClinician')?.textContent || 'N/A'
            };
            claims.push(claim);
        });
    });
    
    return claims;
}

// Display results in table
function displayResults(claims) {
    processedClaims = claims; // Store for filtering
    renderResults();
}

// Render results (with optional filtering)
function renderResults() {
    const claims = showOnlyInvalids ? 
        processedClaims.filter(claim => {
            const result = checkPriceMatch(claim);
            return result.status !== 'Match';
        }) : 
        processedClaims;
    
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    
    let matchCount = 0;
    let mismatchCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    claims.forEach(claim => {
        const result = checkPriceMatch(claim);
        const row = tbody.insertRow();
        
        // Apply row styling based on match status
        if (result.status === 'Match') {
            row.className = 'match-success';
            matchCount++;
        } else if (result.status === 'Not Found') {
            row.className = 'match-warning';
            notFoundCount++;
        } else if (result.status === 'Error') {
            row.className = 'match-error';
            errorCount++;
        } else {
            row.className = 'match-danger';
            mismatchCount++;
        }
        
        row.innerHTML = `
            <td>${claim.claimId}</td>
            <td>${claim.type}</td>
            <td>${claim.code}</td>
            <td>${result.category || 'N/A'}</td>
            <td>${claim.net.toFixed(2)}</td>
            <td>${claim.quantity}</td>
            <td>${claim.clinician}</td>
            <td>${result.expectedPrice !== null ? result.expectedPrice.toFixed(2) : 'N/A'}</td>
            <td>${result.matchedModifier || 'N/A'}</td>
            <td><span class="badge ${result.status === 'Match' ? 'bg-success' : result.status === 'Not Found' ? 'bg-warning' : result.status === 'Error' ? 'bg-dark' : 'bg-danger'}">${result.status}</span></td>
        `;
    });
    
    // Show summary (always show total from all claims)
    const allMatchCount = processedClaims.filter(c => checkPriceMatch(c).status === 'Match').length;
    const allMismatchCount = processedClaims.filter(c => checkPriceMatch(c).status === 'Mismatch').length;
    const allNotFoundCount = processedClaims.filter(c => checkPriceMatch(c).status === 'Not Found').length;
    const allErrorCount = processedClaims.filter(c => checkPriceMatch(c).status === 'Error').length;
    
    const summaryDiv = document.getElementById('summarySection');
    summaryDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Summary:</strong> 
            Total Claims: ${processedClaims.length} | 
            <span class="text-success">Matches: ${allMatchCount}</span> | 
            <span class="text-danger">Mismatches: ${allMismatchCount}</span> | 
            <span class="text-warning">Not Found: ${allNotFoundCount}</span>${allErrorCount > 0 ? ' | <span class="text-dark">Errors: ' + allErrorCount + '</span>' : ''}
            ${showOnlyInvalids ? ' <em>(Showing filtered results: ' + claims.length + ' items)</em>' : ''}
        </div>
    `;
    
    // Show results table (export button always visible)
    document.getElementById('resultsTable').style.display = 'block';
}

// Toggle invalid filter
function toggleInvalidFilter() {
    showOnlyInvalids = !showOnlyInvalids;
    const buttonText = document.getElementById('filterButtonText');
    buttonText.textContent = showOnlyInvalids ? 'All' : 'Invalids';
    
    if (processedClaims.length > 0) {
        renderResults();
    }
}

// Check if price matches with any modifier
function checkPriceMatch(claim) {
    const code = claim.code;
    const actualPrice = claim.net;
    const quantity = claim.quantity || 1;
    const codeType = getCodeType(code);
    
    // Check if code is 00000 - treat as error
    if (code === '00000') {
        return {
            status: 'Error',
            expectedPrice: null,
            matchedModifier: null,
            category: 'Invalid Code'
        };
    }
    
    // Check if code exists in price list and has basePrice
    if (!priceList[code] || !priceList[code].basePrice) {
        return {
            status: 'Not Found',
            expectedPrice: null,
            matchedModifier: null,
            category: codeType || 'Unknown'
        };
    }
    
    const basePrice = priceList[code].basePrice;
    const codeModifiers = getModifiersForCode(code);
    
    // If no modifiers can be applied to this code, treat as valid
    if (!codeModifiers) {
        const expectedPricePerUnit = basePrice;
        const expectedPriceTotal = expectedPricePerUnit * quantity;
        
        // Allow small tolerance for floating point comparison
        if (Math.abs(actualPrice - expectedPriceTotal) < 0.01) {
            return {
                status: 'Match',
                expectedPrice: expectedPriceTotal,
                matchedModifier: 'No modifier (default)',
                category: 'No Category'
            };
        } else {
            return {
                status: 'Mismatch',
                expectedPrice: expectedPriceTotal,
                matchedModifier: null,
                category: 'No Category'
            };
        }
    }
    
    // Try to match with each modifier type (thiqa, lowEnd, basic)
    const modifierTypes = [
        { name: 'Thiqa', value: codeModifiers.thiqa },
        { name: 'Low-End', value: codeModifiers.lowEnd },
        { name: 'Basic', value: codeModifiers.basic }
    ];
    
    for (let modType of modifierTypes) {
        const expectedPricePerUnit = basePrice * modType.value;
        const expectedPriceTotal = expectedPricePerUnit * quantity;
        
        // Allow small tolerance for floating point comparison
        if (Math.abs(actualPrice - expectedPriceTotal) < 0.01) {
            return {
                status: 'Match',
                expectedPrice: expectedPriceTotal,
                matchedModifier: `${modType.name} (${modType.value})`,
                category: codeType
            };
        }
    }
    
    // No match found
    return {
        status: 'Mismatch',
        expectedPrice: basePrice * codeModifiers.thiqa * quantity,
        matchedModifier: null,
        category: codeType
    };
}

// Export results to Excel
function exportToExcel() {
    if (!processedClaims || processedClaims.length === 0) {
        alert('No processed claims to export');
        return;
    }
    
    // Prepare data for export
    const exportData = processedClaims.map(claim => {
        const result = checkPriceMatch(claim);
        return {
            'Claim ID': claim.claimId,
            'Type': claim.type,
            'Code': claim.code,
            'Category': result.category || 'N/A',
            'NET': claim.net,
            'Quantity': claim.quantity,
            'Clinician': claim.clinician,
            'Expected Price': result.expectedPrice !== null ? result.expectedPrice : 'N/A',
            'Modifier': result.matchedModifier || 'N/A',
            'Status': result.status
        };
    });
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Claims Results');
    
    // Generate file name with timestamp
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,'-');
    const filename = `Claims_Results_${timestamp}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, filename);
}
