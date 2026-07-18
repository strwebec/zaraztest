const mongoose = require('mongoose');

// Lets a business configure its own monthly ledger columns — a salon might track
// "Оренда"/"ЗП майстрів", a medical center "Оренда обладнання"/"Лабораторні витрати".
// Mirrors CustomFieldDefinition's shape so the "add/remove a column" UX is consistent
// across both features. `group` decides how the value feeds the net-profit calculation;
// `persistence: recurring` lets a fixed monthly cost (rent, staff salary) be entered once
// and carried forward to future months automatically instead of re-entered every time.
const businessMetricDefinitionSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, enum: ['revenue', 'expense', 'info'], default: 'expense' },
    unit: { type: String, enum: ['currency', 'number', 'percent', 'text'], default: 'currency' },
    persistence: { type: String, enum: ['monthly', 'recurring'], default: 'monthly' },
    order: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

businessMetricDefinitionSchema.index({ business: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('BusinessMetricDefinition', businessMetricDefinitionSchema);
