const { init } = require('../../../lib/db')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'
const TENANT_TABLE = 'tenants'
const TENANT_CATEGORY_TABLE = 'tenant_categories'
const TENANT_CONTACT_TABLE = 'tenant_contacts'
const GENERIC_ENTITY_TABLE = 'entity_records'
const TENANT_JSON_FIELD_MAP = {
  number_format_json: 'number_format',
  default_load_types_json: 'default_load_types',
  features_json: 'features',
  api_keys_json: 'api_keys',
}

const CATEGORY_JSON_FIELD = 'sub_categories_json'
const CONTACT_BOOLEAN_FIELDS = ['is_active']

const DEFAULT_NUMBER_FORMAT = { decimal: '.', thousand: ',' }
const DEFAULT_CATEGORY_SORT_ORDER = 0
const DEFAULT_SIGNATURE_FONT = 'Allura'

const ENTITY_TABLE_ALIAS = {
  tenant: TENANT_TABLE,
  tenants: TENANT_TABLE,
  tenantcategory: TENANT_CATEGORY_TABLE,
  tenantcategories: TENANT_CATEGORY_TABLE,
  'tenant_category': TENANT_CATEGORY_TABLE,
  'tenant_categories': TENANT_CATEGORY_TABLE,
  tenantcontact: TENANT_CONTACT_TABLE,
  tenantcontacts: TENANT_CONTACT_TABLE,
  'tenant_contact': TENANT_CONTACT_TABLE,
  'tenant_contacts': TENANT_CONTACT_TABLE,
  user: 'users',
  users: 'users',
  shiftlog: 'shiftlog',
  shiftlogs: 'shiftlog',
  'shift_log': 'shiftlog',
  'shift_logs': 'shiftlog',
}

function normalizeEntitySlug(value) {
  if (!value) return ''
  return value.replace(/-/g, '_').toLowerCase()
}

function resolveTableName(normalizedSlug) {
  if (!normalizedSlug) return ''
  const compactKey = normalizedSlug.replace(/_/g, '')
  return ENTITY_TABLE_ALIAS[normalizedSlug] || ENTITY_TABLE_ALIAS[compactKey] || normalizedSlug
}

function tableExists(db, tableName) {
  if (!tableName) return false
  const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
  return Boolean(stmt.get(tableName))
}

function safeParseJSON(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return Array.isArray(fallback) ? [...fallback] : typeof fallback === 'object' && fallback !== null ? { ...fallback } : fallback
  }
  try {
    return JSON.parse(value)
  } catch (error) {
    return Array.isArray(fallback) ? [...fallback] : typeof fallback === 'object' && fallback !== null ? { ...fallback } : fallback
  }
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'no', 'n'].includes(normalized)) return false
  }
  return Boolean(value)
}

function normalizeTenantId(value, fallback) {
  const base = (value ?? fallback ?? '').toString().trim()
  return base ? base.toUpperCase() : undefined
}

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

function isValidTableName(name) {
  return /^[a-z0-9_]+$/.test(name)
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.toLowerCase() : ''
}

function decodeTenantRow(row) {
  if (!row) return row
  const result = { ...row }

  Object.entries(TENANT_JSON_FIELD_MAP).forEach(([column, key]) => {
    if (column in result) {
      try {
        result[key] = result[column] ? JSON.parse(result[column]) : key === 'default_load_types' ? [] : {}
      } catch (error) {
        result[key] = key === 'default_load_types' ? [] : {}
      }
      delete result[column]
    }
  })

  if (!Array.isArray(result.default_load_types)) {
    result.default_load_types = []
  }
  if (!result.number_format) {
    result.number_format = DEFAULT_NUMBER_FORMAT
  }
  if (!result.features) {
    result.features = {}
  }
  if (!result.api_keys) {
    result.api_keys = {}
  }
  result.status = (result.status || 'ACTIVE').toUpperCase()
  return result
}

function sanitizeCode(value, fallback) {
  const base = (value || fallback || 'tenant').toString().toLowerCase()
  const slug = base.replace(/[^a-z0-9-]/g, '')
  return slug || 'tenant'
}

