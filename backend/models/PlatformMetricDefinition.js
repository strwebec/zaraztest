const mongoose = require('mongoose');

// Same shape as BusinessMetricDefinition, but scoped to the whole platform instead
// of one business — lets the super-admin configure columns like "ЗП команди",
// "Податки", "Хостинг" for the platform-level payout ledger (routes/admin.js's
// /platform-ledger). `group` decides how the value feeds netPayout; `persistence:
// recurring` lets a fixed monthly cost be entered once and carried forward.
const platformMetricDefinitionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, enum: ['revenue', 'expense', 'info'], default: 'expense' },
    unit: { type: String, enum: ['currency', 'number', 'percent', 'text'], default: 'currency' },
    persistence: { type: String, enum: ['monthly', 'recurring'], default: 'monthly' },
    order: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformMetricDefinition', platformMetricDefinitionSchema);
