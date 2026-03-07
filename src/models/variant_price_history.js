import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VariantPriceHistory extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    price_id: {
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
    price_type: {
      type: DataTypes.ENUM('msrp','avg_market','avg_listing'),
      allowNull: false,
      defaultValue: "avg_market"
    },
    price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: false
    },
    captured_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    source: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'variant_price_history',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "price_id" },
        ]
      },
      {
        name: "idx_price_variant_market_time",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
          { name: "market_id" },
          { name: "captured_at" },
        ]
      },
      {
        name: "idx_price_market_time",
        using: "BTREE",
        fields: [
          { name: "market_id" },
          { name: "captured_at" },
        ]
      },
    ]
  });
  }
}
