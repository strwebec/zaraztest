const Business = require('../models/Business');
const TopPlacement = require('../models/TopPlacement');

// Runs every 5 minutes. A business "confirms payment" on a TOP request (submitting a
// receipt) which starts a 15-minute grace window — an admin can still reject a
// fraudulent receipt in that window; if nobody does, this activates it automatically.
async function runTopPlacementActivation() {
  const due = await TopPlacement.find({ status: 'AWAITING_ACTIVATION', activateAt: { $lte: new Date() } })
    .select('durationDays business')
    .lean();

  let activated = 0;
  for (const due_ of due) {
    const confirmedAt = new Date();
    const expiresAt = new Date(confirmedAt.getTime() + due_.durationDays * 24 * 60 * 60 * 1000);

    // Atomic, status-guarded update — mirrors POST /admin/top-placements/:id/confirm.
    // If an admin fast-tracked this same placement between the find() above and here,
    // the status:'AWAITING_ACTIVATION' filter no longer matches and this silently
    // no-ops instead of double-activating or overwriting the admin's own timestamps.
    const placement = await TopPlacement.findOneAndUpdate(
      { _id: due_._id, status: 'AWAITING_ACTIVATION' },
      { status: 'CONFIRMED', confirmedAt, expiresAt },
      { new: true }
    );
    if (!placement) continue;

    await Business.updateOne({ _id: placement.business }, { top: { active: true, until: expiresAt } });
    activated += 1;
  }

  if (activated) console.log(`[topPlacementActivation] activated ${activated} placements`);
}

module.exports = { runTopPlacementActivation };
