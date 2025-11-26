import { recims } from "@/api/recimsClient";

/**
 * QuickBooks Helper Utilities
 * Provides functions to get QBO connection info for the current tenant
 */

/**
 * Get active QBO connection for a specific tenant
 */
export async function getQBOConnectionForTenant(tenant) {
  try {
    const connections = await recims.entities.QBOConnection.filter({
      tenant: tenant,
      status: 'active'
    }, '-created_date', 1);

    if (connections.length === 0) {
      return null;
    }

    const connection = connections[0];

    // Check if token is expired or expiring soon (within 5 minutes)
    const expiryDate = new Date(connection.token_expires_at);
    const now = new Date();
    const minutesUntilExpiry = (expiryDate - now) / (1000 * 60);

    if (minutesUntilExpiry < 5) {
      // Token is expired or about to expire, attempt refresh
      try {
        const { data } = await recims.functions.invoke('qboRefreshToken', {
          connectionId: connection.id
        });

        if (data.success) {
          // Fetch updated connection
          const refreshedConnections = await recims.entities.QBOConnection.filter({
            id: connection.id
          });
          return refreshedConnections[0];
        }
      } catch (refreshError) {
        console.error('Failed to auto-refresh token:', refreshError);
        return null;
      }
    }

    return connection;
  } catch (error) {
    console.error('Error getting QBO connection:', error);
    return null;
  }
}

/**
 * Get active QBO connection for the current user's tenant
 */
export async function getQBOConnectionForCurrentUser() {
  try {
    const user = await recims.auth.me();
    if (!user || !user.tenant) {
      return null;
    }

    return await getQBOConnectionForTenant(user.tenant);
  } catch (error) {
    console.error('Error getting current user QBO connection:', error);
    return null;
  }
}

/**
 * Check if QBO is connected for a tenant
 */
export async function isQBOConnected(tenant) {
  const connection = await getQBOConnectionForTenant(tenant);
  return connection !== null && connection.status === 'active';
}

/**
 * Get QBO company info for display
 */
export async function getQBOCompanyInfo(tenant) {
  const connection = await getQBOConnectionForTenant(tenant);
  
  if (!connection) {
    return null;
  }

  return {
    name: connection.company_name,
    realmId: connection.realm_id,
    currency: connection.currency,
    country: connection.country,
    connectedAt: connection.connected_at,
    lastSync: connection.last_sync_at
  };
}

/**
 * Format QBO connection status for display
 */
export function getConnectionStatus(connection) {
  if (!connection) {
    return {
      color: 'gray',
      text: 'Not Connected',
      icon: 'unlink'
    };
  }

  const expiryDate = new Date(connection.token_expires_at);
  const now = new Date();
  const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);

  if (connection.status === 'active' && hoursUntilExpiry > 1) {
    return {
      color: 'green',
      text: 'Connected',
      icon: 'check'
    };
  } else if (connection.status === 'active' && hoursUntilExpiry <= 1 && hoursUntilExpiry > 0) {
    return {
      color: 'yellow',
      text: 'Expiring Soon',
      icon: 'alert'
    };
  } else if (connection.status === 'expired' || hoursUntilExpiry <= 0) {
    return {
      color: 'orange',
      text: 'Token Expired',
      icon: 'alert'
    };
  } else {
    return {
      color: 'red',
      text: 'Disconnected',
      icon: 'unlink'
    };
  }
}