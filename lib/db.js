const path = require('path')
const Database = require('better-sqlite3')

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'recims.db')

let db
function init() {
  if (db) return db
  db = new Database(dbPath)

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      tenant_id INTEGER,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Shift logs table for operator shift tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS shiftlog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_email TEXT,
      operator_name TEXT,
      tenant_id TEXT,
      shift_start DATETIME,
      shift_end DATETIME,
      status TEXT DEFAULT 'active',
      shipments_processed INTEGER DEFAULT 0,
      materials_classified INTEGER DEFAULT 0,
      bins_assigned INTEGER DEFAULT 0,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      product_category TEXT,
      category_type TEXT DEFAULT 'predefined',
      sub_categories_json TEXT,
      load_type_mapping TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_categories_tenant ON tenant_categories (tenant_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant ON tenant_contacts (tenant_id)`)

  // Ensure tenant metadata columns exist
  const ensureColumn = (column, type) => {
    try {
      db.prepare(`ALTER TABLE tenants ADD COLUMN ${column} ${type}`).run()
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error
      }
    }
  }

  ensureColumn('tenant_id', 'TEXT')
  ensureColumn('display_name', 'TEXT')
  ensureColumn('region', 'TEXT')
  ensureColumn('code', 'TEXT')
  ensureColumn('base_subdomain', 'TEXT')
  ensureColumn('tenant_code', 'TEXT')
  ensureColumn('business_type', 'TEXT')
  ensureColumn('primary_contact_name', 'TEXT')
  ensureColumn('primary_contact_email', 'TEXT')
  ensureColumn('primary_contact_phone', 'TEXT')
  ensureColumn('default_currency', 'TEXT')
  ensureColumn('country_code', 'TEXT')
  ensureColumn('phone_number_format', 'TEXT')
  ensureColumn('unit_system', 'TEXT')
  ensureColumn('timezone', 'TEXT')
  ensureColumn('date_format', 'TEXT')
  ensureColumn('number_format_json', 'TEXT')
  ensureColumn('branding_primary_color', 'TEXT')
  ensureColumn('branding_secondary_color', 'TEXT')
  ensureColumn('branding_logo_url', 'TEXT')
  ensureColumn('address_line1', 'TEXT')
  ensureColumn('address_line2', 'TEXT')
  ensureColumn('city', 'TEXT')
  ensureColumn('state_province', 'TEXT')
  ensureColumn('postal_code', 'TEXT')
  ensureColumn('address_country_code', 'TEXT')
  ensureColumn('website', 'TEXT')
  ensureColumn('description', 'TEXT')
  ensureColumn('default_load_types_json', 'TEXT')
  ensureColumn('features_json', 'TEXT')
  ensureColumn('api_keys_json', 'TEXT')
  ensureColumn('created_date', 'DATETIME')
  ensureColumn('updated_date', 'DATETIME')

  // Backfill defaults for tenants
  db.prepare(`
    UPDATE tenants
    SET tenant_id = COALESCE(tenant_id, printf('TNT-%03d', id)),
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

  tenantSeeds.forEach((seed) => {
    const payload = { ...seed }
    jsonColumns.forEach((column) => {
      if (column in payload && typeof payload[column] !== 'string') {
        payload[column] = JSON.stringify(payload[column])
      }
    })
    payload.status = (payload.status || 'ACTIVE').toUpperCase()

    const existing = db.prepare('SELECT * FROM tenants WHERE tenant_id = ?').get(payload.tenant_id)
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

        db.prepare(`UPDATE tenants SET ${setColumns} WHERE tenant_id = @tenant_id`).run(updates)
      }
    } else {
      const insertPayload = { ...payload }
      insertPayload.created_date = insertPayload.created_date || now
      insertPayload.updated_date = insertPayload.updated_date || now
      const columns = Object.keys(insertPayload)
      const placeholders = columns.map((column) => `@${column}`).join(', ')
      db.prepare(`INSERT INTO tenants (${columns.join(', ')}) VALUES (${placeholders})`).run(insertPayload)
    }
  })

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

  categorySeeds.forEach((seed) => {
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

    const existing = db
      .prepare('SELECT id FROM tenant_categories WHERE tenant_id = ? AND category_name = ?')
      .get(seed.tenant_id, seed.category_name)

    if (existing) {
      const current = db.prepare('SELECT * FROM tenant_categories WHERE id = ?').get(existing.id)
      const needsUpdate = !current
        || current.product_category === null
        || current.category_type === null
        || current.sub_categories_json === null
        || current.load_type_mapping === null
        || current.description === null
        || current.sort_order === null

      if (needsUpdate) {
        db.prepare(
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
      db.prepare(
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
  })

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

  contactSeeds.forEach((seed) => {
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

    const existing = db
      .prepare('SELECT id FROM tenant_contacts WHERE tenant_id = ? AND contact_email = ?')
      .get(seed.tenant_id, seed.contact_email)

    if (existing) {
      const current = db.prepare('SELECT * FROM tenant_contacts WHERE id = ?').get(existing.id)
      const needsUpdate = !current
        || current.contact_type === null
        || current.contact_name === null
        || current.first_name === null
        || current.last_name === null
        || current.contact_phone === null
        || current.job_title === null
        || current.signature_type === null
        || current.signature_font === null

      if (needsUpdate) {
        db.prepare(
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
      db.prepare(
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
  })

  // Ensure default tenant and admin
  const tenant = db.prepare('SELECT id FROM tenants WHERE id = 1').get()
  if (!tenant) db.prepare('INSERT INTO tenants (id, name) VALUES (1, ?)').run('Default Tenant')

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@recims.com')
  if (!user) {
    const bcrypt = require('bcryptjs')
    const hashed = bcrypt.hashSync('admin123', 10)
    db.prepare(
      `INSERT INTO users (email, password, full_name, tenant_id, role) VALUES (?, ?, ?, ?, ?)`
    ).run('admin@recims.com', hashed, 'Admin User', 'TNT-001', 'super_admin')
  }

  db.prepare(`
    UPDATE users
    SET role = 'super_admin',
        tenant_id = COALESCE(tenant_id, 'TNT-001')
    WHERE email = 'admin@recims.com'
  `).run()

  db.prepare(`
    UPDATE users
    SET tenant_id = 'TNT-001'
    WHERE email = 'admin@recims.com' AND tenant_id = '1'
  `).run()

  return db
}

module.exports = { init }
