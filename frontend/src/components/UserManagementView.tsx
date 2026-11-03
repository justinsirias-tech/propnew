import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit3,
  Sliders,
  Eye,
  FileText,
  Building2,
  Calculator,
  Wrench,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  Info,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { AppUser, FeaturePermissions, RoleMeta, RolesMatrixData } from '../types';

interface UserManagementViewProps {
  currentUser?: AppUser | null;
  onSwitchSimulatedUser?: (user: AppUser) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  onSwitchSimulatedUser,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [rolesMatrix, setRolesMatrix] = useState<RolesMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Permission Editing Modal State
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<AppUser | null>(null);
  const [tempPermissions, setTempPermissions] = useState<FeaturePermissions>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSuccessToast, setPermissionSuccessToast] = useState(false);

  // User Profile Create/Edit Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProfileUser, setEditingProfileUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    role: 'Senior Leasing Agent',
    department: 'Leasing & Sales',
    phone: '',
    status: 'Active',
    avatar_url: '',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, matrixData] = await Promise.all([
        api.getUsers(),
        api.getRolesMatrix(),
      ]);
      setUsers(usersData);
      setRolesMatrix(matrixData);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setErrorMessage(err.message || 'Failed to load user management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        search === '' ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.department.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openEditPermissions = (u: AppUser) => {
    setEditingPermissionsUser(u);
    setTempPermissions(JSON.parse(JSON.stringify(u.permissions || {})));
    setPermissionSuccessToast(false);
  };

  const handleTogglePermission = (module: string, feature: string) => {
    setTempPermissions((prev) => {
      const next = { ...prev };
      if (!next[module]) {
        next[module] = {};
      }
      next[module] = {
        ...next[module],
        [feature]: !next[module][feature],
      };
      return next;
    });
  };

  const handleApplyRoleTemplate = (roleName: string) => {
    if (!rolesMatrix || !rolesMatrix.default_permissions[roleName]) return;
    setTempPermissions(
      JSON.parse(JSON.stringify(rolesMatrix.default_permissions[roleName]))
    );
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsUser) return;
    setSavingPermissions(true);
    try {
      const updated = await api.updateUserPermissions(
        editingPermissionsUser.id,
        tempPermissions
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setEditingPermissionsUser(updated);
      setPermissionSuccessToast(true);
      setTimeout(() => setPermissionSuccessToast(false), 3000);
    } catch (err: any) {
      alert(`Error updating permissions: ${err.message}`);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetToRoleDefault = async (user: AppUser) => {
    if (
      !confirm(
        `Reset permissions for ${user.full_name} back to default template for role '${user.role}'?`
      )
    )
      return;
    try {
      const updated = await api.resetUserPermissions(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      if (editingPermissionsUser?.id === user.id) {
        setEditingPermissionsUser(updated);
        setTempPermissions(updated.permissions || {});
      }
    } catch (err: any) {
      alert(`Failed to reset permissions: ${err.message}`);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    const nextStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    try {
      const updated = await api.updateUser(user.id, { status: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
    } catch (err: any) {
      alert(`Failed to change status: ${err.message}`);
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (
      !confirm(
        `Are you sure you want to delete user account "${user.full_name}" (${user.email})?`
      )
    )
      return;
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (editingPermissionsUser?.id === user.id) {
        setEditingPermissionsUser(null);
      }
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const openCreateUserModal = () => {
    setEditingProfileUser(null);
    setUserForm({
      full_name: '',
      email: '',
      role: 'Senior Leasing Agent',
      department: 'Leasing & Sales',
      phone: '',
      status: 'Active',
      avatar_url: '',
    });
    setShowUserModal(true);
  };

  const openEditProfileModal = (user: AppUser) => {
    setEditingProfileUser(user);
    setUserForm({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone || '',
      status: user.status,
      avatar_url: user.avatar_url || '',
    });
    setShowUserModal(true);
  };

  const handleSaveUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editingProfileUser) {
        const updated = await api.updateUser(editingProfileUser.id, userForm);
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u))
        );
      } else {
        const created = await api.createUser(userForm);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (err: any) {
      alert(`Error saving user: ${err.message}`);
    } finally {
      setSavingUser(false);
    }
  };

  // Helper to count active permissions
  const countActivePermissions = (perms: FeaturePermissions) => {
    let total = 0;
    Object.keys(perms || {}).forEach((mod) => {
      Object.keys(perms[mod] || {}).forEach((f) => {
        if (perms[mod][f]) total++;
      });
    });
    return total;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Admin Role & Feature Access Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Administrative RBAC Engine
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                {users.length} Active System Users
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              User & Feature Access Permission Management
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Configure fine-grained role-based access control (RBAC). Super Admins can manage internal team credentials, assign operational department roles, and dictate precisely which CRM features each user can view, edit, calculate, or delete.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={openCreateUserModal}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg transition shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4.5 h-4.5" />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Impersonation / Test-Drive Switcher */}
        {currentUser && onSwitchSimulatedUser && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Currently active profile:{' '}
                <strong className="text-white font-bold">{currentUser.full_name}</strong>{' '}
                ({currentUser.role})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Preview CRM view as:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const targetId = Number(e.target.value);
                  const found = users.find((u) => u.id === targetId);
                  if (found) onSwitchSimulatedUser(found);
                }}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.role} ({u.department})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 6 Role Cards Quick Overview */}
      {rolesMatrix && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Standard Staff Role Architecture (6 Presets)
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click template button inside user modal to auto-apply
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {rolesMatrix.roles.map((r) => {
              const count = users.filter((u) => u.role === r.name).length;
              return (
                <div
                  key={r.name}
                  className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          r.color === 'indigo'
                            ? 'bg-indigo-100 text-indigo-800'
                            : r.color === 'sky'
                            ? 'bg-sky-100 text-sky-800'
                            : r.color === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.color === 'amber'
                            ? 'bg-amber-100 text-amber-800'
                            : r.color === 'purple'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.badge}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {count} {count === 1 ? 'user' : 'users'}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm mt-2">
                      {r.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {r.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-600">
                    Dept: {r.department}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Directory Filters & Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Strip */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name, email, department..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Branch Manager">Branch Manager</option>
              <option value="Senior Leasing Agent">Senior Leasing Agent</option>
              <option value="Junior Agent">Junior Agent</option>
              <option value="Property Inspector">Property Inspector</option>
              <option value="Accountant">Accountant</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            Showing <strong className="text-slate-900">{filteredUsers.length}</strong> of{' '}
            {users.length} users
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-extrabold text-[11px] tracking-wider">
                <th className="py-4 px-5">Staff Member</th>
                <th className="py-4 px-4">Role & Department</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Feature Rights</th>
                <th className="py-4 px-4">Confidential Spread</th>
                <th className="py-4 px-4">Last Activity</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.map((u) => {
                const activePermCount = countActivePermissions(u.permissions);
                const hasConfidentialSpread =
                  Boolean(u.permissions?.leases?.view_confidential_spread);
                const hasDeleteRights =
                  Boolean(
                    u.permissions?.units?.delete ||
                    u.permissions?.crm?.delete ||
                    u.permissions?.leases?.delete
                  );

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 transition group"
                  >
                    {/* User Info */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            u.avatar_url ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${u.full_name}`
                          }
                          alt={u.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{u.full_name}</span>
                            {u.role === 'Super Admin' && (
                              <span title="Super Administrator">
                                <ShieldCheck className="w-4 h-4 text-indigo-600 inline" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {u.email}
                          </div>
                          {u.phone && (
                            <div className="text-[11px] text-slate-400">
                              {u.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role & Dept */}
                    <td className="py-4 px-4">
                      <div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-black ${
                            u.role === 'Super Admin'
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                              : u.role === 'Branch Manager'
                              ? 'bg-sky-100 text-sky-900 border border-sky-200'
                              : u.role === 'Senior Leasing Agent'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : u.role === 'Junior Agent'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : u.role === 'Property Inspector'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {u.role}
                        </span>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          {u.department}
                        </div>
                      </div>
                    </td>

                    {/* Status Pill with Toggle */}
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        title="Click to toggle Active / Suspended status"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer ${
                          u.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        {u.status === 'Active' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Suspended</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Feature Rights summary */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                            {activePermCount} grants
                          </span>
                          {hasDeleteRights && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                              Can Delete
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.permissions?.financial_settings?.edit ? (
                            <span className="text-indigo-600 font-bold">Tax & Fee Admin</span>
                          ) : (
                            <span>Standard Operational</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Confidential Dual-Rate Spread Badge */}
                    <td className="py-4 px-4">
                      {hasConfidentialSpread ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-black">
                          <Lock className="w-3 h-3 text-indigo-600" />
                          Visible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium">
                          <Eye className="w-3 h-3 text-slate-400" />
                          Hidden
                        </span>
                      )}
                    </td>

                    {/* Last Activity */}
                    <td className="py-4 px-4 text-xs text-slate-500 font-medium">
                      {u.last_login || 'Never'}
                    </td>

                    {/* Action buttons */}
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditPermissions(u)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition"
                          title="Manage Feature Permissions"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Permissions</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditProfileModal(u)}
                          className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                          title="Edit Profile"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No staff members match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GRANULAR FEATURE PERMISSION MATRIX MODAL                                  */}
      {/* ========================================================================= */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={
                    editingPermissionsUser.avatar_url ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${editingPermissionsUser.full_name}`
                  }
                  alt={editingPermissionsUser.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-400/40 bg-slate-800"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">
                      Feature Access Matrix: {editingPermissionsUser.full_name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-mono font-bold">
                      {editingPermissionsUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Toggle individual feature permissions for {editingPermissionsUser.email} ({editingPermissionsUser.department}).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingPermissionsUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Role Template Bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Apply Preset Role Template:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Super Admin',
                    'Branch Manager',
                    'Senior Leasing Agent',
                    'Junior Agent',
                    'Property Inspector',
                    'Accountant',
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleApplyRoleTemplate(r)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold transition shadow-2xs"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleResetToRoleDefault(editingPermissionsUser)}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Default
              </button>
            </div>

            {/* Feature Modules Matrix (Scrollable Body) */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {permissionSuccessToast && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-extrabold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Permissions successfully updated and synchronized for {editingPermissionsUser.full_name}!</span>
                </div>
              )}

              {/* 1. Executive Dashboard */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Executive Dashboard Module
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        KPI metrics cards, occupancy percentages, and recent activity logs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.dashboard?.view)}
                      onChange={() => handleTogglePermission('dashboard', 'view')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">View Dashboard</div>
                      <div className="text-[10px] text-slate-500">Access dashboard overview</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.dashboard?.view_financials)}
                      onChange={() => handleTogglePermission('dashboard', 'view_financials')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">View Financial Volume</div>
                      <div className="text-[10px] text-slate-500">See total rent roll ฿ volume</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.dashboard?.export_data)}
                      onChange={() => handleTogglePermission('dashboard', 'export_data')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">Export Dashboard Data</div>
                      <div className="text-[10px] text-slate-500">Download reports & metrics</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Units & Listings Inventory */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Property Listings & Unit Inventory
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Condominiums, Gated Homes, Shophouses, and Warehouses database.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.units?.view)}
                      onChange={() => handleTogglePermission('units', 'view')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">View Inventory</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.units?.create)}
                      onChange={() => handleTogglePermission('units', 'create')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Add Listings</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.units?.edit)}
                      onChange={() => handleTogglePermission('units', 'edit')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Edit Details</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.units?.view_pricing)}
                      onChange={() => handleTogglePermission('units', 'view_pricing')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">View Pricing / CAM</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50 cursor-pointer text-rose-900">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.units?.delete)}
                      onChange={() => handleTogglePermission('units', 'delete')}
                      className="rounded text-rose-600 w-4 h-4"
                    />
                    <div className="font-bold">Delete Units</div>
                  </label>
                </div>
              </div>

              {/* 3. 360° CRM Directory */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        360° CRM Directory (Landlords, Tenants, Vendors & Developers)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Client profiles, bank account credentials, passports, and communication logs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.crm?.view)}
                      onChange={() => handleTogglePermission('crm', 'view')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">View Directory</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.crm?.create)}
                      onChange={() => handleTogglePermission('crm', 'create')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Create Contacts</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.crm?.edit)}
                      onChange={() => handleTogglePermission('crm', 'edit')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Edit Profiles & Banks</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50 cursor-pointer text-rose-900">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.crm?.delete)}
                      onChange={() => handleTogglePermission('crm', 'delete')}
                      className="rounded text-rose-600 w-4 h-4"
                    />
                    <div className="font-bold">Delete Contacts</div>
                  </label>
                </div>
              </div>

              {/* 4. Lease Contracts & Statements of Account (Confidential Spread) */}
              <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                      4
                    </div>
                    <div>
                      <h4 className="font-extrabold text-indigo-950 text-sm flex items-center gap-1.5">
                        Lease Contracts, Financial Statements & Confidential Spread
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 font-black">
                          CRITICAL
                        </span>
                      </h4>
                      <p className="text-[11px] text-indigo-800">
                        Tenancy agreements, dual-rate spread difference, rental collection ledger, and Statements of Account.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.view)}
                      onChange={() => handleTogglePermission('leases', 'view')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">View Leases</div>
                      <div className="text-[10px] text-slate-500">Access contracts list</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.create)}
                      onChange={() => handleTogglePermission('leases', 'create')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">Create Lease Contracts</div>
                      <div className="text-[10px] text-slate-500">Register new tenancy</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-indigo-400 bg-indigo-100/60 hover:bg-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.view_confidential_spread)}
                      onChange={() => handleTogglePermission('leases', 'view_confidential_spread')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-black text-indigo-950 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-indigo-700" />
                        Confidential Dual-Rate Spread
                      </div>
                      <div className="text-[10px] text-indigo-800 font-semibold">
                        Reveal agency profit spread difference
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.view_statements)}
                      onChange={() => handleTogglePermission('leases', 'view_statements')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">View Statements of Account</div>
                      <div className="text-[10px] text-slate-500">Agency, Landlord & Tenant SOAs</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.mark_paid)}
                      onChange={() => handleTogglePermission('leases', 'mark_paid')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-bold text-slate-900">Mark Rent Paid & Upload Slips</div>
                      <div className="text-[10px] text-slate-500">Toggle monthly settlement status</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-300 bg-rose-50/60 hover:bg-rose-100/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.leases?.terminate_lease)}
                      onChange={() => handleTogglePermission('leases', 'terminate_lease')}
                      className="rounded text-rose-600 w-4 h-4"
                    />
                    <div>
                      <div className="font-black text-rose-950">Early Termination & Forfeit</div>
                      <div className="text-[10px] text-rose-800 font-semibold">Execute Clause 5 deposit forfeit</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 5. Defect Issues Tracker */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      5
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Unit Issues, Maintenance & Developer Warranty Tracker
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Field defects, photo inspections, and developer defect claim routing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.issues?.view)}
                      onChange={() => handleTogglePermission('issues', 'view')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">View Issues</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.issues?.create)}
                      onChange={() => handleTogglePermission('issues', 'create')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Log New Tickets</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.issues?.resolve)}
                      onChange={() => handleTogglePermission('issues', 'resolve')}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <div className="font-bold text-slate-900">Resolve & Close Claims</div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50 cursor-pointer text-rose-900">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.issues?.delete)}
                      onChange={() => handleTogglePermission('issues', 'delete')}
                      className="rounded text-rose-600 w-4 h-4"
                    />
                    <div className="font-bold">Delete Tickets</div>
                  </label>
                </div>
              </div>

              {/* 6, 7 & 8: Financial Settings, Calculator & Admin RBAC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    Transaction Calculator
                  </h4>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.calculator?.view)}
                      onChange={() => handleTogglePermission('calculator', 'view')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-slate-800">Use Tax & Comm Calc</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.calculator?.export_reports)}
                      onChange={() => handleTogglePermission('calculator', 'export_reports')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-slate-800">Export & Print Reports</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Financial & Fee Settings
                  </h4>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.financial_settings?.view)}
                      onChange={() => handleTogglePermission('financial_settings', 'view')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-slate-800">View Rates & CAM</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.financial_settings?.edit)}
                      onChange={() => handleTogglePermission('financial_settings', 'edit')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-indigo-900 font-extrabold">Edit Tax & Fee Rates</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 space-y-2.5">
                  <h4 className="font-extrabold text-indigo-950 text-sm flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    User & Access Management
                  </h4>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.user_management?.view)}
                      onChange={() => handleTogglePermission('user_management', 'view')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-slate-800">View Staff Directory</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tempPermissions.user_management?.edit)}
                      onChange={() => handleTogglePermission('user_management', 'edit')}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-bold text-indigo-900 font-extrabold">Edit Staff Permissions</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                {countActivePermissions(tempPermissions)} total privileges enabled
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingPermissionsUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingPermissions}
                  onClick={handleSavePermissions}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingPermissions ? 'Saving...' : 'Save & Enforce Permissions'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT USER PROFILE MODAL                                             */}
      {/* ========================================================================= */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingProfileUser ? 'Edit User Profile' : 'Add New Staff Member'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingProfileUser
                    ? `Update credentials and department for ${editingProfileUser.full_name}`
                    : 'Create a new team account with predefined role permissions'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserForm} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="e.g. Alex Wong"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Email Address (Login ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="alex.wong@proppulse.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Staff Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Senior Leasing Agent">Senior Leasing Agent</option>
                    <option value="Junior Agent">Junior Agent</option>
                    <option value="Property Inspector">Property Inspector</option>
                    <option value="Accountant">Accountant</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    placeholder="Leasing & Sales"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    placeholder="+66 82 445 1102"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Account Status
                  </label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={userForm.avatar_url}
                  onChange={(e) => setUserForm({ ...userForm, avatar_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {savingUser ? 'Saving...' : editingProfileUser ? 'Update Staff Profile' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
