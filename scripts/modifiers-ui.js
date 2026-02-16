// modifiers-ui.js
// UI handling for CPT Modifiers Validation Checker

// Debug logging flag - set to true to enable detailed console logging
const DEBUG_MODIFIER_UI = true;

let modifierValidationResults = [];

// Status filter state - track which statuses are enabled
let statusFilters = {
    valid: true,
    invalid: true,
    unknown: true
};

// Loading screen functions
function showLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Toggle status filter
function toggleStatusFilter(status) {
    // Toggle the filter state
    statusFilters[status] = !statusFilters[status];
    
    // Update badge visual state
    const badgeId = `filter${status.charAt(0).toUpperCase() + status.slice(1)}Badge`;
    const badge = document.getElementById(badgeId);
    
    if (badge) {
        if (statusFilters[status]) {
            badge.classList.remove('disabled');
        } else {
            badge.classList.add('disabled');
        }
    }
    
    // Re-display results with new filter
    displayModifierResults(modifierValidationResults);
}

// Main function to run the modifier check
async function runModifierCheck() {
    const xmlFile = document.getElementById('modifierXmlFile').files[0];
    const excelFile = document.getElementById('modifierExcelFile').files[0];
    const modifierCodesFile = document.getElementById('modifierCodesFile').files[0];
    
    if (DEBUG_MODIFIER_UI) {
        console.log('=== Run Modifier Check Started ===');
        console.log('XML File:', xmlFile ? xmlFile.name : 'Not selected');
        console.log('Excel File:', excelFile ? excelFile.name : 'Not selected');
        console.log('Modifier Codes File:', modifierCodesFile ? modifierCodesFile.name : 'Not selected');
    }
    
    // Validate file selection
    if (!xmlFile || !excelFile) {
        showModifierStatus('Please select both XML and Excel eligibility files', 'danger');
        return;
    }
    
    try {
        // Show loading screen
        showLoadingScreen();
        
        showModifierStatus('Processing files...', 'info');
        
        // Read XML file
        if (DEBUG_MODIFIER_UI) {
            console.log('\n--- Reading XML file ---');
        }
        const xmlContent = await readFileAsText(xmlFile);
        
        if (DEBUG_MODIFIER_UI) {
            console.log('XML content length:', xmlContent.length);
            console.log('First 500 chars:', xmlContent.substring(0, 500));
        }
        
        let xmlRecords;
        try {
            xmlRecords = parseModifierXML(xmlContent);
            if (DEBUG_MODIFIER_UI) {
                console.log(`\nModifier records found: ${xmlRecords.length}`);
                if (xmlRecords.length > 0) {
                    console.log('First record:', xmlRecords[0]);
                }
            }
        } catch (parseError) {
            console.error('Error parsing XML for modifier records:', parseError);
            throw parseError; // Re-throw to be caught by outer try-catch
        }
        
        if (xmlRecords.length === 0) {
            if (DEBUG_MODIFIER_UI) {
                console.warn('⚠️ No modifier records found in XML file');
            }
            hideLoadingScreen();
            showModifierStatus('No modifier records found in XML file. Total claims parsed: 0', 'warning');
            return;
        }
        
        // Parse all activities from XML for modifier 25 checking
        if (DEBUG_MODIFIER_UI) {
            console.log('\n--- Parsing all activities ---');
        }
        let allActivities;
        try {
            allActivities = parseAllActivities(xmlContent);
            if (DEBUG_MODIFIER_UI) {
                console.log(`All activities found: ${allActivities.length}`);
                if (allActivities.length > 0) {
                    console.log('Sample activities:', allActivities.slice(0, 3));
                }
            }
        } catch (parseError) {
            console.error('Error parsing XML for all activities:', parseError);
            throw parseError; // Re-throw to be caught by outer try-catch
        }
        
        // Read Excel file
        if (DEBUG_MODIFIER_UI) {
            console.log('\n--- Reading Excel eligibility file ---');
        }
        const excelContent = await readFileAsBinary(excelFile);
        const eligibilityData = parseModifierExcel(excelContent);
        
        const eligibilityCount = Object.keys(eligibilityData.index).length;
        
        if (DEBUG_MODIFIER_UI) {
            console.log(`Eligibility records found: ${eligibilityCount}`);
        }
        
        if (eligibilityCount === 0) {
            hideLoadingScreen();
            showModifierStatus(`No eligibility records found in Excel file. Total claims parsed: ${xmlRecords.length}, Total eligibilities: 0`, 'warning');
            return;
        }
        
        // Read modifier codes file if provided
        let modifierCodesMap = null;
        if (modifierCodesFile) {
            if (DEBUG_MODIFIER_UI) {
                console.log('\n--- Reading Modifier Codes file ---');
            }
            try {
                const modifierCodesContent = await readFileAsBinary(modifierCodesFile);
                modifierCodesMap = parseModifierCodesExcel(modifierCodesContent);
                
                if (DEBUG_MODIFIER_UI) {
                    console.log('Modifier codes map loaded:', modifierCodesMap);
                }
            } catch (error) {
                console.warn('Error parsing modifier codes file:', error);
                showModifierStatus(`Warning: Could not parse modifier codes file. Continuing without it. Error: ${error.message}`, 'warning');
            }
        }
        
        // Validate records
        if (DEBUG_MODIFIER_UI) {
            console.log('\n--- Validating modifier records ---');
        }
        modifierValidationResults = validateModifiers(xmlRecords, eligibilityData, allActivities, modifierCodesMap);
        
        if (DEBUG_MODIFIER_UI) {
            console.log(`Validation results: ${modifierValidationResults.length} records`);
        }
        
        if (modifierValidationResults.length === 0) {
            hideLoadingScreen();
            showModifierStatus(`No records found after validation. Total claims parsed: ${xmlRecords.length}, Total eligibilities: ${eligibilityCount}`, 'warning');
            return;
        }
        
        // Display results
        displayModifierResults(modifierValidationResults);
        
        // Enable download button
        document.getElementById('downloadModifierResultsBtn').disabled = false;
        
        // Show success message with stats
        const stats = getValidationStats(modifierValidationResults);
        showModifierStatus(
            `Processing complete! Total: ${stats.total}, Valid: ${stats.valid}, Invalid: ${stats.invalid}, Unknown: ${stats.unknown}`,
            'success'
        );
        
        // Hide loading screen
        hideLoadingScreen();
        
    } catch (error) {
        console.error('Error processing files:', error);
        console.error('Error stack:', error.stack);
        hideLoadingScreen();
        showModifierStatus(`Error: ${error.message}`, 'danger');
    }
}

