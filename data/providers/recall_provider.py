import json
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen

from .base import Provider, ProviderResult, SourceReference


class NhtsaRecallProvider(Provider):
    def fetch(self, year, make, model) -> ProviderResult:
        url = (
            "https://api.nhtsa.gov/recalls/recallsByVehicle"
            f"?make={quote(make)}&model={quote(model)}&modelYear={quote(str(year))}"
        )
        try:
            with urlopen(url, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            return ProviderResult(
                items=[],
                source=SourceReference(
                    provider_key="nhtsa_recalls",
                    source_type="official_api",
                    title=f"NHTSA recall lookup for {year} {make} {model}",
                    url=url,
                    trust_level="high",
                    retrieved_at=datetime.utcnow(),
                    update_cadence="weekly",
                    notes=f"Recall lookup unavailable: {exc.__class__.__name__}",
                ),
            )

        rows = [
            {
                "campaign_number": item.get("NHTSACampaignNumber"),
                "component": item.get("Component"),
                "summary": item.get("Summary"),
                "consequence": item.get("Consequence"),
                "remedy": item.get("Remedy"),
            }
            for item in payload.get("results", [])[:20]
            if item.get("NHTSACampaignNumber")
        ]

        return ProviderResult(
            items=rows,
            source=SourceReference(
                provider_key="nhtsa_recalls",
                source_type="official_api",
                title=f"NHTSA recall lookup for {year} {make} {model}",
                url=url,
                trust_level="high",
                retrieved_at=datetime.utcnow(),
                update_cadence="weekly",
            ),
        )
