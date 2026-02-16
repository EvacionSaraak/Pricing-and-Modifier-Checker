// modifiers-validator.js
// Validates CPT modifiers against eligibility data

function validateModifiers(xmlRecords, eligibilityData, allActivities, modifierCodesMap) {
    const validatedRecords = [];
    
    // Build a map of claim activities for modifier 25 checking
    const claimActivitiesMap = buildClaimActivitiesMap(allActivities || []);
    
    // Check for missing modifier 25 requirements
    const missingModifier25 = checkForMissingModifier25(claimActivitiesMap, xmlRecords, modifierCodesMap);
    
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
        
        // Check 2: Eligibility match (required for all modifiers)
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
            // Check if PayerID is E001 or D001
            if (record.payerID === 'E001' || record.payerID === 'D001') {
                // For E001 and D001, no eligibility match is invalid
                validationResult.isValid = false;
                validationResult.remarks.push('No eligibility match found');
            } else {
                // For other PayerIDs, mark as unknown instead of invalid
                validationResult.isValid = 'unknown';
                validationResult.remarks.push('Unknown status (PayerID not E001 or D001)');
            }
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
            const modifier25Check = checkModifier25Requirement(record, claimActivitiesMap);
            if (!modifier25Check.valid) {
                validationResult.isValid = false;
                validationResult.remarks.push(modifier25Check.message);
            }
        }
        
        // Set final remarks as string
        if (validationResult.isValid === true) {
            validationResult.remarks = 'Valid';
        } else if (validationResult.isValid === 'unknown') {
            validationResult.remarks = validationResult.remarks.join('; ');
        } else {
            validationResult.remarks = validationResult.remarks.join('; ');
        }
        
        validatedRecords.push(validationResult);
    }
    
    // Add validation records for claims that are MISSING modifier 25 when they should have it
    for (const missingRecord of missingModifier25) {
        validatedRecords.push(missingRecord);
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

// Check for claims that are MISSING modifier 25 when they should have it
function checkForMissingModifier25(claimActivitiesMap, xmlRecords, modifierCodesMap) {
    const MAIN_PROCEDURE_CODES = new Set([
        '99202', '99203', '99212', '99213',
        '92002', '92004', '92012', '92014'
    ]);
    
    const missingRecords = [];
    
    // If no modifier codes map provided, we can't determine which codes require modifier 25
    // So we don't flag any missing modifiers (safer to avoid false positives)
    if (!modifierCodesMap || !modifierCodesMap['25'] || modifierCodesMap['25'].length === 0) {
        return missingRecords;
    }
    
    // Build a Set of codes that require modifier 25 from the Modifiers.xlsx file
    const modifier25RequiredCodes = new Set(modifierCodesMap['25']);
    
    // Build a set of claimIDs that already have modifier 25
    const claimsWithModifier25 = new Set();
    for (const record of xmlRecords) {
        if (record.modifier === '25') {
            claimsWithModifier25.add(record.claimID);
        }
    }
    
    // Check each claim to see if it needs modifier 25
    for (const [claimID, activities] of Object.entries(claimActivitiesMap)) {
        // Skip if this claim already has modifier 25
        if (claimsWithModifier25.has(claimID)) {
            continue;
        }
        
        // Check if any main procedure code has amount > 0
        let hasMainProcedure = false;
        let mainProcedureActivity = null;
        for (const activity of activities) {
            if (MAIN_PROCEDURE_CODES.has(activity.code) && activity.amount > 0) {
                hasMainProcedure = true;
                mainProcedureActivity = activity;
                break;
            }
        }
        
        if (!hasMainProcedure) {
            continue; // No main procedure, modifier 25 not relevant
        }
        
        // Check if OTHER activities that are in the modifier 25 list have amount > 0
        // This is the key change: only check for codes that are in Modifiers.xlsx Column A with "25" in Column B
        let hasOtherActivitiesRequiringModifier25 = false;
        for (const activity of activities) {
            if (!MAIN_PROCEDURE_CODES.has(activity.code) && 
                activity.amount > 0 &&
                modifier25RequiredCodes.has(activity.code)) {
                hasOtherActivitiesRequiringModifier25 = true;
                break;
            }
        }
        
        if (hasOtherActivitiesRequiringModifier25) {
            // This claim NEEDS modifier 25 but doesn't have it
            // Create a validation record for this missing modifier
            // Note: We don't have memberID, date, clinician from activities, so these remain empty
            // The claimID and activityID provide enough context for tracking
            missingRecords.push({
                claimID: claimID,
                activityID: mainProcedureActivity.activityID,
                payerID: mainProcedureActivity.payerID,
                code: 'CPT modifier',
                value: '25',
                modifier: '25',
                memberID: '',
                date: '',
                clinician: '',
                isValid: false,
                remarks: 'Modifier 25 required but missing',
                eligibility: null
            });
        }
    }
    
    return missingRecords;
}

// Check if modifier 25 is required for the given record
function checkModifier25Requirement(record, claimActivitiesMap) {
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
        // If modifier 25 is present anyway, that's an error (shouldn't be there)
        return { 
            valid: false, 
            message: 'Modifier 25 present but not required (no main procedure codes with amount > 0)' 
        };
    }
    
    // Check if OTHER activities (non-main procedure codes) have amount > 0
    let hasOtherActivities = false;
    for (const activity of claimActivities) {
        // Skip main procedure codes - we're looking for OTHER activities
        if (!MAIN_PROCEDURE_CODES.has(activity.code) && activity.amount > 0) {
            hasOtherActivities = true;
            break;
        }
    }
    
    if (!hasOtherActivities) {
        // Main procedure exists but no other activities with amount > 0
        // Modifier 25 is NOT required and should NOT be present
        return { 
            valid: false, 
            message: 'Modifier 25 present but not required (no other activities with amount > 0)' 
        };
    }
    
    // Both conditions met: main procedure with amount > 0 AND other activities with amount > 0
    // Modifier 25 is correctly applied
    return { valid: true };
}

// Get validation statistics
function getValidationStats(validatedRecords) {
    const stats = {
        total: validatedRecords.length,
        valid: 0,
        invalid: 0,
        unknown: 0,
        modifier24: 0,
        modifier52: 0,
        payerA001: 0,
        payerE001: 0
    };
    
    for (let record of validatedRecords) {
        if (record.isValid === true) {
            stats.valid++;
        } else if (record.isValid === 'unknown') {
            stats.unknown++;
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
