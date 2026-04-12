import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class VehicleRecallSnapshots extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    recall_snapshot_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    variant_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'car_variants',
        key: 'variant_id'
      }
    },
    source_reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'source_references',
        key: 'source_reference_id'
      }
    },
    campaign_number: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    component: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    consequence: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    remedy: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'vehicle_recall_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "recall_snapshot_id" },
        ]
      },
      {
        name: "uq_vehicle_recall_variant_campaign",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "variant_id" },
          { name: "campaign_number" },
        ]
      },
      {
        name: "idx_vehicle_recall_variant",
        using: "BTREE",
        fields: [
          { name: "variant_id" },
        ]
      },
      {
        name: "fk_vehicle_recall_source",
        using: "BTREE",
        fields: [
          { name: "source_reference_id" },
        ]
      },
    ]
  });
  }
}
