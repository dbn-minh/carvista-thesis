import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class SavedLogs extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    log_id: {
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
      type: DataTypes.ENUM('listing','variant'),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    action: {
      type: DataTypes.ENUM('saved','unsaved'),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'saved_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "log_id" },
        ]
      },
      {
        name: "idx_saved_logs_user_time",
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "created_at" },
        ]
      },
      {
        name: "idx_saved_logs_entity",
        using: "BTREE",
        fields: [
          { name: "entity_type" },
          { name: "entity_id" },
        ]
      },
    ]
  });
  }
}
