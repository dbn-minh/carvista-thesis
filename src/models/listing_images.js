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
      type: DataTypes.TEXT('long'),
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: true
    },
    public_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    asset_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    format: {
      type: DataTypes.STRING(32),
      allowNull: true
    },
    bytes: {
      type: DataTypes.BIGINT,
      allowNull: true
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
