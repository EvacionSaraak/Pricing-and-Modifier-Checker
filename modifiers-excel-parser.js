// modifiers-excel-parser.js
// Parses Excel file to extract eligibility data and build index

function parseModifierExcel(fileData) {
    const workbook = XLSX.read(fileData, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    if (data.length < 2) {
        throw new Error('Excel file is empty or has no data rows');
    }
    
    // Find column indices
    const headers = data[0];
    const cardNumberCol = findColumnIndex(headers, ['Card Number', 'DHA Member ID']);
    const orderedOnCol = findColumnIndex(headers, ['Ordered On']);
    const clinicianCol = findColumnIndex(headers, ['Clinician']);
    const voiNumberCol = findColumnIndex(headers, ['VOI Number']);
    
    if (cardNumberCol === -1 || orderedOnCol === -1 || clinicianCol === -1 || voiNumberCol === -1) {
        throw new Error('Required columns not found in Excel file. Expected: Card Number/DHA Member ID, Ordered On, Clinician, VOI Number');
    }
    
    // Build eligibility index
    const eligibilityIndex = {};
    const eligibilityRecords = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const memberID = normalizeMemberID(String(row[cardNumberCol] || ''));
        const orderedOn = normalizeDate(row[orderedOnCol]);
        const clinician = String(row[clinicianCol] || '').trim();
        const voiNumber = String(row[voiNumberCol] || '').trim();
        
        if (!memberID || !orderedOn || !clinician) continue;
        
        // Create key: MemberID|Date|Clinician
        const key = `${memberID}|${orderedOn}|${clinician}`;
        
        const record = {
            memberID: memberID,
            date: orderedOn,
            clinician: clinician,
            voiNumber: voiNumber,
            originalMemberID: String(row[cardNumberCol] || ''),
            originalDate: row[orderedOnCol]
        };
        
        eligibilityRecords.push(record);
        eligibilityIndex[key] = record;
    }
    
    return {
        index: eligibilityIndex,
        records: eligibilityRecords
    };
}

// Helper function to find column index by possible names
function findColumnIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i] || '').trim();
        for (let name of possibleNames) {
            if (header.toLowerCase() === name.toLowerCase()) {
                return i;
            }
        }
    }
    return -1;
}

// Helper to parse Excel date serial number
function parseExcelDate(excelDate) {
    if (typeof excelDate === 'string') {
        return excelDate;
    }
    
    if (typeof excelDate === 'number') {
        // Excel date serial number (days since 1900-01-01)
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date;
    }
    
    return excelDate;
}
