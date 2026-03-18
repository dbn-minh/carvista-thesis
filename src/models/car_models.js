import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CarModels extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    model_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    make_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'car_makes',
        key: 'make_id'
      }
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    segment: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    is_placeholder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: 'car_models',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "model_id" },
        ]
      },
      {
        name: "uq_model_make_name",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "make_id" },
          { name: "name" },
        ]
      },
      {
        name: "idx_models_make",
        using: "BTREE",
        fields: [
          { name: "make_id" },
        ]
      },
    ]
  });
  }
}
