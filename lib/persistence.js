const path = require('path')
const Database = require('better-sqlite3')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const SQLITE_DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'recims.db')
const DATABASE_URL = process.env.DATABASE_URL
const DATABASE_SSL_MODE = process.env.DATABASE_SSL_MODE || process.env.DATABASE_SSL || 'require'

let adapterInstance
let schemaPromise

async function init() {
  if (!adapterInstance) {
    adapterInstance = DATABASE_URL ? await createPostgresAdapter() : createSqliteAdapter()
    schemaPromise = ensureSchema(adapterInstance)
  }
  await schemaPromise
  return adapterInstance
}

function createSqliteAdapter() {
  const sqlite = new Database(SQLITE_DB_PATH)
  return {
    dialect: 'sqlite',
    async exec(sql) {
      sqlite.exec(sql)
    },
    prepare(sql) {
      const statement = sqlite.prepare(sql)
      return wrapSqliteStatement(statement)
    },
    async close() {
      sqlite.close()
    },
  }
}

async function createPostgresAdapter() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: resolveSslConfig(DATABASE_SSL_MODE),
  })

  return {
    dialect: 'postgres',
    async exec(sql) {
      await pool.query(sql)
    },
    prepare(sql) {
      return createPostgresStatement(pool, sql)
    },
    async close() {
      await pool.end()
    },
  }
}

function resolveSslConfig(mode = 'require') {
  const normalized = mode.toString().trim().toLowerCase()
  if (['disable', 'false', 'off', 'none'].includes(normalized)) {
    return false
  }
  if (['allow', 'prefer'].includes(normalized)) {
    return { rejectUnauthorized: false }
  }
  if (['strict', 'verify-full'].includes(normalized)) {
    return { rejectUnauthorized: true }
  }
  return { rejectUnauthorized: false }
}

function wrapSqliteStatement(statement) {
  return {
    all: (...args) => Promise.resolve(statement.all(...args)),
    get: (...args) => Promise.resolve(statement.get(...args)),
    run: (...args) => Promise.resolve(statement.run(...args)),
  }
}

function createPostgresStatement(pool, sql) {
  return {
    async all(...args) {
      const { text, values } = transformQuery(sql, args)
      const { rows } = await pool.query(text, values)
      return rows
    },
    async get(...args) {
      const rows = await this.all(...args)
      return rows[0]
    },
    async run(...args) {
      const { text, values, isInsert } = transformQuery(sql, args, true)
      const result = await pool.query(text, values)
      const payload = { changes: result.rowCount }
      if (isInsert && result.rows && result.rows[0] && typeof result.rows[0].id !== 'undefined') {
        payload.lastInsertRowid = result.rows[0].id
      }
      return payload
    },
  }
}

function transformQuery(sql, args = [], ensureReturning = false) {
  const trimmed = sql.trim()
  const isInsert = /^insert/i.test(trimmed)
  const hasReturning = /\breturning\b/i.test(sql)
  const namedParamRegex = /@([a-zA-Z0-9_]+)/g
  const hasNamedParams = namedParamRegex.test(sql)
  namedParamRegex.lastIndex = 0

  if (hasNamedParams) {
    const params = (args && args[0]) || {}
    let position = 0
    const values = []
    const text = sql.replace(namedParamRegex, (_, key) => {
      position += 1
      if (!(key in params)) {
        throw new Error(`Missing value for named parameter @${key}`)
      }
      values.push(params[key])
      return `$${position}`
    })
    const appendReturning = ensureReturning && isInsert && !hasReturning
    return {
      text: appendReturning ? `${text} RETURNING id` : text,
      values,
      isInsert: appendReturning || (isInsert && hasReturning),
    }
  }

  const positionalRegex = /\?/g
  const hasPositionals = positionalRegex.test(sql)
  positionalRegex.lastIndex = 0
  if (hasPositionals) {
    let position = 0
    const text = sql.replace(positionalRegex, () => {
      position += 1
      return `$${position}`
    })
    const appendReturning = ensureReturning && isInsert && !hasReturning
    return {
      text: appendReturning ? `${text} RETURNING id` : text,
      values: args,
      isInsert: appendReturning || (isInsert && hasReturning),
    }
  }

  const appendReturning = ensureReturning && isInsert && !hasReturning
  return {
    text: appendReturning ? `${sql} RETURNING id` : sql,
    values: [],
    isInsert: appendReturning || (isInsert && hasReturning),
  }
}

