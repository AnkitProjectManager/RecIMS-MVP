import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import formidable from 'formidable';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB upper bound

export const config = {
  api: {
    bodyParser: false,
  },
};

export const runtime = 'nodejs';

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function verifyToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function sanitizeName(name) {
  if (!name) return 'upload';
  return name
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'upload';
}

function isAllowedMime(mimetype = '') {
  if (!mimetype) return false;
  if (mimetype.startsWith('image/')) return true;
  const allowed = new Set([
    'application/pdf',
    'application/octet-stream',
  ]);
  return allowed.has(mimetype);
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  ensureUploadDir();

  const form = formidable({
    multiples: false,
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    maxFileSize: MAX_UPLOAD_SIZE_BYTES,
  });

  return new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      const finalize = (status, payload) => {
        if (!res.headersSent) {
          res.status(status).json(payload);
        }
        resolve();
      };

      if (err) {
        console.error('[upload] parse error', err);
        const status = err.httpCode || 400;
        return finalize(status, { error: 'Failed to process upload' });
      }

      const providedRaw = files.file || files.upload || Object.values(files)[0];
      const provided = Array.isArray(providedRaw) ? providedRaw[0] : providedRaw;
      if (!provided) {
        return finalize(400, { error: 'File is required' });
      }

      const tempPath = provided.filepath || provided.path;
      if (!tempPath) {
        return finalize(400, { error: 'Upload did not include a file path' });
      }

      const originalName = provided.originalFilename || provided.newFilename || 'upload';
      const extension = path.extname(originalName) || '';
      const safeBase = sanitizeName(originalName.replace(extension, ''));
      const timestamp = Date.now();
      const targetName = `${safeBase}-${timestamp}${extension}`;
      const targetPath = path.join(UPLOAD_DIR, targetName);

      if (!isAllowedMime(provided.mimetype)) {
        await fsPromises.unlink(tempPath).catch(() => {});
        return finalize(400, { error: 'Unsupported file type' });
      }

      const moveFile = async () => {
        try {
          await fsPromises.rename(tempPath, targetPath);
        } catch (moveError) {
          if (moveError.code === 'EXDEV') {
            await fsPromises.copyFile(tempPath, targetPath);
            await fsPromises.unlink(tempPath).catch(() => {});
          } else {
            throw moveError;
          }
        }
      };

      try {
        await moveFile();
      } catch (moveError) {
        console.error('[upload] failed to move file', moveError);
        await fsPromises.unlink(tempPath).catch(() => {});
        return finalize(500, { error: 'Failed to store uploaded file' });
      }

      const relativeUrl = `/uploads/${targetName}`;
      return finalize(201, {
        file_url: relativeUrl,
        file_name: targetName,
        tenant_id: decoded.tenant_id || null,
      });
    });
  });
}
