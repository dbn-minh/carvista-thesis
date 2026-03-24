import _sequelize from "sequelize";
const { Model } = _sequelize;

export default class AuthEventLogs extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        auth_event_log_id: {
          autoIncrement: true,
          type: DataTypes.BIGINT,
          allowNull: false,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: {
            model: "users",
            key: "user_id",
          },
        },
        event_type: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
        auth_method: {
          type: DataTypes.STRING(40),
          allowNull: false,
        },
        destination_type: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        destination_value: {
          type: DataTypes.STRING(190),
          allowNull: true,
        },
        provider_name: {
          type: DataTypes.STRING(40),
          allowNull: true,
        },
        success: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        ip_address: {
          type: DataTypes.STRING(64),
          allowNull: true,
        },
        metadata_json: {
          type: DataTypes.TEXT("long"),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "auth_event_logs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
        indexes: [
          {
            name: "PRIMARY",
            unique: true,
            fields: [{ name: "auth_event_log_id" }],
          },
          {
            name: "idx_auth_event_type_time",
            fields: [{ name: "event_type" }, { name: "created_at" }],
          },
          {
            name: "idx_auth_event_destination",
            fields: [{ name: "destination_type" }, { name: "destination_value" }],
          },
        ],
      }
    );
  }
}