async function ensureSchema(db) {
  await createTables(db)
  await ensureTenantColumns(db)
  await applyTenantDefaults(db)
  await seedTenants(db)
  await seedTenantCategories(db)
  await seedTenantContacts(db)
  await ensureDefaultTenantAndAdmin(db)
}

function resolveTypeMap(dialect) {
  if (dialect === 'postgres') {
    return {
      primaryKey: 'BIGSERIAL PRIMARY KEY',
      timestamp: 'TIMESTAMPTZ',
    }
  }
  return {
    primaryKey: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    timestamp: 'DATETIME',
  }
}

async function createTables(db) {
  const types = resolveTypeMap(db.dialect)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${types.primaryKey},
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      tenant_id TEXT,
      role TEXT DEFAULT 'user',
      created_at ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id ${types.primaryKey},
      name TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS shiftlog (
      id ${types.primaryKey},
      operator_email TEXT,
      operator_name TEXT,
      tenant_id TEXT,
      shift_start ${types.timestamp},
      shift_end ${types.timestamp},
      status TEXT DEFAULT 'active',
      shipments_processed INTEGER DEFAULT 0,
      materials_classified INTEGER DEFAULT 0,
      bins_assigned INTEGER DEFAULT 0,
      created_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_categories (
      id ${types.primaryKey},
      tenant_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      product_category TEXT,
      category_type TEXT DEFAULT 'predefined',
      sub_categories_json TEXT,
      load_type_mapping TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_contacts (
      id ${types.primaryKey},
      tenant_id TEXT NOT NULL,
      contact_type TEXT DEFAULT 'primary',
      contact_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      job_title TEXT NOT NULL,
      signature_type TEXT DEFAULT 'none',
      signature_url TEXT,
      signature_font TEXT DEFAULT 'Allura',
      is_active INTEGER DEFAULT 1,
      created_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_categories_tenant ON tenant_categories (tenant_id)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant ON tenant_contacts (tenant_id)`)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS entity_records (
      id ${types.primaryKey},
      entity_name TEXT NOT NULL,
      tenant_id TEXT,
      payload_json TEXT NOT NULL,
      created_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_records_entity ON entity_records (entity_name)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_records_tenant ON entity_records (tenant_id)`)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS appsettings (
      id ${types.primaryKey},
      tenant_id TEXT,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      setting_category TEXT DEFAULT 'features',
      description TEXT,
      phase TEXT,
      created_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_date ${types.timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_appsettings_tenant_key ON appsettings (tenant_id, setting_key)`)
}

async function ensureTenantColumns(db) {
  const ensureColumn = async (column, type) => {
    try {
      await db.prepare(`ALTER TABLE tenants ADD COLUMN ${column} ${type}`).run()
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        throw error
      }
    }
  }

  await ensureColumn('tenant_id', 'TEXT')
  await ensureColumn('display_name', 'TEXT')
  await ensureColumn('region', 'TEXT')
  await ensureColumn('code', 'TEXT')
  await ensureColumn('base_subdomain', 'TEXT')
  await ensureColumn('tenant_code', 'TEXT')
  await ensureColumn('business_type', 'TEXT')
  await ensureColumn('primary_contact_name', 'TEXT')
  await ensureColumn('primary_contact_email', 'TEXT')
  await ensureColumn('primary_contact_phone', 'TEXT')
  await ensureColumn('default_currency', 'TEXT')
  await ensureColumn('country_code', 'TEXT')
  await ensureColumn('phone_number_format', 'TEXT')
  await ensureColumn('unit_system', 'TEXT')
  await ensureColumn('timezone', 'TEXT')
  await ensureColumn('date_format', 'TEXT')
  await ensureColumn('number_format_json', 'TEXT')
  await ensureColumn('branding_primary_color', 'TEXT')
  await ensureColumn('branding_secondary_color', 'TEXT')
  await ensureColumn('branding_logo_url', 'TEXT')
  await ensureColumn('address_line1', 'TEXT')
  await ensureColumn('address_line2', 'TEXT')
  await ensureColumn('city', 'TEXT')
  await ensureColumn('state_province', 'TEXT')
  await ensureColumn('postal_code', 'TEXT')
  await ensureColumn('address_country_code', 'TEXT')
  await ensureColumn('website', 'TEXT')
  await ensureColumn('description', 'TEXT')
  await ensureColumn('default_load_types_json', 'TEXT')
  await ensureColumn('features_json', 'TEXT')
  await ensureColumn('api_keys_json', 'TEXT')
  await ensureColumn('created_date', 'TIMESTAMPTZ')
  await ensureColumn('updated_date', 'TIMESTAMPTZ')
}

function isDuplicateColumnError(error) {
  if (!error || !error.message) return false
  return error.code === '42701' || /duplicate column/i.test(error.message) || /already exists/i.test(error.message)
}

async function applyTenantDefaults(db) {
  await db.prepare(`
    UPDATE tenants
    SET tenant_id = COALESCE(tenant_id, 'TNT-' || substr('000' || CAST(id AS TEXT), LENGTH('000' || CAST(id AS TEXT)) - 2, 3)),
        display_name = COALESCE(display_name, name),
        region = COALESCE(region, 'Global'),
        status = COALESCE(UPPER(status), 'ACTIVE'),
        code = COALESCE(code, LOWER(REPLACE(name, ' ', ''))),
        tenant_code = COALESCE(tenant_code, code),
        base_subdomain = COALESCE(base_subdomain, LOWER(REPLACE(name, ' ', ''))),
        business_type = COALESCE(business_type, 'general_manufacturing'),
        default_currency = COALESCE(default_currency, 'USD'),
        country_code = COALESCE(country_code, 'US'),
        phone_number_format = COALESCE(phone_number_format, '+1 (XXX) XXX-XXXX'),
        unit_system = COALESCE(unit_system, 'METRIC'),
        timezone = COALESCE(timezone, 'America/New_York'),
        date_format = COALESCE(date_format, 'YYYY-MM-DD'),
        number_format_json = COALESCE(number_format_json, '{"decimal": ".", "thousand": ","}'),
        branding_primary_color = COALESCE(branding_primary_color, '#007A6E'),
        branding_secondary_color = COALESCE(branding_secondary_color, '#005247'),
        address_country_code = COALESCE(address_country_code, country_code, 'US'),
        default_load_types_json = COALESCE(default_load_types_json, '[]'),
        features_json = COALESCE(features_json, '{}'),
        api_keys_json = COALESCE(api_keys_json, '{}'),
        created_date = COALESCE(created_date, CURRENT_TIMESTAMP),
        updated_date = COALESCE(updated_date, CURRENT_TIMESTAMP)
  `).run()
}

async function seedTenants(db) {
  const now = new Date().toISOString()
  const tenantSeeds = [
    {
      id: 1,
      tenant_id: 'TNT-001',
      name: 'MIN-TECH RECYCLING',
      display_name: 'MIN-TECH Recycling',
      status: 'ACTIVE',
      code: 'min-tech',
      tenant_code: 'MIN-TECH',
      base_subdomain: 'min-tech',
      business_type: 'metal_recycling',
      primary_contact_name: 'Maria Chen',
      primary_contact_email: 'operations@mintech.com',
      primary_contact_phone: '+1 (203) 555-0145',
      default_currency: 'USD',
      country_code: 'US',
      region: 'USA',
      phone_number_format: '+1 (XXX) XXX-XXXX',
      unit_system: 'IMPERIAL',
      timezone: 'America/New_York',
      date_format: 'YYYY-MM-DD',
      branding_primary_color: '#0D9488',
      branding_secondary_color: '#164E63',
      branding_logo_url: '',
      address_line1: '125 Recycling Way',
      address_line2: '',
      city: 'Hartford',
      state_province: 'CT',
      postal_code: '06103',
      address_country_code: 'US',
      website: 'https://www.mintechrecycling.com',
      description: 'Regional recycling and materials recovery facility.',
      number_format_json: JSON.stringify({ decimal: '.', thousand: ',' }),
      default_load_types_json: JSON.stringify(['METAL', 'PLASTIC', 'MIXED']),
      features_json: JSON.stringify({
        po_module_enabled: true,
        bin_capacity_enabled: true,
        photo_upload_enabled: true,
        ai_classification_enabled: true,
        qc_module_enabled: true,
        multi_zone_enabled: true,
      }),
      api_keys_json: JSON.stringify({}),
      created_date: now,
      updated_date: now,
    },
    {
      id: 2,
      tenant_id: 'TNT-002',
      name: 'CONNECTICUT METALS',
      display_name: 'Connecticut Metals',
      status: 'ACTIVE',
      code: 'connecticut-metals',
      tenant_code: 'CONNECTICUT-METALS',
      base_subdomain: 'connecticut-metals',
      business_type: 'metal_recycling',
      primary_contact_name: 'Ethan Reynolds',
      primary_contact_email: 'info@ctmetals.com',
      primary_contact_phone: '+1 (475) 555-0198',
      default_currency: 'USD',
      country_code: 'US',
      region: 'USA',
      phone_number_format: '+1 (XXX) XXX-XXXX',
      unit_system: 'IMPERIAL',
      timezone: 'America/New_York',
      date_format: 'YYYY-MM-DD',
      branding_primary_color: '#B45309',
      branding_secondary_color: '#78350F',
      branding_logo_url: '',
      address_line1: '412 Foundry Avenue',
      address_line2: '',
      city: 'Bridgeport',
      state_province: 'CT',
      postal_code: '06604',
      address_country_code: 'US',
      website: 'https://www.ctmetals.com',
      description: 'Advanced metals recycling and processing partner.',
      number_format_json: JSON.stringify({ decimal: '.', thousand: ',' }),
      default_load_types_json: JSON.stringify(['METAL', 'MIXED']),
      features_json: JSON.stringify({
        po_module_enabled: true,
        bin_capacity_enabled: false,
        photo_upload_enabled: false,
        ai_classification_enabled: false,
        qc_module_enabled: true,
        multi_zone_enabled: false,
      }),
      api_keys_json: JSON.stringify({}),
      created_date: now,
      updated_date: now,
    },
  ]

  const jsonColumns = ['number_format_json', 'default_load_types_json', 'features_json', 'api_keys_json']

  const isEmptyValue = (value) => value === null || value === undefined || value === ''

  const isEmptyJson = (value) => {
    if (isEmptyValue(value)) return true
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      if (Array.isArray(parsed)) return parsed.length === 0
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length === 0
    } catch (error) {
      return true
    }
    return false
  }

  for (const seed of tenantSeeds) {
    const payload = { ...seed }
    jsonColumns.forEach((column) => {
      if (column in payload && typeof payload[column] !== 'string') {
        payload[column] = JSON.stringify(payload[column])
      }
    })
    payload.status = (payload.status || 'ACTIVE').toUpperCase()

    const existing = await db.prepare('SELECT * FROM tenants WHERE tenant_id = ?').get(seed.tenant_id)
    if (existing) {
      const updates = {}
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'id' || key === 'created_date') {
          return
        }

        if (!(key in existing)) {
          updates[key] = value
          return
        }

        const current = existing[key]
        if (jsonColumns.includes(key)) {
          if (isEmptyJson(current)) {
            updates[key] = value
          }
        } else if (isEmptyValue(current)) {
          updates[key] = value
        }
      })

      if (Object.keys(updates).length > 0) {
        updates.updated_date = now
        updates.tenant_id = payload.tenant_id
        const setColumns = Object.keys(updates)
          .filter((key) => key !== 'tenant_id')
          .map((key) => `${key} = @${key}`)
          .join(', ')

        await db.prepare(`UPDATE tenants SET ${setColumns} WHERE tenant_id = @tenant_id`).run(updates)
      }
    } else {
      const insertPayload = { ...payload }
      insertPayload.created_date = insertPayload.created_date || now
      insertPayload.updated_date = insertPayload.updated_date || now
      const columns = Object.keys(insertPayload)
      const placeholders = columns.map((column) => `@${column}`).join(', ')
      await db.prepare(`INSERT INTO tenants (${columns.join(', ')}) VALUES (${placeholders})`).run(insertPayload)
    }
  }
}

async function seedTenantCategories(db) {
  const now = new Date().toISOString()
  const categorySeeds = [
    {
      tenant_id: 'TNT-001',
      category_name: 'Mixed Plastics',
      product_category: 'Plastics',
      category_type: 'predefined',
      sub_categories: ['PET', 'HDPE', 'LDPE', 'PP', 'PS'],
      load_type_mapping: 'PLASTIC',
      description: 'Various plastic types',
      sort_order: 10,
    },
    {
      tenant_id: 'TNT-001',
      category_name: 'Ferrous Metals',
      product_category: 'Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Steel', 'Iron', 'Cast Iron'],
      load_type_mapping: 'METAL',
      description: 'Iron-based metals',
      sort_order: 20,
    },
    {
      tenant_id: 'TNT-001',
      category_name: 'Non-Ferrous Metals',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Aluminum', 'Copper', 'Brass', 'Stainless Steel'],
      load_type_mapping: 'METAL',
      description: 'Non-iron metals',
      sort_order: 30,
    },
    {
      tenant_id: 'TNT-002',
      category_name: 'Aluminum foil and laminate scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Foil', 'Laminate', 'Packaging'],
      load_type_mapping: 'MIXED',
      description: 'Aluminum foil and laminate materials',
      sort_order: 10,
    },
    {
      tenant_id: 'TNT-002',
      category_name: 'Copper scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Bare Bright', '#1 Copper', '#2 Copper', 'Insulated Wire'],
      load_type_mapping: 'MIXED',
      description: 'Various copper grades',
      sort_order: 20,
    },
    {
      tenant_id: 'TNT-002',
      category_name: 'Stainless steel scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['304', '316', '430', 'Mixed SS'],
      load_type_mapping: 'MIXED',
      description: 'Stainless steel materials',
      sort_order: 30,
    },
    {
      tenant_id: 'TNT-002',
      category_name: 'Aluminum scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Extrusion', 'Sheet', 'Cast', 'UBC'],
      load_type_mapping: 'MIXED',
      description: 'Various aluminum forms',
      sort_order: 40,
    },
    {
      tenant_id: 'TNT-002',
      category_name: 'Brass and bronze scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Yellow Brass', 'Red Brass', 'Bronze', 'Plumbing Brass'],
      load_type_mapping: 'MIXED',
      description: 'Brass and bronze materials',
      sort_order: 50,
    },
  ]

  for (const seed of categorySeeds) {
    const payload = {
      tenant_id: seed.tenant_id,
      category_name: seed.category_name,
      product_category: seed.product_category || '',
      category_type: (seed.category_type || 'predefined').toLowerCase(),
      sub_categories_json: JSON.stringify(seed.sub_categories || []),
      load_type_mapping: (seed.load_type_mapping || '').toUpperCase(),
      description: seed.description || '',
      sort_order: seed.sort_order ?? 0,
      is_active: seed.is_active === false ? 0 : 1,
      updated_date: now,
    }

    const existing = await db
      .prepare('SELECT id FROM tenant_categories WHERE tenant_id = ? AND category_name = ?')
      .get(seed.tenant_id, seed.category_name)

    if (existing) {
      const current = await db.prepare('SELECT * FROM tenant_categories WHERE id = ?').get(existing.id)
      const needsUpdate =
        !current ||
        current.product_category === null ||
        current.category_type === null ||
        current.sub_categories_json === null ||
        current.load_type_mapping === null ||
        current.description === null ||
        current.sort_order === null

      if (needsUpdate) {
        await db.prepare(
          `UPDATE tenant_categories
             SET product_category = COALESCE(product_category, @product_category),
                 category_type = COALESCE(category_type, @category_type),
                 sub_categories_json = COALESCE(sub_categories_json, @sub_categories_json),
                 load_type_mapping = COALESCE(load_type_mapping, @load_type_mapping),
                 description = COALESCE(description, @description),
                 sort_order = COALESCE(sort_order, @sort_order),
                 is_active = CASE WHEN is_active IS NULL THEN @is_active ELSE is_active END,
                 updated_date = @updated_date
           WHERE id = @id`
        ).run({ ...payload, id: existing.id })
      }
    } else {
      await db.prepare(
        `INSERT INTO tenant_categories (
           tenant_id,
           category_name,
           product_category,
           category_type,
           sub_categories_json,
           load_type_mapping,
           description,
           sort_order,
           is_active,
           created_date,
           updated_date
         ) VALUES (
           @tenant_id,
           @category_name,
           @product_category,
           @category_type,
           @sub_categories_json,
           @load_type_mapping,
           @description,
           @sort_order,
           @is_active,
           @created_date,
           @updated_date
         )`
      ).run({ ...payload, created_date: now })
    }
  }
}

async function seedTenantContacts(db) {
  const now = new Date().toISOString()
  const contactSeeds = [
    {
      tenant_id: 'TNT-001',
      contact_type: 'primary',
      contact_name: 'Maria Chen',
      first_name: 'Maria',
      last_name: 'Chen',
      contact_email: 'maria.chen@mintechrecycling.com',
      contact_phone: '+1 (203) 555-0145',
      job_title: 'Director of Operations',
      signature_type: 'generated',
      signature_font: 'Great Vibes',
    },
    {
      tenant_id: 'TNT-001',
      contact_type: 'secondary',
      contact_name: 'David Patel',
      first_name: 'David',
      last_name: 'Patel',
      contact_email: 'david.patel@mintechrecycling.com',
      contact_phone: '+1 (203) 555-0166',
      job_title: 'Logistics Manager',
      signature_type: 'none',
    },
    {
      tenant_id: 'TNT-002',
      contact_type: 'primary',
      contact_name: 'Ethan Reynolds',
      first_name: 'Ethan',
      last_name: 'Reynolds',
      contact_email: 'ethan.reynolds@ctmetals.com',
      contact_phone: '+1 (475) 555-0198',
      job_title: 'General Manager',
      signature_type: 'generated',
      signature_font: 'Allura',
    },
    {
      tenant_id: 'TNT-002',
      contact_type: 'secondary',
      contact_name: 'Sofia Martinez',
      first_name: 'Sofia',
      last_name: 'Martinez',
      contact_email: 'sofia.martinez@ctmetals.com',
      contact_phone: '+1 (475) 555-0204',
      job_title: 'Customer Success Lead',
      signature_type: 'none',
    },
  ]

  for (const seed of contactSeeds) {
    const payload = {
      tenant_id: seed.tenant_id,
      contact_type: (seed.contact_type || 'primary').toLowerCase(),
      contact_name: seed.contact_name,
      first_name: seed.first_name || '',
      last_name: seed.last_name || '',
      contact_email: seed.contact_email,
      contact_phone: seed.contact_phone || '',
      job_title: seed.job_title,
      signature_type: (seed.signature_type || 'none').toLowerCase(),
      signature_url: seed.signature_url || '',
      signature_font: seed.signature_font || 'Allura',
      is_active: seed.is_active === false ? 0 : 1,
      updated_date: now,
    }

    const existing = await db
      .prepare('SELECT id FROM tenant_contacts WHERE tenant_id = ? AND contact_email = ?')
      .get(seed.tenant_id, seed.contact_email)

    if (existing) {
      const current = await db.prepare('SELECT * FROM tenant_contacts WHERE id = ?').get(existing.id)
      const needsUpdate =
        !current ||
        current.contact_type === null ||
        current.contact_name === null ||
        current.first_name === null ||
        current.last_name === null ||
        current.contact_phone === null ||
        current.job_title === null ||
        current.signature_type === null ||
        current.signature_font === null

      if (needsUpdate) {
        await db.prepare(
          `UPDATE tenant_contacts
             SET contact_type = COALESCE(contact_type, @contact_type),
                 contact_name = COALESCE(contact_name, @contact_name),
                 first_name = COALESCE(first_name, @first_name),
                 last_name = COALESCE(last_name, @last_name),
                 contact_phone = COALESCE(contact_phone, @contact_phone),
                 job_title = COALESCE(job_title, @job_title),
                 signature_type = COALESCE(signature_type, @signature_type),
                 signature_url = COALESCE(signature_url, @signature_url),
                 signature_font = COALESCE(signature_font, @signature_font),
                 is_active = CASE WHEN is_active IS NULL THEN @is_active ELSE is_active END,
                 updated_date = @updated_date
           WHERE id = @id`
        ).run({ ...payload, id: existing.id })
      }
    } else {
      await db.prepare(
        `INSERT INTO tenant_contacts (
           tenant_id,
           contact_type,
           contact_name,
           first_name,
           last_name,
           contact_email,
           contact_phone,
           job_title,
           signature_type,
           signature_url,
           signature_font,
           is_active,
           created_date,
           updated_date
         ) VALUES (
           @tenant_id,
           @contact_type,
           @contact_name,
           @first_name,
           @last_name,
           @contact_email,
           @contact_phone,
           @job_title,
           @signature_type,
           @signature_url,
           @signature_font,
           @is_active,
           @created_date,
           @updated_date
         )`
      ).run({ ...payload, created_date: now })
    }
  }
}

async function ensureDefaultTenantAndAdmin(db) {
  const tenant = await db.prepare('SELECT id FROM tenants WHERE id = 1').get()
  if (!tenant) {
    await db.prepare('INSERT INTO tenants (id, name) VALUES (1, ?)').run('Default Tenant')
  }

  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get('admin@recims.com')
  if (!user) {
    const hashed = bcrypt.hashSync('admin123', 10)
    await db
      .prepare(`INSERT INTO users (email, password, full_name, tenant_id, role) VALUES (?, ?, ?, ?, ?)`)
      .run('admin@recims.com', hashed, 'Admin User', 'TNT-001', 'super_admin')
  }

  await db.prepare(`
    UPDATE users
    SET role = 'super_admin',
        tenant_id = COALESCE(tenant_id, 'TNT-001')
    WHERE email = 'admin@recims.com'
  `).run()

  await db.prepare(`
    UPDATE users
    SET tenant_id = 'TNT-001'
    WHERE email = 'admin@recims.com' AND tenant_id = '1'
  `).run()
}

module.exports = { init }
