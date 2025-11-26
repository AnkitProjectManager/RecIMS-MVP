import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import formidable from 'formidable';
import jwt from 'jsonwebtoken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB upper bound
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET || process.env.AWS_S3_UPLOAD_BUCKET;
const rawPrefix = ((process.env.UPLOADS_KEY_PREFIX && process.env.UPLOADS_KEY_PREFIX.length ? process.env.UPLOADS_KEY_PREFIX : 'uploads/')).replace(/^\/+/, '');
const UPLOADS_PREFIX = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
const S3_REGION = process.env.AWS_REGION || process.env.UPLOADS_REGION || 'us-east-1';
const PUBLIC_UPLOAD_BASE_URL = process.env.PUBLIC_UPLOAD_BASE_URL || '';

const s3Client = UPLOADS_BUCKET
  ? new S3Client({
      region: S3_REGION,
    })
  : null;

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

async function saveToLocal(tempPath, targetName) {
  ensureUploadDir();
  const targetPath = path.join(UPLOAD_DIR, targetName);

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

  return {
    storage: 'local',
    url: `/uploads/${targetName}`,
  };
}

async function saveToS3(tempPath, targetName, tenantId, mimetype) {
  if (!s3Client || !UPLOADS_BUCKET) {
    return saveToLocal(tempPath, targetName);
  }

  const tenantPrefix = tenantId ? `${tenantId}/` : '';
  const key = `${UPLOADS_PREFIX}${tenantPrefix}${targetName}`.replace(/^\/+/, '');
  const body = await fsPromises.readFile(tempPath);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimetype || 'application/octet-stream',
      ACL: process.env.UPLOADS_ACL || 'private',
    })
  );

  await fsPromises.unlink(tempPath).catch(() => {});

  const baseUrl = PUBLIC_UPLOAD_BASE_URL.replace(/\/$/, '');
  const url = baseUrl ? `${baseUrl}/${key}` : `https://${UPLOADS_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  return {
    storage: 's3',
    url,
    key,
  };
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

  if (!s3Client) {
    ensureUploadDir();
  }

  const form = formidable({
    multiples: false,
    uploadDir: s3Client ? undefined : UPLOAD_DIR,
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
      if (!isAllowedMime(provided.mimetype)) {
        await fsPromises.unlink(tempPath).catch(() => {});
        return finalize(400, { error: 'Unsupported file type' });
      }
      let stored;
      try {
        stored = await (s3Client
          ? saveToS3(tempPath, targetName, decoded.tenant_id, provided.mimetype)
          : saveToLocal(tempPath, targetName));
      } catch (moveError) {
        console.error('[upload] failed to store file', moveError);
        await fsPromises.unlink(tempPath).catch(() => {});
        return finalize(500, { error: 'Failed to store uploaded file' });
      }

      return finalize(201, {
        file_url: stored.url,
        file_name: targetName,
        storage: stored.storage,
        tenant_id: decoded.tenant_id || null,
      });
    });
  });
}