// Display results in table
function displayModifierResults(results) {
    const tbody = document.getElementById('modifierResultsBody');
    tbody.innerHTML = '';
    
    if (DEBUG_MODIFIER_UI) {
        console.log('\n=== displayModifierResults ===');
        console.log(`Total results to display: ${results.length}`);
        console.log('First 3 results:', results.slice(0, 3).map(r => ({
            claimID: r.claimID,
            memberID: r.memberID,
            modifier: r.modifier,
            isValid: r.isValid
        })));
    }
    
    // Remove the old checkbox filter
    const filterInvalidOnly = false; // Deprecated - using new badge filters instead
    
    // Track displayed claim IDs per status (for deduplication)
    const displayedClaimIDs = {
        'valid': new Set(),
        'invalid': new Set(),
        'unknown': new Set()
    };
    
    // Count records by status
    const statusCounts = {
        valid: 0,
        invalid: 0,
        unknown: 0
    };
    
    // First pass: count all records by status
    for (let i = 0; i < results.length; i++) {
        const record = results[i];
        if (record.isValid === true) {
            statusCounts.valid++;
        } else if (record.isValid === 'unknown') {
            statusCounts.unknown++;
        } else {
            statusCounts.invalid++;
        }
    }
    
    if (DEBUG_MODIFIER_UI) {
        console.log('Status counts:', statusCounts);
        console.log('Status filters:', statusFilters);
    }
    
    // Update count badges
    document.getElementById('validCount').textContent = statusCounts.valid;
    document.getElementById('invalidCount').textContent = statusCounts.invalid;
    document.getElementById('unknownCount').textContent = statusCounts.unknown;
    
    let rowsRendered = 0;
    let rowsSkippedByFilter = 0;
    
    for (let i = 0; i < results.length; i++) {
        const record = results[i];
        
        // Determine status for tracking
        let status;
        if (record.isValid === true) {
            status = 'valid';
        } else if (record.isValid === 'unknown') {
            status = 'unknown';
        } else {
            status = 'invalid';
        }
        
        // Apply status filter - skip if this status is disabled
        if (!statusFilters[status]) {
            rowsSkippedByFilter++;
            if (DEBUG_MODIFIER_UI && i < 5) {
                console.log(`Row ${i}: Skipped by filter (status=${status})`);
            }
            continue;
        }
        
        // Check if claim ID already displayed for this status
        const claimID = record.claimID;
        const shouldDisplayClaimID = !displayedClaimIDs[status].has(claimID);
        
        // Mark this claim ID as displayed for this status
        if (shouldDisplayClaimID) {
            displayedClaimIDs[status].add(claimID);
        }
        
        const row = document.createElement('tr');
        // Use Bootstrap table classes for color-coding
        if (record.isValid === true) {
            row.className = 'table-success';
        } else if (record.isValid === 'unknown') {
            row.className = 'table-warning';
        } else {
            row.className = 'table-danger';
        }
        
        row.innerHTML = `
            <td>${shouldDisplayClaimID ? escapeHtml(record.claimID) : ''}</td>
            <td>${escapeHtml(record.memberID)}</td>
            <td>${escapeHtml(record.activityID)}</td>
            <td>${escapeHtml(record.clinician)}</td>
            <td>${escapeHtml(record.code)}</td>
            <td>${escapeHtml(record.modifier)}</td>
            <td>${escapeHtml(record.voi)}</td>
            <td>${escapeHtml(record.payerID)}</td>
            <td>${escapeHtml(record.remarks)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewEligibilityDetails(${i})">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        rowsRendered++;
    }
    
    if (DEBUG_MODIFIER_UI) {
        console.log(`Rows rendered: ${rowsRendered}, Rows skipped by filter: ${rowsSkippedByFilter}`);
        console.log('=== End displayModifierResults ===\n');
    }
    
    // Show results container
    document.getElementById('modifierResultsContainer').style.display = 'block';
}

// View eligibility details in modal
function viewEligibilityDetails(index) {
    const record = modifierValidationResults[index];
    const modalBody = document.getElementById('eligibilityModalBody');
    
    let content = `
        <div class="row">
            <div class="col-md-6">
                <h6>Claim Information</h6>
                <table class="table table-sm table-bordered">
                    <tr><td><strong>Claim ID:</strong></td><td>${escapeHtml(record.claimID)}</td></tr>
                    <tr><td><strong>Member ID:</strong></td><td>${escapeHtml(record.memberID)}</td></tr>
                    <tr><td><strong>Activity ID:</strong></td><td>${escapeHtml(record.activityID)}</td></tr>
                    <tr><td><strong>Payer ID:</strong></td><td>${escapeHtml(record.payerID)}</td></tr>
                    <tr><td><strong>Clinician:</strong></td><td>${escapeHtml(record.clinician)}</td></tr>
                    <tr><td><strong>Date:</strong></td><td>${escapeHtml(record.date)}</td></tr>
                    <tr><td><strong>Code:</strong></td><td>${escapeHtml(record.code)}</td></tr>
                    <tr><td><strong>Modifier:</strong></td><td>${escapeHtml(record.modifier)}</td></tr>
                    <tr><td><strong>VOI Value:</strong></td><td>${escapeHtml(record.voi)}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Eligibility Information</h6>
    `;
    
    if (record.eligibility) {
        content += `
                <table class="table table-sm table-bordered">
                    <tr><td><strong>Member ID:</strong></td><td>${escapeHtml(record.eligibility.memberID)}</td></tr>
                    <tr><td><strong>Original Member ID:</strong></td><td>${escapeHtml(record.eligibility.originalMemberID)}</td></tr>
                    <tr><td><strong>Date:</strong></td><td>${escapeHtml(record.eligibility.date)}</td></tr>
                    <tr><td><strong>Clinician:</strong></td><td>${escapeHtml(record.eligibility.clinician)}</td></tr>
                    <tr><td><strong>VOI Number:</strong></td><td>${escapeHtml(record.eligibility.voiNumber)}</td></tr>
                    <tr><td><strong>Match Key:</strong></td><td><small>${escapeHtml(record.matchKey)}</small></td></tr>
                </table>
        `;
    } else {
        content += `
                <div class="alert alert-warning">
                    <strong>No eligibility match found</strong>
                    <p class="mb-0 mt-2"><small>Search Key: ${escapeHtml(record.matchKey)}</small></p>
                </div>
        `;
    }
    
    content += `
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <h6>Validation Status</h6>
                <div class="alert ${record.isValid === true ? 'alert-success' : (record.isValid === 'unknown' ? 'alert-warning' : 'alert-danger')}">
                    <strong>${record.isValid === true ? 'VALID' : (record.isValid === 'unknown' ? 'UNKNOWN' : 'INVALID')}</strong>
                    <p class="mb-0 mt-2">${escapeHtml(record.remarks)}</p>
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = content;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('eligibilityModal'));
    modal.show();
}

