const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportThread', required: true, index: true },
    from: { type: String, enum: ['user', 'admin'], required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    // A message needs text or an image, not necessarily both — enforced in
    // routes/support.js rather than here since Mongoose can't easily require
    // "at least one of two fields" declaratively.
    text: { type: String, trim: true, default: '' },
    imageUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
