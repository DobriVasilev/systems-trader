"use client";

import { useState, useEffect } from "react";
import { Shield, Users, Mail, Calendar, Activity } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
  emailVerified: Date | null;
  _count: {
    feedback: number;
    sessions: number;
  };
}

const ROLE_INFO: Record<string, { label: string; color: string; description: string }> = {
  admin: {
    label: "Admin",
    color: "bg-red-600 text-white",
    description: "Full access, bypasses all restrictions",
  },
  dev_team: {
    label: "Dev Team",
    color: "bg-purple-600 text-white",
    description: "Autonomous Claude workflow, dev features",
  },
  moderator: {
    label: "Moderator",
    color: "bg-blue-600 text-white",
    description: "Can manage content and users",
  },
  member: {
    label: "Member",
    color: "bg-gray-600 text-white",
    description: "Standard user access",
  },
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error || "Failed to load users");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert(data.error || "Failed to update role");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const adminCount = users.filter(u => u.role === "admin").length;
  const devTeamCount = users.filter(u => u.role === "dev_team").length;
  const modCount = users.filter(u => u.role === "moderator").length;
  const memberCount = users.filter(u => u.role === "member").length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Admins</span>
            </div>
            <div className="text-3xl font-bold text-white">{adminCount}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Dev Team</span>
            </div>
            <div className="text-3xl font-bold text-white">{devTeamCount}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Moderators</span>
            </div>
            <div className="text-3xl font-bold text-white">{modCount}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Members</span>
            </div>
            <div className="text-3xl font-bold text-white">{memberCount}</div>
          </div>
        </div>

        {/* Role Descriptions */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ROLE_INFO).map(([role, info]) => (
              <div key={role} className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${info.color}`}>
                  {info.label}
                </span>
                <span className="text-sm text-gray-400">{info.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User List */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || "User"}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-white">{user.name || "No name"}</div>
                          <div className="text-sm text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={updatingUserId === user.id}
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          ROLE_INFO[user.role]?.color || "bg-gray-600 text-white"
                        } ${updatingUserId === user.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                      >
                        {Object.entries(ROLE_INFO).map(([role, info]) => (
                          <option key={role} value={role}>
                            {info.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          <span>{user._count.feedback} feedback</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{user._count.sessions} sessions</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {updatingUserId === user.id && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Count */}
        <div className="text-sm text-gray-400 text-center">
          {users.length} total users
        </div>
      </div>
    </div>
  );
}
