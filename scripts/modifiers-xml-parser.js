// modifiers-xml-parser.js
// Parses XML file to extract CPT modifier data

// Debug logging flag - set to true to enable detailed console logging
const DEBUG_MODIFIER_PARSING = true;

function parseModifierXML(xmlContent) {
    if (DEBUG_MODIFIER_PARSING) {
        console.log('=== Starting XML Parsing ===');
        console.log('XML Content Length:', xmlContent.length);
    }
    
    // Preprocess XML to replace unescaped & with "and" for parseability
    const cleanedXml = xmlContent.replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;))/g, "and");
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXml, "text/xml");
    
    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
        if (DEBUG_MODIFIER_PARSING) {
            console.error('XML Parse Error:', parseError.textContent);
        }
        throw new Error('Invalid XML: ' + (parseError.textContent || 'parse error').trim());
    }
    
    const results = [];
    const claims = Array.from(xmlDoc.getElementsByTagName('Claim'));
    
    if (DEBUG_MODIFIER_PARSING) {
        console.log(`Found ${claims.length} Claim elements in XML`);
    }
    
    claims.forEach((claim, claimIndex) => {
        const claimID = getTextValue(claim, 'ID');
        const payerID = getTextValue(claim, 'PayerID');
        const memberIDRaw = getTextValue(claim, 'MemberID');
        
        if (DEBUG_MODIFIER_PARSING) {
            console.log(`\n--- Claim ${claimIndex + 1} ---`);
            console.log('  Claim ID:', claimID || '(empty)');
            console.log('  Payer ID:', payerID || '(empty)');
            console.log('  Member ID:', memberIDRaw || '(empty)');
        }
        
        // Get Encounter node - try both "Encounter" and "Encounte" (typo variation)
        const encNode = claim.getElementsByTagName('Encounter')[0] || 
                       claim.getElementsByTagName('Encounte')[0];
        
        // Get date from various possible tags in Encounter
        const encDateRaw = encNode ? (
            getTextValue(encNode, 'Date') || 
            getTextValue(encNode, 'Start') || 
            getTextValue(encNode, 'EncounterDate') || 
            ''
        ) : '';
        const encDate = normalizeDate(encDateRaw);
        
        if (DEBUG_MODIFIER_PARSING) {
            console.log('  Encounter Date:', encDate || '(empty)');
        }
        
        // Loop through Activity tags
        const activities = Array.from(claim.getElementsByTagName('Activity'));
        
        if (DEBUG_MODIFIER_PARSING) {
            console.log(`  Found ${activities.length} Activity elements`);
        }
        
        activities.forEach((activity, activityIndex) => {
            const activityID = getTextValue(activity, 'ID');
            const activityCode = extractActivityCode(activity);
            const activityAmount = extractActivityAmount(activity);
            
            // Try different variations of OrderingClinician tag
            const clinician = firstNonEmpty([
                getTextValue(activity, 'OrderingClnician'),
                getTextValue(activity, 'OrderingClinician'),
                getTextValue(activity, 'Ordering_Clinician'),
                getTextValue(activity, 'OrderingClin')
            ]).trim().toUpperCase();
            
            if (DEBUG_MODIFIER_PARSING) {
                console.log(`    Activity ${activityIndex + 1}:`);
                console.log('      Activity ID:', activityID || '(empty)');
                console.log('      Activity Code:', activityCode || '(empty)');
                console.log('      Activity Amount:', activityAmount);
                console.log('      Clinician:', clinician || '(empty)');
            }
            
            // Loop through Observation tags
            const observations = Array.from(activity.getElementsByTagName('Observation'));
            
            if (DEBUG_MODIFIER_PARSING) {
                console.log(`      Found ${observations.length} Observation elements`);
            }
            
            observations.forEach((observation, obsIndex) => {
                const code = getTextValue(observation, 'Code');
                const voiVal = getTextValue(observation, 'Value') || 
                              getTextValue(observation, 'ValueText') || '';
                const valueType = getTextValue(observation, 'ValueType') || '';
                
                if (DEBUG_MODIFIER_PARSING) {
                    console.log(`        Observation ${obsIndex + 1}:`);
                    console.log('          Code:', code || '(empty)');
                    console.log('          Value:', voiVal || '(empty)');
                    console.log('          ValueType:', valueType || '(empty)');
                }
                
                // Only accept observations with ValueType of "Modifiers"
                if (!valueType || valueType.trim().toLowerCase() !== 'modifiers') {
                    if (DEBUG_MODIFIER_PARSING) {
                        console.log('          ❌ Skipped: ValueType is not "Modifiers"');
                    }
                    return;
                }
                
                // Only accept valid VOI values
                let modifier = '';
                const voiNorm = (voiVal || '').toUpperCase().replace(/[_\s]/g, '');
                if (voiNorm === 'VOID' || voiNorm === '24') {
                    modifier = '24';
                } else if (voiNorm === 'VOIEF1' || voiNorm === '52') {
                    modifier = '52';
                } else if (voiNorm === '25' || voiNorm === 'VOI25') {
                    modifier = '25';
                } else {
                    if (DEBUG_MODIFIER_PARSING) {
                        console.log(`          ❌ Skipped: Invalid modifier value "${voiNorm}"`);
                    }
                    return; // skip anything else
                }
                
                if (DEBUG_MODIFIER_PARSING) {
                    console.log(`          ✅ Added modifier record: ${modifier}`);
                }
                
                results.push({
                    claimID: claimID,
                    memberID: normalizeMemberID(memberIDRaw),
                    activityID: activityID,
                    activityCode: activityCode,
                    activityAmount: activityAmount,
                    payerID: payerID,
                    clinician: clinician,
                    date: encDate,
                    modifier: modifier,
                    code: code,
                    value: voiVal,
                    voi: voiVal
                });
            });
        });
    });
    
    if (DEBUG_MODIFIER_PARSING) {
        console.log(`\n=== Parsing Complete ===`);
        console.log(`Total modifier records before deduplication: ${results.length}`);
    }
    
    // Deduplicate rows based on key
    const seen = new Set();
    const dedupedResults = results.filter(r => {
        const key = [r.claimID, r.activityID, r.memberID, r.modifier, r.code].join('|');
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
    
    if (DEBUG_MODIFIER_PARSING) {
        console.log(`Total modifier records after deduplication: ${dedupedResults.length}`);
        console.log('=== End XML Parsing ===\n');
    }
    
    return dedupedResults;
}

// Helper function to get text value from a child element or attribute
// First checks for an attribute with the given name, then checks for a child element
function getTextValue(node, tagName) {
    if (!node) return '';
    
    // Try to get as attribute first (check if methods exist to avoid errors)
    if (node.getAttribute && node.hasAttribute && node.hasAttribute(tagName)) {
        return String(node.getAttribute(tagName) || '').trim();
    }
    
    // Fall back to child element
    const element = node.getElementsByTagName(tagName)[0];
    return element ? String(element.textContent || '').trim() : '';
}

// Helper function to return first non-empty string from array
function firstNonEmpty(arr) {
    for (const s of arr) {
        if (s !== undefined && s !== null && String(s).trim() !== '') {
            return String(s).trim();
        }
    }
    return '';
}

// Helper function to normalize date to YYYY-MM-DD format
function normalizeDate(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    
    // Remove time portion if present
    const dateOnly = s.split(' ')[0].trim();
    
    // Check for DD/MM/YYYY or DD-MM-YYYY (day-first)
    let match = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
        let [, day, month, year] = match;
        if (year.length === 2) {
            year = String(2000 + Number(year));
        }
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(date.getTime())) {
            return toYMD(date);
        }
    }
    
    // Check for DD-MMM-YYYY e.g., 11-Aug-2025
    match = dateOnly.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
    if (match) {
        let [, day, monthName, year] = match;
        const monthMap = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        const monthIndex = monthMap[monthName] !== undefined ? monthMap[monthName] : 0;
        const date = new Date(Number(year), monthIndex, Number(day));
        if (!isNaN(date.getTime())) {
            return toYMD(date);
        }
    }
    
    // Try ISO/parseable numeric date
    const timestamp = Date.parse(dateOnly);
    if (!isNaN(timestamp)) {
        return toYMD(new Date(timestamp));
    }
    
    return dateOnly; // fallback (unchanged)
}

