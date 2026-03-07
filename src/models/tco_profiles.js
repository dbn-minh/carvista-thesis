import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class TcoProfiles extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    profile_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    market_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'markets',
        key: 'market_id'
      }
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'tco_profiles',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "profile_id" },
        ]
      },
      {
        name: "idx_tco_profiles_market",
        using: "BTREE",
        fields: [
          { name: "market_id" },
        ]
      },
    ]
  });
  }
}
