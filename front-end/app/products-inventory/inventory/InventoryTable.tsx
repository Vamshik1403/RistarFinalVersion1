"use client";

import React, { useEffect, useState } from 'react';
import { Pencil, Search, Trash2, Filter, X, Plus } from "lucide-react";
import AddContainerForm from '../inventory/CreateInventoryForm';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={
      "inline-block px-4 py-1 rounded-full text-sm font-semibold shadow transition-all duration-300 hover:scale-105 " +
      (status === "Active"
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300")
    }
    style={{
      minWidth: 70,
      textAlign: "center",
      letterSpacing: 1,
      cursor: "default",
    }}
  >
    {status === "Active" ? "Active" : "Inactive"}
  </span>
);

const ProductsInventoryPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showTable, setShowTable] = useState(false);
  type AddressBookEntry = { id: number; companyName: string; [key: string]: any };
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    ownership: "",
    status: "",
    initialSurveyDate: ""
  });
  const [tempFilters, setTempFilters] = useState({
    ownership: "",
    status: "",
    initialSurveyDate: ""
  });
  const [inventoryPermissions, setInventoryPermissions] = useState<any>(null);
  const [containerEditStatus, setContainerEditStatus] = useState<{ [key: number]: { canEdit: boolean, reason: string | null, action: string | null, canDelete: boolean, deleteReason: string | null } }>({});

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`http://localhost:8000/permissions?userId=${userId}`)
        .then((res) => res.json())
        .then((data) => {
          const perm = data.find(
            (p: any) => p.module.toLowerCase() === "inventory"
          );
          setInventoryPermissions(perm);
        })
        .catch((err) => console.error("Failed to fetch permissions:", err));
    }
  }, []);


  const handleAddInventoryWithPermission = () => {
    if (inventoryPermissions?.canCreate) {
      setSelectedInventoryId(null);
      setShowModal(true);
    } else {
      alert("You don't have access to create inventory.");
    }
  };

  const checkContainerEditStatus = async (id: number) => {
    try {
      const editResponse = await axios.get(`http://localhost:8000/inventory/${id}/can-edit`);
      const deleteResponse = await axios.get(`http://localhost:8000/inventory/${id}/can-delete`);

      setContainerEditStatus(prev => ({
        ...prev,
        [id]: {
          canEdit: editResponse.data.canEdit,
          reason: editResponse.data.reason,
          action: editResponse.data.action,
          canDelete: deleteResponse.data.canDelete,
          deleteReason: deleteResponse.data.reason
        }
      }));
    } catch (error) {
      console.error('Error checking container edit status:', error);
    }
  };

  const handleEditInventoryWithPermission = async (id: number) => {
    if (!inventoryPermissions?.canEdit) {
      alert("You don't have access to edit inventory.");
      return;
    }

    try {
      const editResponse = await axios.get(`http://localhost:8000/inventory/${id}/can-edit`);
      if (!editResponse.data.canEdit) {
        alert(editResponse.data.reason || "Cannot edit this container.");
        return;
      }
      handleEditClick(id);
    } catch (error) {
      console.error('Error checking edit status:', error);
      alert("Error checking container status. Please try again.");
    }
  };

  const handleDeleteInventoryWithPermission = async (id: number) => {
    if (!inventoryPermissions?.canDelete) {
      alert("You don't have access to delete inventory.");
      return;
    }

    try {
      const deleteResponse = await axios.get(`http://localhost:8000/inventory/${id}/can-delete`);
      if (!deleteResponse.data.canDelete) {
        alert(deleteResponse.data.reason || "Cannot delete this container.");
        return;
      }
      handleDelete(id);
    } catch (error) {
      console.error('Error checking delete status:', error);
      alert("Error checking container status. Please try again.");
    }
  };

  const handleAddContainerClick = () => {
    setSelectedInventoryId(null);
    setShowModal(true);
    setShowTable(true);
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      const response = await axios.get('http://localhost:8000/inventory');
      setInventoryData(response.data);

      const editStatusPromises = response.data.map(async (item: any) => {
        try {
          const [editResponse, deleteResponse] = await Promise.all([
            axios.get(`http://localhost:8000/inventory/${item.id}/can-edit`),
            axios.get(`http://localhost:8000/inventory/${item.id}/can-delete`)
          ]);

          return {
            id: item.id,
            editStatus: {
              canEdit: editResponse.data.canEdit,
              reason: editResponse.data.reason,
              action: editResponse.data.action,
              canDelete: deleteResponse.data.canDelete,
              deleteReason: deleteResponse.data.reason
            }
          };
        } catch (error) {
          console.error(`Error checking status for container ${item.id}:`, error);
          return {
            id: item.id,
            editStatus: {
              canEdit: true,
              reason: null,
              action: null,
              canDelete: true,
              deleteReason: null
            }
          };
        }
      });

      setLoading(false);

      Promise.all(editStatusPromises).then(editResults => {
        const editStatusMap = editResults.reduce((acc, item) => {
          acc[item.id] = item.editStatus;
          return acc;
        }, {} as { [key: number]: { canEdit: boolean, reason: string | null, action: string | null, canDelete: boolean, deleteReason: string | null } });

        setContainerEditStatus(editStatusMap);
      });

    } catch (error) {
      console.error('Error fetching inventory data:', error);
      setLoading(false);
    }
  };

  const handleEditClick = (id: number): void => {
    setSelectedInventoryId(id);
    setShowModal(true);
  };

  const handleDelete = async (id: number): Promise<void> => {
    try {
      const deletionCheck = await axios.get(`http://localhost:8000/inventory/${id}/can-delete`);

      if (!deletionCheck.data.canDelete) {
        alert(deletionCheck.data.reason);
        return;
      }

      await axios.delete(`http://localhost:8000/inventory/${id}`);

      setInventoryData(inventoryData.filter((item) => item.id !== id));
      alert('Inventory deleted successfully');
    } catch (error: any) {
      console.error('Error deleting inventory:', error.response?.data || error);
      alert('Failed to delete inventory: ' + (error.response?.data?.message || error.message));
    }
  };

  useEffect(() => {
    fetch("http://128.199.19.28:8000/addressbook")
      .then((res) => res.json())
      .then((data) => setAddressBook(data))
      .catch((err) => console.error("Failed to fetch address book", err));
  }, []);

  const getCompanyName = (addressbookId: any) => {
    const entry = addressBook.find((ab) => ab.id === addressbookId);
    return entry ? entry.companyName : "Unknown";
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedInventoryId(null);
    fetchInventoryData();
  };

  const filteredData = inventoryData.filter((item) => {
    const matchesSearch = item.containerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.containerType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.containerClass.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOwnership = !filters.ownership ||
      (item.leasingInfo?.[0]?.ownershipType || item.ownershipType || "Own").toLowerCase() === filters.ownership.toLowerCase();

    const matchesStatus = !filters.status ||
      item.status.toLowerCase() === filters.status.toLowerCase();

    const matchesInitialSurveyDate = !filters.initialSurveyDate ||
      (item.InitialSurveyDate && item.InitialSurveyDate.startsWith(filters.initialSurveyDate));

    return matchesSearch && matchesOwnership && matchesStatus && matchesInitialSurveyDate;
  });

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setShowFilterModal(false);
  };

  const handleResetTempFilters = () => {
    setTempFilters({
      ownership: "",
      status: "",
      initialSurveyDate: ""
    });
  };

  const hasActiveFilters = filters.ownership || filters.status || filters.initialSurveyDate;

  // counts
  const totalCount = inventoryData.length;
  const filteredCount = filteredData.length;

  return (
    <div className="px-4 py-6 bg-white dark:bg-black min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center w-full max-w-sm">
            <Search size={18} className="absolute left-3 text-gray-400" />
            <Input
              placeholder="Search containers..."
              className="pl-10 bg-white dark:bg-neutral-900 border-neutral-800 text-black dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Button with Count */}
          <Button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-lg transition-colors border border-neutral-600 focus:border-blue-500 focus:outline-none ${
              hasActiveFilters
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-black dark:text-white'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filter
           
          </Button>
           <span className="flex items-center gap-2 px-4 py-2 cursor-pointer rounded-lg transition-colors border border-neutral-600 focus:border-blue-500 focus:outline-none">
              {hasActiveFilters ? filteredCount : totalCount}
            </span>
        </div>

        <Button
          className={`bg-blue-600 hover:bg-blue-700 text-white ${!inventoryPermissions?.canCreate ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={handleAddInventoryWithPermission}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Container
        </Button>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-neutral-400">Active filters:</span>
          {filters.ownership && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              Ownership: {filters.ownership}
              <button
                onClick={() => setFilters(prev => ({ ...prev, ownership: "" }))}
                className="ml-1 hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.status && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              Status: {filters.status}
              <button
                onClick={() => setFilters(prev => ({ ...prev, status: "" }))}
                className="ml-1 hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.initialSurveyDate && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              Survey Date: {filters.initialSurveyDate}
              <button
                onClick={() => setFilters(prev => ({ ...prev, initialSurveyDate: "" }))}
                className="ml-1 hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 overflow-x-auto">
        <Table>
          <TableHeader className="bg-white dark:bg-neutral-900">
            <TableRow>
              <TableHead className="text-black dark:text-neutral-200">Ownership</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Owner/Leaser</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Container No</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Category</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Type</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Class</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Capacity</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Next Inspection Due Date</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Off Hire Date</TableHead>
              <TableHead className="text-black dark:text-neutral-200 text-center">Status</TableHead>
              <TableHead className="text-black dark:text-neutral-200 text-right text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-4 text-neutral-400">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-4 text-neutral-400">
                  No inventory data found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id} className="border-b border-border bg-background text-foreground">
                  <TableCell className="bg-background text-foreground">
                    {/* First check if there are leasing records with ownershipType */}
                    {item.leasingInfo?.length > 0 && item.leasingInfo[0].ownershipType
                      ? (item.leasingInfo[0].ownershipType === "Leased" ? "Lease" : item.leasingInfo[0].ownershipType)
                      : /* If no leasing records or no ownershipType in leasing record, use the top-level ownershipType */
                      (item.ownershipType === "Leased" ? "Lease" : item.ownershipType ||
                        /* If there are leasing records but no ownershipType, default to "Lease" */
                        (item.leasingInfo?.length > 0 ? "Lease" : "Own"))}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    {item.leasingInfo?.[0]?.ownershipType === "Own"
                      ? "RISTAR"
                      : item.leasingInfo?.[0]
                        ? getCompanyName(item.leasingInfo[0].leasoraddressbookId)
                        : "N/A"}
                  </TableCell>


                  <TableCell className="bg-background text-foreground">{item.containerNumber}</TableCell>
                  <TableCell className="bg-background text-foreground">{item.containerCategory}</TableCell>
                  <TableCell className="bg-background text-foreground">{item.containerType}</TableCell>
                  <TableCell className="bg-background text-foreground">{item.containerClass}</TableCell>
                  <TableCell className="bg-background text-foreground">{item.containerCapacity}</TableCell>
                  <TableCell className="bg-background text-foreground">
                    {item.periodicTankCertificates?.[0]?.nextDueDate
                      ? new Date(item.periodicTankCertificates[0].nextDueDate).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    {item.leasingInfo?.[0]?.offHireDate
                      ? new Date(item.leasingInfo[0].offHireDate).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="bg-background text-foreground text-right">
                    <div className="flex gap-2 justify-end">
                     <Button
  variant="ghost"
  size="icon"
  className={`h-8 w-8 ${
    !inventoryPermissions?.canEdit || !containerEditStatus[item.id]?.canEdit
      ? "text-gray-400 opacity-50 cursor-pointer"
      : "text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 dark:hover:bg-blue-900/40"
  }`}
  onClick={() => handleEditInventoryWithPermission(item.id)}
>
  <Pencil size={16} />
</Button>

<Button
  variant="ghost"
  size="icon"
  className={`h-8 w-8 ${
    !inventoryPermissions?.canDelete || !containerEditStatus[item.id]?.canDelete
      ? "text-gray-400 opacity-50 cursor-pointer"
      : "text-red-400 hover:text-red-300 hover:bg-red-900/40 dark:hover:bg-red-900/40"
  }`}
  onClick={() => handleDeleteInventoryWithPermission(item.id)}
>
  <Trash2 size={16} />
</Button>

                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) handleCloseModal();
        setShowModal(open);
      }}>
        <DialogContent
          className="
      bg-neutral-900 border border-neutral-800
      max-h-[90vh] overflow-y-auto
      backdrop-blur-md
      "
          style={{
            // Narrower width to prevent horizontal scrolling
            width: "85vw",
            maxWidth: "950px"
          }}
        >
          <DialogTitle className="sr-only">
            {selectedInventoryId ? 'Edit Container' : 'Add Container'}
          </DialogTitle>
          {showModal && (
            <AddContainerForm
              onClose={handleCloseModal}
              inventoryId={selectedInventoryId || 0}
              editData={selectedInventoryId ? inventoryData.find(item => item.id === selectedInventoryId) : null}
              isEditMode={!!selectedInventoryId}
            />
          )}
        </DialogContent>
      </Dialog>

          

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-lg">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Filter Inventory</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFilterModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Ownership Filter */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-2">
                  Ownership Type
                </label>
                <select
                  value={tempFilters.ownership}
                  onChange={(e) => setTempFilters(prev => ({ ...prev, ownership: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Ownership Types</option>
                  <option value="Own">Own</option>
                                              <option value="Leased">Lease</option>
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-2">
                  Status
                </label>
                <select
                  value={tempFilters.status}
                  onChange={(e) => setTempFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              {/* Initial Survey Date Filter */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-2">
                  Initial Survey Date (Year)
                </label>
                <input
                  type="date"
                  placeholder="Select date"
                  value={tempFilters.initialSurveyDate}
                  onChange={(e) => setTempFilters(prev => ({ ...prev, initialSurveyDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-black-400 mt-1">
                  Filter by year (e.g., 2024) or specific date (YYYY-MM-DD)
                </p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="ghost"
                onClick={handleResetTempFilters}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Reset
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowFilterModal(false)}
                  className="bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  Cancel
                </Button>
                {/* <Button
                  onClick={handleClearFilters}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Clear All
                </Button> */}
                <Button
                  onClick={handleApplyFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ...existing table code... */}
    </div>
  );
};

export default ProductsInventoryPage;
