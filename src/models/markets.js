import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Markets extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    market_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    country_code: {
      type: DataTypes.CHAR(2),
      allowNull: false
    },
    currency_code: {
      type: DataTypes.CHAR(3),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'markets',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "market_id" },
        ]
      },
      {
        name: "uq_market_country_currency",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "country_code" },
          { name: "currency_code" },
        ]
      },
    ]
  });
  }
}
