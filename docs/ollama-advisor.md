# Local Ollama Advisor

CarVista AI Advisor uses Ollama as a local conversational helper and keeps the internal catalog/database as the source of truth.

## Environment

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_TIMEOUT_MS=30000
```

## Local Setup

```bash
ollama pull qwen3:1.7b
ollama serve
```

The backend calls Ollama for structured answer extraction and concise recommendation copy. Vehicle selection, prices, links, images, and availability remain backend/database controlled.

If Ollama is unavailable or times out, the Advisor falls back to deterministic backend parsing and formatting instead of letting the model invent missing data.
