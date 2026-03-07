import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class CarReviews extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    car_review_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    rating: {
      type: DataTypes.TINYINT,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: true
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'car_reviews',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "car_review_id" },
        ]
      },
      {
        name: "uq_car_review_user_variant",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "variant_id" },
        ]
      },
      {
        name: "idx_car_reviews_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
    ]
  });
  }
}
