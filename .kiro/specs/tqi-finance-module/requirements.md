# Requirements Document

## Introduction

The TQI Finance Module is an audit-grade expense management system integrated into the Talent Quest India (TQI) admin platform. It enables Super Admins to configure finance settings, release cluster-level advance amounts, and review/approve/export submitted finance reports. Cluster Admins use it to record session-wise expenses across Travel, Food, Stationery, and Other categories — attaching scanned or uploaded bills — and then submit the completed finance report to the Super Admin dashboard.

The module is implemented as a React/TypeScript frontend (TanStack Router + Zustand), a Node.js/Express backend, and a MySQL database. It follows the same resource pattern used by the existing attendance module.

---

## Glossary

- **Finance_Module**: The complete finance subsystem described in this document.
- **Super_Admin**: A platform user with the role "Super Admin" who configures finance settings, releases advances, and reviews/approves submissions.
- **Cluster_Admin**: A platform user with the role "Cluster Admin" who creates and submits finance entries for their assigned cluster.
- **Finance_Entry**: A single day-level finance submission that contains header metadata, expense tabs, attached bills, and a volunteer list.
- **Finance_Settings**: A persisted configuration record set by the Super Admin containing organisation details, approver info, and PDF footer/signature fields.
- **Advance**: A cash advance amount released by the Super Admin for a specific cluster before a session starts; it defines the budget ceiling from which Balance is computed.
- **Expense_Tab**: One of four categorised sections within a Finance_Entry — Travel, Food, Stationery, or Other.
- **Travel_Entry**: A single travel leg within the Travel expense tab, defined by From, To, volunteer count, and per-person amount.
- **Food_Entry**: A sub-entry within the Food expense tab for one meal type (Breakfast, Lunch, Dinner, or Refreshments), defined by count and amount.
- **Stationery_Entry**: An item-level row within the Stationery expense tab, defined by item name, quantity, and unit amount.
- **Other_Entry**: An optional expense row within the Other tab, defined by description and amount.
- **Bill**: A digital image of a physical receipt or ticket, attached to an expense row via upload or camera scan.
- **Bill_Scanner**: The in-app camera/upload pipeline that captures, crops, perspective-corrects, and attaches a bill image to an expense row.
- **Grand_Total**: The sum of all expense tab totals (Travel + Food + Stationery + Other) for a Finance_Entry.
- **Balance**: Advance Released minus Grand_Total for a Finance_Entry.
- **Finance_Dashboard**: The Super Admin view showing per-cluster advance, expense, balance, and submission summary cards.
- **Cluster_Finance_Dashboard**: The drill-down view from a cluster card showing day-level cards for that cluster.
- **Finance_Audit_View**: The read-only detail view of a single Finance_Entry showing the full expense table, volunteer list, bills, totals, advance, and balance.
- **Audit_PDF**: The printable/downloadable PDF generated from the Finance_Audit_View.
- **Draft**: A Finance_Entry that has been saved but not yet submitted (editable by Cluster_Admin).
- **Submitted**: A Finance_Entry that has been submitted by the Cluster_Admin; it is visible on the Finance_Dashboard and is no longer editable by the Cluster_Admin.
- **Approved**: A Finance_Entry that the Super_Admin has approved.
- **Rejected**: A Finance_Entry that the Super_Admin has rejected.
- **Locked**: A Finance_Entry that the Super_Admin has locked, preventing further changes.
- **SPOC**: Single Point of Contact — the admin or volunteer lead identified for a session.
- **Session_Day**: A numbered day (Day 1–8) within a cluster's session schedule.

---

## Requirements

---

### Requirement 1: Role-Based Access Control

**User Story:** As a platform administrator, I want role-based access control enforced on every finance action, so that each user can only perform the operations their role permits.

#### Acceptance Criteria

1. THE Finance_Module SHALL restrict the following actions to Super_Admin only: configure Finance_Settings, release Advance, approve a Finance_Entry, reject a Finance_Entry, lock a Finance_Entry, unlock a Finance_Entry, export PDF, export Excel.
2. THE Finance_Module SHALL restrict the following actions to Cluster_Admin only: create a Finance_Entry, add or edit expense rows within a Finance_Entry, upload or scan bills, save a Draft, and submit a Finance_Entry.
3. THE Finance_Module SHALL grant both Super_Admin and Cluster_Admin read access to Finance_Entry records, Finance_Dashboard data, bills, and balance information.
4. WHEN a user attempts an action not permitted by their role, THE Finance_Module SHALL return a permission-denied response and display an error message to the user.
5. WHEN a Finance_Entry status is "Submitted", "Approved", or "Locked", THE Finance_Module SHALL prevent the Cluster_Admin from editing or deleting that Finance_Entry.

