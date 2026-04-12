import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class DataFreshnessSnapshots extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    freshness_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    entity_type: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    entity_key: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    source_reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'source_references',
        key: 'source_reference_id'
      }
    },
    last_refreshed_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    freshness_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('fresh','stale','expired','unknown'),
      allowNull: false,
      defaultValue: "unknown"
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'data_freshness_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "freshness_id" },
        ]
      },
      {
        name: "uq_data_freshness",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "entity_type" },
          { name: "entity_key" },
        ]
      },
      {
        name: "fk_data_freshness_source",
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
    ]
  });
  }
}
