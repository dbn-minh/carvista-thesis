import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class SellerReviews extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    seller_review_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    seller_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    buyer_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    listing_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'listings',
        key: 'listing_id'
      }
    },
    rating: {
      type: DataTypes.TINYINT,
      allowNull: false
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'seller_reviews',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "seller_review_id" },
        ]
      },
      {
        name: "idx_seller_reviews_seller",
        using: "BTREE",
        fields: [
          { name: "seller_id" },
        ]
      },
      {
        name: "idx_seller_reviews_buyer",
        using: "BTREE",
        fields: [
          { name: "buyer_id" },
        ]
      },
      {
        name: "fk_seller_reviews_listing",
        using: "BTREE",
        fields: [
          { name: "listing_id" },
        ]
      },
    ]
  });
  }
}