---

### Requirement 2: Finance Settings Configuration

**User Story:** As a Super Admin, I want to configure organisation-level finance settings, so that all Cluster Admin finance forms automatically display the correct financer and organisation details.

#### Acceptance Criteria

1. THE Finance_Module SHALL provide a Finance_Settings form accessible only to Super_Admin containing the following fields: Name Of Financer, Finance Team Email, Approver Name, Approver Designation, Organisation Name, PDF Footer text, Signature Name, and Signature Designation.
2. THE Finance_Settings form SHALL provide Save, Update, and Reset buttons.
3. WHEN the Super_Admin saves or updates Finance_Settings, THE Finance_Module SHALL persist the settings to the database and return the saved record.
4. WHEN a Cluster_Admin opens a new Finance_Entry form, THE Finance_Module SHALL auto-populate the Financer Name field from the most recently saved Finance_Settings record.
5. WHEN no Finance_Settings record exists, THE Finance_Module SHALL display a default financer name of "TQI Finance Team" in the Cluster_Admin form.
6. WHEN the Super_Admin clicks Reset in the Finance_Settings form, THE Finance_Module SHALL clear all fields in the Finance_Settings form without saving to the database.

---

### Requirement 3: Advance Management

**User Story:** As a Super Admin, I want to release a cluster-level advance amount before a session starts, so that Cluster Admins have a defined budget ceiling and the system can compute the balance automatically.

#### Acceptance Criteria

1. THE Finance_Module SHALL allow the Super_Admin to create an Advance record with the following fields: Cluster (selected from existing clusters), Advance Amount (positive decimal), and Released Date.
2. WHEN the Super_Admin saves an Advance record, THE Finance_Module SHALL persist it to the database linked to the specified cluster.
3. THE Finance_Module SHALL display advance records in the Finance_Dashboard per cluster.
4. THE Finance_Module SHALL prevent the Cluster_Admin from editing or deleting any Advance record.
5. WHEN a Finance_Entry is submitted for a cluster that has an Advance record, THE Finance_Module SHALL use the Advance Amount as the reference value for Balance calculation.
6. WHEN multiple Advance records exist for the same cluster, THE Finance_Module SHALL use the most recently released Advance Amount for Balance calculation.

---

### Requirement 4: Cluster Admin Finance Entry — Header Auto-Fill

**User Story:** As a Cluster Admin, I want the finance form header fields pre-populated from system data, so that I do not need to manually re-enter information that the system already knows.

#### Acceptance Criteria