// Helper to format date as YYYY-MM-DD
function toYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to remove leading zeros from member ID
function normalizeMemberID(memberID) {
    if (!memberID) return '';
    return String(memberID).replace(/^0+/, '').trim() || '0';
}

// Helper function to extract activity code from an Activity node
function extractActivityCode(activity) {
    return firstNonEmpty([
        getTextValue(activity, 'Code'),
        getTextValue(activity, 'ActivityCode')
    ]).trim();
}

// Helper function to extract activity amount from an Activity node
function extractActivityAmount(activity) {
    return parseFloat(firstNonEmpty([
        getTextValue(activity, 'NetAmount'),
        getTextValue(activity, 'Net'),
        getTextValue(activity, 'Amount')
    ]) || '0');
}

// Parse XML to extract all activities with their codes and amounts
// This is used for modifier 25 validation
function parseAllActivities(xmlContent) {
    if (DEBUG_MODIFIER_PARSING) {
        console.log('=== Starting parseAllActivities ===');
    }
    
    // Preprocess XML to replace unescaped & with "and" for parseability
    const cleanedXml = xmlContent.replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;))/g, "and");
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXml, "text/xml");
    
    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
        if (DEBUG_MODIFIER_PARSING) {
            console.error('XML Parse Error in parseAllActivities:', parseError.textContent);
        }
        throw new Error('Invalid XML: ' + (parseError.textContent || 'parse error').trim());
    }
    
    const activities = [];
    const claims = Array.from(xmlDoc.getElementsByTagName('Claim'));
    
    if (DEBUG_MODIFIER_PARSING) {
        console.log(`Found ${claims.length} claims for activity extraction`);
    }
    
    claims.forEach((claim, claimIndex) => {
        const claimID = getTextValue(claim, 'ID');
        const payerID = getTextValue(claim, 'PayerID');
        
        // Loop through Activity tags
        const activityNodes = Array.from(claim.getElementsByTagName('Activity'));
        
        if (DEBUG_MODIFIER_PARSING) {
            console.log(`  Claim ${claimIndex + 1}: ${activityNodes.length} activities`);
        }
        
        activityNodes.forEach((activity, actIdx) => {
            const activityID = getTextValue(activity, 'ID');
            const activityCode = extractActivityCode(activity);
            const activityAmount = extractActivityAmount(activity);
            
            if (activityCode) {
                activities.push({
                    claimID: claimID,
                    activityID: activityID,
                    code: activityCode,
                    amount: activityAmount,
                    payerID: payerID
                });
                
                if (DEBUG_MODIFIER_PARSING) {
                    console.log(`    Activity ${actIdx + 1}: Code=${activityCode}, Amount=${activityAmount}`);
                }
            } else if (DEBUG_MODIFIER_PARSING) {
                console.log(`    Activity ${actIdx + 1}: No code found, skipped`);
            }
        });
    });
    
    if (DEBUG_MODIFIER_PARSING) {
        console.log(`Total activities extracted: ${activities.length}`);
        console.log('=== End parseAllActivities ===\n');
    }
    
    return activities;
}
