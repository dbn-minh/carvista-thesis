from data.ingestion.ingest_vehicle_facts import main as ingest_vehicle_facts
from data.ingestion.build_market_features import main as build_market_features
from data.ingestion.ingest_fuel_economy import main as ingest_fuel_economy
from data.ingestion.ingest_safety_recalls import main as ingest_safety_recalls


def main():
    ingest_vehicle_facts()
    build_market_features()
    ingest_fuel_economy(limit=15)
    ingest_safety_recalls(limit=15)
    print("CarVista intelligence materializations refreshed.")


if __name__ == "__main__":
    main()