1. WHEN a Cluster_Admin opens a new Finance_Entry form, THE Finance_Module SHALL auto-populate the following header fields: Cluster Name (from the admin's assigned cluster), College Name (from the admin's profile or associated college), Session Name (from the session record matching the selected Session_Day), Date (from the session record matching the selected Session_Day), SPOC Name (from the admin's profile name), and Financer Name (from Finance_Settings).
2. THE Finance_Module SHALL allow the Cluster_Admin to override the Date and Session Name fields if the auto-populated values are incorrect.
3. WHEN the Cluster_Admin changes the Session_Day selector, THE Finance_Module SHALL update the Session Name and Date fields to match the newly selected Session_Day.
4. THE Finance_Module SHALL provide an editable "No. of Volunteers" field in the header; this field SHALL default to 0.
5. WHEN the Cluster_Admin opens the Finance_Entry form, THE Finance_Module SHALL display the Cluster Name, College Name, SPOC Name, and Financer Name as read-only display values; these SHALL NOT be editable text inputs.

---

### Requirement 5: Travel Expense Tab

**User Story:** As a Cluster Admin, I want to record travel expenses for each leg of the journey, so that exact reimbursement amounts can be audited per route and volunteer count.

#### Acceptance Criteria

1. THE Finance_Module SHALL allow the Cluster_Admin to add one or more Travel_Entry rows to the Travel tab.
2. EACH Travel_Entry SHALL contain the following fields: From (text), To (text), No. of Volunteers (integer), Per Person Amount (decimal), and optional Remarks (text).
3. WHEN the Cluster_Admin enters or changes the "No. of Volunteers" or "Per Person Amount" values in a Travel_Entry, THE Finance_Module SHALL immediately compute and display the row total as (No. of Volunteers × Per Person Amount) without requiring a save action.
4. THE Finance_Module SHALL display the Travel Total as the sum of all Travel_Entry row totals.
5. THE Finance_Module SHALL allow the Cluster_Admin to attach one or more Bills to each Travel_Entry using the Bill_Scanner (Upload or Scan buttons).
6. THE Finance_Module SHALL allow the Cluster_Admin to remove any Travel_Entry row.

---

### Requirement 6: Food Expense Tab

**User Story:** As a Cluster Admin, I want to record food expenses for each meal type separately, so that the audit trail shows exactly how much was spent per meal category.

#### Acceptance Criteria

1. THE Finance_Module SHALL present four fixed food sub-categories in the Food tab: Breakfast, Lunch, Dinner, and Refreshments.
2. EACH Food_Entry SHALL contain Count (integer), Amount (decimal), and a computed Sub-total (Count × Amount).
3. WHEN the Cluster_Admin changes Count or Amount for a Food_Entry, THE Finance_Module SHALL immediately compute and display the Sub-total without requiring a save action.
4. THE Finance_Module SHALL display the Food Total as the sum of all non-zero Food_Entry sub-totals.
5. THE Finance_Module SHALL allow the Cluster_Admin to attach one or more Bills to each Food_Entry using the Bill_Scanner.
6. WHEN a Food_Entry's Count and Amount are both 0, THE Finance_Module SHALL exclude that food sub-category from the Grand_Total computation.

---

### Requirement 7: Stationery Expense Tab

**User Story:** As a Cluster Admin, I want to record stationery expenses as itemised rows, so that each purchased item is individually auditable.

#### Acceptance Criteria

1. THE Finance_Module SHALL allow the Cluster_Admin to add one or more Stationery_Entry rows to the Stationery tab.
2. EACH Stationery_Entry SHALL contain: Item Name (text), Quantity (integer), and Amount per item (decimal).
3. WHEN the Cluster_Admin changes Quantity or Amount for a Stationery_Entry, THE Finance_Module SHALL immediately compute and display that row's total as (Quantity × Amount) without requiring a save action.
4. THE Finance_Module SHALL display the Stationery Total as the sum of all Stationery_Entry row totals.
5. THE Finance_Module SHALL allow the Cluster_Admin to attach one or more Bills to the Stationery tab using the Bill_Scanner.
6. THE Finance_Module SHALL allow the Cluster_Admin to remove any Stationery_Entry row.

---

### Requirement 8: Other Expense Tab

**User Story:** As a Cluster Admin, I want an optional "Other" expense category for miscellaneous costs that do not fit Travel, Food, or Stationery, so that all actual session costs are captured.

#### Acceptance Criteria

1. THE Finance_Module SHALL allow the Cluster_Admin to add zero or more Other_Entry rows to the Other tab.
2. EACH Other_Entry SHALL contain: Description (text), Amount (decimal), and optional Remarks (text).
3. THE Finance_Module SHALL display the Other Total as the sum of all Other_Entry amounts.
4. THE Finance_Module SHALL allow the Cluster_Admin to attach one or more Bills to each Other_Entry using the Bill_Scanner.
5. THE Finance_Module SHALL allow the Cluster_Admin to remove any Other_Entry row.
6. WHEN no Other_Entry rows have been added, THE Finance_Module SHALL display the Other tab as empty and contribute 0 to the Grand_Total.

---

### Requirement 9: Grand Total and Balance Computation

**User Story:** As a Cluster Admin and Super Admin, I want the system to automatically compute Grand Total and Balance from actual entered values, so that no manual arithmetic is needed and the audit figures are always exact.

#### Acceptance Criteria

1. THE Finance_Module SHALL compute Grand_Total as the arithmetic sum of Travel Total, Food Total, Stationery Total, and Other Total.
2. WHEN any expense row value is added, changed, or removed, THE Finance_Module SHALL recompute Grand_Total immediately without requiring a save action.
3. THE Finance_Module SHALL compute Balance as (Advance Released − Grand_Total).
4. WHEN no Advance record exists for the cluster, THE Finance_Module SHALL display Balance as 0 and show a warning that no advance has been released.
5. THE Finance_Module SHALL display Grand_Total and Balance in Indian Rupee format (₹) at the bottom of the Finance_Entry form and in the Finance_Audit_View.
6. THE Finance_Module SHALL store the Grand_Total and Balance values in the database at the time of submission, ensuring the audit record reflects the exact figures at submission time.

---

### Requirement 10: Save Draft and Submit Finance

**User Story:** As a Cluster Admin, I want to save a draft or submit the final finance entry, so that I can prepare the report over multiple sessions and submit only when all bills are attached.

#### Acceptance Criteria

1. WHEN the Cluster_Admin clicks "Save Draft", THE Finance_Module SHALL persist the Finance_Entry with status "Draft" to the database, including all expense rows and attached bills, without triggering Super_Admin dashboard update.
2. WHEN the Cluster_Admin clicks "Submit Finance", THE Finance_Module SHALL validate that the Date field is not empty; IF the Date is empty, THEN THE Finance_Module SHALL display a validation error and halt submission.
3. WHEN the Cluster_Admin clicks "Submit Finance" and the form is valid, THE Finance_Module SHALL persist the Finance_Entry with status "Submitted", store the Grand_Total and Balance at submission time, and immediately update the Finance_Dashboard visible to the Super_Admin.
4. WHEN a Finance_Entry has status "Draft", THE Finance_Module SHALL allow the Cluster_Admin to reopen and edit it.
5. WHEN a Finance_Entry is submitted, THE Finance_Module SHALL prevent the Cluster_Admin from editing it further until the Super_Admin unlocks or rejects it.
6. THE Finance_Module SHALL display submitted Finance_Entries in the Cluster_Admin dashboard table with status badge "Submitted".

---

### Requirement 11: Bill Scanner

**User Story:** As a Cluster Admin, I want to scan physical receipts using my device camera or upload images, so that original bills are digitally captured at full quality and attached to the correct expense row.

#### Acceptance Criteria

1. THE Bill_Scanner SHALL support three input methods: Mobile Camera (using the device's camera), Laptop Webcam (using the `getUserMedia` API), and image file upload.
2. WHEN the device camera is active, THE Bill_Scanner SHALL display a live preview with an alignment frame, continuously detect when a receipt is present within the frame, and automatically capture the image when the receipt has been held still for a minimum of 8 consecutive stable frames.
3. WHEN a bill image is captured or uploaded, THE Bill_Scanner SHALL run the following processing pipeline: auto detect receipt region, apply perspective correction, apply auto rotation, crop to receipt bounds, remove background (wall, floor, hand, finger, face), and preserve receipt content at original quality.
4. THE Bill_Scanner SHALL store both the original captured image and the processed image for each Bill.
5. WHEN the processing pipeline is running, THE Bill_Scanner SHALL display a step-by-step progress indicator to the user.
6. WHEN the processing pipeline completes, THE Bill_Scanner SHALL attach the resulting Bill to the expense row from which it was opened, and display it in the bill thumbnail grid.
7. WHEN the Cluster_Admin clicks a bill thumbnail, THE Finance_Module SHALL open a full-screen preview dialog showing the processed image, with options to toggle to the original image, zoom in/out, and rotate.
8. WHEN camera access is denied by the user, THE Bill_Scanner SHALL display a human-readable error message and offer the file upload option instead.

---

### Requirement 12: Super Admin Finance Dashboard

**User Story:** As a Super Admin, I want a Finance Dashboard that shows all clusters' financial status at a glance, so that I can monitor budget utilisation and quickly identify clusters that need review.

#### Acceptance Criteria

1. THE Finance_Dashboard SHALL display one card per cluster, showing: Advance Released, Expense Submitted (total), Balance, Sessions Completed count, and Last Submission date.
2. WHEN a Finance_Entry is submitted by a Cluster_Admin, THE Finance_Dashboard SHALL reflect the updated cluster totals within the same page load or via automatic data refresh without requiring a manual page reload.
3. THE Finance_Dashboard SHALL NOT display "No finance entries yet" when at least one Finance_Entry exists for any cluster.
4. WHEN the Super_Admin clicks a cluster card, THE Finance_Module SHALL navigate to the Cluster_Finance_Dashboard for that cluster.
5. THE Finance_Dashboard SHALL display KPI summary cards showing: total advance released across all clusters, total expenses submitted, and total balance across all clusters.

---

### Requirement 13: Cluster Finance Dashboard (Day Cards)

**User Story:** As a Super Admin, I want to drill into a specific cluster's finance history by day, so that I can track session-wise expenditure patterns.

#### Acceptance Criteria

1. THE Cluster_Finance_Dashboard SHALL display one card per submitted Finance_Entry for the selected cluster, showing: Session name, Travel Total, Food Total, Stationery Total, Other Total, Grand Total, and Balance.
2. WHEN the Super_Admin clicks a day card, THE Finance_Module SHALL navigate to the Finance_Audit_View for that Finance_Entry.
3. THE Cluster_Finance_Dashboard SHALL display the cluster's total Advance Released and total Balance at the top of the page.
4. WHEN a cluster has no Finance_Entry records, THE Cluster_Finance_Dashboard SHALL display a clear message indicating that no finance submissions have been made for the cluster.

---

### Requirement 14: Finance Audit View

**User Story:** As a Super Admin, I want a detailed read-only audit view of each Finance_Entry, so that I can verify expenses, review bills, and confirm balances before approving.

#### Acceptance Criteria

1. THE Finance_Audit_View SHALL display a header section containing: College Name, Cluster, Session Name, Day, Date, SPOC Name, Financer Name, Advance Released, Balance, and Volunteer Count.
2. THE Finance_Audit_View SHALL display an expense table with columns: S.No, Category, Description, Volunteers, Count × Amount formula, Total, Bills (thumbnail links), and Remarks.
3. THE Finance_Audit_View expense table SHALL include sub-total rows for Travel Total, Food Total, Stationery Total, and Other Total, followed by a Grand Total row.
4. THE Finance_Audit_View SHALL display the Advance Released amount and computed Balance (Advance Released − Grand Total) below the expense table.
5. THE Finance_Audit_View SHALL display a Volunteer List section showing each volunteer's S.No, Volunteer Name, College, and Year.
6. THE Finance_Audit_View SHALL display all attached bills as thumbnails; WHEN the Super_Admin clicks a bill thumbnail, THE Finance_Module SHALL open the bill in a full-screen dialog at original quality.
7. THE Finance_Audit_View SHALL provide Approve, Reject, Lock, and Unlock action buttons visible only to the Super_Admin.
8. WHEN the Super_Admin clicks Approve, THE Finance_Module SHALL update the Finance_Entry status to "Approved" and persist the change to the database.
9. WHEN the Super_Admin clicks Reject, THE Finance_Module SHALL update the Finance_Entry status to "Rejected" and persist the change to the database.
10. WHEN the Super_Admin clicks Lock, THE Finance_Module SHALL update the Finance_Entry status to "Locked" and prevent any further edits to that entry.
11. WHEN the Super_Admin clicks Unlock, THE Finance_Module SHALL update the Finance_Entry status from "Locked" back to "Submitted" and allow editing to resume.

---

### Requirement 15: Audit PDF Export

**User Story:** As a Super Admin, I want to export a Finance_Entry as a signed PDF, so that I have a printable audit document that includes all expenses, bills, volunteer list, and authorised signatures.

#### Acceptance Criteria

1. THE Finance_Module SHALL provide an "Export PDF" button in the Finance_Audit_View, visible only to the Super_Admin.
2. WHEN the Super_Admin clicks "Export PDF", THE Finance_Module SHALL generate an Audit_PDF that includes: the header section (College, Cluster, Session, Day, Date, SPOC, Financer, Advance, Balance, Volunteers), the full expense table with all rows and sub-totals, the Grand Total row, the Advance Released row, the Balance row, the Volunteer List, all attached bill images, the PDF Footer text from Finance_Settings, and two signature lines (Signature Name and Signature Designation from Finance_Settings).
3. THE Audit_PDF SHALL be rendered in a printable browser window using the window.print() method and SHALL be formatted for A4 paper.
4. THE Finance_Module SHALL allow both Super_Admin and Cluster_Admin to trigger PDF generation from the Finance_Audit_View; however, the "Export PDF" button as a primary action SHALL be visible to Super_Admin.
5. WHEN bill images are present, THE Audit_PDF SHALL embed each bill image inline within the expense table row or in a Bills section at a size that preserves legibility.

---

### Requirement 16: Excel Export

**User Story:** As a Super Admin, I want to export finance data to Excel, so that I can perform further analysis or share data with the finance team in a spreadsheet format.

#### Acceptance Criteria

1. THE Finance_Module SHALL provide an "Export Excel" button in the Finance_Dashboard, visible only to the Super_Admin.
2. WHEN the Super_Admin clicks "Export Excel", THE Finance_Module SHALL generate a .xlsx file containing one row per Finance_Entry with columns: Cluster, Session Day, Date, SPOC Name, Financer Name, Travel Total, Food Total, Stationery Total, Other Total, Grand Total, Advance Released, and Balance.
3. THE Finance_Module SHALL trigger a browser file download for the generated .xlsx file.
4. THE Finance_Module SHALL include all Finance_Entry records regardless of status in the export, with the status column included.

---

### Requirement 17: Persistence and Data Integrity

**User Story:** As a system operator, I want all finance data stored reliably in MySQL with correct schema and JSON columns, so that no finance records are lost between page reloads or server restarts.

#### Acceptance Criteria

1. THE Finance_Module SHALL persist Finance_Entry records (including all expense tab details, bill references, Grand_Total, and Balance) to dedicated MySQL tables via the existing backend resource API.
2. THE Finance_Module SHALL persist Finance_Settings to a dedicated MySQL table; WHEN the Super_Admin saves settings, THE Finance_Module SHALL upsert the record using the standard `upsertResource` pattern.
3. THE Finance_Module SHALL persist Advance records to the existing `advances` MySQL table extended with `clusterId`, `clusterName`, `releasedDate`, and `releasedBy` columns.
4. THE Finance_Module SHALL NOT store Finance_Entry records exclusively in sessionStorage; all submitted Finance_Entry records SHALL be persisted to the MySQL database and fetched from it on page load.
5. WHEN the backend receives a Finance_Entry payload containing JSON fields (expense tab entries, bills), THE Finance_Module SHALL serialise those fields as JSON columns in MySQL and deserialise them on retrieval.
6. THE Finance_Module SHALL apply the same upsert pattern (POST to create, PUT to update) used by the attendance module for all finance resources.

---

### Requirement 18: Finance Entry Status Lifecycle

**User Story:** As both Super Admin and Cluster Admin, I want the Finance_Entry status to follow a defined lifecycle, so that it is always clear which actions are available at each stage.

#### Acceptance Criteria

1. THE Finance_Module SHALL define the Finance_Entry status lifecycle as: Draft → Submitted → (Approved | Rejected | Locked).
2. WHEN a Finance_Entry has status "Draft", THE Finance_Module SHALL allow the Cluster_Admin to edit, update, and re-save it.
3. WHEN a Finance_Entry has status "Submitted", THE Finance_Module SHALL prevent the Cluster_Admin from editing it and SHALL allow the Super_Admin to Approve, Reject, or Lock it.
4. WHEN a Finance_Entry has status "Approved", THE Finance_Module SHALL display an "Approved" badge and SHALL allow the Super_Admin to Lock it.
5. WHEN a Finance_Entry has status "Rejected", THE Finance_Module SHALL display a "Rejected" badge and SHALL allow the Cluster_Admin to create a new Finance_Entry for the same day.
6. WHEN a Finance_Entry has status "Locked", THE Finance_Module SHALL display a "Locked" badge and SHALL prevent all edits until unlocked by the Super_Admin.

---

### Requirement 19: Real-Time Dashboard Synchronisation

**User Story:** As a Super Admin, I want the Finance Dashboard to reflect the latest cluster submissions immediately after a Cluster Admin submits, so that I always see current data without needing to refresh the page manually.

#### Acceptance Criteria

1. WHEN a Cluster_Admin submits a Finance_Entry, THE Finance_Module SHALL persist the submission to the database immediately.
2. WHEN the Super_Admin's Finance_Dashboard is open and a new Finance_Entry is submitted by any Cluster_Admin, THE Finance_Dashboard SHALL update the relevant cluster card totals within 30 seconds without a full page reload.
3. THE Finance_Dashboard SHALL fetch the latest Finance_Entry data from the backend on every mount of the Finance_Dashboard component.
4. THE Finance_Dashboard SHALL NOT rely on sessionStorage as the source of truth for submitted Finance_Entry records; all dashboard data SHALL be fetched from the MySQL database via the backend API.

---

### Requirement 20: Bill Parser Round-Trip Integrity

**User Story:** As a system operator, I want bill image attachments to be stored and retrieved without data loss, so that auditors can always view the original and processed bill images at full quality.

#### Acceptance Criteria

1. THE Bill_Scanner SHALL store the original captured image data URL and the processed image data URL as separate fields on the Bill record.
2. WHEN a Bill is persisted to the database as part of a Finance_Entry, THE Finance_Module SHALL serialise the full Bill record (id, name, url, originalUrl, type) as a JSON object within the bills JSON column.
3. WHEN a Finance_Entry is loaded from the database, THE Finance_Module SHALL deserialise the bills JSON column back to an array of Bill objects such that each Bill's url and originalUrl fields are accessible and non-empty.
4. FOR ALL valid Finance_Entry records containing bills, retrieving and re-serialising the bills array SHALL produce an equivalent array (round-trip property): `deserialise(serialise(bills)) equals bills`.
