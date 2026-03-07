import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VariantSpecs extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    power_hp: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    torque_nm: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    displacement_cc: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    length_mm: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    width_mm: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    height_mm: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    wheelbase_mm: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    curb_weight_kg: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    battery_kwh: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true
    },
    range_km: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'variant_specs',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
    ]
  });
  }
}
