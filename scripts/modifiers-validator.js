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
        
        // Check 2: Eligibility match must exist (do this first to get VOI)
        const eligibilityMatches = eligibilityData.index[key];
        let eligibilityMatch = null;
        
        if (eligibilityMatches && eligibilityMatches.length > 0) {
            // Find first unused eligibility record
            eligibilityMatch = eligibilityMatches.find(e => !e._used);
            if (eligibilityMatch) {
                eligibilityMatch._used = true; // Mark as used
            } else {
                // All matches already used, just use the first one
                eligibilityMatch = eligibilityMatches[0];
            }
        }
        
        if (!eligibilityMatch) {
            validationResult.isValid = false;
            validationResult.remarks.push('No eligibility match found');
            validationResult.eligibility = null;
        } else {
            validationResult.eligibility = eligibilityMatch;
        }
        
        // Check 3: Modifier VOI compatibility
        // Use VOI from eligibility data if available, otherwise fall back to XML observation value
        let voiToCheck = '';
        if (eligibilityMatch && eligibilityMatch.voiNumber) {
            voiToCheck = String(eligibilityMatch.voiNumber).trim();
        } else {
            voiToCheck = record.value || '';
        }
        
        const voiNorm = normalizeVOI(voiToCheck);
        if (record.modifier === '24' && voiNorm !== 'VOID' && voiNorm !== '24') {
            validationResult.isValid = false;
            validationResult.remarks.push(`Modifier 24 does not match VOI (expected VOI_D)`);
        } else if (record.modifier === '52' && voiNorm !== 'VOIEF1' && voiNorm !== '52') {
            validationResult.isValid = false;
            validationResult.remarks.push(`Modifier 52 does not match VOI (expected VOI_EF1)`);
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

// Helper to normalize VOI for comparison
function normalizeVOI(voi) {
    return String(voi || '').toUpperCase().replace(/[_\s]/g, '');
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
