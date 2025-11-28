import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const CLNENV_TENANT_ID = 'TNT-002';
const CLNENV_USER_EMAIL = (process.env.CLNENV_USER_EMAIL || 'admin@clnenv.com').toLowerCase();
const CLNENV_USER_PASSWORD = process.env.CLNENV_USER_PASSWORD || 'phase3only!';
const CLNENV_USER_NAME = process.env.CLNENV_USER_NAME || 'CLN Env Restricted Admin';

// Initialize SQLite database
const db = new Database(process.env.DATABASE_PATH || join(__dirname, 'recims.db'));

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database tables
function initDatabase() {
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
  `);

  // Tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Shift logs table
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
  `);

  const ensureColumn = (column, type) => {
    try {
      db.prepare(`ALTER TABLE tenants ADD COLUMN ${column} ${type}`).run();
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
    }
  };

  const ensureUserColumn = (column, type) => {
    try {
      db.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run();
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
    }
  };

  ensureColumn('tenant_id', 'TEXT');
  ensureColumn('display_name', 'TEXT');
  ensureColumn('region', 'TEXT');
  ensureColumn('code', 'TEXT');
  ensureColumn('base_subdomain', 'TEXT');
  ensureColumn('tenant_code', 'TEXT');
  ensureColumn('business_type', 'TEXT');
  ensureColumn('primary_contact_name', 'TEXT');
  ensureColumn('primary_contact_email', 'TEXT');
  ensureColumn('primary_contact_phone', 'TEXT');
  ensureColumn('default_currency', 'TEXT');
  ensureColumn('country_code', 'TEXT');
  ensureColumn('phone_number_format', 'TEXT');
  ensureColumn('unit_system', 'TEXT');
  ensureColumn('timezone', 'TEXT');
  ensureColumn('date_format', 'TEXT');
  ensureColumn('number_format_json', 'TEXT');
  ensureColumn('branding_primary_color', 'TEXT');
  ensureColumn('branding_secondary_color', 'TEXT');
  ensureColumn('branding_logo_url', 'TEXT');
  ensureColumn('address_line1', 'TEXT');
  ensureColumn('address_line2', 'TEXT');
  ensureColumn('city', 'TEXT');
  ensureColumn('state_province', 'TEXT');
  ensureColumn('postal_code', 'TEXT');
  ensureColumn('address_country_code', 'TEXT');
  ensureColumn('website', 'TEXT');
  ensureColumn('description', 'TEXT');
  ensureColumn('default_load_types_json', 'TEXT');
  ensureColumn('features_json', 'TEXT');
  ensureColumn('api_keys_json', 'TEXT');
  ensureColumn('created_date', 'DATETIME');
  ensureColumn('updated_date', 'DATETIME');
  ensureUserColumn('phase_limit', 'TEXT');

  // Create default tenant and admin user if not exists
  const tenant = db.prepare('SELECT id FROM tenants WHERE id = 1').get();
  if (!tenant) {
    db.prepare('INSERT INTO tenants (id, name) VALUES (1, ?)').run('Default Tenant');
  }

  const ctMetalsTenant = db.prepare('SELECT id FROM tenants WHERE tenant_id = ?').get(CLNENV_TENANT_ID);
  if (!ctMetalsTenant) {
    db.prepare(`
      INSERT INTO tenants (
        name,
        tenant_id,
        display_name,
        region,
        status,
        branding_primary_color,
        branding_secondary_color,
        created_date,
        updated_date
      ) VALUES (@name, @tenant_id, @display_name, @region, 'ACTIVE', @primary_color, @secondary_color, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run({
      name: 'Connecticut Metals',
      tenant_id: CLNENV_TENANT_ID,
      display_name: 'CT Metals',
      region: 'Northeast',
      primary_color: '#F97316',
      secondary_color: '#F43F5E'
    });
  }

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
  `).run();

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@recims.com');
  if (!user) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (email, password, full_name, tenant_id, role) 
      VALUES (?, ?, ?, ?, ?)
    `).run('admin@recims.com', hashedPassword, 'Admin User', 'TNT-001', 'super_admin');
  }

  // Ensure the default admin retains super admin privileges and tenant code format
  db.prepare(`
    UPDATE users
    SET role = 'super_admin',
        tenant_id = COALESCE(tenant_id, 'TNT-001')
    WHERE email = 'admin@recims.com'
  `).run();

  // Link default tenant identifier back to numeric id if needed
  db.prepare(`
    UPDATE users
    SET tenant_id = 'TNT-001'
    WHERE email = 'admin@recims.com' AND tenant_id = '1'
  `).run();

  const restrictedUser = db.prepare('SELECT id FROM users WHERE email = ?').get(CLNENV_USER_EMAIL);
  if (!restrictedUser) {
    const hashed = bcrypt.hashSync(CLNENV_USER_PASSWORD, 10);
    db.prepare(`
      INSERT INTO users (email, password, full_name, tenant_id, role, phase_limit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      CLNENV_USER_EMAIL,
      hashed,
      CLNENV_USER_NAME,
      CLNENV_TENANT_ID,
      'phase3_admin',
      'PHASE III'
    );
  } else {
    db.prepare(`
      UPDATE users
      SET tenant_id = ?,
          role = 'phase3_admin',
          phase_limit = COALESCE(phase_limit, 'PHASE III')
      WHERE email = ?
    `).run(CLNENV_TENANT_ID, CLNENV_USER_EMAIL);
  }

  console.log('✅ Database initialized');
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role, phase_limit: user.phase_limit },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        tenant_id: user.tenant_id,
        role: user.role,
        phase_limit: user.phase_limit
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, full_name, tenant_id, role, phase_limit FROM users WHERE id = ?')
      .get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update current user
