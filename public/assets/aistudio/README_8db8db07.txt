HILFUL FUZUL COOPERATIVE SOCIETY - AI STUDIO IMPORT PACKAGE

Files:
- monthly_records_for_ai_studio.csv: flattened monthly rows, UTF-8 with BOM for spreadsheet compatibility.
- monthly_records_for_ai_studio.json: same rows as JSON array.
- member_index_for_ai_studio.json: member identity index with source labels and years.
- import_validation_report.json: extraction counts and warnings.

IMPORTANT:
1. These are extraction/analysis files, NOT approved accounting data.
2. All records are marked REVIEW_REQUIRED.
3. date_raw preserves original Excel date text/value; ambiguous dates need manual review.
4. Formula strings are preserved; they are not evaluated by this conversion.
5. Do not import directly into production before member matching, date review, formula reconciliation and Super Admin approval.
6. Use CSV for easy AI Studio upload or JSON for structured parsing.
