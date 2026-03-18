import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Listings extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    listing_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    owner_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    asking_price: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: false
    },
    mileage_km: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    location_city: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    location_country_code: {
      type: DataTypes.CHAR(2),
      allowNull: false,
      defaultValue: "VN"
    },
    status: {
      type: DataTypes.ENUM('active','reserved','sold','hidden'),
      allowNull: false,
      defaultValue: "active"
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'listings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "listing_id" },
        ]
      },
      {
        name: "idx_listings_owner",
        using: "BTREE",
        fields: [
          { name: "owner_id" },
        ]
      },
      {
        name: "idx_listings_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "idx_listings_status",
        using: "BTREE",
        fields: [
          { name: "status" },
        ]
      },
      {
        name: "idx_listings_location",
        using: "BTREE",
        fields: [
          { name: "location_country_code" },
          { name: "location_city" },
        ]
      },
    ]
  });
  }
}
