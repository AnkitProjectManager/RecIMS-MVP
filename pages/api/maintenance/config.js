const jwt = require('jsonwebtoken')
const { init } = require('../../../lib/persistence')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'

function verifyToken(req) {
  const auth = req.headers.authorization || ''
  const token = auth.split(' ')[1]
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

function normalizeTenantId(value) {
  const base = (value || '').toString().trim().toUpperCase()
  return base || null
}

async function exportTenantData(db, tenantId) {
  const tenantPromise = db.prepare('SELECT * FROM tenants WHERE tenant_id = ?').get(tenantId)
  const categoriesPromise = db.prepare('SELECT * FROM tenant_categories WHERE tenant_id = ?').all(tenantId)
  const contactsPromise = db.prepare('SELECT * FROM tenant_contacts WHERE tenant_id = ?').all(tenantId)
  const settingsPromise = db.prepare('SELECT * FROM appsettings WHERE tenant_id = ? OR tenant_id IS NULL').all(tenantId)
  const recordsPromise = db.prepare('SELECT * FROM entity_records WHERE tenant_id = ? OR tenant_id IS NULL').all(tenantId)

  const [tenantRow, categories, contacts, settings, records] = await Promise.all([
    tenantPromise,
    categoriesPromise,
    contactsPromise,
    settingsPromise,
    recordsPromise,
  ])

  return {
    tenant_id: tenantId,
    exported_at: new Date().toISOString(),
    data: {
      tenant: tenantRow ? { ...tenantRow } : null,
      tenant_categories: categories ?? [],
      tenant_contacts: contacts ?? [],
      appsettings: settings ?? [],
      entity_records: records ?? [],
    },
  }
}

async function insertRows(db, tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return
  }
  for (const entry of rows) {
    const record = { ...entry }
    const columns = Object.keys(record)
    if (columns.length === 0) continue
    const placeholders = columns.map(() => '?').join(', ')
    const values = columns.map((column) => record[column])
    await db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values)
  }
}

async function importTenantData(db, tenantId, payload = {}) {
  const normalizedData = payload.data || payload
  const tenantData = normalizedData.tenant
  if (tenantData) {
    await db.prepare('DELETE FROM tenants WHERE tenant_id = ?').run(tenantId)
    const record = { ...tenantData, tenant_id: tenantId }
    await insertRows(db, 'tenants', [record])
  }

  const tenantScopedTables = [
    ['tenant_categories', 'tenant_categories'],
    ['tenant_contacts', 'tenant_contacts'],
    ['appsettings', 'appsettings'],
    ['entity_records', 'entity_records'],
  ]

  for (const [key, table] of tenantScopedTables) {
    const rows = Array.isArray(normalizedData[key]) ? normalizedData[key] : []
    await db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).run(tenantId)
    if (rows.length > 0) {
      const scopedRows = rows.map((entry) => ({ ...entry, tenant_id: entry.tenant_id || tenantId }))
      await insertRows(db, table, scopedRows)
    }
  }
}

export default async function handler(req, res) {
  const decoded = verifyToken(req)
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const normalizedRole = (decoded.role || '').toString().toLowerCase()
  if (!['super_admin', 'admin'].includes(normalizedRole)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const tenantIdSource = req.method === 'GET' ? req.query.tenantId : req.body?.tenant_id
  const tenantId = normalizeTenantId(tenantIdSource || decoded.tenant_id)
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' })
  }

  const db = await init()

  if (req.method === 'GET') {
    try {
      const snapshot = await exportTenantData(db, tenantId)
      return res.json(snapshot)
    } catch (error) {
      console.error('[config-export] failed', error)
      return res.status(500).json({ error: 'Failed to export tenant configuration' })
    }
  }

  if (req.method === 'POST') {
    try {
      await importTenantData(db, tenantId, req.body || {})
      return res.status(202).json({ message: 'Import accepted', tenant_id: tenantId })
    } catch (error) {
      console.error('[config-import] failed', error)
      return res.status(500).json({ error: 'Failed to import tenant configuration' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).end('Method Not Allowed')
}
