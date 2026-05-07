import { UserRole } from "@/lib/auth";

export interface ModuleConfig {
  id: string;
  label: string;
  path: string;
  role: UserRole[];
}

export const MODULES: ModuleConfig[] = [
  // Admin Modules
  { id: "admin-dashboard", label: "Dashboard", path: "/admin/dashboard", role: ["admin", "superadmin"] },
  { id: "reports", label: "Reports", path: "/admin/reports", role: ["admin", "superadmin"] },
  { id: "users", label: "User Management", path: "/admin/users", role: ["admin", "superadmin"] },
  { id: "admin-visitors", label: "Visitors", path: "/guard/visitors", role: ["admin", "superadmin"] },
  { id: "admin-passes", label: "Visitor Access Pass", path: "/admin/passes", role: ["admin", "superadmin"] },
  { id: "settings", label: "System Settings", path: "/admin/settings", role: ["admin", "superadmin"] },

  // Receptionist Modules
  { id: "reception-dashboard", label: "Dashboard", path: "/guard/dashboard", role: ["guard"] },
  { id: "reception-visitors", label: "Visitors", path: "/guard/visitors", role: ["guard"] },
  { id: "reception-register", label: "Register", path: "/guard/register", role: ["guard"] },
  { id: "reception-photo", label: "Photo", path: "/guard/photo", role: ["guard"] },
  { id: "reception-host", label: "Host", path: "/guard/host", role: ["guard"] },
  { id: "reception-checkin", label: "IN", path: "/guard/qr-checkin", role: ["guard"] },
  { id: "reception-qr-scanner", label: "QR Scanner", path: "/guard/qr-scanner", role: ["guard"] },
  { id: "reception-qr-visitor", label: "QR Visitor", path: "/guard/qr-visitor", role: ["guard"] },
  { id: "reception-checkout", label: "OUT", path: "/guard/manual-checkout", role: ["guard"] },
  { id: "reception-history", label: "History", path: "/guard/history", role: ["guard"] },

  // Employee Modules
  { id: "employee-dashboard", label: "Dashboard", path: "/employee/dashboard", role: ["employee"] },
  { id: "employee-visitors", label: "My Visitor", path: "/employee/visitors", role: ["employee"] },
  { id: "employee-pending-approvals", label: "Pending Approvals", path: "/employee/visitors?view=pending", role: ["employee"] },
  { id: "employee-approved", label: "Approved", path: "/employee/visitors?view=approved", role: ["employee"] },
  { id: "employee-rejected", label: "Rejected", path: "/employee/visitors?view=rejected", role: ["employee"] },
  { id: "employee-passes", label: "Visitor Access Pass", path: "/employee/passes", role: ["employee"] },
];

export function getModulesForRole(role: UserRole): ModuleConfig[] {
  return MODULES.filter(m => m.role.includes(role));
}
