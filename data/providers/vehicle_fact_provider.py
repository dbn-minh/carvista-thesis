from datetime import datetime

from .base import Provider, ProviderResult, SourceReference


class CanonicalCatalogProvider(Provider):
    def fetch(self, cursor) -> ProviderResult:
        cursor.execute(
            """
            SELECT
              cv.variant_id,
              cv.model_year,
              cv.trim_name,
              cv.body_type,
              cv.fuel_type,
              cv.transmission,
              cv.drivetrain,
              cv.engine,
              cv.seats,
              cv.doors,
              cv.msrp_base,
              cm.model_id,
              cm.name AS model_name,
              mk.make_id,
              mk.name AS make_name
            FROM car_variants cv
            JOIN car_models cm ON cm.model_id = cv.model_id
            JOIN car_makes mk ON mk.make_id = cm.make_id
            ORDER BY mk.name, cm.name, cv.model_year DESC, cv.trim_name
            """
        )
        rows = cursor.fetchall()
        return ProviderResult(
            items=rows,
            source=SourceReference(
                provider_key="canonical_catalog",
                source_type="manual",
                title="Canonical vehicle catalog from internal normalized tables",
                trust_level="high",
                retrieved_at=datetime.utcnow(),
                update_cadence="on demand",
                notes="Reuses existing car_makes/car_models/car_variants as the canonical vehicle layer.",
            ),
        )
