// modifiers-validator.js
// Validates CPT modifiers against eligibility data

function validateModifiers(xmlRecords, eligibilityData) {
    const validatedRecords = [];
    
    for (let record of xmlRecords) {
        // Filter: Keep only PayerID "A001" or "E001"
        if (record.payerID !== 'A001' && record.payerID !== 'E001') {
            continue;
        }
        
        // Build matching key
        const normalizedMemberID = normalizeMemberID(record.memberID);
        const normalizedDate = normalizeDate(record.date);
        const key = `${normalizedMemberID}|${normalizedDate}|${record.clinician}`;
        
        // Perform validation checks
        const validationResult = {
            ...record,
            normalizedMemberID: normalizedMemberID,
            normalizedDate: normalizedDate,
            matchKey: key,
            isValid: true,
            remarks: []
        };
        
        // Check 1: Code must equal "CPT modifier"
        if (record.code.toLowerCase() !== 'cpt modifier') {
            validationResult.isValid = false;
            validationResult.remarks.push(`Code is "${record.code}", expected "CPT modifier"`);
        }
        
        // Check 2: Modifier 24 needs VOI_D, Modifier 52 needs VOI_EF1
        if (record.modifier === '24' && record.value !== 'VOI_D' && record.value !== '24') {
            validationResult.isValid = false;
            validationResult.remarks.push(`Modifier 24 requires VOI_D or 24, found "${record.value}"`);
        } else if (record.modifier === '52' && record.value !== 'VOI_EF1' && record.value !== '52') {
            validationResult.isValid = false;
            validationResult.remarks.push(`Modifier 52 requires VOI_EF1 or 52, found "${record.value}"`);
        }
        
        // Check 3: Eligibility match must exist
        const eligibilityMatch = eligibilityData.index[key];
        if (!eligibilityMatch) {
            validationResult.isValid = false;
            validationResult.remarks.push('No eligibility match found');
            validationResult.eligibility = null;
        } else {
            validationResult.eligibility = eligibilityMatch;
        }
        
        // Set final remarks as string
        if (validationResult.isValid) {
            validationResult.remarks = 'Valid';
        } else {
            validationResult.remarks = validationResult.remarks.join('; ');
        }
        
        validatedRecords.push(validationResult);
    }
    
    return validatedRecords;
}

// Get validation statistics
function getValidationStats(validatedRecords) {
    const stats = {
        total: validatedRecords.length,
        valid: 0,
        invalid: 0,
        modifier24: 0,
        modifier52: 0,
        payerA001: 0,
        payerE001: 0
    };
    
    for (let record of validatedRecords) {
        if (record.isValid) {
            stats.valid++;
        } else {
            stats.invalid++;
        }
        
        if (record.modifier === '24') {
            stats.modifier24++;
        } else if (record.modifier === '52') {
            stats.modifier52++;
        }
        
        if (record.payerID === 'A001') {
            stats.payerA001++;
        } else if (record.payerID === 'E001') {
            stats.payerE001++;
        }
    }
    
    return stats;
}
