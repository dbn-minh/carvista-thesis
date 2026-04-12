import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VehicleMarketSignals extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    signal_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    market_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'markets',
        key: 'market_id'
      }
    },
    snapshot_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    active_listing_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    avg_asking_price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    median_asking_price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    min_asking_price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    max_asking_price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    avg_mileage_km: {
      type: DataTypes.DECIMAL(12,2),
      allowNull: true
    },
    price_spread_pct: {
      type: DataTypes.DECIMAL(10,6),
      allowNull: true
    },
    scarcity_score: {
      type: DataTypes.DECIMAL(10,6),
      allowNull: true
    },
    data_confidence: {
      type: DataTypes.DECIMAL(10,6),
      allowNull: true
    },
    source_reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'source_references',
        key: 'source_reference_id'
      }
    }
  }, {
    sequelize,
    tableName: 'vehicle_market_signals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "signal_id" },
        ]
      },
      {
        name: "uq_vehicle_market_signal",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "variant_id" },
          { name: "market_id" },
          { name: "snapshot_date" },
        ]
      },
      {
        name: "idx_vehicle_market_signal_lookup",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
          { name: "market_id" },
          { name: "snapshot_date" },
        ]
      },
      {
        name: "fk_vehicle_market_signal_market",
        using: "BTREE",
        fields: [
          { name: "market_id" },
        ]
      },
      {
        name: "fk_vehicle_market_signal_source",
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
    ]
  });
  }
}
