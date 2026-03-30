from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen

from .base import Provider, ProviderResult, SourceReference


def _extract_xml_value(xml, tag):
    opening = f"<{tag}>"
    closing = f"</{tag}>"
    if opening not in xml or closing not in xml:
        return None
    return xml.split(opening, 1)[1].split(closing, 1)[0].strip()


class FuelEconomyGovProvider(Provider):
    def fetch(self, year, make, model) -> ProviderResult:
        menu_url = (
            "https://www.fueleconomy.gov/ws/rest/vehicle/menu/options"
            f"?year={quote(str(year))}&make={quote(make)}&model={quote(model)}"
        )
        try:
            with urlopen(menu_url, timeout=12) as response:
                menu_xml = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError) as exc:
            return ProviderResult(
                items=[],
                source=SourceReference(
                    provider_key="fuel_economy_gov",
                    source_type="official_api",
                    title=f"FuelEconomy.gov lookup for {year} {make} {model}",
                    url=menu_url,
                    trust_level="high",
                    retrieved_at=datetime.utcnow(),
                    update_cadence="monthly",
                    notes=f"Fuel-economy lookup unavailable: {exc.__class__.__name__}",
                ),
            )

        option_id = _extract_xml_value(menu_xml, "value")
        if not option_id:
            return ProviderResult(
                items=[],
                source=SourceReference(
                    provider_key="fuel_economy_gov",
                    source_type="official_api",
                    title=f"FuelEconomy.gov lookup for {year} {make} {model}",
                    url=menu_url,
                    trust_level="high",
                    retrieved_at=datetime.utcnow(),
                    update_cadence="monthly",
                    notes="No matching official option id was found for this lookup.",
                ),
            )

        detail_url = f"https://www.fueleconomy.gov/ws/rest/vehicle/{quote(option_id)}"
        try:
            with urlopen(detail_url, timeout=12) as response:
                detail_xml = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError) as exc:
            return ProviderResult(
                items=[],
                source=SourceReference(
                    provider_key="fuel_economy_gov",
                    source_type="official_api",
                    title=f"FuelEconomy.gov profile for {year} {make} {model}",
                    url=detail_url,
                    trust_level="high",
                    retrieved_at=datetime.utcnow(),
                    update_cadence="monthly",
                    notes=f"Fuel-economy detail lookup unavailable: {exc.__class__.__name__}",
                ),
            )

        return ProviderResult(
            items=[
                {
                    "combined_mpg": _extract_xml_value(detail_xml, "comb08"),
                    "city_mpg": _extract_xml_value(detail_xml, "city08"),
                    "highway_mpg": _extract_xml_value(detail_xml, "highway08"),
                    "annual_fuel_cost_usd": _extract_xml_value(detail_xml, "fuelCost08"),
                    "fuel_type": _extract_xml_value(detail_xml, "fuelType1"),
                    "drive": _extract_xml_value(detail_xml, "drive"),
                    "class_name": _extract_xml_value(detail_xml, "VClass"),
                }
            ],
            source=SourceReference(
                provider_key="fuel_economy_gov",
                source_type="official_api",
                title=f"FuelEconomy.gov profile for {year} {make} {model}",
                url=detail_url,
                trust_level="high",
                retrieved_at=datetime.utcnow(),
                update_cadence="monthly",
            ),
        )
