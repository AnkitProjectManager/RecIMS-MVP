const { getPersistenceDiagnostics } = require('../../lib/persistence');

export default function handler(req, res) {
  const diagnostics = getPersistenceDiagnostics();

  res.status(200).json({
    nodeEnv: process.env.NODE_ENV,
    jwtSet: !!process.env.JWT_SECRET,
    persistenceMode: diagnostics.mode,
    hasDatabaseUrl: diagnostics.hasDatabaseUrl,
    dbUrlPrefix: diagnostics.databaseUrlPrefix,
    sqlitePath: diagnostics.sqlitePath,
    sslMode: diagnostics.sslMode,
    uploadsBucketSet: Boolean(process.env.UPLOADS_BUCKET || process.env.AWS_S3_UPLOAD_BUCKET),
  });
}
