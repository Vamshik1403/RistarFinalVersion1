'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import AddUserModal from './AddUserModal';

const modulesList = [
  "AddressBook",
  "Ports",
  "Countries",
  "Currency",
  "ExchangeRates",
  "Inventory",
  "Products",
  "ContainerLeaseTarrif",
  "HandlingAgentTariffCost",
  "LandTransportCost",
  "DepotAvgTarriffCost",
  "DepotCleaningCost",
  "Shipments",
  "EmptyRepoJobs",
  "Quotation",
  "MovementHistory",
  "BillManagement",
  "DataImport"
];

export default function UsersPermissionsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false); // ✅ State for modal
  const [editUser, setEditUser] = useState<any>(null);

  // Fetch users
  useEffect(() => {
    fetch("http://localhost:8000/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Error fetching users:", err));
  }, []);

  const fetchUsers = () => {
    fetch("http://localhost:8000/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Error fetching users:", err));
  };

  // Fetch permissions for selected user
  const openPermissionsModal = (user: any) => {
    setSelectedUser(user);
    setLoadingPermissions(true);
    fetch(`http://localhost:8000/permissions?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        const perms = modulesList.map((module) => {
          const existing = data.find((p: any) => p.module === module);
          return {
            module,
            canRead: existing?.canRead || false,
            canCreate: existing?.canCreate || false,
            canEdit: existing?.canEdit || false,
            canDelete: existing?.canDelete || false
          };
        });
        setPermissions(perms);
        setLoadingPermissions(false);
      })
      .catch(err => {
        console.error("Error fetching permissions:", err);
        setLoadingPermissions(false);
      });
  };

  const togglePermission = (index: number, key: string) => {
    setPermissions(prev =>
      prev.map((perm, i) =>
        i === index ? { ...perm, [key]: !perm[key as keyof typeof perm] } : perm
      )
    );
  };

  const savePermissions = async () => {
    try {
      for (const perm of permissions) {
        await fetch("http://localhost:8000/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUser.id, ...perm }),
        });
      }
      alert("Permissions saved successfully");
      setSelectedUser(null);
    } catch (error) {
      console.error("Error saving permissions:", error);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">User Permissions</h1>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white"
          onClick={() => setShowAddModal(true)} // ✅ Open modal
        >
          + Add User
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full border border-gray-300 dark:border-neutral-700 text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-neutral-800">
                <th className="p-2 border">Username</th>
                <th className="p-2 border">Full Name</th>
                <th className="p-2 border">Department</th>
                <th className="p-2 border text-center">Edit</th>
                <th className="p-2 border text-center">Manage Permissions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <td className="p-2 border">{u.username}</td>
                  <td className="p-2 border">{u.firstName} {u.lastName}</td>
                  <td className="p-2 border">{u.departmentName}</td>
                  <td className="p-2 border text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditUser(u);
                        setShowAddModal(true);
                      }}
                    >
                      ✏️
                    </Button>
                  </td>
                  <td className="p-2 border text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openPermissionsModal(u)}
                    >
                      <Settings size={18} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      </div>

      {/* Permissions Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-full max-w-[750px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-bold mb-4">
              Manage Permissions for {selectedUser.username}
            </h2>

            {loadingPermissions ? (
              <p>Loading permissions...</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full border border-gray-300 dark:border-neutral-700 text-sm">
                    <thead className="bg-gray-100 dark:bg-neutral-800">
                      <tr>
                        <th className="p-2 border text-left">Module</th>
                        <th className="p-2 border text-center">All</th>
                        <th className="p-2 border text-center">Read</th>
                        <th className="p-2 border text-center">Create</th>
                        <th className="p-2 border text-center">Edit</th>
                        <th className="p-2 border text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((perm, idx) => {
                        const allSelected = perm.canRead && perm.canCreate && perm.canEdit && perm.canDelete;
                        return (
                          <tr key={perm.module} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                            <td className="p-2 border font-medium">{perm.module}</td>
                            <td className="p-2 border text-center">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => {
                                  const newValue = e.target.checked;
                                  setPermissions((prev) =>
                                    prev.map((p, i) =>
                                      i === idx
                                        ? {
                                          ...p,
                                          canRead: newValue,
                                          canCreate: newValue,
                                          canEdit: newValue,
                                          canDelete: newValue
                                        }
                                        : p
                                    )
                                  );
                                }}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            </td>
                            {["canRead", "canCreate", "canEdit", "canDelete"].map((key) => (
                              <td key={key} className="p-2 border text-center">
                                <input
                                  type="checkbox"
                                  checked={perm[key as keyof typeof perm]}
                                  onChange={() => togglePermission(idx, key)}
                                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={savePermissions}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditUser(null); // reset after closing
        }}
        onUserAdded={fetchUsers}
        editUser={editUser} // ✅ pass selected user
      />

    </div>
  );
}
