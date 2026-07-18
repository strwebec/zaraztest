const Business = require('../models/Business');
const TopPlacement = require('../models/TopPlacement');

// Runs every 5 minutes. A business "confirms payment" on a TOP request (submitting a
// receipt) which starts a 15-minute grace window — an admin can still reject a
// fraudulent receipt in that window; if nobody does, this activates it automatically.
async function runTopPlacementActivation() {
  const due = await TopPlacement.find({ status: 'AWAITING_ACTIVATION', activateAt: { $lte: new Date() } });

  for (const placement of due) {
    const confirmedAt = new Date();
    const expiresAt = new Date(confirmedAt.getTime() + placement.durationDays * 24 * 60 * 60 * 1000);

    placement.status = 'CONFIRMED';
    placement.confirmedAt = confirmedAt;
    placement.expiresAt = expiresAt;
    await placement.save();

    await Business.updateOne({ _id: placement.business }, { top: { active: true, until: expiresAt } });
  }

  if (due.length) console.log(`[topPlacementActivation] activated ${due.length} placements`);
}

module.exports = { runTopPlacementActivation };
