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

  return {
    async list(orderBy, limit) {
      const entities = await fetchAPI(`/entities/${entityName}`);
      
      // Apply ordering and limit client-side for now
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const field = desc ? orderBy.slice(1) : orderBy;
        entities.sort((a, b) => {
          if (desc) {
            return b[field] > a[field] ? 1 : -1;
          }
          return a[field] > b[field] ? 1 : -1;
        });
      }
      
      if (limit) {
        return entities.slice(0, limit);
      }
      
      return entities;
    },

    async filter(filters, orderBy) {
      const entities = await this.list(orderBy);
      
      // Apply filters client-side
      return entities.filter(entity => {
        return Object.keys(filters).every(key => {
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
      return fetchAPI(`/entities/${entityName}/${id}`);
    },

    async create(data) {
      return fetchAPI(`/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id, data) {
      return fetchAPI(`/entities/${entityName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return fetchAPI(`/entities/${entityName}/${id}`, {
        method: 'DELETE',
      });
    },
  };
}

// Entities object - matches the legacy SDK structure for compatibility
const entities = {
  // Core entities
  User: createEntityAPI('User'),
  Tenant: createEntityAPI('tenants'),
  
  // Inventory entities
  Inventory: createEntityAPI('Inventory'),
  Bin: createEntityAPI('Bin'),
  ProductSKU: createEntityAPI('ProductSKU'),
  Zone: createEntityAPI('Zone'),
  
  // Shipment entities
  InboundShipment: createEntityAPI('InboundShipment'),
  
  // Purchase Order entities
  PurchaseOrder: createEntityAPI('PurchaseOrder'),
  PurchaseOrderLine: createEntityAPI('PurchaseOrderLine'),
  
  // Sales Order entities
  SalesOrder: createEntityAPI('SalesOrder'),
  SalesOrderLine: createEntityAPI('SalesOrderLine'),
  
  // Quality Control
  QCInspection: createEntityAPI('QCInspection'),
  QCCriteria: createEntityAPI('QCCriteria'),
  
  // Customer/Vendor
  Customer: createEntityAPI('Customer'),
  Vendor: createEntityAPI('Vendor'),
  
  // Settings & Config
  AppSettings: createEntityAPI('AppSettings'),
  TenantCategory: createEntityAPI('tenant_categories'),
  TenantContact: createEntityAPI('tenant_contacts'),
  
  // Logistics
  Carrier: createEntityAPI('Carrier'),
  Waybill: createEntityAPI('Waybill'),
  WaybillItem: createEntityAPI('WaybillItem'),
  
  // Misc
  ShiftLog: createEntityAPI('ShiftLog'),
  Container: createEntityAPI('Container'),
  MaterialCategory: createEntityAPI('MaterialCategory'),
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
const notImplemented = (feature) => {
  console.warn(`${feature} integration not available in standalone mode`);
  return {
    message: `${feature} integration is not configured for this environment`,
    success: false,
  };
};

const integrations = {
  Core: {
    async UploadFile({ file, fileName, mimeType }) {
      if (!file) {
        throw new Error('File is required for upload');
      }

      let uploadBlob = file;
      let uploadName = fileName || (typeof file === 'object' && file?.name) || 'upload';
      let inferredMime = mimeType || (typeof file === 'object' && file?.type) || 'application/octet-stream';

      if (typeof file === 'string') {
        let base64Data = file;
        const dataUrlMatch = /^data:(.*?);base64,(.*)$/.exec(file);
        if (dataUrlMatch) {
          inferredMime = dataUrlMatch[1] || inferredMime;
          base64Data = dataUrlMatch[2];
        }

        try {
          const binary = typeof atob === 'function'
            ? atob(base64Data)
            : typeof Buffer !== 'undefined'
              ? Buffer.from(base64Data, 'base64').toString('binary')
              : (() => { throw new Error('Base64 decoding not supported'); })();
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          uploadBlob = new Blob([bytes], { type: inferredMime });
          if (!fileName) {
            const guessedExt = inferredMime && inferredMime.includes('/') ? inferredMime.split('/')[1] : 'bin';
            uploadName = `upload.${guessedExt}`;
          }
        } catch (decodeError) {
          console.error('Failed to decode base64 upload payload', decodeError);
          throw new Error('Invalid file data');
        }
      }

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadName);

      const headers = { Accept: 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || 'File upload failed';
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      return payload || {};
    },
    async UploadPrivateFile(params) {
      return this.UploadFile(params);
    },
    async CreateFileSignedUrl() {
      return notImplemented('Signed URL');
    },
    async ExtractDataFromUploadedFile() {
      return notImplemented('File extraction');
    },
    async GenerateImage() {
      return notImplemented('Image generation');
    },
    async SendEmail() {
      return notImplemented('Email');
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