function decodeTenantCategoryRow(row) {
  if (!row) return row
  const result = { ...row }
  if (CATEGORY_JSON_FIELD in result) {
    result.sub_categories = safeParseJSON(result[CATEGORY_JSON_FIELD], [])
    delete result[CATEGORY_JSON_FIELD]
  } else if (!Array.isArray(result.sub_categories)) {
    result.sub_categories = []
  }
  result.is_active = toBoolean(result.is_active, true)
  result.category_type = (result.category_type || 'predefined').toLowerCase()
  result.load_type_mapping = (result.load_type_mapping || '').toUpperCase()
  return result
}

function decodeTenantContactRow(row) {
  if (!row) return row
  const result = { ...row }
  CONTACT_BOOLEAN_FIELDS.forEach((field) => {
    if (field in result) {
      result[field] = toBoolean(result[field], field === 'is_active')
    }
  })
  result.contact_type = (result.contact_type || 'primary').toLowerCase()
  result.signature_type = (result.signature_type || 'none').toLowerCase()
  result.signature_font = result.signature_font || DEFAULT_SIGNATURE_FONT
  return result
}

function decodeGenericEntityRow(row) {
  if (!row) return row
  let payload = {}
  if (row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json)
    } catch (error) {
      payload = {}
    }
  }

  const result = {
    id: row.id,
    ...payload,
  }

  if (!('tenant_id' in result) && row.tenant_id) {
    result.tenant_id = row.tenant_id
  }

  if (!('created_date' in result) && row.created_date) {
    result.created_date = row.created_date
  }

  if (!('updated_date' in result) && row.updated_date) {
    result.updated_date = row.updated_date
  }

  return result
}

function canAccessGenericRow(rowTenantId, actorTenantId, isSuperAdmin) {
  if (isSuperAdmin) return true
  const normalizedRow = normalizeTenantId(rowTenantId)
  const normalizedActor = normalizeTenantId(actorTenantId)
  if (!normalizedRow) return true
  return normalizedRow === normalizedActor
}

function encodeTenantInput(input = {}, existingRow, actorContext) {
  const existing = existingRow ? decodeTenantRow(existingRow) : null
  const now = new Date().toISOString()

  const baseName = input.name || existing?.name
  if (!baseName) {
    const error = new Error('Tenant name is required')
    error.status = 400
    throw error
  }

  const uppercaseName = baseName.toString().toUpperCase()
  const code = sanitizeCode(input.code, existing?.code || uppercaseName)
  const baseSubdomain = sanitizeCode(input.base_subdomain, existing?.base_subdomain || code)

  const isSuperAdmin = actorContext?.isSuperAdmin ?? false
  const tenantIdSource = isSuperAdmin
    ? input.tenant_id || existing?.tenant_id || `TNT-${Date.now()}`
    : actorContext?.tenantId
  const normalizedTenantId = normalizeTenantId(tenantIdSource, existing?.tenant_id)

  if (!normalizedTenantId) {
    const error = new Error('Tenant identifier is required')
    error.status = 400
    throw error
  }

  const tenantCodeSource = input.tenant_code ?? existing?.tenant_code ?? code
  const normalizedTenantCode = tenantCodeSource ? tenantCodeSource.toString().toUpperCase() : code.toUpperCase()

  const payload = {
    name: uppercaseName,
    display_name: input.display_name ?? existing?.display_name ?? uppercaseName,
    status: (input.status ?? existing?.status ?? 'ACTIVE').toUpperCase(),
    code,
    tenant_code: normalizedTenantCode,
    base_subdomain: baseSubdomain,
    business_type: input.business_type ?? existing?.business_type ?? 'general_manufacturing',
    primary_contact_name: input.primary_contact_name ?? existing?.primary_contact_name ?? '',
    primary_contact_email: input.primary_contact_email ?? existing?.primary_contact_email ?? '',
    primary_contact_phone: input.primary_contact_phone ?? existing?.primary_contact_phone ?? '',
    default_currency: input.default_currency ?? existing?.default_currency ?? 'USD',
    country_code: input.country_code ?? existing?.country_code ?? 'US',
    region: input.region ?? existing?.region ?? 'Global',
    phone_number_format: input.phone_number_format ?? existing?.phone_number_format ?? '+1 (XXX) XXX-XXXX',
    unit_system: input.unit_system ?? existing?.unit_system ?? 'METRIC',
    timezone: input.timezone ?? existing?.timezone ?? 'America/New_York',
    date_format: input.date_format ?? existing?.date_format ?? 'YYYY-MM-DD',
    branding_primary_color: input.branding_primary_color ?? existing?.branding_primary_color ?? '#007A6E',
    branding_secondary_color: input.branding_secondary_color ?? existing?.branding_secondary_color ?? '#005247',
    branding_logo_url: input.branding_logo_url ?? existing?.branding_logo_url ?? '',
    address_line1: input.address_line1 ?? existing?.address_line1 ?? '',
    address_line2: input.address_line2 ?? existing?.address_line2 ?? '',
    city: input.city ?? existing?.city ?? '',
    state_province: input.state_province ?? existing?.state_province ?? '',
    postal_code: input.postal_code ?? existing?.postal_code ?? '',
    address_country_code:
      input.address_country_code ?? existing?.address_country_code ?? (input.country_code ?? existing?.country_code ?? 'US'),
    website: input.website ?? existing?.website ?? '',
    description: input.description ?? existing?.description ?? '',
    number_format_json: JSON.stringify(input.number_format ?? existing?.number_format ?? DEFAULT_NUMBER_FORMAT),
    default_load_types_json: JSON.stringify(input.default_load_types ?? existing?.default_load_types ?? []),
    features_json: JSON.stringify(input.features ?? existing?.features ?? {}),
    api_keys_json: JSON.stringify(input.api_keys ?? existing?.api_keys ?? {}),
    tenant_id: normalizedTenantId,
    updated_date: now,
  }

  if (!existing) {
    payload.created_date = input.created_date ?? now
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key]
    }
  })

  return payload
}

