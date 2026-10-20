# DetailList: οθόνες που χρησιμοποιούν ακόμη το παλιό «πλέγμα»

Το κοινό στοιχείο `src/design-system/DetailList.jsx` (+ `DetailList.css`) είναι η νέα εμφάνιση των πεδίων μιας εγγραφής: ενότητες με σύντομο τίτλο, λίστα ετικέτα/τιμή σε δύο στήλες, λεπτά διαχωριστικά, χωρίς πλαίσια, τιμές που αναδιπλώνονται, «—» για ό,τι λείπει. Εφαρμόστηκε στη Σύνοψη του ασθενούς (κάθε νοσηλεία), στη Σύνοψη του επεισοδίου επιτήρησης και στην επιβεβαίωση εξιτηρίου.

Οι παρακάτω οθόνες χρησιμοποιούν ακόμη το παλιό πλέγμα (`detail-grid` / `detail-item` / `RecordDetailsGrid` / τοπικό `Detail`) και μένουν για επόμενη φάση, μία κατηγορία κάθε φορά:

| Οθόνη | Αρχείο |
|---|---|
| Πορεία επιτήρησης (αξιολόγηση, απομόνωση, έκβαση) | `src/features/surveillance/ClinicalJourney.jsx` (χρησιμοποιεί το `Detail` της `ClinicalAdmissions.jsx`) |
| Καρτέλα δείγματος εργαστηρίου (Σύνοψη, προβολές) | `src/features/laboratory/LaboratorySampleSummary.jsx`, `LaboratorySampleViews.jsx` |
| Ποιότητα: συμβάν, εγγραφές, επιθεωρήσεις | `src/features/quality/QualityRecordPage.jsx`, `IncidentEventDetails.jsx`, `IncidentReportPage.jsx`, `audits/AuditFindingDialog.jsx`, `audits/AuditPlanPanel.jsx` |
| Εργαζόμενοι: καρτέλα και υγεία | `src/features/employees/EmployeeRecordPage.jsx`, `EmployeeHealthTabs.jsx` |
| Επιτροπές | `src/features/committees/CommitteeRecordSections.jsx` |
| Έλεγχοι | `src/features/controls/ControlRecordPage.jsx` |
| Πρόληψη | `src/features/prevention/PreventionRecordPage.jsx`, `StaffVaccinationEditor.jsx`, `WasteEntryEditor.jsx` |
| Κουζίνα | `src/features/kitchen/KitchenPanels.jsx`, `KitchenRecall.jsx`, `KitchenReceiptRecordPage.jsx` |
| Νομοθεσία | `src/features/legislation/LegislationRecordPage.jsx` |
| Συνεντεύξεις | `src/features/interviews/InterviewRecordPage.jsx` |
| Κέντρο Διαχείρισης (LIRA) | `src/features/management/LiraKnowledgePanel.jsx`, `LiraOutbreakInvestigationsPanel.jsx` |
| Κοινό στοιχείο παλιού πλέγματος | `src/design-system/RecordDetailsGrid.jsx` (+ κανόνες `.record-details-grid` στο `src/styles/design-system.css`) |

Σημείωση για τη μετάβαση: οι οθόνες με επεξεργασία στη θέση τους (`detail-item editable`) χρειάζονται και τη φόρμα δύο στηλών του ασθενούς (`PatientFormFields`) ως πρότυπο, όχι μόνο τη λίστα ανάγνωσης.
