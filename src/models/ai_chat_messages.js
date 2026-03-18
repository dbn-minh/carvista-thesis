import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class AiChatMessages extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    message_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    session_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'ai_chat_sessions',
        key: 'session_id'
      }
    },
    role: {
      type: DataTypes.ENUM('user','assistant','tool'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tool_name: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    tool_payload: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'ai_chat_messages',
    timestamps: true,
    createdAt: 'created_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "message_id" },
        ]
      },
      {
        name: "idx_ai_messages_session_time",
        using: "BTREE",
        fields: [
          { name: "session_id" },
          { name: "created_at" },
        ]
      },
    ]
  });
  }
}
