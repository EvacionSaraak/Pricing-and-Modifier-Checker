// modifiers-ui.js
// UI handling for CPT Modifiers Validation Checker

let modifierValidationResults = [];

// Main function to run the modifier check
async function runModifierCheck() {
    const xmlFile = document.getElementById('modifierXmlFile').files[0];
    const excelFile = document.getElementById('modifierExcelFile').files[0];
    
    // Validate file selection
    if (!xmlFile || !excelFile) {
        showModifierStatus('Please select both XML and Excel files', 'danger');
        return;
    }
    
    try {
        showModifierStatus('Processing files...', 'info');
        
        // Read XML file
        const xmlContent = await readFileAsText(xmlFile);
        const xmlRecords = parseModifierXML(xmlContent);
        
        if (xmlRecords.length === 0) {
            showModifierStatus('No modifier records found in XML file', 'warning');
            return;
        }
        
        // Read Excel file
        const excelContent = await readFileAsBinary(excelFile);
        const eligibilityData = parseModifierExcel(excelContent);
        
        if (Object.keys(eligibilityData.index).length === 0) {
            showModifierStatus('No eligibility records found in Excel file', 'warning');
            return;
        }
        
        // Validate records
        modifierValidationResults = validateModifiers(xmlRecords, eligibilityData);
        
        if (modifierValidationResults.length === 0) {
            showModifierStatus('No records matched the filter criteria (PayerID A001 or E001)', 'warning');
            return;
        }
        
        // Display results
        displayModifierResults(modifierValidationResults);
        
        // Enable download button
        document.getElementById('downloadModifierResultsBtn').disabled = false;
        
        // Show success message with stats
        const stats = getValidationStats(modifierValidationResults);
        showModifierStatus(
            `Processing complete! Total: ${stats.total}, Valid: ${stats.valid}, Invalid: ${stats.invalid}`,
            'success'
        );
        
    } catch (error) {
        console.error('Error processing files:', error);
        showModifierStatus(`Error: ${error.message}`, 'danger');
    }
}

// Display results in table
function displayModifierResults(results) {
    const tbody = document.getElementById('modifierResultsBody');
    tbody.innerHTML = '';
    
    for (let record of results) {
        const row = document.createElement('tr');
        row.className = record.isValid ? 'valid-row' : 'invalid-row';
        
        row.innerHTML = `
            <td>${escapeHtml(record.claimID)}</td>
            <td>${escapeHtml(record.memberID)}</td>
            <td>${escapeHtml(record.activityID)}</td>
            <td>${escapeHtml(record.clinician)}</td>
            <td>${escapeHtml(record.code)}</td>
            <td>${escapeHtml(record.modifier)}</td>
            <td>${escapeHtml(record.voi)}</td>
            <td>${escapeHtml(record.payerID)}</td>
            <td>${escapeHtml(record.remarks)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewEligibilityDetails(${results.indexOf(record)})">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
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
                <div class="alert ${record.isValid ? 'alert-success' : 'alert-danger'}">
                    <strong>${record.isValid ? 'VALID' : 'INVALID'}</strong>
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
            'Status': record.isValid ? 'VALID' : 'INVALID',
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
