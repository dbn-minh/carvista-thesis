import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ListingImages extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    listing_image_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    listing_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'listings',
        key: 'listing_id'
      }
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'listing_images',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "listing_image_id" },
        ]
      },
      {
        name: "idx_listing_images_listing",
        using: "BTREE",
        fields: [
          { name: "listing_id" },
        ]
      },
    ]
  });
  }
}
