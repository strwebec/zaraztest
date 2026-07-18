const mongoose = require('mongoose');

// Free-text category rather than an enum — what a medical center spends on
// (lab supplies, equipment servicing) has nothing in common with a barbershop
// (chairs, product stock), and forcing a shared category list would just get
// ignored or abused as a catch-all "other".
const expenseSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true }, // YYYY-MM-DD
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

expenseSchema.index({ business: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
