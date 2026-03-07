import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class AiChatSessions extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    session_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    context_json: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'ai_chat_sessions',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "session_id" },
        ]
      },
      {
        name: "idx_ai_sessions_user",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
    ]
  });
  }
}
