const mongoose = require('mongoose');

// Lets each business tailor what it tracks on a client record to its own
// category — a medical center might add "Група крові"/"Алергії", a salon
// "Формула фарби", an auto detailer "Марка авто"/"VIN" — without any of
// them touching a shared, one-size-fits-all schema.
const customFieldDefinitionSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    key: { type: String, required: true }, // stable slug, used as the customFieldValues map key
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'date', 'select', 'textarea'], default: 'text' },
    options: [String], // only meaningful when type === 'select'
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customFieldDefinitionSchema.index({ business: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('CustomFieldDefinition', customFieldDefinitionSchema);
