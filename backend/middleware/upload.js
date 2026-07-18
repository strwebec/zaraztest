const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const PDF_TYPES = { 'application/pdf': '.pdf' };

// Local disk (backend/uploads/) only survives as long as this exact container/process
// does — most hosts (Render, Railway, Vercel, etc.) wipe it on every redeploy or restart.
// When Cloudinary credentials are set, every upload goes there instead and the URL is
// permanent; without them (plain local dev), files fall back to disk so nothing extra is
// required to run the app locally.
const CLOUDINARY_ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Files are held in memory (never touch local disk) until finalizeUpload() decides
// whether they go to Cloudinary or to backend/uploads/ — needed because the signature
// check and the Cloudinary upload both just need the raw bytes, not a filesystem path.
function imageUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, !!IMAGE_TYPES[file.mimetype]),
  });
}

function pdfUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, !!PDF_TYPES[file.mimetype]),
  });
}

function collectFiles(req) {
  if (req.files) return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
  return req.file ? [req.file] : [];
}

// multer's fileFilter only ever sees the multipart Content-Type header the client
// claims for the part — fully attacker-controlled. Someone can upload an HTML file
// with a spoofed "image/jpeg" header and it sails through as a legitimate photo. This
// checks the file's real magic bytes in memory, so a mismatch (mislabeled or malicious
// content) is caught before it's ever persisted anywhere.
const SIGNATURE_CHECKS = {
  image: (buf) => {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    )
      return true; // PNG
    if (
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    )
      return true; // WEBP
    return false;
  },
  pdf: (buf) => buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-',
};

function verifySignature(kind) {
  const check = SIGNATURE_CHECKS[kind];
  return (req, res, next) => {
    const files = collectFiles(req);
    if (files.length === 0) return next();
    for (const file of files) {
      if (!check(file.buffer.subarray(0, 12))) {
        return res.status(400).json({ error: 'INVALID_FILE' });
      }
    }
    next();
  };
}

function uploadBufferToCloudinary(file, subdir, kind) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: `${subdir}/${crypto.randomUUID()}`, resource_type: kind === 'pdf' ? 'raw' : 'image' },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(file.buffer);
  });
}

function writeBufferToDisk(file, subdir, kind) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const ext = (kind === 'pdf' ? PDF_TYPES : IMAGE_TYPES)[file.mimetype] || '';
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${subdir}/${filename}`;
}

// Runs after verifySignature — persists each file (Cloudinary if configured, else local
// disk) and sets file.publicUrl so route handlers never need to know which storage
// backend actually served the request.
function finalizeUpload(subdir, kind = 'image') {
  return async (req, res, next) => {
    const files = collectFiles(req);
    if (files.length === 0) return next();
    try {
      for (const file of files) {
        file.publicUrl = CLOUDINARY_ENABLED
          ? (await uploadBufferToCloudinary(file, subdir, kind)).secure_url
          : writeBufferToDisk(file, subdir, kind);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  UPLOAD_ROOT,
  CLOUDINARY_ENABLED,
  imageUploader,
  pdfUploader,
  finalizeUpload,
  verifyImageSignature: verifySignature('image'),
  verifyPdfSignature: verifySignature('pdf'),
};
