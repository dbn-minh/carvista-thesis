import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class SourceReferences extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    source_reference_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    provider_key: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    source_type: {
      type: DataTypes.ENUM('seed','internal_marketplace','official_api','configured_feed','web','manual'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    trust_level: {
      type: DataTypes.ENUM('high','medium','low'),
      allowNull: false,
      defaultValue: "medium"
    },
    retrieved_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    update_cadence: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'source_references',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
      {
        name: "idx_source_references_provider",
        using: "BTREE",
        fields: [
          { name: "provider_key" },
        ]
      },
      {
        name: "idx_source_references_type",
        using: "BTREE",
        fields: [
          { name: "source_type" },
        ]
      },
    ]
  });
  }
}
