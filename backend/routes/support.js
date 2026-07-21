const express = require('express');

const SupportThread = require('../models/SupportThread');
const SupportMessage = require('../models/SupportMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/adminPermission');
const { authedLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { imageUploader, verifyImageSignature, finalizeUpload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGE_LENGTH = 2000;
const adminOnly = requirePermission('support');
const chatImageUpload = imageUploader().single('image');

// Empty string is valid here (an image-only message has no text) — only an
// over-length message is rejected; "neither text nor image" is checked separately
// once the caller also knows whether a file came through.
function validateText(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length > MAX_MESSAGE_LENGTH) return undefined;
  return trimmed;
}

function messagePreview(text, hasImage) {
  if (text) return text.slice(0, 140);
  return hasImage ? '📷 Фото' : '';
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
  chatImageUpload,
  verifyImageSignature,
  finalizeUpload('support', 'image'),
  asyncHandler(async (req, res) => {
    const text = validateText(req.body?.text);
    if (text === undefined || (!text && !req.file)) return res.status(400).json({ error: 'INVALID_INPUT' });
    const imageUrl = req.file?.publicUrl;

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const preview = messagePreview(text, !!imageUrl);
    let thread = await SupportThread.findOne({ user: req.userId });
    if (!thread) {
      thread = await SupportThread.create({
        user: req.userId,
        userRole: user.role,
        userName: user.name,
        userEmail: user.email,
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        lastMessageFrom: 'user',
        unreadByAdmin: 1,
        unreadByUser: 0,
      });
    } else {
      thread.lastMessageAt = new Date();
      thread.lastMessagePreview = preview;
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
      imageUrl,
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
  adminOnly,
  asyncHandler(async (_req, res) => {
    const threads = await SupportThread.find({}).sort({ lastMessageAt: -1 }).lean();
    res.json({ threads });
  })
);

router.get(
  '/admin/threads/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findById(req.params.id).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    const messages = await SupportMessage.find({ thread: thread._id }).sort({ createdAt: 1 }).lean();
    res.json({ thread, messages });
  })
);

router.post(
  '/admin/threads/:id/messages',
  adminOnly,
  authedLimiter,
  chatImageUpload,
  verifyImageSignature,
  finalizeUpload('support', 'image'),
  asyncHandler(async (req, res) => {
    const text = validateText(req.body?.text);
    if (text === undefined || (!text && !req.file)) return res.status(400).json({ error: 'INVALID_INPUT' });
    const imageUrl = req.file?.publicUrl;

    const thread = await SupportThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

    const admin = await User.findById(req.userId).lean();
    const preview = messagePreview(text, !!imageUrl);
    thread.lastMessageAt = new Date();
    thread.lastMessagePreview = preview;
    thread.lastMessageFrom = 'admin';
    thread.unreadByUser += 1;
    await thread.save();

    const message = await SupportMessage.create({
      thread: thread._id,
      from: 'admin',
      author: req.userId,
      authorName: admin.name,
      text,
      imageUrl,
    });

    await Notification.create({
      user: thread.user,
      type: 'support_reply',
      title: 'Відповідь від підтримки',
      text: preview,
    });

    res.status(201).json({ message });
  })
);

router.post(
  '/admin/threads/:id/read',
  adminOnly,
  asyncHandler(async (req, res) => {
    await SupportThread.updateOne({ _id: req.params.id }, { unreadByAdmin: 0 });
    res.json({ ok: true });
  })
);

router.post(
  '/admin/threads/:id/resolve',
  adminOnly,
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findByIdAndUpdate(req.params.id, { status: 'COMPLETED' }, { new: true }).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ thread });
  })
);

router.post(
  '/admin/threads/:id/reopen',
  adminOnly,
  asyncHandler(async (req, res) => {
    const thread = await SupportThread.findByIdAndUpdate(req.params.id, { status: 'ACTIVE' }, { new: true }).lean();
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ thread });
  })
);

module.exports = router;
