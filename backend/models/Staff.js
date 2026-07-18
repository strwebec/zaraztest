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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
