const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    // COMMISSION invoices are the automatic monthly one per business (see
    // jobs/monthlyInvoices.js) — MANUAL ones are ad-hoc, super-admin-created invoices
    // for an arbitrary amount (see routes/admin.js POST /invoices). Both share the same
    // status lifecycle and business-side confirm-payment/receipt-upload flow below.
    type: { type: String, enum: ['COMMISSION', 'MANUAL'], default: 'COMMISSION' },
    description: String, // MANUAL only — what the invoice is for
    month: { type: String, required: true }, // YYYY-MM
    items: [
      {
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        date: String,
        clientName: String,
        serviceName: String,
        price: Number,
        source: { type: String, enum: ['platform', 'manual'] },
        commissionRate: Number,
        commissionAmount: Number,
      },
    ],
    totalCommission: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'AWAITING_VERIFICATION', 'PAID', 'OVERDUE', 'BLOCKED'],
      default: 'PENDING',
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, required: true },
    paidAt: Date,
    warnedAt: Date,
    lastReminderAt: Date,
    receiptUrl: String,
    paymentConfirmedAt: Date,
    receiptRejectedReason: String,
    // Full history of every receipt submission, so a business that had two rejected
    // attempts before finally getting paid can still see why the earlier ones failed —
    // receiptRejectedReason above only ever holds the most recent one.
    receiptHistory: [
      {
        receiptUrl: String,
        submittedAt: Date,
        status: { type: String, enum: ['PENDING_REVIEW', 'REJECTED', 'ACCEPTED'] },
        rejectedReason: String,
        resolvedAt: Date,
      },
    ],
  },
  { timestamps: true }
);

// Only one automatic commission invoice per business per month — manual invoices are
// exempt (a business can get several in the same month) via the partial filter.
invoiceSchema.index({ business: 1, month: 1 }, { unique: true, partialFilterExpression: { type: 'COMMISSION' } });

module.exports = mongoose.model('Invoice', invoiceSchema);
