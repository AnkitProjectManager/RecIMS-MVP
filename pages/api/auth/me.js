const jwt = require('jsonwebtoken')
const { init } = require('../../../lib/persistence')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'

function verifyToken(req) {
  const auth = req.headers.authorization || ''
  const token = auth.split(' ')[1]
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (e) {
    return null
  }
}

export default async function handler(req, res) {
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' })

  const db = await init()

  if (req.method === 'GET') {
    const user = await db.prepare('SELECT id, email, full_name, tenant_id, role FROM users WHERE id = ?').get(decoded.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json(user)
  }

  if (req.method === 'PUT') {
    const updatableFields = ['full_name', 'tenant_id', 'role']
    const updates = {}

    updatableFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field]
      }
    })

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' })
    }

    const setClause = Object.keys(updates)
      .map(field => `${field} = ?`)
      .join(', ')

    await db
      .prepare(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...Object.values(updates), decoded.id)

    const user = await db.prepare('SELECT id, email, full_name, tenant_id, role FROM users WHERE id = ?').get(decoded.id)

    const token = jwt.sign(
      { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    return res.json({ user, token })
  }

  return res.status(405).end()
}
