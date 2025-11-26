// RecIMS Standalone API Client
// Implements direct API calls to the RecIMS backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Use a guard so SSR doesn't access window/localStorage
const storage = typeof window !== 'undefined'
  ? window.localStorage
  : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };

const ENTITY_CACHE_PREFIX = 'recims:entityCache:';

const entityCache = {
  key(entityName) {
    return `${ENTITY_CACHE_PREFIX}${entityName}`;
  },

  read(entityName) {
    const raw = storage.getItem(this.key(entityName));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },

  write(entityName, records) {
    if (!Array.isArray(records)) return;
    try {
      storage.setItem(this.key(entityName), JSON.stringify(records));
    } catch (error) {
      // Best-effort cache; ignore quota errors.
    }
  },

  normalizeId(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object' && 'id' in value) {
      return this.normalizeId(value.id);
    }
    return null;
  },

  upsert(entityName, record) {
    if (!record || typeof record !== 'object') return;
    const id = this.normalizeId(record);
    if (!id) return;
    const existing = this.read(entityName);
    const next = existing.filter((item) => this.normalizeId(item) !== id);
    next.push(record);
    this.write(entityName, next);
  },

  remove(entityName, recordId) {
    const id = this.normalizeId(recordId);
    if (!id) return;
    const existing = this.read(entityName);
    const next = existing.filter((item) => this.normalizeId(item) !== id);
    this.write(entityName, next);
  },

  find(entityName, recordId) {
    const id = this.normalizeId(recordId);
    if (!id) return null;
    const existing = this.read(entityName);
    return existing.find((item) => this.normalizeId(item) === id) || null;
  },
};

const valuesEqual = (left, right) => {
  if (left === right) return true;
  if (left == null || right == null) {
    return left == null && right == null;
  }

  if (typeof left === 'number' && typeof right === 'string') {
    return String(left) === right;
  }

  if (typeof left === 'string' && typeof right === 'number') {
    return left === String(right);
  }

  if (typeof left === 'boolean' && typeof right === 'string') {
    const normalized = right.trim().toLowerCase();
    if (normalized === 'true') return left === true;
    if (normalized === 'false') return left === false;
    return false;
  }

  if (typeof left === 'string' && typeof right === 'boolean') {
    const normalized = left.trim().toLowerCase();
    if (normalized === 'true') return right === true;
    if (normalized === 'false') return right === false;
    return false;
  }

  return String(left) === String(right);
};

const applyOrderingAndLimit = (records, orderBy, limit) => {
  const result = Array.isArray(records) ? [...records] : [];
  if (orderBy && result.length > 1) {
    const desc = orderBy.startsWith('-');
    const field = desc ? orderBy.slice(1) : orderBy;
    result.sort((a, b) => {
      const left = a?.[field];
      const right = b?.[field];
      if (left === right) return 0;
      if (left === undefined) return desc ? 1 : -1;
      if (right === undefined) return desc ? -1 : 1;
      if (left > right) return desc ? -1 : 1;
      if (left < right) return desc ? 1 : -1;
      return 0;
    });
  }

  if (limit && Number.isFinite(Number(limit))) {
    return result.slice(0, Number(limit));
  }
  return result;
};

// Token management
let authToken = storage.getItem('recims_token') || null;

function setToken(token) {
  authToken = token;
  if (token) {
    storage.setItem('recims_token', token);
  } else {
    storage.removeItem('recims_token');
  }
}

function getStoredToken() {
  return authToken;
}

// Generic fetch wrapper with auth
async function fetchAPI(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => '');
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
    }

    const message = payload?.error || payload?.message || response.statusText || 'API request failed';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload ?? {};
}

// Auth API
const auth = {
  async login({ email, password }) {
    const data = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data.token) {
      setToken(data.token);
    }
    
    return data.user;
  },

  async logout() {
    setToken(null);
  },

  getToken() {
    return getStoredToken();
  },

  isAuthenticated() {
    return Boolean(getStoredToken());
  },

  async me() {
    return fetchAPI('/auth/me');
  },

  async requestPasswordReset({ email }) {
    return fetchAPI('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async updateMe(data) {
    const payload = await fetchAPI('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (payload?.token) {
      setToken(payload.token);
    }

    return payload?.user ?? payload;
  },
};