// Download results as Excel
function downloadModifierResults() {
    if (modifierValidationResults.length === 0) {
        showModifierStatus('No results to download', 'warning');
        return;
    }
    
    try {
        // Prepare data for Excel export
        const exportData = modifierValidationResults.map(record => ({
            'Claim ID': record.claimID,
            'Member ID': record.memberID,
            'Activity ID': record.activityID,
            'Clinician': record.clinician,
            'Code': record.code,
            'Modifier': record.modifier,
            'VOI': record.voi,
            'Payer ID': record.payerID,
            'Date': record.date,
            'Normalized Date': record.normalizedDate,
            'Status': record.isValid === true ? 'VALID' : (record.isValid === 'unknown' ? 'UNKNOWN' : 'INVALID'),
            'Remarks': record.remarks,
            'Eligibility Match': record.eligibility ? 'Yes' : 'No',
            'VOI Number': record.eligibility ? record.eligibility.voiNumber : ''
        }));
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Modifier Validation Results');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `Modifier_Validation_Results_${timestamp}.xlsx`;
        
        // Download file
        XLSX.writeFile(wb, filename);
        
        showModifierStatus('Results downloaded successfully', 'success');
        
    } catch (error) {
        console.error('Error downloading results:', error);
        showModifierStatus(`Error downloading results: ${error.message}`, 'danger');
    }
}

// Show status message
function showModifierStatus(message, type) {
    const statusBox = document.getElementById('modifierStatusBox');
    statusBox.className = `alert alert-${type}`;
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusBox.style.display = 'none';
        }, 5000);
    }
}

// File reading utilities
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function readFileAsBinary(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const arr = [];
            for (let i = 0; i < data.length; i++) {
                arr.push(String.fromCharCode(data[i]));
            }
            resolve(arr.join(''));
        };
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// HTML escape utility
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Get validation statistics
function getValidationStats(results) {
    const stats = {
        total: results.length,
        valid: 0,
        invalid: 0,
        unknown: 0
    };
    
    results.forEach(record => {
        if (record.isValid === true) {
            stats.valid++;
        } else if (record.isValid === 'unknown') {
            stats.unknown++;
        } else {
            stats.invalid++;
        }
    });
    
    return stats;
}

// Initialize resize handle for sidebar
function initializeResizeHandle() {
    const resizeHandle = document.getElementById('resizeHandle');
    const sidebar = document.getElementById('leftSidebar');
    
    if (!resizeHandle || !sidebar) return;
    
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeResizeHandle();
});