app.put('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const updatableFields = ['full_name', 'tenant_id', 'role'];
    const updates = {};

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const setClause = Object.keys(updates)
      .map((field) => `${field} = ?`)
      .join(', ');

    db.prepare(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(...Object.values(updates), req.user.id);

    const user = db.prepare('SELECT id, email, full_name, tenant_id, role, phase_limit FROM users WHERE id = ?')
      .get(req.user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, tenant_id: user.tenant_id, role: user.role, phase_limit: user.phase_limit },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ user, token });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Request password reset
app.post('/api/auth/password-reset', (req, res) => {
  try {
    const { email } = req.body;
    
    // In a real app, send email here
    // For now, just return success
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
});

// ==================== GENERIC ENTITY ROUTES ====================

// Generic GET all entities
app.get('/api/entities/:entityName', authenticateToken, (req, res) => {
  try {
    const { entityName } = req.params;
    const tableName = entityName.toLowerCase();

    if (tableName === 'tenants' && req.user.role === 'super_admin') {
      const stmt = db.prepare(`SELECT * FROM ${tableName}`);
      const tenants = stmt.all();
      return res.json(tenants);
    }

    const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE tenant_id = ? OR tenant_id IS NULL`);
    const entities = stmt.all(req.user.tenant_id);

    res.json(entities);
  } catch (error) {
    console.error(`Get ${req.params.entityName} error:`, error);
    // Return empty array instead of error for non-existent tables
    res.json([]);
  }
});

// Generic GET entity by ID
app.get('/api/entities/:entityName/:id', authenticateToken, (req, res) => {
  try {
    const { entityName, id } = req.params;
    const tableName = entityName.toLowerCase();
    
    const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
    const entity = stmt.get(id);
    
    if (!entity) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(entity);
  } catch (error) {
    console.error(`Get ${req.params.entityName} error:`, error);
    res.status(500).json({ error: 'Failed to get entity' });
  }
});

// Generic CREATE entity
app.post('/api/entities/:entityName', authenticateToken, (req, res) => {
  try {
    const { entityName } = req.params;
    const tableName = entityName.toLowerCase();
    const data = { ...req.body, tenant_id: req.user.tenant_id };
    
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const stmt = db.prepare(
      `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`
    );
    const result = stmt.run(...values);
    
    res.status(201).json({ id: result.lastInsertRowid, ...data });
  } catch (error) {
    console.error(`Create ${req.params.entityName} error:`, error);
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

// Generic UPDATE entity
app.put('/api/entities/:entityName/:id', authenticateToken, (req, res) => {
  try {
    const { entityName, id } = req.params;
    const tableName = entityName.toLowerCase();
    const data = req.body;
    
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    const stmt = db.prepare(
      `UPDATE ${tableName} SET ${setClause} WHERE id = ?`
    );
    stmt.run(...values, id);
    
    res.json({ id, ...data });
  } catch (error) {
    console.error(`Update ${req.params.entityName} error:`, error);
    res.status(500).json({ error: 'Failed to update entity' });
  }
});

// Generic DELETE entity
app.delete('/api/entities/:entityName/:id', authenticateToken, (req, res) => {
  try {
    const { entityName, id } = req.params;
    const tableName = entityName.toLowerCase();
    
    const stmt = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    stmt.run(id);
    
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(`Delete ${req.params.entityName} error:`, error);
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RecIMS API Server Running' });
});

// Initialize database and start server
initDatabase();

app.listen(PORT, () => {
  console.log(`🚀 RecIMS Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Default login: admin@recims.com / admin123`);
});
