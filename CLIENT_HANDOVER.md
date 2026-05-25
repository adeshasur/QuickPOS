# QuickPOS Pro - Client Handover

## Delivery Package

Use this portable Windows package for client demo or pilot handover:

- `dist/QuickPOS-Pro-portable-win.zip`

To run:

1. Extract the ZIP to a normal folder, for example `C:\QuickPOS Pro`.
2. Open `QuickPOS Pro.exe` inside the extracted folder.
3. Log in with one of the default accounts below.

## Default Accounts

- Owner: `owner` / `owner@123`
- Cashier: `cashier1` / `cashier@123`

Change these passwords before real production use.

## Verified Software Checks

- JavaScript syntax check passed for all app files.
- `npm install` completed with `0 vulnerabilities`.
- Windows unpacked build completed in `dist/win-unpacked`.
- Portable ZIP package created successfully.

## Hardware Not Verified

Hardware was not available during finalization. These items must be tested at the client site:

- Thermal receipt printer print and reprint
- Barcode scanner input speed and focus behavior
- Cash drawer trigger, if used
- Scale barcode format, if used

## Pilot Checklist

Before full production handover, run one shop-floor pilot with:

- 20-50 normal bills
- Cash, card, credit, and split payment
- Hold bill and recall
- Return/refund
- GRN/add stock
- Low-stock notification
- Report PDF export
- Manual backup and restore check

If the pilot passes, the app is ready for client production use.
