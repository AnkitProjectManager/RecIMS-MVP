export default function handler(req, res) {
  res.status(200).json({
    nodeEnv: process.env.NODE_ENV,
    jwtSet: !!process.env.JWT_SECRET,
    dbUrlPrefix: (process.env.DATABASE_URL || '').slice(0, 60),
  });
}
