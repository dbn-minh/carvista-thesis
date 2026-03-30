from datetime import datetime
from statistics import median

from .base import Provider, ProviderResult, SourceReference


class InternalMarketplaceProvider(Provider):
    def fetch(self, cursor) -> ProviderResult:
        cursor.execute(
            """
            SELECT
              l.listing_id,
              l.variant_id,
              l.asking_price,
              l.mileage_km,
              l.location_country_code,
              l.location_city,
              l.status,
              l.created_at
            FROM listings l
            ORDER BY l.created_at DESC
            """
        )
        rows = cursor.fetchall()
        return ProviderResult(
            items=rows,
            source=SourceReference(
                provider_key="internal_marketplace",
                source_type="internal_marketplace",
                title="Internal marketplace listings and listing history",
                trust_level="high",
                retrieved_at=datetime.utcnow(),
                update_cadence="daily",
            ),
        )


def build_market_signal_rows(listings, snapshot_date, source_reference_id):
    grouped = {}
    for item in listings:
      if item.get("status") not in ("active", "reserved", "sold"):
          continue
      key = (item["variant_id"], item["location_country_code"])
      grouped.setdefault(key, []).append(item)

    signal_rows = []
    for (variant_id, country_code), items in grouped.items():
      prices = sorted(float(item["asking_price"]) for item in items if item.get("asking_price") is not None)
      mileages = [float(item["mileage_km"]) for item in items if item.get("mileage_km") is not None]
      if not prices:
          continue

      average_price = sum(prices) / len(prices)
      median_price = float(median(prices))
      min_price = prices[0]
      max_price = prices[-1]
      spread_pct = ((max_price - min_price) / average_price) if average_price else None
      avg_mileage = (sum(mileages) / len(mileages)) if mileages else None
      scarcity_score = 1 / max(len(items), 1)
      confidence = min(0.9, 0.35 + min(len(items), 12) * 0.04)

      signal_rows.append(
          {
              "variant_id": variant_id,
              "country_code": country_code,
              "snapshot_date": snapshot_date,
              "active_listing_count": len([item for item in items if item.get("status") == "active"]),
              "avg_asking_price": round(average_price, 2),
              "median_asking_price": round(median_price, 2),
              "min_asking_price": round(min_price, 2),
              "max_asking_price": round(max_price, 2),
              "avg_mileage_km": round(avg_mileage, 2) if avg_mileage is not None else None,
              "price_spread_pct": round(spread_pct, 6) if spread_pct is not None else None,
              "scarcity_score": round(scarcity_score, 6),
              "data_confidence": round(confidence, 6),
              "source_reference_id": source_reference_id,
          }
      )
    return signal_rows
