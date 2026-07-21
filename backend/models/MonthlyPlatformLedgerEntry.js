const mongoose = require('mongoose');

// One document per calendar month, platform-wide. `values` holds only the manually
// entered figures (salaries, taxes, other costs), encrypted at rest via
// utils/ledgerCrypto — auto stats like collected commission and TOP-placement
// revenue are never stored here, they're recomputed live from Invoice/TopPlacement
// so they can never drift from the source data.
const monthlyPlatformLedgerEntrySchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // YYYY-MM
    values: { type: Map, of: String, default: () => new Map() },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MonthlyPlatformLedgerEntry', monthlyPlatformLedgerEntrySchema);
