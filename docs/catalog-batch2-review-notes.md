# Catalog Batch 2 Review Notes

## Rows Still Unresolved

_No rows._

## Low-Confidence Matches

| make_name | model_name | model_year | trim_name | match_key_used | enrichment_notes |
| --- | --- | --- | --- | --- | --- |
| Ram | 1500 | 2012 | ST | epa_match | Only partial structured alignment was available Seats not available from the structured VIN sample. Manual review recommended before any future import. |

## Fields Still Too Risky To Fill Automatically

- `seats` remains sparse because the VIN sample often does not expose it and Batch 2 avoids guessing from body class.
- Some trim-level distinctions on premium sedans, SUVs, and pickups remain too close to fill blindly when VIN decode and seller-entered trim naming disagree.
- Any spec not present in either NHTSA VIN decode or EPA data remains null by design.

## Rows Recommended For Manual Review Before Any Future Import

| make_name | model_name | model_year | trim_name | enrichment_confidence | ready_for_import |
| --- | --- | --- | --- | --- | --- |
| Ford | F-150 | 2013 | XLT | medium | True |
| Ford | F-150 | 2011 | XLT | medium | True |
| Ford | F-150 | 2014 | XLT | medium | True |
| Mercedes-Benz | M-Class | 2011 | ML350 4MATIC | medium | True |
| Mercedes-Benz | M-Class | 2006 | ML350 | medium | True |
| Nissan | Leaf | 2012 | SL | high | False |
| Nissan | Leaf | 2013 | SV | high | False |
| Nissan | Leaf | 2013 | S | high | False |
| Ram | 1500 | 2012 | ST | low | True |
