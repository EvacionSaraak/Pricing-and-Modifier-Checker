# Pricing and Modifier Checker - Daman Thiqa

A web-based application for validating medical claims pricing and CPT modifiers against standard pricelists and eligibility data.

## Features

### Pricing Tab
- **Price List Management**: Upload XLSX pricelists or use default JSON-based prices
- **Configurable Modifiers**: Adjust pricing modifiers (e.g., 1.0, 1.3) for different plan types
- **XML Claims Processing**: Parse and validate XML claim files
- **Price Validation**: Automatically compare claim prices against expected prices with modifiers
- **Visual Results**: Color-coded table showing matches, mismatches, and codes not found

### Modifiers Tab (CPT Modifiers Validation Checker)
- **XML Claims Parsing**: Extract CPT modifier information from medical claims
- **Excel Eligibility Matching**: Match claims against eligibility data
- **Comprehensive Validation**: Three-tier validation checks
  - Code must equal "CPT modifier"
  - Modifier-VOI compatibility (24→VOI_D, 52→VOI_EF1)
  - Eligibility record must exist
- **PayerID Filtering**: Process only A001 and E001 payers
- **Color-Coded Results**: Green rows for valid, red rows for invalid
- **Eligibility Details Modal**: View detailed matching information
- **Excel Export**: Download validation results

## Usage

### Pricing Tab

1. **Set Up Modifiers** (Left Sidebar):
   - Default modifiers include: Thiqa (1.0), High-end (1.3), Mid-range (1.2), Low-End (1.1), Basic (1.0)
   - Modify values as needed
   - Add or remove modifiers using the buttons

2. **Upload Price List**:
   - Click the "Price List" tab
   - Upload an XLSX file with columns: Code, Name, Thiqa, High-end, Mid-range, Low-End, Basic
   - Alternatively, modify `default-prices.json` and click "Load Default Prices"

3. **Upload XML Claims**:
   - Select an XML file containing claims data
   - See `sample-claims.xml` for the expected format

4. **Process**:
   - Click "Process Claims" button
   - View results in the table below with color-coded status

### Modifiers Tab

1. **Upload Files**:
   - **XML Claims File**: Medical claims containing CPT modifier observations
   - **Excel Eligibility File**: Eligibility data with columns:
     - Card Number / DHA Member ID
     - Ordered On
     - Clinician
     - VOI Number
   - **Modifier Codes File** (Optional): Excel file mapping modifiers to activity codes
     - Column 1: Modifier (e.g., 25, 50)
     - Column 2: Code (activity codes that require this modifier)
     - Used for modifier 25 validation (see below)

2. **Run Check**:
   - Click "Run Check" button
   - System will:
     - Parse XML for modifier records
     - Build eligibility index from Excel
     - Match using key: `MemberID|Date|Clinician`
     - Validate all records
     - Filter by PayerID (A001, E001)
     - Check modifier 25 requirements if configured

3. **View Results**:
   - Green rows = Valid (all checks passed)
   - Red rows = Invalid (one or more checks failed)
   - Click "View" button to see eligibility details

4. **Export**:
   - Click "Download Results" to export validation results as Excel

## File Structure

### Core Files
- `index.html` - Main application page
- `script.js` - Pricing tab functionality
- `styles.css` - Application styling
- `default-prices.json` - Default price list (JSON format)
- `sample-claims.xml` - Sample XML claims file for testing

### Modifiers Feature Files
- `modifiers-xml-parser.js` - XML parsing for CPT modifiers
- `modifiers-excel-parser.js` - Excel eligibility data parsing
- `modifiers-code-parser.js` - Modifier codes mapping parser
- `modifiers-validator.js` - Validation logic
- `modifiers-ui.js` - UI interactions and export
- `Modifier-Codes-Template.csv` - Template for modifier codes configuration file

## Data Formats

### Price List Format

#### JSON Format (default-prices.json)
```json
{
  "CODE": {
    "name": "Service Name",
    "thiqa": 100.00,
    "highEnd": 100.00,
    "midRange": 100.00,
    "lowEnd": 100.00,
    "basic": 100.00
  }
}
```

