import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ListingPriceHistory extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    listing_price_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    listing_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'listings',
        key: 'listing_id'
      }
    },
    price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: false
    },
    changed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'listing_price_history',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "listing_price_id" },
        ]
      },
      {
        name: "idx_listing_price_listing_time",
        using: "BTREE",
        fields: [
          { name: "listing_id" },
          { name: "changed_at" },
        ]
      },
    ]
  });
  }
}
