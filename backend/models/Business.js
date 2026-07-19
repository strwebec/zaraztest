const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, required: true, index: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    district: String,
    address: String,
    lat: Number,
    lng: Number,
    phone: String,
    socials: {
      instagram: String,
      facebook: String,
    },
    googleMapsUrl: String,

    coverPhotoUrl: String,
    galleryUrls: [String],

    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'HIDDEN', 'BLOCKED'],
      default: 'PENDING',
      index: true,
    },
    agreementAcceptedAt: Date,
    rejectionReason: String,
    blockedUntil: Date,
    blockReason: String,

    cancellationPolicyHours: { type: Number, enum: [12, 24, 48], default: 24 },

    // Gap enforced after every booking (e.g. 5 min for a client to pay/leave before the
    // next one starts) — padded onto each existing booking's busy window when computing
    // availability, so it applies automatically without touching the booking's own duration.
    bufferMinutes: { type: Number, default: 0, min: 0, max: 120 },

    // How many days into the future a client may book — the client-facing date picker
    // only offers this many days (today inclusive), and booking creation is rejected past it.
    bookingWindowDays: { type: Number, default: 30, min: 1, max: 365 },

    // Business-level default hours — the ceiling every service's duration and every
    // staff member's own schedule should fit within. Distinct from Staff.schedule,
    // which lets an individual master work fewer/different hours than this bound.
    workingHours: {
      // A single nested object whose own children are themselves objects (mon, tue, ...)
      // gets treated as a single-nested subdocument by Mongoose, which auto-assigns it an
      // _id unless told not to — that stray _id then round-trips back on the next PATCH
      // /me/working-hours as an extra top-level key, failing the weekday-key validation.
      type: new mongoose.Schema(
        {
          mon: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          tue: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          wed: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          thu: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          fri: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          sat: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
          sun: { start: String, end: String, dayOff: Boolean, breakStart: String, breakEnd: String },
        },
        { _id: false }
      ),
      default: () => ({
        mon: { start: '09:00', end: '19:00', dayOff: false },
        tue: { start: '09:00', end: '19:00', dayOff: false },
        wed: { start: '09:00', end: '19:00', dayOff: false },
        thu: { start: '09:00', end: '19:00', dayOff: false },
        fri: { start: '09:00', end: '19:00', dayOff: false },
        sat: { start: '10:00', end: '16:00', dayOff: false },
        sun: { start: '', end: '', dayOff: true },
      }),
    },

    googleRating: { type: Number, default: 0 },
    googleReviewsCount: { type: Number, default: 0 },
    platformRating: { type: Number, default: 0 },
    platformReviewsCount: { type: Number, default: 0 },

    bookingsLast30Days: { type: Number, default: 0 },
    profileViewsLast30Days: { type: Number, default: 0 },
    repeatClientsRatio: { type: Number, default: 0 },
    platformPopularityScore: { type: Number, default: 0 },
    catalogScore: { type: Number, default: 0 },

    top: {
      active: { type: Boolean, default: false },
      until: Date,
    },

    unfairCancellations: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    underReview: { type: Boolean, default: false },
    catalogPenaltyUntil: Date,

    billing: {
      unpaidSince: Date,
      status: { type: String, enum: ['CURRENT', 'OVERDUE', 'BLOCKED'], default: 'CURRENT' },
    },

    // Offline-fallback backup: a Google Sheet mirroring this business's upcoming
    // bookings, synced every 5 minutes so the business can keep working from it
    // if the platform's own servers are unreachable. See utils/googleSheets.js.
    backupSheetId: String,
    backupSheetUrl: String,
  },
  { timestamps: true }
);

businessSchema.index({ city: 1, category: 1, status: 1 });

module.exports = mongoose.model('Business', businessSchema);
