const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: String,
    bio: String,
    photoUrl: String,
    schedule: {
      type: Map,
      of: new mongoose.Schema(
        {
          start: String,
          end: String,
          dayOff: { type: Boolean, default: false },
          // Optional lunch break — a fixed unavailable window inside the working day,
          // distinct from dayOff (whole day) and timeOff (date range). Both must be set
          // together or neither counts.
          breakStart: String,
          breakEnd: String,
        },
        { _id: false }
      ),
      default: undefined,
    },
    timeOff: [
      {
        from: Date,
        to: Date,
        note: String,
      },
    ],
    active: { type: Boolean, default: true },
    // A hidden placeholder Staff document auto-created for businesses with zero real
    // staff, so the existing per-staff availability/booking machinery (built entirely
    // around Staff documents) still works when there's no actual master to assign —
    // see utils/virtualStaff.js. Never shown to clients or business owners as a real
    // master; every staff-listing query must exclude it.
    virtual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
