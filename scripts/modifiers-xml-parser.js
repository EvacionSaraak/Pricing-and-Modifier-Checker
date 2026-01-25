// modifiers-xml-parser.js
// Parses XML file to extract CPT modifier data

function parseModifierXML(xmlContent) {
    // Preprocess XML to replace unescaped & with "and" for parseability
    const cleanedXml = xmlContent.replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;))/g, "and");
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXml, "text/xml");
    
    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
        throw new Error('Invalid XML: ' + (parseError.textContent || 'parse error').trim());
    }
    
    const results = [];
    const claims = Array.from(xmlDoc.getElementsByTagName('Claim'));
    
    claims.forEach(claim => {
        const claimID = getTextValue(claim, 'ID');
        const payerID = getTextValue(claim, 'PayerID');
        const memberIDRaw = getTextValue(claim, 'MemberID');
        
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
        
        // Loop through Activity tags
        const activities = Array.from(claim.getElementsByTagName('Activity'));
        activities.forEach(activity => {
            const activityID = getTextValue(activity, 'ID');
            
            // Try different variations of OrderingClinician tag
            const clinician = firstNonEmpty([
                getTextValue(activity, 'OrderingClnician'),
                getTextValue(activity, 'OrderingClinician'),
                getTextValue(activity, 'Ordering_Clinician'),
                getTextValue(activity, 'OrderingClin')
            ]).trim().toUpperCase();
            
            // Loop through Observation tags
            const observations = Array.from(activity.getElementsByTagName('Observation'));
            observations.forEach(observation => {
                const code = getTextValue(observation, 'Code');
                const voiVal = getTextValue(observation, 'Value') || 
                              getTextValue(observation, 'ValueText') || '';
                const valueType = getTextValue(observation, 'ValueType') || '';
                
                // Only accept observations with ValueType of "Modifiers"
                if (!valueType || valueType.trim().toLowerCase() !== 'modifiers') {
                    return;
                }
                
                // Only accept valid VOI values
                let modifier = '';
                const voiNorm = (voiVal || '').toUpperCase().replace(/[_\s]/g, '');
                if (voiNorm === 'VOID' || voiNorm === '24') {
                    modifier = '24';
                } else if (voiNorm === 'VOIEF1' || voiNorm === '52') {
                    modifier = '52';
                } else {
                    return; // skip anything else
                }
                
                results.push({
                    claimID: claimID,
                    memberID: normalizeMemberID(memberIDRaw),
                    activityID: activityID,
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
    
    // Deduplicate rows based on key
    const seen = new Set();
    return results.filter(r => {
        const key = [r.claimID, r.activityID, r.memberID, r.modifier, r.code].join('|');
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

// Helper function to get text value from a child element
function getTextValue(node, tagName) {
    if (!node) return '';
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
        const date = new Date(Number(year), monthMap[monthName] ?? 0, Number(day));
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
