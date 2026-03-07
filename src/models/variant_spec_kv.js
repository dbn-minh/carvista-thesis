import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VariantSpecKv extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    spec_id: {
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
    spec_key: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    spec_value: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    source: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'variant_spec_kv',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "spec_id" },
        ]
      },
      {
        name: "idx_spec_kv_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "idx_spec_kv_key",
        using: "BTREE",
        fields: [
          { name: "spec_key" },
        ]
      },
    ]
  });
  }
}
