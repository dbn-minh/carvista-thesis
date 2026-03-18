import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Notifications extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    notification_id: {
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
    entity_type: {
      type: DataTypes.ENUM('listing','viewing_request','report','price_alert','system'),
      allowNull: false,
      defaultValue: "system"
    },
    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('unread','read'),
      allowNull: false,
      defaultValue: "unread"
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "notification_id" },
        ]
      },
      {
        name: "idx_notifications_user_status_time",
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "status" },
          { name: "created_at" },
        ]
      },
    ]
  });
  }
}
