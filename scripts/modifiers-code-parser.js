// modifiers-code-parser.js
// Parses Excel file containing modifier-to-code mappings

function parseModifierCodesExcel(fileData) {
    const workbook = XLSX.read(fileData, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Read all data
    const data = XLSX.utils.sheet_to_json(firstSheet, { 
        header: 1,
        defval: ''
    });
    
    if (data.length < 1) {
        throw new Error('Modifier codes Excel file is empty');
    }
    
    // Expected format:
    // Modifier | Code
    // 25       | CODE1
    // 25       | CODE2
    // 50       | CODE3
    
    const headers = data[0];
    const modifierCol = findColumnIndex(headers, ['Modifier']);
    const codeCol = findColumnIndex(headers, ['Code']);
    
    if (modifierCol === -1 || codeCol === -1) {
        throw new Error('Required columns not found in Modifier Codes file. Expected: Modifier, Code');
    }
    
    // Build modifier-to-codes mapping
    const modifierMap = {
        '25': [],
        '50': [],
        '24': [],
        '52': []
    };
    
    // Start from row 1 (data rows start after headers)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const modifier = String(row[modifierCol] || '').trim();
        const code = String(row[codeCol] || '').trim();
        
        // Skip empty rows or rows without both modifier and code
        if (!modifier || !code) continue;
        
        // Initialize array for this modifier if it doesn't exist
        if (!modifierMap[modifier]) {
            modifierMap[modifier] = [];
        }
        
        // Add code to the modifier's list (avoid duplicates)
        if (!modifierMap[modifier].includes(code)) {
            modifierMap[modifier].push(code);
        }
    }
    
    return modifierMap;
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
