SUPPORT_TABLE_DDL = [
    """
    CREATE TABLE IF NOT EXISTS source_references (
      source_reference_id BIGINT NOT NULL AUTO_INCREMENT,
      provider_key VARCHAR(120) NOT NULL,
      source_type ENUM('seed','internal_marketplace','official_api','configured_feed','web','manual') NOT NULL,
      title VARCHAR(255) NOT NULL,
      url VARCHAR(500) NULL,
      trust_level ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
      retrieved_at DATETIME NOT NULL,
      update_cadence VARCHAR(120) NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (source_reference_id),
      KEY idx_source_references_provider (provider_key),
      KEY idx_source_references_type (source_type)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS vehicle_market_aliases (
      alias_id BIGINT NOT NULL AUTO_INCREMENT,
      variant_id BIGINT NULL,
      model_id INT NULL,
      make_id INT NULL,
      alias_name VARCHAR(255) NOT NULL,
      market_scope CHAR(2) NULL,
      normalization_status ENUM('canonical','generated','needs_review') NOT NULL DEFAULT 'generated',
      source_reference_id BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (alias_id),
      UNIQUE KEY uq_vehicle_alias (alias_name, variant_id),
      KEY idx_vehicle_alias_name (alias_name),
      KEY idx_vehicle_alias_variant (variant_id),
      CONSTRAINT fk_vehicle_alias_variant FOREIGN KEY (variant_id) REFERENCES car_variants (variant_id) ON DELETE CASCADE,
      CONSTRAINT fk_vehicle_alias_model FOREIGN KEY (model_id) REFERENCES car_models (model_id) ON DELETE SET NULL,
      CONSTRAINT fk_vehicle_alias_make FOREIGN KEY (make_id) REFERENCES car_makes (make_id) ON DELETE SET NULL,
      CONSTRAINT fk_vehicle_alias_source FOREIGN KEY (source_reference_id) REFERENCES source_references (source_reference_id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS vehicle_market_signals (
      signal_id BIGINT NOT NULL AUTO_INCREMENT,
      variant_id BIGINT NOT NULL,
      market_id INT NOT NULL,
      snapshot_date DATETIME NOT NULL,
      active_listing_count INT NOT NULL DEFAULT 0,
      avg_asking_price DECIMAL(14,2) NULL,
      median_asking_price DECIMAL(14,2) NULL,
      min_asking_price DECIMAL(14,2) NULL,
      max_asking_price DECIMAL(14,2) NULL,
      avg_mileage_km DECIMAL(12,2) NULL,
      price_spread_pct DECIMAL(10,6) NULL,
      scarcity_score DECIMAL(10,6) NULL,
      data_confidence DECIMAL(10,6) NULL,
      source_reference_id BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (signal_id),
      UNIQUE KEY uq_vehicle_market_signal (variant_id, market_id, snapshot_date),
      KEY idx_vehicle_market_signal_lookup (variant_id, market_id, snapshot_date),
      CONSTRAINT fk_vehicle_market_signal_variant FOREIGN KEY (variant_id) REFERENCES car_variants (variant_id) ON DELETE CASCADE,
      CONSTRAINT fk_vehicle_market_signal_market FOREIGN KEY (market_id) REFERENCES markets (market_id) ON DELETE CASCADE,
      CONSTRAINT fk_vehicle_market_signal_source FOREIGN KEY (source_reference_id) REFERENCES source_references (source_reference_id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS vehicle_fuel_economy_snapshots (
      fuel_snapshot_id BIGINT NOT NULL AUTO_INCREMENT,
      variant_id BIGINT NOT NULL,
      source_reference_id BIGINT NULL,
      combined_mpg DECIMAL(10,2) NULL,
      city_mpg DECIMAL(10,2) NULL,
      highway_mpg DECIMAL(10,2) NULL,
      annual_fuel_cost_usd DECIMAL(14,2) NULL,
      fuel_type VARCHAR(80) NULL,
      drive VARCHAR(120) NULL,
      class_name VARCHAR(120) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (fuel_snapshot_id),
      UNIQUE KEY uq_vehicle_fuel_variant (variant_id),
      CONSTRAINT fk_vehicle_fuel_variant FOREIGN KEY (variant_id) REFERENCES car_variants (variant_id) ON DELETE CASCADE,
      CONSTRAINT fk_vehicle_fuel_source FOREIGN KEY (source_reference_id) REFERENCES source_references (source_reference_id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS vehicle_recall_snapshots (
      recall_snapshot_id BIGINT NOT NULL AUTO_INCREMENT,
      variant_id BIGINT NOT NULL,
      source_reference_id BIGINT NULL,
      campaign_number VARCHAR(60) NOT NULL,
      component VARCHAR(255) NULL,
      summary TEXT NULL,
      consequence TEXT NULL,
      remedy TEXT NULL,
      report_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (recall_snapshot_id),
      UNIQUE KEY uq_vehicle_recall_variant_campaign (variant_id, campaign_number),
      KEY idx_vehicle_recall_variant (variant_id),
      CONSTRAINT fk_vehicle_recall_variant FOREIGN KEY (variant_id) REFERENCES car_variants (variant_id) ON DELETE CASCADE,
      CONSTRAINT fk_vehicle_recall_source FOREIGN KEY (source_reference_id) REFERENCES source_references (source_reference_id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS data_freshness_snapshots (
      freshness_id BIGINT NOT NULL AUTO_INCREMENT,
      entity_type VARCHAR(80) NOT NULL,
      entity_key VARCHAR(255) NOT NULL,
      source_reference_id BIGINT NULL,
      last_refreshed_at DATETIME NOT NULL,
      freshness_days INT NULL,
      status ENUM('fresh','stale','expired','unknown') NOT NULL DEFAULT 'unknown',
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (freshness_id),
      UNIQUE KEY uq_data_freshness (entity_type, entity_key),
      CONSTRAINT fk_data_freshness_source FOREIGN KEY (source_reference_id) REFERENCES source_references (source_reference_id) ON DELETE SET NULL
    )
    """,
]


def ensure_support_tables(cursor):
    for ddl in SUPPORT_TABLE_DDL:
        cursor.execute(ddl)
