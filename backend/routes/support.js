const express = require('express');

const SupportThread = require('../models/SupportThread');
const SupportMessage = require('../models/SupportMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { authedLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGE_LENGTH = 2000;
const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR'];

function validateText(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

// ---- User side: any authenticated role (client or business owner) ----

router.get(
  '/thread',
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findOne({ user: req.userId }).lean();
    if (!thread) return res.json({ thread: null, messages: [] });
    const messages = await SupportMessage.find({ thread: thread._id }).sort({ createdAt: 1 }).lean();
    res.json({ thread, messages });
  })
);

router.post(
  '/thread/messages',
  authedLimiter,
  asyncHandler(async (req, res) => {
    const text = validateText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'INVALID_INPUT' });

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    let thread = await SupportThread.findOne({ user: req.userId });
    if (!thread) {
      thread = await SupportThread.create({
        user: req.userId,
        userRole: user.role,
        userName: user.name,
        userEmail: user.email,
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 140),
        lastMessageFrom: 'user',
        unreadByAdmin: 1,
        unreadByUser: 0,
      });
    } else {
      thread.lastMessageAt = new Date();
      thread.lastMessagePreview = text.slice(0, 140);
      thread.lastMessageFrom = 'user';
      thread.unreadByAdmin += 1;
      // Replying to a closed thread is how a user reopens it — matches how
      // most support-ticket systems treat a new message on a resolved ticket.
      if (thread.status === 'COMPLETED') thread.status = 'ACTIVE';
      await thread.save();
    }

    const message = await SupportMessage.create({
      thread: thread._id,
      from: 'user',
      author: req.userId,
      authorName: user.name,
      text,
    });

    res.status(201).json({ message });
  })
);

router.post(
  '/thread/read',
  asyncHandler(async (req, res) => {
    await SupportThread.updateOne({ user: req.userId }, { unreadByUser: 0 });
    res.json({ ok: true });
  })
);

// ---- Admin side: SUPER_ADMIN or MODERATOR only ----

router.get(
  '/admin/threads',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const threads = await SupportThread.find({}).sort({ lastMessageAt: -1 }).lean();
    res.json({ threads });
  })
);

router.get(
  '/admin/threads/:id',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findById(req.params.id).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    const messages = await SupportMessage.find({ thread: thread._id }).sort({ createdAt: 1 }).lean();
    res.json({ thread, messages });
  })
);

router.post(
  '/admin/threads/:id/messages',
  requireRole(...ADMIN_ROLES),
  authedLimiter,
  asyncHandler(async (req, res) => {
    const text = validateText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'INVALID_INPUT' });

    const thread = await SupportThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

    const admin = await User.findById(req.userId).lean();
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = text.slice(0, 140);
    thread.lastMessageFrom = 'admin';
    thread.unreadByUser += 1;
    await thread.save();

    const message = await SupportMessage.create({
      thread: thread._id,
      from: 'admin',
      author: req.userId,
      authorName: admin.name,
      text,
    });

    await Notification.create({
      user: thread.user,
      type: 'support_reply',
      title: 'Відповідь від підтримки',
      text: text.slice(0, 140),
    });

    res.status(201).json({ message });
  })
);

router.post(
  '/admin/threads/:id/read',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await SupportThread.updateOne({ _id: req.params.id }, { unreadByAdmin: 0 });
    res.json({ ok: true });
  })
);

router.post(
  '/admin/threads/:id/resolve',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findByIdAndUpdate(req.params.id, { status: 'COMPLETED' }, { new: true }).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ thread });
  })
);

router.post(
  '/admin/threads/:id/reopen',
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findByIdAndUpdate(req.params.id, { status: 'ACTIVE' }, { new: true }).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ thread });
  })
);

module.exports = router;
