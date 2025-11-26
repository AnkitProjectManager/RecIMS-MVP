import { useMemo } from 'react';

/**
 * Custom hook for role-based permissions
 * Returns a permissions object based on user role
 */
export function usePermissions(user) {
  return useMemo(() => {
    if (!user) {
      return {
        canManageUsers: false,
        canViewFinancials: false,
        canApproveOrders: false,
        canExportData: false,
        canManageSettings: false,
        canDeleteShipments: false,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'none'
      };
    }

    const role = user.detailed_role || user.role || 'warehouse_staff';

    // SUPERADMIN: Full system access + tenant/phase configuration
    if (role === 'superadmin') {
      return {
        canManageUsers: true,
        canViewFinancials: true,
        canApproveOrders: true,
        canExportData: true,
        canManageSettings: true,
        canDeleteShipments: true,
        canManageTenants: true,
        canConfigurePhases: true,
        role: 'superadmin'
      };
    }

    // ADMIN: Full system access except tenant configuration
    if (role === 'admin') {
      return {
        canManageUsers: true,
        canViewFinancials: true,
        canApproveOrders: true,
        canExportData: true,
        canManageSettings: true,
        canDeleteShipments: true,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'admin'
      };
    }

    // MANAGER: Can manage operations, approve orders, delete shipments
    if (role === 'manager') {
      return {
        canManageUsers: false,
        canViewFinancials: true,
        canApproveOrders: true,
        canExportData: true,
        canManageSettings: false,
        canDeleteShipments: true,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'manager'
      };
    }

    // WAREHOUSE STAFF: Basic operations only
    if (role === 'warehouse_staff') {
      return {
        canManageUsers: false,
        canViewFinancials: false,
        canApproveOrders: false,
        canExportData: false,
        canManageSettings: false,
        canDeleteShipments: false,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'warehouse_staff'
      };
    }

    // SALES REPRESENTATIVE: Sales-related permissions
    if (role === 'sales_representative') {
      return {
        canManageUsers: false,
        canViewFinancials: true,
        canApproveOrders: false,
        canExportData: true,
        canManageSettings: false,
        canDeleteShipments: false,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'sales_representative'
      };
    }

    // QUALITY CONTROL: QC-related permissions
    if (role === 'quality_control') {
      return {
        canManageUsers: false,
        canViewFinancials: false,
        canApproveOrders: false,
        canExportData: true,
        canManageSettings: false,
        canDeleteShipments: false,
        canManageTenants: false,
        canConfigurePhases: false,
        role: 'quality_control'
      };
    }

    // Default: minimal permissions
    return {
      canManageUsers: false,
      canViewFinancials: false,
      canApproveOrders: false,
      canExportData: false,
      canManageSettings: false,
      canDeleteShipments: false,
      canManageTenants: false,
      canConfigurePhases: false,
      role: 'warehouse_staff'
    };
  }, [user]);
}

/**
 * Get a user-friendly display name for a role
 */
export function getRoleDisplayName(role) {
  const roleNames = {
    superadmin: 'Super Administrator',
    admin: 'Administrator',
    manager: 'Manager',
    warehouse_staff: 'Warehouse Staff',
    sales_representative: 'Sales Representative',
    quality_control: 'Quality Control'
  };
  return roleNames[role] || 'Warehouse Staff';
}

/**
 * Get a color class for a role badge
 */
export function getRoleColor(role) {
  const roleColors = {
    superadmin: 'bg-red-100 text-red-700 border-red-300',
    admin: 'bg-purple-100 text-purple-700 border-purple-300',
    manager: 'bg-blue-100 text-blue-700 border-blue-300',
    warehouse_staff: 'bg-green-100 text-green-700 border-green-300',
    sales_representative: 'bg-orange-100 text-orange-700 border-orange-300',
    quality_control: 'bg-yellow-100 text-yellow-700 border-yellow-300'
  };
  return roleColors[role] || 'bg-gray-100 text-gray-700 border-gray-300';
}