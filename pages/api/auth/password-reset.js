const { init } = require('../../../lib/db')

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { email } = req.body
    const db = init()
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    // In production, send an email. Here return success so UI behaves correctly.
    return res.json({ message: 'If that email exists, a reset link has been sent' })
  } catch (err) {
    console.error('Password reset error', err)
    return res.status(500).json({ error: 'Failed to process password reset' })
  }
}
