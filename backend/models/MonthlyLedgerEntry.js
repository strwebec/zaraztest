const mongoose = require('mongoose');

// One document per business per calendar month. `values` holds only the manually
// entered custom-metric figures (encrypted at rest, see utils/ledgerCrypto) — auto
// stats like booking revenue and platform commission are never stored here, they're
// recomputed live from Booking/Expense so they can never drift from the source data.
const monthlyLedgerEntrySchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    month: { type: String, required: true }, // YYYY-MM
    values: { type: Map, of: String, default: () => new Map() },
  },
  { timestamps: true }
);

monthlyLedgerEntrySchema.index({ business: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyLedgerEntry', monthlyLedgerEntrySchema);
