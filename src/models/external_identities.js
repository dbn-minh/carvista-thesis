import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class ExternalIdentities extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    external_identity_id: {
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
    provider_name: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    provider_user_id: {
      type: DataTypes.STRING(190),
      allowNull: false
    },
    provider_email: {
      type: DataTypes.STRING(190),
      allowNull: true
    },
    provider_display_name: {
      type: DataTypes.STRING(190),
      allowNull: true
    },
    provider_avatar_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    provider_email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0
    },
    metadata_json: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'external_identities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "external_identity_id" },
        ]
      },
      {
        name: "uniq_external_provider_user",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "provider_name" },
          { name: "provider_user_id" },
        ]
      },
      {
        name: "idx_external_user",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
    ]
  });
  }
}
