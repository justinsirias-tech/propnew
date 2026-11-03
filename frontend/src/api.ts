import {
  DashboardData,
  Developer,
  Contact,
  PropertyUnit,
  LeaseContract,
  LeaseDocument,
  RentalPayment,
  LeaseStatementData,
  UnitIssue,
  CommunicationLog,
  AppUser,
  RolesMatrixData,
  FeaturePermissions,
} from './types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP error ${res.status}`);
  }
  return res.json();
}

export const api = {
  getDashboard: () => request<DashboardData>('/dashboard'),

  uploadImages: async (
    files: FileList | File[]
  ): Promise<{
    urls: string[];
    files: { url: string; name: string; size_bytes: number }[];
  }> => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    const res = await fetch(`${API_BASE}/upload-images`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Upload failed with status ${res.status}`);
    }
    return res.json();
  },

  uploadFiles: async (
    files: FileList | File[]
  ): Promise<{ files: LeaseDocument[] }> => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    const res = await fetch(`${API_BASE}/upload-files`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `File upload failed with status ${res.status}`);
    }
    return res.json();
  },

  // Developers
  getDevelopers: () => request<Developer[]>('/developers'),
  getDeveloperDetails: (id: number) =>
    request<{
      developer: Developer;
      units: PropertyUnit[];
      issues: UnitIssue[];
      communications: CommunicationLog[];
    }>(`/developers/${id}/details`),
  createDeveloper: (data: Partial<Developer>) =>
    request<Developer>('/developers', { method: 'POST', body: JSON.stringify(data) }),
  updateDeveloper: (id: number, data: Partial<Developer>) =>
    request<Developer>(`/developers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeveloper: (id: number) =>
    request<{ ok: boolean }>(`/developers/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: (role?: string) =>
    request<Contact[]>(role ? `/contacts?role=${role}` : '/contacts'),
  getContactDetails: (id: number) =>
    request<{
      contact: Contact;
      owned_units: PropertyUnit[];
      leases: LeaseContract[];
      issues: UnitIssue[];
      communications: CommunicationLog[];
    }>(`/contacts/${id}/details`),
  createContact: (data: Partial<Contact>) =>
    request<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id: number, data: Partial<Contact>) =>
    request<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id: number) =>
    request<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),

  // Units
  getUnits: () => request<PropertyUnit[]>('/units'),
  getUnitDetails: (id: number) =>
    request<{
      unit: PropertyUnit;
      developer: Developer | null;
      landlord: Contact | null;
      leases: LeaseContract[];
      issues: UnitIssue[];
      communications: CommunicationLog[];
    }>(`/units/${id}/details`),
  createUnit: (data: Partial<PropertyUnit>) =>
    request<PropertyUnit>('/units', { method: 'POST', body: JSON.stringify(data) }),
  updateUnit: (id: number, data: Partial<PropertyUnit>) =>
    request<PropertyUnit>(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnit: (id: number) =>
    request<{ ok: boolean }>(`/units/${id}`, { method: 'DELETE' }),

  // Leases
  getLeases: () => request<LeaseContract[]>('/leases'),
  getLeaseStatement: (leaseId: number) =>
    request<LeaseStatementData>(`/leases/${leaseId}/statement`),
  createLease: (data: Partial<LeaseContract>) =>
    request<LeaseContract>('/leases', { method: 'POST', body: JSON.stringify(data) }),
  updateLease: (id: number, data: Partial<LeaseContract>) =>
    request<LeaseContract>(`/leases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateLeaseTerms: (
    id: number,
    data: {
      start_date: string;
      end_date: string;
      monthly_rent: number;
      has_rent_spread?: number;
      landlord_monthly_rent?: number;
      security_deposit: number;
      landlord_security_deposit?: number;
      agent_commission?: number;
      management_fee_percent?: number;
      payment_due_day?: number;
      status?: string;
    }
  ) =>
    request<LeaseContract>(`/leases/${id}/terms`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  earlyTerminateLease: (
    id: number,
    data: {
      early_termination_date: string;
      early_termination_note?: string;
      forfeit_deposit?: boolean;
    }
  ) =>
    request<LeaseContract>(`/leases/${id}/early-terminate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  restoreTerminatedLease: (id: number) =>
    request<LeaseContract>(`/leases/${id}/restore-terminated`, {
      method: 'POST',
    }),
  deleteLease: (id: number) =>
    request<{ ok: boolean }>(`/leases/${id}`, { method: 'DELETE' }),

  // Rental Payments & Statement of Account
  getPayments: (leaseId?: number) =>
    request<RentalPayment[]>(leaseId ? `/payments?lease_id=${leaseId}` : '/payments'),
  createPayment: (data: Partial<RentalPayment>) =>
    request<RentalPayment>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: number, data: Partial<RentalPayment>) =>
    request<RentalPayment>(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  quickUpdatePayment: (id: number, data: Partial<RentalPayment>) =>
    request<RentalPayment>(`/payments/${id}/quick-update`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePayment: (id: number) =>
    request<{ ok: boolean }>(`/payments/${id}`, { method: 'DELETE' }),

  // Issues
  getIssues: () => request<UnitIssue[]>('/issues'),
  createIssue: (data: Partial<UnitIssue>) =>
    request<UnitIssue>('/issues', { method: 'POST', body: JSON.stringify(data) }),
  updateIssue: (id: number, data: Partial<UnitIssue>) =>
    request<UnitIssue>(`/issues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIssue: (id: number) =>
    request<{ ok: boolean }>(`/issues/${id}`, { method: 'DELETE' }),

  // Communications
  getCommunications: () => request<CommunicationLog[]>('/communications'),
  createCommunication: (data: Partial<CommunicationLog>) =>
    request<CommunicationLog>('/communications', { method: 'POST', body: JSON.stringify(data) }),
  deleteCommunication: (id: number) =>
    request<{ ok: boolean }>(`/communications/${id}`, { method: 'DELETE' }),

  // Financial & Fee Settings
  getFinancialSettings: () => request<any>('/financial-settings'),
  saveFinancialSettings: (settings: any) =>
    request<{ ok: boolean; settings: any }>('/financial-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Admin User & Feature Permission Management (RBAC)
  getUsers: () => request<AppUser[]>('/users'),
  getRolesMatrix: () => request<RolesMatrixData>('/users/roles-matrix'),
  createUser: (data: Partial<AppUser>) =>
    request<AppUser>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: Partial<AppUser>) =>
    request<AppUser>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateUserPermissions: (id: number, permissions: FeaturePermissions) =>
    request<AppUser>(`/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  resetUserPermissions: (id: number) =>
    request<AppUser>(`/users/${id}/reset-permissions`, { method: 'POST' }),
  deleteUser: (id: number) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};
