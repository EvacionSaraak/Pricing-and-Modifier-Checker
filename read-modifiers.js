const fs = require('fs');
const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('Modifiers.xlsx');
    console.log('Sheet names:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n=== Sheet: ${sheetName} ===`);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log('Total rows:', data.length);
        console.log('\nFirst 20 rows:');
        data.slice(0, 20).forEach((row, idx) => {
            console.log(`Row ${idx}:`, row);
        });
    });
} catch (error) {
    console.error('Error:', error.message);
    // Try in browser environment
    console.log('\nNode.js XLSX not available, the file can be read in browser');
}
