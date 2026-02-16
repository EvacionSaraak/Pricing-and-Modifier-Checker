// modifiers-validator.js
// Validates CPT modifiers against eligibility data

function validateModifiers(xmlRecords, eligibilityData, allActivities, modifierCodesMap) {
    const validatedRecords = [];
    
    // Build a map of claim activities for modifier 25 checking
    const claimActivitiesMap = buildClaimActivitiesMap(allActivities || []);
    
    for (let record of xmlRecords) {
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
        } else if (record.modifier === '25') {
            // Modifier 25 validation - check if it's properly applied
            const modifier25Check = checkModifier25Requirement(record, claimActivitiesMap, modifierCodesMap);
            if (!modifier25Check.valid) {
                validationResult.isValid = false;
                validationResult.remarks.push(modifier25Check.message);
            }
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

// Build a map of activities by claim ID for easy lookup
function buildClaimActivitiesMap(allActivities) {
    const map = {};
    for (const activity of allActivities) {
        if (!map[activity.claimID]) {
            map[activity.claimID] = [];
        }
        map[activity.claimID].push(activity);
    }
    return map;
}

// Check if modifier 25 is required for the given record
function checkModifier25Requirement(record, claimActivitiesMap, modifierCodesMap) {
    // Main procedure codes that require modifier 25 validation
    const MAIN_PROCEDURE_CODES = new Set([
        '99202', '99203', '99212', '99213',
        '92002', '92004', '92012', '92014'
    ]);
    
    // Get all activities for this claim
    const claimActivities = claimActivitiesMap[record.claimID] || [];
    
    // Check if any main procedure code has amount > 0
    let hasMainProcedure = false;
    for (const activity of claimActivities) {
        if (MAIN_PROCEDURE_CODES.has(activity.code) && activity.amount > 0) {
            hasMainProcedure = true;
            break;
        }
    }
    
    if (!hasMainProcedure) {
        // No main procedure code found, modifier 25 is not required
        // But if it's present anyway, that's acceptable (no validation error)
        return { valid: true };
    }
    
    // If no modifier codes map provided, we can't validate the requirement
    // Accept modifier 25 as valid since we can't determine if it's truly needed
    if (!modifierCodesMap || !modifierCodesMap['25']) {
        return { valid: true };
    }
    
    // Get the list of codes that require modifier 25 and convert to Set for O(1) lookup
    const modifier25Codes = new Set(modifierCodesMap['25'] || []);
    
    // If the config is empty (no codes specified), accept modifier 25 as valid
    if (modifier25Codes.size === 0) {
        return { valid: true };
    }
    
    // Check if any activity has a code that's in the modifier 25 list AND has amount > 0
    let hasModifier25Activity = false;
    for (const activity of claimActivities) {
        if (modifier25Codes.has(activity.code) && activity.amount > 0) {
            hasModifier25Activity = true;
            break;
        }
    }
    
    if (!hasModifier25Activity) {
        // Modifier 25 is present but not required (no qualifying activity codes found)
        // According to the requirements, modifier 25 should only be present when both conditions are met
        return { 
            valid: false, 
            message: 'Modifier 25 present but not required (no qualifying activity codes with amount > 0)' 
        };
    }
    
    // Both conditions met: main procedure with amount > 0 AND modifier 25 activity with amount > 0
    // Modifier 25 is correctly applied
    return { valid: true };
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
