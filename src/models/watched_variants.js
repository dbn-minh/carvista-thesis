import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class WatchedVariants extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    }
  }, {
    sequelize,
    tableName: 'watched_variants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "variant_id" },
        ]
      },
      {
        name: "fk_watched_variants_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
    ]
  });
  }
}
