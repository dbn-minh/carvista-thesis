from data.ingestion.ingest_market_listings import main as ingest_market_listings
from data.ingestion.ingest_price_history import main as ingest_price_history


def main():
    ingest_market_listings()
    ingest_price_history()


if __name__ == "__main__":
    main()
