import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Reports extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    report_id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    reporter_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    entity_type: {
      type: DataTypes.ENUM('listing','car_review','seller_review','user'),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending','reviewing','resolved','rejected'),
      allowNull: false,
      defaultValue: "pending"
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolved_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    }
  }, {
    sequelize,
    tableName: 'reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "report_id" },
        ]
      },
      {
        name: "idx_reports_status_time",
        using: "BTREE",
        fields: [
          { name: "status" },
          { name: "created_at" },
        ]
      },
      {
        name: "idx_reports_entity",
        using: "BTREE",
        fields: [
          { name: "entity_type" },
          { name: "entity_id" },
        ]
      },
      {
        name: "fk_reports_reporter",
        using: "BTREE",
        fields: [
          { name: "reporter_id" },
        ]
      },
      {
        name: "fk_reports_resolved_by",
        using: "BTREE",
        fields: [
          { name: "resolved_by" },
        ]
      },
    ]
  });
  }
}
