// modifiers-xml-parser.js
// Parses XML file to extract CPT modifier data

function parseModifierXML(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    const results = [];
    const claims = xmlDoc.getElementsByTagName('Claim');
    
    for (let claim of claims) {
        const claimID = claim.getAttribute('ID') || '';
        const payerID = claim.getAttribute('PayerID') || '';
        const memberID = claim.getAttribute('MemberID') || '';
        
        // Get date from Encounter tag
        const encounters = claim.getElementsByTagName('Encounter');
        let encounterDate = '';
        if (encounters.length > 0) {
            encounterDate = encounters[0].getAttribute('Start') || '';
        }
        
        // Loop through Activity tags
        const activities = claim.getElementsByTagName('Activity');
        for (let activity of activities) {
            const activityID = activity.getAttribute('ID') || '';
            
            // Try different variations of OrderingClinician attribute
            let clinician = activity.getAttribute('OrderingClinician') || 
                          activity.getAttribute('OrderingClnician') || 
                          activity.getAttribute('Ordering_Clinician') || 
                          activity.getAttribute('OrderingClin') || '';
            
            // Loop through Observation tags
            const observations = activity.getElementsByTagName('Observation');
            for (let observation of observations) {
                const valueType = observation.getAttribute('ValueType') || '';
                
                // Skip if ValueType is not "Modifiers"
                if (valueType !== 'Modifiers') {
                    continue;
                }
                
                const code = observation.getAttribute('Code') || '';
                const value = observation.getAttribute('Value') || '';
                
                // Determine modifier based on Value
                let modifier = '';
                let voi = '';
                if (value === 'VOI_D' || value === '24') {
                    modifier = '24';
                    voi = value === 'VOI_D' ? 'VOI_D' : '24';
                } else if (value === 'VOI_EF1' || value === '52') {
                    modifier = '52';
                    voi = value === 'VOI_EF1' ? 'VOI_EF1' : '52';
                }
                
                // Only add if we found a valid modifier
                if (modifier) {
                    results.push({
                        claimID: claimID,
                        memberID: memberID,
                        activityID: activityID,
                        payerID: payerID,
                        clinician: clinician,
                        date: encounterDate,
                        modifier: modifier,
                        code: code,
                        value: value,
                        voi: voi
                    });
                }
            }
        }
    }
    
    return results;
}

// Helper function to normalize date to YYYY-MM-DD format
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (e) {
        return '';
    }
}

// Helper function to remove leading zeros from member ID
function normalizeMemberID(memberID) {
    if (!memberID) return '';
    return memberID.replace(/^0+/, '') || '0';
}
