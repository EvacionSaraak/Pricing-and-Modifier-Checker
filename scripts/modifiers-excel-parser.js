// modifiers-excel-parser.js
// Parses Excel file to extract eligibility data and build index

function parseModifierExcel(fileData) {
    const workbook = XLSX.read(fileData, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Read with range starting from row 2 (index 1) where headers are located
    const data = XLSX.utils.sheet_to_json(firstSheet, { 
        header: 1,
        range: 1  // Start from row 2 (0-indexed, so 1 = row 2)
    });
    
    if (data.length < 2) {
        throw new Error('Excel file is empty or has no data rows');
    }
    
    // Headers are now in data[0] (which is the second row of the Excel file)
    const headers = data[0];
    
    // Find column indices - look for the exact column name with slash
    const cardNumberCol = findColumnIndex(headers, ['Card Number / DHA Member ID', 'Card Number', 'DHA Member ID']);
    const orderedOnCol = findColumnIndex(headers, ['Ordered On']);
    const clinicianCol = findColumnIndex(headers, ['Clinician']);
    const voiNumberCol = findColumnIndex(headers, ['VOI Number']);
    
    if (cardNumberCol === -1 || orderedOnCol === -1 || clinicianCol === -1 || voiNumberCol === -1) {
        throw new Error('Required columns not found in Excel file. Expected: Card Number / DHA Member ID, Ordered On, Clinician, VOI Number');
    }
    
    // Build eligibility index
    const eligibilityIndex = {};
    const eligibilityRecords = [];
    
    // Start from row 1 (data rows start after headers)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const memberIDRaw = String(row[cardNumberCol] || '');
        const memberID = normalizeMemberID(memberIDRaw);
        const orderedOn = normalizeDate(row[orderedOnCol]);
        const clinician = String(row[clinicianCol] || '').trim().toUpperCase();
        const voiNumber = String(row[voiNumberCol] || '').trim();
        
        if (!memberID || !orderedOn || !clinician) continue;
        
        // Create key: MemberID|Date|Clinician
        const key = `${memberID}|${orderedOn}|${clinician}`;
        
        const record = {
            memberID: memberID,
            date: orderedOn,
            clinician: clinician,
            voiNumber: voiNumber,
            originalMemberID: memberIDRaw,
            originalDate: row[orderedOnCol]
        };
        
        eligibilityRecords.push(record);
        
        // Store in index - allow multiple records with same key
        if (!eligibilityIndex[key]) {
            eligibilityIndex[key] = [];
        }
        eligibilityIndex[key].push(record);
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
