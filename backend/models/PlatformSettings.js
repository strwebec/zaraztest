const mongoose = require('mongoose');

// Singleton document (always _id: 'default') holding platform-wide settings an
// admin can edit live — currently just the two sets of payment requisites shown
// to businesses when they owe commission or want to buy TOP-placement. Editing
// these here updates what every business cabinet displays immediately.
const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    commissionRequisites: { type: String, default: '' },
    topPlacementRequisites: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

async function getOrCreate() {
  let doc = await mongoose.model('PlatformSettings').findById('default');
  if (!doc) doc = await mongoose.model('PlatformSettings').create({ _id: 'default' });
  return doc;
}

platformSettingsSchema.statics.getOrCreate = getOrCreate;

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
