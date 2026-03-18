import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ViewingRequests extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    request_id: {
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
    buyer_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    contact_name: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    contact_email: {
      type: DataTypes.STRING(190),
      allowNull: true
    },
    contact_phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending','accepted','rejected','cancelled'),
      allowNull: false,
      defaultValue: "pending"
    }
  }, {
    sequelize,
    tableName: 'viewing_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "request_id" },
        ]
      },
      {
        name: "idx_requests_listing",
        using: "BTREE",
        fields: [
          { name: "listing_id" },
        ]
      },
      {
        name: "idx_requests_buyer",
        using: "BTREE",
        fields: [
          { name: "buyer_id" },
        ]
      },
      {
        name: "idx_requests_status",
        using: "BTREE",
        fields: [
          { name: "status" },
        ]
      },
    ]
  });
  }
}