// Entity API factory
function createEntityAPI(entityName) {
  return {
    async list(orderBy, limit) {
      try {
        const entities = await fetchAPI(`/entities/${entityName}`);
        const normalized = Array.isArray(entities) ? entities : [];
        if (normalized.length > 0) {
          entityCache.write(entityName, normalized);
          return applyOrderingAndLimit(normalized, orderBy, limit);
        } else {
          const cached = entityCache.read(entityName);
          if (cached.length > 0) {
            return applyOrderingAndLimit(cached, orderBy, limit);
          }
          entityCache.write(entityName, normalized);
          return applyOrderingAndLimit(normalized, orderBy, limit);
        }
      } catch (error) {
        const cached = entityCache.read(entityName);
        if (cached.length > 0) {
          return applyOrderingAndLimit(cached, orderBy, limit);
        }
        throw error;
      }
    },

    async filter(filters, orderBy) {
      const entities = await this.list(orderBy);
      
      // Apply filters client-side
      return entities.filter((entity) => {
        return Object.keys(filters).every((key) => {
          const filterValue = filters[key];
          const entityValue = entity[key];

          if (Array.isArray(filterValue)) {
            return filterValue.some((candidate) => valuesEqual(entityValue, candidate));
          }

          return valuesEqual(entityValue, filterValue);
        });
      });
    },

    async get(id) {
      try {
        const entity = await fetchAPI(`/entities/${entityName}/${id}`);
        if (entity && typeof entity === 'object') {
          entityCache.upsert(entityName, entity);
        }
        return entity;
      } catch (error) {
        const cached = entityCache.find(entityName, id);
        if (cached) {
          return cached;
        }
        throw error;
      }
    },

    async create(data) {
      try {
        const created = await fetchAPI(`/entities/${entityName}`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (created && typeof created === 'object') {
          entityCache.upsert(entityName, created);
        }
        return created;
      } catch (error) {
        const localRecord = {
          ...data,
          id: data?.id ?? `local-${Date.now()}`,
          __source: 'local-cache',
        };
        entityCache.upsert(entityName, localRecord);
        return localRecord;
      }
    },

    async update(id, data) {
      try {
        const updated = await fetchAPI(`/entities/${entityName}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (updated && typeof updated === 'object') {
          entityCache.upsert(entityName, updated);
        } else {
          entityCache.upsert(entityName, { ...(data || {}), id });
        }
        return updated;
      } catch (error) {
        const fallback = { ...(data || {}), id, __source: 'local-cache' };
        entityCache.upsert(entityName, fallback);
        return fallback;
      }
    },

    async delete(id) {
      try {
        const result = await fetchAPI(`/entities/${entityName}/${id}`, {
          method: 'DELETE',
        });
        entityCache.remove(entityName, id);
        return result;
      } catch (error) {
        entityCache.remove(entityName, id);
        return { message: 'Deleted locally', __source: 'local-cache' };
      }
    },
  };
}

// Entities object - matches the legacy SDK structure for compatibility
const entities = {
  // Core entities
  User: createEntityAPI('User'),
  Tenant: createEntityAPI('tenants'),
  
  // Inventory entities
  Material: createEntityAPI('Material'),
  Inventory: createEntityAPI('Inventory'),
  Bin: createEntityAPI('Bin'),
  ProductSKU: createEntityAPI('ProductSKU'),
  Zone: createEntityAPI('Zone'),
  MaterialCategory: createEntityAPI('MaterialCategory'),
  Supplier: createEntityAPI('Supplier'),
  
  // Shipment entities
  InboundShipment: createEntityAPI('InboundShipment'),
  OutboundShipment: createEntityAPI('OutboundShipment'),
  
  // Purchase Order entities
  PurchaseOrder: createEntityAPI('PurchaseOrder'),
  PurchaseOrderLine: createEntityAPI('PurchaseOrderLine'),
  PurchaseOrderItem: createEntityAPI('PurchaseOrderItem'),
  
  // Sales Order entities
  SalesOrder: createEntityAPI('SalesOrder'),
  SalesOrderLine: createEntityAPI('SalesOrderLine'),
  SalesOrderItem: createEntityAPI('SalesOrderItem'),
  Invoice: createEntityAPI('Invoice'),
  InvoiceLine: createEntityAPI('InvoiceLine'),
  SignatureRequest: createEntityAPI('SignatureRequest'),
  
  // Quality Control
  QCInspection: createEntityAPI('QCInspection'),
  QCCriteria: createEntityAPI('QCCriteria'),
  AuditTrail: createEntityAPI('AuditTrail'),
  ComplianceCertificate: createEntityAPI('ComplianceCertificate'),
  
  // Customer/Vendor
  Customer: createEntityAPI('Customer'),
  Vendor: createEntityAPI('Vendor'),
  Address: createEntityAPI('Address'),
  EmailTemplate: createEntityAPI('EmailTemplate'),
  
  // Settings & Config
  AppSettings: createEntityAPI('AppSettings'),
  AlertSettings: createEntityAPI('AlertSettings'),
  InventoryAlert: createEntityAPI('InventoryAlert'),
  TenantCategory: createEntityAPI('tenant_categories'),
  TenantContact: createEntityAPI('tenant_contacts'),
  ReportHistory: createEntityAPI('ReportHistory'),
  QBOConnection: createEntityAPI('QBOConnection'),
  
  // Logistics
  Carrier: createEntityAPI('Carrier'),
  Waybill: createEntityAPI('Waybill'),
  WaybillItem: createEntityAPI('WaybillItem'),
  Container: createEntityAPI('Container'),
  
  // Misc
  ShiftLog: createEntityAPI('ShiftLog'),
};

// Functions API (placeholder for now)
const functions = {
  async invoke(functionName, data) {
    console.warn(`Function ${functionName} called but not implemented in standalone mode`);
    // Return mock data based on function name
    if (functionName === 'calculateUSTax') {
      return {
        data: {
          subtotal: data.subtotal || 0,
          tax: (data.subtotal || 0) * 0.08,
          total: (data.subtotal || 0) * 1.08,
        },
      };
    }
    return { data: {} };
  },
};

// Integrations API (placeholder)
const integrations = {
  Core: {
    async UploadFile({ file }) {
      console.warn('File upload not implemented in standalone mode');
      return { file_url: URL.createObjectURL(file) };
    },
    async InvokeLLM(data) {
      console.warn('LLM integration not available in standalone mode');
      return {
        result: 'AI features require backend integration',
        insights: [],
      };
    },
  },
};

// Agents API (placeholder)
const agents = {
  getWhatsAppConnectURL(agentName) {
    console.warn('WhatsApp integration not available in standalone mode');
    return '#';
  },
};

// Main RecIMS client object
export const recims = {
  auth,
  entities,
  functions,
  integrations,
  agents,
};


