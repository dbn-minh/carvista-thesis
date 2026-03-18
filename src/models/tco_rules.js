import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class TcoRules extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    rule_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tco_profiles',
        key: 'profile_id'
      }
    },
    cost_type: {
      type: DataTypes.ENUM('registration_tax','excise_tax','vat','import_duty','insurance','maintenance','depreciation','other'),
      allowNull: false
    },
    rule_kind: {
      type: DataTypes.ENUM('rate','fixed','formula'),
      allowNull: false,
      defaultValue: "rate"
    },
    rate: {
      type: DataTypes.DECIMAL(10,6),
      allowNull: true
    },
    fixed_amount: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    formula_json: {
      type: DataTypes.JSON,
      allowNull: true
    },
    applies_to: {
      type: DataTypes.ENUM('all','ev','ice','hybrid','phev'),
      allowNull: false,
      defaultValue: "all"
    }
  }, {
    sequelize,
    tableName: 'tco_rules',
    timestamps: true,
    createdAt: 'created_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "rule_id" },
        ]
      },
      {
        name: "idx_tco_rules_profile",
        using: "BTREE",
        fields: [
          { name: "profile_id" },
        ]
      },
    ]
  });
  }
}
