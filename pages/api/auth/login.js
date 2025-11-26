const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { init } = require('../../../lib/db')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const db = init()
  try {
    const { email, password } = req.body
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.status(200).json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, tenant_id: user.tenant_id, role: user.role } })
  } catch (err) {
    console.error('Login error', err)
    res.status(500).json({ error: 'Login failed' })
  }
}
