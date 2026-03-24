import _sequelize from "sequelize";
const { Model } = _sequelize;

export default class OtpChallenges extends Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        challenge_id: {
          autoIncrement: true,
          type: DataTypes.BIGINT,
          allowNull: false,
          primaryKey: true,
        },
        destination_type: {
          type: DataTypes.ENUM("email", "phone"),
          allowNull: false,
        },
        destination_value: {
          type: DataTypes.STRING(190),
          allowNull: false,
        },
        purpose: {
          type: DataTypes.ENUM(
            "login",
            "register",
            "verify_contact",
            "passwordless_signin"
          ),
          allowNull: false,
          defaultValue: "login",
        },
        otp_hash: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        consumed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        last_sent_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        attempt_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        resend_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        metadata_json: {
          type: DataTypes.TEXT("long"),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "otp_challenges",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
        indexes: [
          {
            name: "PRIMARY",
            unique: true,
            fields: [{ name: "challenge_id" }],
          },
          {
            name: "idx_otp_destination",
            fields: [{ name: "destination_type" }, { name: "destination_value" }],
          },
          {
            name: "idx_otp_purpose_expiry",
            fields: [{ name: "purpose" }, { name: "expires_at" }],
          },
        ],
      }
    );
  }
}