function encodeTenantCategoryInput(input = {}, existingRow, actorContext) {
  const existing = existingRow ? decodeTenantCategoryRow(existingRow) : null
  const now = new Date().toISOString()
  const isSuperAdmin = actorContext?.isSuperAdmin ?? false
  const tenantId = normalizeTenantId(
    isSuperAdmin ? input.tenant_id || existing?.tenant_id || actorContext?.tenantId : actorContext?.tenantId,
    existing?.tenant_id
  )

  if (!tenantId) {
    const error = new Error('Tenant identifier is required for tenant categories')
    error.status = 400
    throw error
  }

  const categoryName = input.category_name ?? existing?.category_name
  if (!categoryName || !categoryName.toString().trim()) {
    const error = new Error('Category name is required')
    error.status = 400
    throw error
  }

  const loadTypeSource = input.load_type_mapping ?? existing?.load_type_mapping ?? ''
  if (!loadTypeSource) {
    const error = new Error('Load type mapping is required')
    error.status = 400
    throw error
  }

  const subCategoriesInput = Array.isArray(input.sub_categories)
    ? input.sub_categories
    : existing?.sub_categories ?? []
  const subCategories = subCategoriesInput
    .map((entry) => (entry ?? '').toString().trim())
    .filter((entry) => entry.length > 0)

  const sortOrderValue = input.sort_order ?? existing?.sort_order ?? DEFAULT_CATEGORY_SORT_ORDER
  const sortOrder = Number.isFinite(Number(sortOrderValue)) ? Number(sortOrderValue) : DEFAULT_CATEGORY_SORT_ORDER

  const payload = {
    tenant_id: tenantId,
    category_name: categoryName.toString().trim(),
    product_category: (input.product_category ?? existing?.product_category ?? '').toString().trim(),
    category_type: (input.category_type ?? existing?.category_type ?? 'predefined').toLowerCase(),
    load_type_mapping: loadTypeSource.toString().trim().toUpperCase(),
    description: (input.description ?? existing?.description ?? '').toString().trim(),
    sort_order: sortOrder,
    [CATEGORY_JSON_FIELD]: JSON.stringify(subCategories),
    is_active: toBoolean(input.is_active, existing?.is_active ?? true) ? 1 : 0,
    updated_date: now,
  }

  if (!existing) {
    payload.created_date = input.created_date ?? now
  }

  return payload
}

