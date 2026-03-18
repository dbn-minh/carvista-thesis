import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class SavedListings extends Model {
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
    listing_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'listings',
        key: 'listing_id'
      }
    }
  }, {
    sequelize,
    tableName: 'saved_listings',
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
          { name: "listing_id" },
        ]
      },
      {
        name: "fk_saved_listings_listing",
        using: "BTREE",
        fields: [
          { name: "listing_id" },
        ]
      },
    ]
  });
  }
}
