import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CarVariants extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    variant_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    model_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'car_models',
        key: 'model_id'
      }
    },
    model_year: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    trim_name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    body_type: {
      type: DataTypes.ENUM('sedan','hatchback','suv','cuv','mpv','pickup','coupe','convertible','wagon','van','other'),
      allowNull: false,
      defaultValue: "other"
    },
    engine: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    transmission: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    drivetrain: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    fuel_type: {
      type: DataTypes.ENUM('gasoline','diesel','hybrid','phev','ev','other'),
      allowNull: false,
      defaultValue: "other"
    },
    seats: {
      type: DataTypes.TINYINT,
      allowNull: true
    },
    doors: {
      type: DataTypes.TINYINT,
      allowNull: true
    },
    msrp_base: {
      type: DataTypes.DECIMAL(14,2),
      allowNull: true
    },
    is_placeholder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: 'car_variants',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "uq_variant_unique",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "model_id" },
          { name: "model_year" },
          { name: "trim_name" },
        ]
      },
      {
        name: "idx_variants_model",
        using: "BTREE",
        fields: [
          { name: "model_id" },
        ]
      },
      {
        name: "idx_variants_year",
        using: "BTREE",
        fields: [
          { name: "model_year" },
        ]
      },
    ]
  });
  }
}