function encodeTenantContactInput(input = {}, existingRow, actorContext) {
  const existing = existingRow ? decodeTenantContactRow(existingRow) : null
  const now = new Date().toISOString()
  const isSuperAdmin = actorContext?.isSuperAdmin ?? false
  const tenantId = normalizeTenantId(
    isSuperAdmin ? input.tenant_id || existing?.tenant_id || actorContext?.tenantId : actorContext?.tenantId,
    existing?.tenant_id
  )

  if (!tenantId) {
    const error = new Error('Tenant identifier is required for contacts')
    error.status = 400
    throw error
  }

  const name = input.contact_name ?? existing?.contact_name
  const email = input.contact_email ?? existing?.contact_email
  const jobTitle = input.job_title ?? existing?.job_title

  if (!name || !name.toString().trim()) {
    const error = new Error('Contact name is required')
    error.status = 400
    throw error
  }

  if (!email || !email.toString().trim()) {
    const error = new Error('Contact email is required')
    error.status = 400
    throw error
  }

  if (!jobTitle || !jobTitle.toString().trim()) {
    const error = new Error('Job title is required')
    error.status = 400
    throw error
  }

  const contactType = (input.contact_type ?? existing?.contact_type ?? 'primary').toLowerCase()
  const allowedContactTypes = ['primary', 'secondary', 'backup']
  const normalizedContactType = allowedContactTypes.includes(contactType) ? contactType : 'primary'

  const signatureTypeInput = (input.signature_type ?? existing?.signature_type ?? 'none').toLowerCase()
  const allowedSignatureTypes = ['none', 'upload', 'generated']
  const signatureType = allowedSignatureTypes.includes(signatureTypeInput) ? signatureTypeInput : 'none'

  const payload = {
    tenant_id: tenantId,
    contact_type: normalizedContactType,
    contact_name: name.toString().trim(),
    first_name: (input.first_name ?? existing?.first_name ?? '').toString().trim(),
    last_name: (input.last_name ?? existing?.last_name ?? '').toString().trim(),
    contact_email: email.toString().trim(),
    contact_phone: (input.contact_phone ?? existing?.contact_phone ?? '').toString().trim(),
    job_title: jobTitle.toString().trim(),
    signature_type: signatureType,
    signature_url: (input.signature_url ?? existing?.signature_url ?? '').toString().trim(),
    signature_font: (input.signature_font ?? existing?.signature_font ?? DEFAULT_SIGNATURE_FONT).toString().trim(),
    is_active: toBoolean(input.is_active, existing?.is_active ?? true) ? 1 : 0,
    updated_date: now,
  }

  if (!existing) {
    payload.created_date = input.created_date ?? now
  }

  return payload
}

function prepareGenericData(input, actorTenantId) {
  const output = { ...input }
  if (!('tenant_id' in output)) {
    output.tenant_id = actorTenantId
  }
  if (output.tenant_id !== undefined && output.tenant_id !== null) {
    output.tenant_id = normalizeTenantId(output.tenant_id, actorTenantId)
  }
  return output
}

