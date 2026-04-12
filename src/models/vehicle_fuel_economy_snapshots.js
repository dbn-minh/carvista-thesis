import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VehicleFuelEconomySnapshots extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    fuel_snapshot_id: {
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
      },
      unique: "fk_vehicle_fuel_variant"
    },
    source_reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'source_references',
        key: 'source_reference_id'
      }
    },
    combined_mpg: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true
    },
    city_mpg: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true
    },
    highway_mpg: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true
    },
    annual_fuel_cost_usd: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    fuel_type: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    drive: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    class_name: {
      type: DataTypes.STRING(120),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'vehicle_fuel_economy_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "fuel_snapshot_id" },
        ]
      },
      {
        name: "uq_vehicle_fuel_variant",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "fk_vehicle_fuel_source",
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
    ]
  });
  }
}
