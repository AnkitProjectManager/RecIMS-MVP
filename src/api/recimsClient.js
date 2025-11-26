// RecIMS Standalone API Client
// Implements direct API calls to the RecIMS backend

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const API_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl.replace(/\/$/, '')
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

// Use a guard so SSR doesn't access window/localStorage
const storage = typeof window !== 'undefined'
  ? window.localStorage
  : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };

const FALLBACK_ENTITY_KEY = 'recims_fallback_entities';
const FALLBACK_UPLOAD_KEY = 'recims_fallback_uploads';

function safeParseJSON(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeEntityKey(name) {
  return (name || '').toString().trim().toLowerCase();
}

function getFallbackEntityMap() {
  return safeParseJSON(storage.getItem(FALLBACK_ENTITY_KEY), {});
}

function saveFallbackEntityMap(map) {
  try {
    storage.setItem(FALLBACK_ENTITY_KEY, JSON.stringify(map));
  } catch (error) {
    // Ignore storage quota or privacy-mode failures silently
  }
}

function readFallbackList(entityName) {
  const map = getFallbackEntityMap();
  const records = map[normalizeEntityKey(entityName)] || [];
  return Array.isArray(records) ? records.map((item) => ({ ...item })) : [];
}

function writeFallbackList(entityName, list) {
  const map = getFallbackEntityMap();
  map[normalizeEntityKey(entityName)] = Array.isArray(list)
    ? list.map((item) => ({ ...item }))
    : [];
  saveFallbackEntityMap(map);
}

function generateClientId() {
  return `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function upsertFallbackRecord(entityName, record) {
  const list = readFallbackList(entityName);
  const now = new Date().toISOString();
  const normalizedId = record?.id != null ? String(record.id) : null;

  let target = { ...record };
  if (!normalizedId) {
    target.id = generateClientId();
  } else {
    target.id = normalizedId;
  }

  const existingIndex = list.findIndex((item) => String(item.id) === target.id);
  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    target = {
      ...existing,
      ...target,
      id: existing.id,
      created_date: existing.created_date || target.created_date || now,
      updated_date: now,
    };
    list[existingIndex] = target;
  } else {
    if (!target.created_date) {
      target.created_date = now;
    }
    target.updated_date = now;
    list.push(target);
  }

  writeFallbackList(entityName, list);
  return { ...target };
}

function removeFallbackRecord(entityName, id) {
  const list = readFallbackList(entityName);
  const filtered = list.filter((item) => String(item.id) !== String(id));
  writeFallbackList(entityName, filtered);
}

function getFallbackUploadsMap() {
  return safeParseJSON(storage.getItem(FALLBACK_UPLOAD_KEY), {});
}

function saveFallbackUploadsMap(map) {
  try {
    storage.setItem(FALLBACK_UPLOAD_KEY, JSON.stringify(map));
  } catch (error) {
    // Ignore storage quota or privacy-mode failures silently
  }
}

function storeFallbackUpload({ dataUrl, fileName, mimeType }) {
  const uploads = getFallbackUploadsMap();
  const id = generateClientId();
  uploads[id] = {
    id,
    file_name: fileName,
    mime_type: mimeType,
    data_url: dataUrl,
    created_at: new Date().toISOString(),
  };
  saveFallbackUploadsMap(uploads);
  return {
    file_url: dataUrl,
    file_id: id,
    file_name: fileName,
    mime_type: mimeType,
    stored: 'local',
  };
}

function sortEntities(entities, orderBy) {
  const results = Array.isArray(entities) ? [...entities] : [];
  if (!orderBy) {
    return results;
  }

  const desc = orderBy.startsWith('-');
  const field = desc ? orderBy.slice(1) : orderBy;
  return results.sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    if (left == null) return desc ? 1 : -1;
    if (right == null) return desc ? -1 : 1;
    if (desc) {
      return right > left ? 1 : -1;
    }
    return left > right ? 1 : -1;
  });
}

function logFallback(entityName, action, error) {
  if (typeof console !== 'undefined' && error) {
    console.warn(`[recims] Falling back to local data for ${entityName} ${action}`, error);
  }
}

function blobToDataUrl(blob) {
  if (!(blob instanceof Blob)) {
    return Promise.reject(new Error('Invalid blob provided')); 
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob')); 
    reader.readAsDataURL(blob);
  });
}

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
      try {
        const entities = await fetchAPI(`/entities/${entityName}`);
        const normalized = Array.isArray(entities) ? entities : [];
        const sorted = sortEntities(normalized, orderBy);
        writeFallbackList(entityName, sorted);
        return limit ? sorted.slice(0, limit) : sorted;
      } catch (error) {
        logFallback(entityName, 'list', error);
        const fallback = sortEntities(readFallbackList(entityName), orderBy);
        return limit ? fallback.slice(0, limit) : fallback;
      }
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
      try {
        const entity = await fetchAPI(`/entities/${entityName}/${id}`);
        if (entity && typeof entity === 'object' && !Array.isArray(entity)) {
          upsertFallbackRecord(entityName, entity);
        }
        return entity;
      } catch (error) {
        logFallback(entityName, `get(${id})`, error);
        const fallback = readFallbackList(entityName).find((item) => String(item.id) === String(id));
        if (fallback) {
          return { ...fallback };
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
          upsertFallbackRecord(entityName, created);
          return created;
        }
        const fallbackRecord = upsertFallbackRecord(entityName, { ...data });
        return fallbackRecord;
      } catch (error) {
        logFallback(entityName, 'create', error);
        return upsertFallbackRecord(entityName, { ...data });
      }
    },

    async update(id, data) {
      try {
        const payload = await fetchAPI(`/entities/${entityName}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        const normalized = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? payload
          : { ...data, id };
        upsertFallbackRecord(entityName, normalized);
        return normalized;
      } catch (error) {
        logFallback(entityName, `update(${id})`, error);
        return upsertFallbackRecord(entityName, { ...data, id });
      }
    },

    async delete(id) {
      try {
        const result = await fetchAPI(`/entities/${entityName}/${id}`, {
          method: 'DELETE',
        });
        removeFallbackRecord(entityName, id);
        return result ?? id;
      } catch (error) {
        logFallback(entityName, `delete(${id})`, error);
        removeFallbackRecord(entityName, id);
        return id;
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
      const originalDataUrl = typeof file === 'string' && file.startsWith('data:') ? file : null;

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

      try {
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
      } catch (error) {
        console.warn('[recims] Upload failed, using local fallback storage', error);
        try {
          let dataUrl = originalDataUrl;
          if (!dataUrl) {
            dataUrl = await blobToDataUrl(uploadBlob instanceof Blob ? uploadBlob : new Blob([uploadBlob], { type: inferredMime }));
          }
          return storeFallbackUpload({ dataUrl, fileName: uploadName, mimeType: inferredMime });
        } catch (fallbackError) {
          // Preserve original error context for debugging
          if (typeof fallbackError === 'object') {
            fallbackError.originalError = error;
          }
          throw fallbackError;
        }
      }
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


