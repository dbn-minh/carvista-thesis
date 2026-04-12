import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VehicleMarketAliases extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    alias_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    model_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'car_models',
        key: 'model_id'
      }
    },
    make_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'car_makes',
        key: 'make_id'
      }
    },
    alias_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    market_scope: {
      type: DataTypes.CHAR(2),
      allowNull: true
    },
    normalization_status: {
      type: DataTypes.ENUM('canonical','generated','needs_review'),
      allowNull: false,
      defaultValue: "generated"
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
    tableName: 'vehicle_market_aliases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "alias_id" },
        ]
      },
      {
        name: "uq_vehicle_alias",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "alias_name" },
          { name: "variant_id" },
        ]
      },
      {
        name: "idx_vehicle_alias_name",
        using: "BTREE",
        fields: [
          { name: "alias_name" },
        ]
      },
      {
        name: "idx_vehicle_alias_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "fk_vehicle_alias_model",
        using: "BTREE",
        fields: [
          { name: "model_id" },
        ]
      },
      {
        name: "fk_vehicle_alias_make",
        using: "BTREE",
        fields: [
          { name: "make_id" },
        ]
      },
      {
        name: "fk_vehicle_alias_source",
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
    ]
  });
  }
}
