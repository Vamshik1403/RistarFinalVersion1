"use client";
import React, { useState, useEffect } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import AddContainerLeaseForm from "./AddContainerLeaseForm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ContainerLeaseTariff {
  id: number;
  tariffCode: string;
  containerCategory: string;
  containerType: string;
  containerClass: string;
  leaseRentPerDay: number;
  currencyName: string;
  status: boolean;
}

const StatusBadge = ({ status }: { status: boolean }) => (
  <span
    className={cn(
      "inline-block px-4 py-1 rounded-full text-sm font-semibold shadow transition-all duration-300 hover:scale-105",
      status
        ? "bg-green-900/80 text-green-300"
        : "bg-red-900/80 text-red-300"
    )}
    style={{
      minWidth: 70,
      textAlign: "center",
      letterSpacing: 1,
    }}
  >
    {status ? "Active" : "Inactive"}
  </span>
);

const ContainerLeaseTariffPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [tariffs, setTariffs] = useState<ContainerLeaseTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTariff, setEditingTariff] = useState<ContainerLeaseTariff | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [containerLeasePermissions, setContainerLeasePermissions] = useState<any>(null);

useEffect(() => {
  const userId = localStorage.getItem("userId");
  if (userId) {
    fetch(`http://localhost:8000/permissions?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        const perm = data.find(
          (p: any) => p.module.toLowerCase() === "containerleasetarrif"
        );
        setContainerLeasePermissions(perm);
      })
      .catch((err) => console.error("Failed to fetch permissions:", err));
  }
}, []);

const handleAddContainerLeaseWithPermission = () => {
  if (containerLeasePermissions?.canCreate) {
    setEditingTariff(null);
    setShowModal(true);
  } else {
    alert("You don't have access to create container lease tariffs.");
  }
};

const handleEditContainerLeaseWithPermission = (id: number) => {
  if (containerLeasePermissions?.canEdit) {
    handleEditClick(id);
  } else {
    alert("You don't have access to edit container lease tariffs.");
  }
};

const handleDeleteContainerLeaseWithPermission = (id: number) => {
  if (containerLeasePermissions?.canDelete) {
    handleDelete(id);
  } else {
    alert("You don't have access to delete container lease tariffs.");
  }
};



  useEffect(() => {
    const fetchTariffs = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/container-lease-tariff"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch tariffs");
        }
        const data = await response.json();
        // Ensure status is boolean
        setTariffs(
          data.map((item: any) => ({
            ...item,
            status:
              typeof item.status === "boolean"
                ? item.status
                : item.status === true ||
                  item.status === "true" ||
                  item.status === 1
          }))
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch tariffs"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTariffs();
  }, [showModal]);

  function handleDelete(id: number): void {
    if (window.confirm("Are you sure you want to delete this tariff?")) {
      fetch(`http://localhost:8000/container-lease-tariff/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to delete tariff");
          }
          setTariffs((prevTariffs) =>
            prevTariffs.filter((tariff) => tariff.id !== id)
          );
        })
        .catch((error) => {
          setError(
            error instanceof Error ? error.message : "Failed to delete tariff"
          );
        });
    }
  }

  function handleEditClick(id: number): void {
    const tariffToEdit = tariffs.find(t => t.id === id);
    if (tariffToEdit) {
      setEditingTariff(tariffToEdit);
      setShowModal(true);
    }
  }

  // Filtered tariffs based on searchTerm
  const filteredTariffs = tariffs.filter((tariff) => {
    const term = searchTerm.toLowerCase();
    return (
      tariff.tariffCode?.toLowerCase().includes(term) ||
      tariff.containerCategory?.toLowerCase().includes(term) ||
      tariff.containerType?.toLowerCase().includes(term) ||
      tariff.containerClass?.toLowerCase().includes(term) ||
      tariff.currencyName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="px-4 pt-4 pb-4 dark:bg-black">
      <div className="flex items-center justify-between mt-0 mb-4">
        <div className="relative w-full mr-4">
          <input
            type="text"
            placeholder="Search tariffs..."
            className="p-2 pl-10 rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white placeholder-neutral-400 border border-neutral-800 focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
        </div>
        <Button
  className={cn(
    "bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 px-6 shadow rounded-md whitespace-nowrap cursor-pointer",
    !containerLeasePermissions?.canCreate && "opacity-50 cursor-not-allowed"
  )}
  onClick={handleAddContainerLeaseWithPermission}
>

          <Plus className="mr-2 h-4 w-4" />
          Add Tariff
        </Button>
        {showModal && (
          <AddContainerLeaseForm
            onClose={() => {
              setShowModal(false);
              setEditingTariff(null);
            }}
            onSave={(data) => {
              if (editingTariff) {
                setTariffs(prevTariffs =>
                  prevTariffs.map(t =>
                    t.id === editingTariff.id ? { ...t, ...data } : t
                  )
                );
              } else {
                setTariffs(prevTariffs => [...prevTariffs, data]);
              }
              setShowModal(false);
              setEditingTariff(null);
            }}
            editData={editingTariff}
          />
        )}
      </div>

      <div className="rounded-lg shadow border border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto mt-4">
        <Table>
          <TableHeader className="bg-white dark:bg-neutral-900">
            <TableRow>
              <TableHead className="text-black dark:text-neutral-200">Tariff Code</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Container Category</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Type</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Class</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Lease Rent/Day</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Currency</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Status</TableHead>
              <TableHead className="text-center text-black dark:text-neutral-200">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-neutral-400 bg-white dark:bg-neutral-900">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-red-400 py-8 bg-white dark:bg-neutral-900">
                  {error}
                </TableCell>
              </TableRow>
            ) : filteredTariffs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-neutral-400 bg-white dark:bg-neutral-900">
                  No tariffs found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTariffs.map((tariff, idx) => (
                <TableRow
                  key={tariff.id}
                  className={cn(
                    "border-b border-neutral-800 text-black dark:text-white",
                    idx % 2 === 1 ? "bg-gray-50 dark:bg-neutral-800" : "bg-white dark:bg-neutral-900"
                  )}
                >
                  <TableCell>{tariff.tariffCode}</TableCell>
                  <TableCell>{tariff.containerCategory}</TableCell>
                  <TableCell>{tariff.containerType}</TableCell>
                  <TableCell>{tariff.containerClass}</TableCell>
                  <TableCell>{tariff.leaseRentPerDay}</TableCell>
                  <TableCell>{tariff.currencyName}</TableCell>
                  <TableCell>
                    <StatusBadge status={tariff.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
  variant="ghost"
  size="icon"
  title="Edit"
  onClick={() => handleEditContainerLeaseWithPermission(tariff.id)}
  className={cn(
    "h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 dark:hover:bg-blue-900/40",
    !containerLeasePermissions?.canEdit && "opacity-50 cursor-not-allowed"
  )}
>
                      <Pencil size={18} />
                    </Button>
                    <Button
  variant="ghost"
  size="icon"
  title="Delete"
  onClick={() => handleDeleteContainerLeaseWithPermission(tariff.id)}
  className={cn(
    "h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/40 dark:hover:bg-red-900/40",
    !containerLeasePermissions?.canDelete && "opacity-50 cursor-not-allowed"
  )}
>

                      <Trash2 size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ContainerLeaseTariffPage;
