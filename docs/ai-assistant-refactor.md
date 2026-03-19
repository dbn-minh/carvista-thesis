# CarVista AI Assistant Refactor

## Current architecture after refactor

The AI layer now follows a modular flow instead of a single demo-style stack:

1. `conversation_orchestrator.service.js`
   - Routes chat into:
   - comparison
   - valuation / forecast
   - TCO
   - focused vehicle Q&A
   - advisory profile collection
   - small-talk / off-topic handling

2. `source_retrieval.service.js`
   - Loads grounded internal vehicle context from:
   - local catalog tables
   - local review tables
   - local price history
   - local TCO rule tables
   - Adds official fallback retrieval from:
   - `FuelEconomy.gov`
   - `NHTSA`
   - Includes in-memory caching and source provenance

3. `knowledge_engine.service.js`
   - Answers direct car questions like a domain specialist
   - Grounds answers to a specific vehicle whenever possible
   - Separates verified facts from inferred advice

4. Domain engines
   - `compare_variants.service.js`
   - `predict_price.service.js`
   - `tco.service.js`
   - These remain deterministic and explainable, but now emit richer AI-ready outputs

5. `contracts.js`
   - Standard response contract for:
   - `confidence`
   - `evidence`
   - `sources`
   - `caveats`
   - `freshness_note`

6. `presentation.service.js`
   - Formats all engines into a consistent assistant narrative

## Why this is better than before

- Keeps working deterministic engines instead of replacing them with shallow chatbot logic.
- Adds official-source fallback where practical.
- Makes every answer source-aware and uncertainty-aware.
- Lets the UI render confidence and provenance instead of raw JSON or unsupported claims.
- Creates a path for future provider expansion without rewriting the chat layer.

## Retrieval priority

1. Internal DB and structured project data
2. Official automotive fallback APIs
3. Configured external feeds in future extensions

Current official providers implemented:

- `FuelEconomy.gov`
- `NHTSA recalls API`

## Confidence model

Each AI response now carries:

- `confidence.score`
- `confidence.label`
- `confidence.rationale`

Confidence is higher when:

- local data coverage is strong
- price history is deep enough
- comparable variants exist
- official fallback data is available
- user profile is complete enough to personalize the recommendation

## Evidence model

Every engine now separates:

- `verified`
- `inferred`
- `estimated`

This is critical for:

- valuation
- TCO
- expert consultation
- trim / market caveats

## Sample prompts

### Focused vehicle Q&A

Prompt:
`Is this car safe for family use?`

Expected style:
- direct answer first
- mention official recall context if found
- mention practical fit
- show sources and caveats

### Buyer advisory

Prompt:
`I need a family SUV under 1 billion for city driving, but we travel on weekends.`

Expected style:
- collect only missing profile fields
- recommend grounded vehicles
- explain why each fit is strong or weaker
- invite compare / TCO / forecast next

### Comparison

Prompt:
`Compare [101,102] for a family mostly driving in the city.`

Expected style:
- verdict first
- profile-aware weighting
- source-aware and caveat-aware

### Valuation

Prompt:
`Forecast resale value for [123] over 6 months.`

Expected style:
- fair-value range
- future-value range
- confidence
- major drivers
- scarcity signal

### TCO

Prompt:
`Estimate 5-year ownership cost for this car in market 1.`

Expected style:
- drive-away cost
- recurring ownership cost
- depreciation
- assumptions
- caveats if energy or tax data is incomplete

## Future extensions

Recommended next upgrades:

1. Add configured valuation feeds for local market listings and transaction references
2. Add country-specific tax provider connectors
3. Add trim / generation normalization layer
4. Add recall severity and reliability issue clustering
5. Add battery-health and EV charging-cost modeling
6. Add telemetry and answer trace logging
7. Add richer UI rendering for evidence buckets

## Testing

Run:

```bash
npm run test:ai
```

Current automated coverage includes:

- conversation routing
- official-source parsing
- buyer-profile-aware comparison output