#### XLSX Format
| Code | Name | Thiqa | High-end | Mid-range | Low-End | Basic |
|------|------|-------|----------|-----------|---------|-------|
| CODE001 | Service 1 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |

### XML Claims Format (Pricing)

```xml
<Claims>
    <Claim>
        <ClaimID>CLAIM-001</ClaimID>
        <Type>Inpatient</Type>
        <Service>
            <Code>CODE001</Code>
            <Net>130.00</Net>
            <Quantity>1</Quantity>
            <Clinician>Dr. Name</Clinician>
        </Service>
    </Claim>
</Claims>
```

### XML Claims Format (Modifiers)

The parser supports **flexible XML formats** - both attribute-based and element-based syntax:

**Attribute-based format (recommended):**
```xml
<Claims>
    <Claim ID="CLAIM-001" PayerID="A001" MemberID="0012345">
        <Encounter Start="2024-01-15"/>
        <Activity ID="ACT-001" OrderingClinician="Dr. Smith">
            <Observation ValueType="Modifiers" Code="CPT modifier" Value="VOI_D"/>
        </Activity>
    </Claim>
</Claims>
```

**Element-based format (also supported):**
```xml
<Claims>
    <Claim>
        <ID>CLAIM-001</ID>
        <PayerID>A001</PayerID>
        <MemberID>0012345</MemberID>
        <Encounter>
            <Start>2024-01-15</Start>
        </Encounter>
        <Activity>
            <ID>ACT-001</ID>
            <OrderingClinician>Dr. Smith</OrderingClinician>
            <Observation>
                <ValueType>Modifiers</ValueType>
                <Code>CPT modifier</Code>
                <Value>VOI_D</Value>
            </Observation>
        </Activity>
    </Claim>
</Claims>
```

**Note:** You can also use a mixed format (some attributes, some elements).

### Excel Eligibility Format

| Card Number / DHA Member ID | Ordered On | Clinician | VOI Number |
|----------------------------|------------|-----------|------------|
| 0012345 | 2024-01-15 | Dr. Smith | VOI123 |

## How Price Matching Works

The application compares each claim's NET price against the expected price calculated as:
```
Expected Price = Base Price × Modifier
```

For example:
- Base Price: 90.00
- Modifier: 1.3 (High-end)
- Expected Price: 90.00 × 1.3 = 117.00

The claim NET amount is compared against all possible modifier combinations. If a match is found (within 0.01 tolerance), the claim is marked as "Match".

## Modifier Validation Rules

The CPT Modifiers Validation Checker performs the following checks:

1. **Code Check**: `Code` attribute must equal "CPT modifier"
2. **Modifier-VOI Compatibility**:
   - Modifier 24 requires Value "VOI_D" or "24"
   - Modifier 52 requires Value "VOI_EF1" or "52"
   - Modifier 25 validation (see below)
3. **Eligibility Match**: Must find matching record using:
   - Member ID (normalized, leading zeros removed)
   - Date (YYYY-MM-DD format)
   - Clinician name
   
**Filter**: Only processes records with PayerID "A001" or "E001"

### Modifier 25 Validation

Modifier 25 is used to identify a significant, separately identifiable evaluation and management (E/M) service by the same physician on the same day of a procedure or other service.

**Requirements**:
- Main procedure codes: 99202, 99203, 99212, 99213, 92002, 92004, 92012, 92014
- If one of these codes has an amount > 0 AND an activity code listed in the Modifier Codes file also has amount > 0, then modifier 25 should be present

**Configuration**:
Upload a Modifier Codes Excel file with the following structure:

| Modifier | Code |
|----------|------|
| 25 | CODE1 |
| 25 | CODE2 |
| 50 | CODE3 |

The system validates that modifier 25 is correctly applied when both conditions are met.

## Deployment

This application is designed for GitHub Pages:
1. Ensure `index.html` is in the root directory
2. Enable GitHub Pages in repository settings
3. Select the branch to deploy
4. Access via: `https://[username].github.io/[repository-name]/`