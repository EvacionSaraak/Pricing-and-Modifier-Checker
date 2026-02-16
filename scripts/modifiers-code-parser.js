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
    
    // Check format of the file by examining headers
    const headers = data[0];
    const firstHeader = String(headers[0] || '').trim().toLowerCase();
    const secondHeader = String(headers[1] || '').trim().toLowerCase();
    
    // Detect format type
    let isCodeModifierFormat = false; // Format: Code | Modifier Type (e.g., "10040" | "25 Modifiers")
    let isModifierCodeFormat = false; // Format: Modifier | Code (e.g., "25" | "10040")
    
    // Check if it's the Code-Modifier format (like the uploaded Modifiers.xlsx)
    if (secondHeader.includes('modifier') || data.length > 1 && String(data[1][1] || '').toLowerCase().includes('modifier')) {
        isCodeModifierFormat = true;
    } else if (firstHeader.includes('modifier') || firstHeader === 'modifier') {
        isModifierCodeFormat = true;
    }
    
    // Build modifier-to-codes mapping
    const modifierMap = {
        '25': [],
        '50': [],
        '24': [],
        '52': []
    };
    
    if (isCodeModifierFormat) {
        // Format: Column A = Code, Column B = Modifier Type
        // Example: 10040 | "25 Modifiers"
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const code = String(row[0] || '').trim();
            const modifierText = String(row[1] || '').trim().toLowerCase();
            
            if (!code || !modifierText) continue;
            
            // Parse modifier text to extract modifier numbers
            if (modifierText.includes('25')) {
                if (!modifierMap['25'].includes(code)) {
                    modifierMap['25'].push(code);
                }
            }
            if (modifierText.includes('50')) {
                if (!modifierMap['50'].includes(code)) {
                    modifierMap['50'].push(code);
                }
            }
            if (modifierText.includes('24')) {
                if (!modifierMap['24'].includes(code)) {
                    modifierMap['24'].push(code);
                }
            }
            if (modifierText.includes('52')) {
                if (!modifierMap['52'].includes(code)) {
                    modifierMap['52'].push(code);
                }
            }
        }
    } else {
        // Format: Column A = Modifier, Column B = Code  
        // Example: 25 | 10040
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const modifier = String(row[0] || '').trim();
            const code = String(row[1] || '').trim();
            
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
    }
    
    return modifierMap;
}
