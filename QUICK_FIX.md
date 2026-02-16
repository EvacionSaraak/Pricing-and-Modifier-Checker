# Quick Fix Guide - "Only 1 Row" Issue

## Step 1: Hard Refresh (MOST IMPORTANT!)

Your browser might be using old JavaScript. Do a hard refresh:

- **Windows (Chrome/Edge/Firefox):** `Ctrl` + `Shift` + `R`
- **Mac (Chrome/Edge/Firefox):** `Cmd` + `Shift` + `R`  
- **Mac (Safari):** `Cmd` + `Option` + `R`

## Step 2: Verify Latest Version

Open browser console (F12) and look for:

```
🔧 Modifiers UI Script Loaded - Version 2.1.0 - 2026-02-16...
```

**If version is NOT 2.1.0 → You have cached code! Repeat Step 1.**

## Step 3: Run Your Test

Upload files and click "Run Check". You should see:

```
✅ Modifier records found: 2    ← Should match your expected count
✅ All activities found: X
✅ Validation results: 2 records
...
Rows rendered: 2, Rows skipped by filter: 0
```

## Troubleshooting

### See Only 1 Record?

Check the console line:
```
✅ Modifier records found: 1
```

**If it shows 1** → Your XML file only has 1 modifier observation. Check your XML:
- Does it have 2 `<Observation>` elements with `ValueType="Modifiers"`?

### See 2 Records But Only 1 Row?

Check the console line:
```
Rows rendered: 1, Rows skipped by filter: 1
```

**If 1 was skipped** → A status filter is disabled!
- Look at the colored badges above the table
- Is one dimmed/crossed out?
- Click it to re-enable

### See Alert Dialog?

An alert dialog means there's an error. Read the error message and check console for details.

### Console Stops After "First 500 chars"?

This means JavaScript crashed. Look for red error messages in console or an alert dialog.

## Still Having Issues?

See `DEBUGGING_GUIDE.md` for comprehensive troubleshooting, or provide:
1. Script version from console
2. Full console output
3. Screenshot of results table
