const multer = require('multer');
const path = require('path');

// Safe allowed educational MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
]);

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Dangerous file extensions blocklist
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.dll', '.com', '.vbs', '.js',
  '.ts', '.html', '.htm', '.php', '.phtml', '.jar', '.scr', '.ps1', '.py',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  // Strict extension check
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    const error = new Error(`Executable and script files (${ext}) are strictly prohibited.`);
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    return cb(error, false);
  }

  // Strict MIME type check
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, PDF, TXT, MD.`);
    error.code = 'INVALID_FILE_TYPE';
    error.status = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// Memory storage for secure analysis (avoids saving unvetted temp files to disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

/**
 * Express wrapper for single file upload with standard error handling
 */
const validateFileUpload = (fieldName = 'file') => (req, res, next) => {
  const uploadSingle = upload.single(fieldName);

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            code: 'FILE_TOO_LARGE',
            message: `File exceeds maximum allowed limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
          });
        }
        return res.status(400).json({
          success: false,
          code: 'UPLOAD_ERROR',
          message: err.message,
        });
      }

      return res.status(err.status || 400).json({
        success: false,
        code: err.code || 'INVALID_FILE',
        message: err.message || 'File validation failed',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'NO_FILE_PROVIDED',
        message: `Please attach a valid file in '${fieldName}' field.`,
      });
    }

    next();
  });
};

module.exports = {
  validateFileUpload,
  ALLOWED_MIME_TYPES: Array.from(ALLOWED_MIME_TYPES),
  MAX_FILE_SIZE,
};