export default function handler(req, res) {
  const db = init()
  const decoded = verifyToken(req)
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' })

  const slug = req.query.slug || []
  const rawEntity = slug[0] || ''
  const id = slug[1]

  const normalizedRole = normalizeRole(decoded.role)
  const isSuperAdmin = normalizedRole === 'super_admin'
  let entityName = ''
  let normalizedSlug = ''

  try {
    normalizedSlug = normalizeEntitySlug(rawEntity)
    if (!normalizedSlug) return res.status(400).json({ error: 'Entity name required' })
    entityName = resolveTableName(normalizedSlug)

    if (!isValidTableName(entityName)) {
      return res.status(400).json({ error: 'Invalid entity name' })
    }

    const tableAvailable = tableExists(db, entityName)

    if (req.method === 'GET' && !id) {
      if (!tableAvailable) {
        const tenantFilter = normalizeTenantId(decoded.tenant_id)
        const stmt = isSuperAdmin
          ? db.prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE entity_name = ? ORDER BY datetime(created_date) DESC, id DESC`)
          : db.prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE entity_name = ? AND (tenant_id = ? OR tenant_id IS NULL) ORDER BY datetime(created_date) DESC, id DESC`)
        const rows = isSuperAdmin ? stmt.all(normalizedSlug) : stmt.all(normalizedSlug, tenantFilter)
        return res.json(rows.map(decodeGenericEntityRow))
      }
      if (entityName === TENANT_TABLE) {
        const stmt = isSuperAdmin
          ? db.prepare(`SELECT * FROM ${TENANT_TABLE} ORDER BY datetime(created_date) DESC, id DESC`)
          : db.prepare(`SELECT * FROM ${TENANT_TABLE} WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY datetime(created_date) DESC, id DESC`)
        const rows = isSuperAdmin ? stmt.all() : stmt.all(decoded.tenant_id)
        return res.json(rows.map(decodeTenantRow))
      }

      if (entityName === TENANT_CATEGORY_TABLE || entityName === TENANT_CONTACT_TABLE) {
        const decoder = entityName === TENANT_CATEGORY_TABLE ? decodeTenantCategoryRow : decodeTenantContactRow
        const stmt = isSuperAdmin
          ? db.prepare(`SELECT * FROM ${entityName} ORDER BY datetime(created_date) DESC, id DESC`)
          : db.prepare(`SELECT * FROM ${entityName} WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY datetime(created_date) DESC, id DESC`)
        const rows = isSuperAdmin ? stmt.all() : stmt.all(decoded.tenant_id)
        return res.json(rows.map(decoder))
      }

      const stmt = db.prepare(`SELECT * FROM ${entityName} WHERE tenant_id = ? OR tenant_id IS NULL`)
      const rows = stmt.all(decoded.tenant_id)
      return res.json(rows)
    }

    if (req.method === 'GET' && id) {
      if (!tableAvailable) {
        const tenantFilter = normalizeTenantId(decoded.tenant_id)
        const stmt = isSuperAdmin
          ? db.prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ?`)
          : db.prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ? AND (tenant_id = ? OR tenant_id IS NULL)`)
        const row = isSuperAdmin ? stmt.get(id, normalizedSlug) : stmt.get(id, normalizedSlug, tenantFilter)
        if (!row) return res.status(404).json({ error: 'Not found' })
        return res.json(decodeGenericEntityRow(row))
      }
      const stmt = db.prepare(`SELECT * FROM ${entityName} WHERE id = ?`)
      const row = stmt.get(id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (entityName === TENANT_TABLE) {
        return res.json(decodeTenantRow(row))
      }
      if (entityName === TENANT_CATEGORY_TABLE) {
        return res.json(decodeTenantCategoryRow(row))
      }
      if (entityName === TENANT_CONTACT_TABLE) {
        return res.json(decodeTenantContactRow(row))
      }
      return res.json(row)
    }

    if (req.method === 'POST') {
      if (!tableAvailable) {
        const baseData = prepareGenericData(req.body || {}, decoded.tenant_id)
        const tenantForRecord = normalizeTenantId(baseData.tenant_id, decoded.tenant_id)
        if (tenantForRecord) {
          baseData.tenant_id = tenantForRecord
        }
        if (!baseData.created_date) {
          const timestamp = new Date().toISOString()
          baseData.created_date = timestamp
          baseData.updated_date = timestamp
        }
        const stmt = db.prepare(`INSERT INTO ${GENERIC_ENTITY_TABLE} (entity_name, tenant_id, payload_json) VALUES (?, ?, ?)`)
        const result = stmt.run(normalizedSlug, tenantForRecord || null, JSON.stringify(baseData))
        const created = db.prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ?`).get(result.lastInsertRowid)
        return res.status(201).json(decodeGenericEntityRow(created))
      }
      let data

      if (entityName === TENANT_TABLE) {
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'Insufficient privileges to manage tenants' })
        }
        data = encodeTenantInput(req.body, null, { isSuperAdmin, tenantId: decoded.tenant_id })
      } else if (entityName === TENANT_CATEGORY_TABLE) {
        data = encodeTenantCategoryInput(req.body, null, { isSuperAdmin, tenantId: decoded.tenant_id })
      } else if (entityName === TENANT_CONTACT_TABLE) {
        data = encodeTenantContactInput(req.body, null, { isSuperAdmin, tenantId: decoded.tenant_id })
      } else {
        data = prepareGenericData(req.body || {}, decoded.tenant_id)
      }

      const keys = Object.keys(data)
      if (keys.length === 0) {
        return res.status(400).json({ error: 'No data provided' })
      }
      const values = Object.values(data)
      const placeholders = keys.map(() => '?').join(', ')
      const stmt = db.prepare(`INSERT INTO ${entityName} (${keys.join(',')}) VALUES (${placeholders})`)
      const result = stmt.run(...values)

      if (entityName === TENANT_TABLE) {
        const created = db.prepare(`SELECT * FROM ${TENANT_TABLE} WHERE id = ?`).get(result.lastInsertRowid)
        return res.status(201).json(decodeTenantRow(created))
      }

      if (entityName === TENANT_CATEGORY_TABLE) {
        const created = db.prepare(`SELECT * FROM ${TENANT_CATEGORY_TABLE} WHERE id = ?`).get(result.lastInsertRowid)
        return res.status(201).json(decodeTenantCategoryRow(created))
      }

      if (entityName === TENANT_CONTACT_TABLE) {
        const created = db.prepare(`SELECT * FROM ${TENANT_CONTACT_TABLE} WHERE id = ?`).get(result.lastInsertRowid)
        return res.status(201).json(decodeTenantContactRow(created))
      }

      return res.status(201).json({ id: result.lastInsertRowid, ...data })
    }

    if (req.method === 'PUT' && id) {
      if (!tableAvailable) {
        const existingRow = db
          .prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ?`)
          .get(id, normalizedSlug)
        if (!existingRow) {
          return res.status(404).json({ error: 'Entity not found' })
        }
        if (!canAccessGenericRow(existingRow.tenant_id, decoded.tenant_id, isSuperAdmin)) {
          return res.status(403).json({ error: 'Insufficient privileges to update this record' })
        }

        const existingPayload = decodeGenericEntityRow(existingRow)
        const mergedPayload = { ...existingPayload, ...req.body }
        delete mergedPayload.id

        const tenantForRecord = normalizeTenantId(mergedPayload.tenant_id, existingRow.tenant_id || decoded.tenant_id)
        if (tenantForRecord) {
          mergedPayload.tenant_id = tenantForRecord
        } else {
          delete mergedPayload.tenant_id
        }

        const updatedTimestamp = new Date().toISOString()
        mergedPayload.updated_date = updatedTimestamp
        if (!mergedPayload.created_date) {
          mergedPayload.created_date = existingPayload.created_date || updatedTimestamp
        }

        db.prepare(
          `UPDATE ${GENERIC_ENTITY_TABLE}
             SET tenant_id = ?, payload_json = ?, updated_date = ?
           WHERE id = ? AND entity_name = ?`
        ).run(tenantForRecord || null, JSON.stringify(mergedPayload), updatedTimestamp, id, normalizedSlug)

        const updatedRow = db
          .prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ?`)
          .get(id, normalizedSlug)
        return res.json(decodeGenericEntityRow(updatedRow))
      }
      if (entityName === TENANT_TABLE) {
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'Insufficient privileges to manage tenants' })
        }
        const existingRow = db.prepare(`SELECT * FROM ${TENANT_TABLE} WHERE id = ?`).get(id)
        if (!existingRow) {
          return res.status(404).json({ error: 'Tenant not found' })
        }
        const data = encodeTenantInput(req.body || {}, existingRow, { isSuperAdmin, tenantId: decoded.tenant_id })
        const keys = Object.keys(data)
        const values = Object.values(data)
        const setClause = keys.map((k) => `${k} = ?`).join(', ')
        db.prepare(`UPDATE ${TENANT_TABLE} SET ${setClause} WHERE id = ?`).run(...values, id)
        const updated = db.prepare(`SELECT * FROM ${TENANT_TABLE} WHERE id = ?`).get(id)
        return res.json(decodeTenantRow(updated))
      }

      if (entityName === TENANT_CATEGORY_TABLE) {
        const existingRow = db.prepare(`SELECT * FROM ${TENANT_CATEGORY_TABLE} WHERE id = ?`).get(id)
        if (!existingRow) {
          return res.status(404).json({ error: 'Tenant category not found' })
        }
        if (!isSuperAdmin && normalizeTenantId(existingRow.tenant_id) !== normalizeTenantId(decoded.tenant_id)) {
          return res.status(403).json({ error: 'Insufficient privileges to update tenant category' })
        }
        const data = encodeTenantCategoryInput(req.body || {}, existingRow, { isSuperAdmin, tenantId: decoded.tenant_id })
        const keys = Object.keys(data)
        const values = Object.values(data)
        const setClause = keys.map((k) => `${k} = ?`).join(', ')
        db.prepare(`UPDATE ${TENANT_CATEGORY_TABLE} SET ${setClause} WHERE id = ?`).run(...values, id)
        const updated = db.prepare(`SELECT * FROM ${TENANT_CATEGORY_TABLE} WHERE id = ?`).get(id)
        return res.json(decodeTenantCategoryRow(updated))
      }

      if (entityName === TENANT_CONTACT_TABLE) {
        const existingRow = db.prepare(`SELECT * FROM ${TENANT_CONTACT_TABLE} WHERE id = ?`).get(id)
        if (!existingRow) {
          return res.status(404).json({ error: 'Tenant contact not found' })
        }
        if (!isSuperAdmin && normalizeTenantId(existingRow.tenant_id) !== normalizeTenantId(decoded.tenant_id)) {
          return res.status(403).json({ error: 'Insufficient privileges to update tenant contact' })
        }
        const data = encodeTenantContactInput(req.body || {}, existingRow, { isSuperAdmin, tenantId: decoded.tenant_id })
        const keys = Object.keys(data)
        const values = Object.values(data)
        const setClause = keys.map((k) => `${k} = ?`).join(', ')
        db.prepare(`UPDATE ${TENANT_CONTACT_TABLE} SET ${setClause} WHERE id = ?`).run(...values, id)
        const updated = db.prepare(`SELECT * FROM ${TENANT_CONTACT_TABLE} WHERE id = ?`).get(id)
        return res.json(decodeTenantContactRow(updated))
      }

      const data = req.body || {}
      const keys = Object.keys(data)
      if (keys.length === 0) {
        return res.status(400).json({ error: 'No data provided' })
      }
      const values = Object.values(data)
      const setClause = keys.map((k) => `${k} = ?`).join(',')
      const stmt = db.prepare(`UPDATE ${entityName} SET ${setClause} WHERE id = ?`)
      stmt.run(...values, id)
      return res.json({ id, ...data })
    }

    if (req.method === 'DELETE' && id) {
      if (!tableAvailable) {
        const existingRow = db
          .prepare(`SELECT * FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ?`)
          .get(id, normalizedSlug)
        if (!existingRow) {
          return res.status(404).json({ error: 'Entity not found' })
        }
        if (!canAccessGenericRow(existingRow.tenant_id, decoded.tenant_id, isSuperAdmin)) {
          return res.status(403).json({ error: 'Insufficient privileges to delete this record' })
        }
        db.prepare(`DELETE FROM ${GENERIC_ENTITY_TABLE} WHERE id = ? AND entity_name = ?`).run(id, normalizedSlug)
        return res.json({ message: 'Deleted successfully' })
      }
      if (entityName === TENANT_TABLE && !isSuperAdmin) {
        return res.status(403).json({ error: 'Insufficient privileges to delete tenants' })
      }

      if (entityName === TENANT_CATEGORY_TABLE || entityName === TENANT_CONTACT_TABLE) {
        const tableName = entityName === TENANT_CATEGORY_TABLE ? TENANT_CATEGORY_TABLE : TENANT_CONTACT_TABLE
        const existingRow = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id)
        if (!existingRow) {
          return res.status(404).json({ error: 'Not found' })
        }
        if (!isSuperAdmin && normalizeTenantId(existingRow.tenant_id) !== normalizeTenantId(decoded.tenant_id)) {
          return res.status(403).json({ error: 'Insufficient privileges to delete this record' })
        }
      }
      const stmt = db.prepare(`DELETE FROM ${entityName} WHERE id = ?`)
      stmt.run(id)
      return res.json({ message: 'Deleted successfully' })
    }

    res.status(405).end()
  } catch (err) {
    const status = err?.status || 500
    console.error('Entity error', err)
    if (req.method === 'GET' && !id) {
      if (entityName === TENANT_TABLE) {
        return res.status(status).json([])
      }
      if (status === 500) {
        return res.status(status).json({ error: 'Entity operation failed' })
      }
      return res.status(status).json([])
    }
    return res.status(status).json({ error: err?.message || 'Entity operation failed' })
  }
}
