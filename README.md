# Pricing Checker - Daman Thiqa

A web-based pricing checker application for validating medical claims pricing against standard pricelists with configurable modifiers.

## Features

- **Price List Management**: Upload XLSX pricelists or use default JSON-based prices
- **Configurable Modifiers**: Adjust pricing modifiers (e.g., 1.0, 1.3) for different plan types
- **XML Claims Processing**: Parse and validate XML claim files
- **Price Validation**: Automatically compare claim prices against expected prices with modifiers
- **Visual Results**: Color-coded table showing matches, mismatches, and codes not found

## Usage

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

## File Structure

- `index.html` - Main application page
- `default-prices.json` - Default price list (JSON format)
- `sample-claims.xml` - Sample XML claims file for testing

## Price List Format

### JSON Format (default-prices.json)
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

### XLSX Format
| Code | Name | Thiqa | High-end | Mid-range | Low-End | Basic |
|------|------|-------|----------|-----------|---------|-------|
| CODE001 | Service 1 | 100.00 | 100.00 | 100.00 | 100.00 | 100.00 |

## XML Claims Format

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

## Deployment

This application is designed for GitHub Pages:
1. Ensure `index.html` is in the root directory
2. Enable GitHub Pages in repository settings
3. Select the branch to deploy
4. Access via: `https://[username].github.io/[repository-name]/`