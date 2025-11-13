"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaEdit } from "react-icons/fa";
import { Filter, HistoryIcon } from 'lucide-react';
import MovementHistoryModal from "./MovementHistoryModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "../../lib/api";

// These components are no longer needed as we now use bulk caching approach
interface MovementRow {
  id: number;
  date: string;
  status: string;
  maintenanceStatus: string;
  remarks: string;
  jobNumber?: string;
  vesselName?: string;
  inventory?: { id?: number; containerNumber?: string };
  shipment?: { jobNumber?: string; vesselName?: string };
  emptyRepoJob?: { jobNumber?: string; vesselName?: string };
  port?: { id?: number; portName?: string };
  addressBook?: { id?: number; companyName?: string };
}

type Port = {
  id: number;
  portName: string;
};

type AddressBook = {
  id: number;
  companyName: string;
  businessType: string;
  portId: number;
};


const MovementHistoryTable = () => {
  const [data, setData] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [containerSearch, setContainerSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [availableStatusOptions, setAvailableStatusOptions] = useState<string[]>([]);
  const [jobNumberForUpdate, setJobNumberForUpdate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MovementRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilters, setTempFilters] = useState({ status: "", port: "", location: "" });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedContainerNumber, setSelectedContainerNumber] = useState<string | null>(null);
  const [availableLocations, setAvailableLocations] = useState<any[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [depots, setDepots] = useState<AddressBook[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<number | null>(null);
  const [selectedDepotId, setSelectedDepotId] = useState<number | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | null>(null);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [movementPermissions, setMovementPermissions] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [maintenanceStatus, setMaintenanceStatus] = useState<string | null>(null);

  // Cache for container location data to avoid multiple API calls
  const [containerLocationCache, setContainerLocationCache] = useState<{ [key: number]: { depotName: string, portName: string } }>({});
  // ✅ Latest location cache for EMPTY RETURNED
  const [latestReturnLocation, setLatestReturnLocation] = useState<{ [key: number]: { depotName: string; portName: string } }>({});


  const statusTransitions: Record<string, string[]> = {
    ALLOTTED: ["EMPTY PICKED UP"],

    "EMPTY PICKED UP": [], // handled dynamically
    "LADEN GATE-IN": ["SOB"],
    "EMPTY GATE-IN": ["SOB"],
    SOB: [],

    "LADEN DISCHARGE(ATA)": ["EMPTY RETURNED", "DAMAGED"],
    "EMPTY DISCHARGE": ["EMPTY RETURNED", "DAMAGED"],

    // RETURN / STORAGE
    "EMPTY RETURNED": ["AVAILABLE", "UNAVAILABLE"],
    AVAILABLE: ["UNAVAILABLE"],

    // UNAVAILABLE → sub-statuses
    UNAVAILABLE: ["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"],

    // Maintenance statuses can go to AVAILABLE or switch
    "UNDER CLEANING": ["AVAILABLE", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"],
    "UNDER SURVEY": ["AVAILABLE", "UNDER CLEANING", "UNDER REPAIR/UNDER TESTING"],
    "UNDER REPAIR/UNDER TESTING": ["AVAILABLE", "UNDER CLEANING", "UNDER SURVEY"],

    // Exceptions
    DAMAGED: ["RETURNED TO DEPOT"],
    CANCELLED: ["RETURNED TO DEPOT"],
    "RETURNED TO DEPOT": ["UNAVAILABLE", "AVAILABLE"],
  };


  const getAvailableStatusOptions = (currentStatus: string, currentNewStatus: string, currentMaintenance?: string) => {
    // EMPTY RETURNED -> UNAVAILABLE -> Maintenance
    if (currentStatus === "EMPTY RETURNED" && currentNewStatus === "UNAVAILABLE") {
      return ["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"];
    }

    // If UNAVAILABLE with a maintenance status attached
    if (currentStatus === "UNAVAILABLE" && currentMaintenance) {
      return [
        "AVAILABLE", // Complete maintenance
        ...["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].filter(
          (s) => s !== currentMaintenance // Don't show current maintenance status
        ),
      ];
    }

    // If directly in a maintenance status (UNDER CLEANING, UNDER SURVEY, etc.)
    if (["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].includes(currentStatus)) {
      return [
        "AVAILABLE", // Complete maintenance
        ...["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].filter(
          (s) => s !== currentStatus // Don't show current maintenance status
        ),
      ];
    }

    // Default transitions
    return statusTransitions[currentStatus] || [];
  };


  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`http://localhost:8000/permissions?userId=${userId}`)
        .then((res) => res.json())
        .then((data) => {
          const perms = data.find(
            (p: any) => p.module === "MovementHistory" // must match backend module name
          );
          setMovementPermissions(perms || {});
        })
        .catch((err) => console.error("Error fetching permissions:", err));
    }
  }, []);



  // Fetch ports on load
  useEffect(() => {
    axios.get("http://localhost:8000/ports").then((res) => {
      setPorts(res.data || []);
    });
  }, []);

  // Fetch depots when a port is selected
  useEffect(() => {
    if (selectedPortId !== null) {
      axios.get("http://localhost:8000/addressbook").then((res) => {
        const filtered = res.data.filter((entry: any) => {
          return (
            entry.businessType?.includes("Depot Terminal") &&
            entry.businessPorts.some((bp: any) => bp.portId === selectedPortId)
          );
        });

        setDepots(filtered);
      });
    }
  }, [selectedPortId]);

  useEffect(() => {
    if (newStatus === "SOB") {
      axios.get("http://localhost:8000/addressbook").then((res) => {
        const filteredCarriers = res.data.filter((entry: any) => {
          const types = entry.businessType?.split(",").map((t: string) => t.trim()) || [];
          return types.includes("Carrier");
        });
        setCarriers(filteredCarriers); // assume setCarriers is defined via useState
      });
    }
  }, [newStatus]);





  useEffect(() => {
    if (
      (newStatus === "DAMAGED" || newStatus === "CANCELLED" || newStatus === "RETURNED TO DEPOT") &&
      selectedIds.length > 0
    ) {
      const selectedRow = data.find((d) => selectedIds.includes(d.id));
      if (selectedRow) {
        setSelectedPortId(selectedRow.port?.id || null);
        setSelectedDepotId(selectedRow.addressBook?.id || null);
      }
    }
  }, [newStatus, selectedIds]);





  const openEditDateModal = (row: MovementRow) => {
    setEditingRow(row);
    setEditDate(row.date.slice(0, 10));
    setEditModalOpen(true);
  };

  const handleViewHistory = (containerNumber: string) => {
    setSelectedContainerNumber(containerNumber);
    setShowHistoryModal(true);
  };

  // Function to fetch container location data in bulk
  const fetchContainerLocationData = async (inventoryIds: number[]) => {
    const locationCache: { [key: number]: { depotName: string, portName: string } } = {};

    try {
      // Fetch inventory data for all unique inventory IDs in parallel
      const inventoryPromises = inventoryIds.map(async (inventoryId) => {
        if (inventoryId) {
          try {
            const inventoryResponse = await axios.get(`http://localhost:8000/inventory/${inventoryId}`);
            const inventory = inventoryResponse.data;
            const latestLeasingInfo = inventory.leasingInfo?.[0];

            let portName = "N/A";
            let depotName = "N/A";

            if (latestLeasingInfo) {
              // Fetch port name if portId exists
              if (latestLeasingInfo.portId) {
                try {
                  const portResponse = await axios.get(`http://localhost:8000/ports/${latestLeasingInfo.portId}`);
                  portName = portResponse.data.portName;
                } catch (portError) {
                  console.warn("Failed to fetch port name:", portError);
                }
              }

              // Fetch depot name if onHireDepotaddressbookId exists
              if (latestLeasingInfo.onHireDepotaddressbookId) {
                try {
                  const depotResponse = await axios.get(`http://localhost:8000/addressbook/${latestLeasingInfo.onHireDepotaddressbookId}`);
                  depotName = depotResponse.data.companyName;
                } catch (depotError) {
                  console.warn("Failed to fetch depot name:", depotError);
                }
              }
            }

            locationCache[inventoryId] = { depotName, portName };
          } catch (error) {
            console.error(`Failed to fetch location for inventory ${inventoryId}:`, error);
            locationCache[inventoryId] = { depotName: "N/A", portName: "N/A" };
          }
        }
      });

      await Promise.all(inventoryPromises);

      // ✅ merge only for inventories that don't already have a latestReturnLocation entry
      setContainerLocationCache(prevCache => {
        const merged: typeof prevCache = { ...prevCache };
        for (const [id, loc] of Object.entries(locationCache)) {
          const numericId = Number(id);
          if (!latestReturnLocation[numericId]) {
            merged[numericId] = loc;
          }
        }
        return merged;
      });

    } catch (error) {
      console.error("Error fetching container location data:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both in parallel for better performance
        const [movementRes, portsRes] = await Promise.all([
          axios.get("http://localhost:8000/movement-history/latest"),
          axios.get("http://localhost:8000/ports")
        ]);

        // Sort by date in descending order (latest first)
        const sortedData = movementRes.data.sort((a: any, b: any) => {
          const dateA = new Date(a.date || a.createdAt || 0);
          const dateB = new Date(b.date || b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });

        // 🔄 Refresh latestReturnLocation - Only update for EMPTY RETURNED status
     // 🔄 Refresh latestReturnLocation - Only update for EMPTY RETURNED status
const latestMap: { [key: number]: { depotName: string; portName: string } } = { ...latestReturnLocation };

(movementRes.data || []).forEach((row: any) => {
  const invId = row.inventory?.id;
  if (!invId) return;

  // ✅ Always use current record's port and addressBook if available
  if (row.port && row.addressBook) {
    latestMap[invId] = {
      depotName: row.addressBook?.companyName || "N/A",
      portName: row.port?.portName || "N/A",
    };
  }
});
setLatestReturnLocation(latestMap);




        // Set data and ports immediately to show the table
        setData(sortedData);
        setPorts(portsRes.data);

        // Extract unique inventory IDs and fetch location data in background
        const uniqueInventoryIds = [...new Set(sortedData
          .map((row: any) => row.inventory?.id)
          .filter((id: any) => id && typeof id === 'number')
        )] as number[];

        if (uniqueInventoryIds.length > 0) {
          // Fetch location data in background without blocking the table display
          fetchContainerLocationData(uniqueInventoryIds);
        }

      } catch (error) {
        console.error("Error fetching movement history data:", error);
        // Even if location fetch fails, show the table with fallback data
        setData([]);

      }
    };

    fetchData();
  }, []);

  const filteredData = data.filter((row) => {
    const containerMatch = row.inventory?.containerNumber?.toLowerCase().includes(containerSearch.toLowerCase());
    const jobMatch =
      row.shipment?.jobNumber?.toLowerCase().includes(jobSearch.toLowerCase()) ||
      row.emptyRepoJob?.jobNumber?.toLowerCase().includes(jobSearch.toLowerCase()) ||
      row.jobNumber?.toLowerCase().includes(jobSearch.toLowerCase());


    const statusMatch = !statusFilter || row.status === statusFilter;
    const portMatch = !portFilter || row.port?.portName === portFilter;
    const locationMatch = !locationFilter || row.addressBook?.companyName === locationFilter;
    return (!containerSearch || containerMatch) && (!jobSearch || jobMatch) && statusMatch && portMatch && locationMatch;
  });

  // Check if all filtered records have the same job number
  const getUniqueJobNumbers = () => {
    const jobNumbers = new Set<string>();
    filteredData.forEach(row => {
      const jobNumber = row.shipment?.jobNumber || row.emptyRepoJob?.jobNumber || row.jobNumber;
      if (jobNumber) jobNumbers.add(jobNumber);
    });
    return Array.from(jobNumbers);
  };

  const uniqueJobNumbers = getUniqueJobNumbers();
  const canSelectAll = uniqueJobNumbers.length === 1 && filteredData.length > 0;

  // Pagination logic
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to first page when search terms or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [containerSearch, jobSearch, statusFilter, portFilter, locationFilter]);

  // Calculate status counts for all data (not just filtered)
  // Calculate status counts for all data (not just filtered)
  const getStatusCounts = () => {
    const statusCounts: Record<string, number> = {};

    // Define all possible statuses including maintenance ones
    const allStatuses = [
      'ALLOTTED', 'EMPTY PICKED UP', 'LADEN GATE-IN', 'SOB',
      'LADEN DISCHARGE(ATA)', 'EMPTY RETURNED', 'AVAILABLE', 'UNAVAILABLE',
      'UNDER CLEANING', 'UNDER SURVEY', 'UNDER REPAIR/UNDER TESTING' // Add maintenance statuses
    ];

    // Initialize all statuses with 0
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });

    // Count actual occurrences
    data.forEach(row => {
      const status = row.status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return statusCounts;
  };

  const statusCounts = getStatusCounts();

  const handleSelectAll = () => {
    if (!canSelectAll) return;

    const jobNumber = uniqueJobNumbers[0];
    const recordsWithSameJob = filteredData.filter(row => {
      const rowJobNumber = row.shipment?.jobNumber || row.emptyRepoJob?.jobNumber || row.jobNumber;
      return rowJobNumber === jobNumber;
    });

    const recordIds = recordsWithSameJob.map(row => row.id);
    setSelectedIds(recordIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const toggleSelectRow = (row: MovementRow) => {
    const sameJob = data.find((d) => selectedIds.includes(d.id));
    const selectedJob = sameJob?.shipment?.jobNumber || sameJob?.emptyRepoJob?.jobNumber || sameJob?.jobNumber || "";
    const currentRowJob = row.shipment?.jobNumber || row.emptyRepoJob?.jobNumber || row.jobNumber;

    if (sameJob && selectedJob !== currentRowJob) {
      alert("Please select containers with the same Job Number (Shipping or Empty Repo).");
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
    );
  };

  const handleUpdateStatusClick = () => {
    const selectedRows = data.filter((row) => selectedIds.includes(row.id));
    const currentStatuses = [...new Set(selectedRows.map((r) => r.status))];

    if (currentStatuses.length !== 1) {
      alert("Selected containers must all have the same current status.");
      return;
    }

    const currentStatus = currentStatuses[0]?.toUpperCase();
    const currentMaintenance = selectedRows[0]?.maintenanceStatus;
    const jobNumber =
      selectedRows[0].shipment?.jobNumber ||
      selectedRows[0].emptyRepoJob?.jobNumber ||
      selectedRows[0].jobNumber ||
      "";

    // ✅ Special case: EMPTY PICKED UP
    if (currentStatus === "EMPTY PICKED UP") {
      if (selectedRows[0].shipment) {
        setAvailableStatusOptions(["LADEN GATE-IN", "DAMAGED", "CANCELLED"]);
      } else if (selectedRows[0].emptyRepoJob) {
        setAvailableStatusOptions(["EMPTY GATE-IN", "DAMAGED", "CANCELLED"]);
      } else {
        setAvailableStatusOptions(["DAMAGED", "CANCELLED"]);
      }
    }
    // ✅ Special case: SOB
    else if (currentStatus === "SOB") {
      if (selectedRows[0].shipment) {
        setAvailableStatusOptions(["LADEN DISCHARGE(ATA)", "DAMAGED"]);
      } else if (selectedRows[0].emptyRepoJob) {
        setAvailableStatusOptions(["EMPTY DISCHARGE", "DAMAGED"]);
      } else {
        setAvailableStatusOptions(["DAMAGED"]);
      }
    }
    // ✅ Use dynamic function for all other cases including maintenance
    else {
      const availableOptions = getAvailableStatusOptions(currentStatus, newStatus, currentMaintenance);
      setAvailableStatusOptions(availableOptions);
    }

    setNewStatus("");
    setJobNumberForUpdate(jobNumber);
    setRemarks("");
    setModalOpen(true);
  };

  // Fetch locations by port
  const fetchLocationsByPort = async (portId: number) => {
    try {
      const res = await axios.get(`http://localhost:8000/addressbook/locations-by-port/${portId}`);
      setAvailableLocations(res.data);
    } catch (error) {
      console.error("Error fetching locations by port:", error);
      setAvailableLocations([]);
    }
  };

  // Handle port filter change
  const handlePortFilterChange = (portName: string) => {
    setTempFilters(prev => ({ ...prev, port: portName, location: "" }));

    if (portName) {
      const selectedPort = ports.find(p => p.portName === portName);
      if (selectedPort) {
        fetchLocationsByPort(selectedPort.id);
      }
    } else {
      setAvailableLocations([]);
    }
  };

  const handleBulkUpdate = async () => {
    if (!newStatus) {
      alert("Please select a new status.");
      return;
    }

    // Validate maintenance status when moving from EMPTY RETURNED to UNAVAILABLE
    if (newStatus === "UNAVAILABLE") {
      const selectedRows = data.filter((row) => selectedIds.includes(row.id));
      const currentStatus = selectedRows[0]?.status;

      // If moving from EMPTY RETURNED to UNAVAILABLE, maintenance status is required
      if (currentStatus === "EMPTY RETURNED" && !maintenanceStatus) {
        alert("Please select a maintenance type when setting status to UNAVAILABLE.");
        return;
      }
    }

    if ((newStatus === "DAMAGED" || newStatus === "CANCELLED") && remarks.trim() === "") {
      alert("Remarks are required when status is DAMAGED or CANCELLED.");
      return;
    }

    try {
      const shipmentRes = await axios.get("http://localhost:8000/shipment");
      const shipment = shipmentRes.data.find((s: any) => s.jobNumber === jobNumberForUpdate);

      let emptyRepoJob = null;
      if (!shipment) {
        const emptyRepoRes = await axios.get("http://localhost:8000/empty-repo-job");
        emptyRepoJob = emptyRepoRes.data.find((e: any) => e.jobNumber === jobNumberForUpdate);
      }

      const source = shipment || emptyRepoJob;

      let portId: number | undefined;
      let addressBookId: number | null | undefined;

      const newStatusUpper = newStatus.toUpperCase();

      switch (newStatusUpper) {
        case "EMPTY PICKED UP":
          break;

        case "LADEN GATE-IN":
        case "EMPTY GATE-IN":
          portId = source?.polPortId;
          addressBookId = null;
          break;


        case "SOB":
          portId = source?.podPortId || source?.polPortId;
          addressBookId = selectedCarrierId || source?.carrierAddressBookId || null;
          break;

        case 'LADEN DISCHARGE(ATA)':
        case 'EMPTY DISCHARGE':
          if (emptyRepoJob) {
            portId = emptyRepoJob.podPortId ?? null;
            addressBookId = null;
          } else {
            portId = shipment?.podPortId ?? null;
            addressBookId = null;
          }
          break;


        case "EMPTY RETURNED":
          portId = source?.podPortId;
          addressBookId = source?.emptyReturnDepotAddressBookId;
          break;

        case "UNDER CLEANING":
        case "UNDER SURVEY":
        case "UNDER REPAIR/UNDER TESTING":
          {
            const prev = data.find((d) => selectedIds.includes(d.id));
            if (prev) {
              portId = prev.port?.id;
              addressBookId = prev.addressBook?.id ?? null;
            }
          }
          break;



        case "AVAILABLE":
        case "UNAVAILABLE":
          {
            const prev = data.find((d) => selectedIds.includes(d.id));
            if (prev) {
              portId = prev.port?.id;
              addressBookId = prev.addressBook?.id ?? null;
            }
          }
          break;

        case "DAMAGED":
        case "CANCELLED":
        case "RETURNED TO DEPOT":
          portId = selectedPortId !== null ? selectedPortId : undefined;
          addressBookId = selectedDepotId || null;
          break;

        default:
          alert("Invalid status transition.");
          return;
      }

      const payload: any = {
        ids: selectedIds,
        newStatus: newStatus.toUpperCase(),
        jobNumber: jobNumberForUpdate,
        date: movementDate,
        remarks: remarks.trim(),
        portId: selectedPortId || null,
        addressBookIdFromClient: selectedDepotId || null,
        vesselName: newStatus === "SOB" ? vesselName : null,
      };

      // Handle maintenance status logic
      if (newStatus === "UNAVAILABLE" && maintenanceStatus) {
        // When setting UNAVAILABLE with maintenance
        payload.maintenanceStatus = maintenanceStatus;
      } else if (newStatus === "AVAILABLE") {
        // When completing maintenance, clear maintenance status
        payload.maintenanceStatus = null;
      } else if (["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].includes(newStatus)) {
        // When switching between maintenance types
        payload.maintenanceStatus = newStatus;
      }

      // add maintenanceStatus if set
      if (maintenanceStatus) {
        payload.maintenanceStatus = maintenanceStatus;
      }


      if (portId !== undefined) payload.portId = portId;
      if (addressBookId !== undefined) payload.addressBookId = addressBookId;
      console.log("Payload being sent:", payload);

      await apiFetch('http://localhost:8000/movement-history/bulk-update', {
        method: 'POST',
        body: payload,   // 👈 plain object, no JSON.stringify
      });

      alert("Status updated.");
      setSelectedIds([]);
      setModalOpen(false);
      setSelectedCarrierId(null);
      setVesselName("");

      const res = await axios.get("http://localhost:8000/movement-history/latest");
      setData(res.data);

      // 🔄 Refresh latestReturnLocation
      const latestMap: { [key: number]: { depotName: string; portName: string } } = {};
      (res.data || []).forEach((row: any) => {
        if (row.status === "AVAILABLE" && row.port && row.addressBook) {
          latestMap[row.inventoryId] = {
            depotName: row.addressBook?.companyName || "N/A",
            portName: row.port?.portName || "N/A",
          };
        }
      });
      setLatestReturnLocation(latestMap);

    } catch (err: any) {
      console.error("Update failed:", err?.response || err?.message || err);
      alert("Update failed. Check console for details.");
    }
  };


  const handleDateUpdate = async () => {
    if (!editingRow) return;

    try {
      await apiFetch(`http://localhost:8000/movement-history/${editingRow.id}`, {
        method: 'PATCH',
        body: { date: editDate },   // 👈 pass plain object
      });


      alert("Date updated successfully.");
      setEditModalOpen(false);
      setEditingRow(null);

      const res = await axios.get("http://localhost:8000/movement-history/latest");
      setData(res.data);
    } catch (err: any) {
      console.error("Date update failed:", err);
      alert("Failed to update date.");
    }
  };

  useEffect(() => {
    if (
      (newStatus === "EMPTY RETURNED" || newStatus === "RETURNED TO DEPOT") &&
      selectedIds.length > 0
    ) {
      const selectedRow = data.find((d) => selectedIds.includes(d.id));
      if (!selectedRow) return;

      const portId = selectedRow.port?.id || null;
      setSelectedPortId(portId);

      if (portId) {
        axios.get("http://localhost:8000/addressbook").then((res) => {
          const filtered = res.data.filter((entry: any) => {
            return (
              entry.businessType?.includes("Depot Terminal") &&
              entry.businessPorts?.some((bp: any) => bp.portId === portId)
            );
          });
          setDepots(filtered);
        });
      }

      // ✅ Only set depot once (don’t override user changes)
      if (!selectedDepotId) {
        setSelectedDepotId(selectedRow.addressBook?.id || null);
      }
    }
  }, [newStatus, selectedIds]);


  // Helper function to format ISO date to DD/MM/YY
const formatDateToDDMMYY = (isoDate: string) => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
};

  return (
    <div className="p-6 my-0 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white min-h-screen mb-6">


      {/* Status Count Display - Moved higher up to marked space */}
      <div className="mb-4">
        {/* Status Cards with Total Records at the start */}
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
          {/* Total Records Card - First position */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-400 to-blue-500 
                         text-white rounded-md shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105">
            <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
            <span className="text-[10px] font-medium">Total:</span>
            <span className="text-xs font-bold">{data.length}</span>
          </div>

          {/* Status Cards - Much smaller height, wider width */}
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-md p-0.5 shadow-sm hover:shadow-md 
                          transition-all duration-300 transform hover:scale-105 cursor-pointer
                          bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-800/20 dark:to-blue-700/20 
                          border border-blue-200 dark:border-blue-600 hover:from-blue-100 hover:to-blue-200"
            >
              <div className="text-center">
                <div className="text-[10px] font-bold mb-0.5 text-blue-600 dark:text-blue-400">
                  {count}
                </div>
                <div className="text-[7px] font-medium uppercase tracking-wide leading-tight text-blue-500 dark:text-blue-300">
                  {status.replace(/\s+/g, '\n')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Input
          type="text"
          placeholder="Search Container No."
          value={containerSearch}
          onChange={(e) => setContainerSearch(e.target.value)}
          className="flex-1 min-w-[220px] border-neutral-200 dark:border-neutral-700 outline-neutral-900 dark:outline-neutral-700"
        />
        <Input
          type="text"
          placeholder="Search Shipping Job No."
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          className="flex-1 min-w-[220px] border-neutral-200 dark:border-neutral-700 outline-neutral-900 dark:outline-neutral-700"
        />
        <Button
          onClick={() => {
            setTempFilters({ status: statusFilter, port: portFilter, location: locationFilter });
            if (portFilter) {
              const selectedPort = ports.find(p => p.portName === portFilter);
              if (selectedPort) {
                fetchLocationsByPort(selectedPort.id);
              }
            }
            setShowFilterModal(true);
          }}
          variant="outline"
          className="flex items-center gap-2 cursor-pointer"
        >
          <Filter className="h-4 w-4" />
          Filter
        </Button>
        <Button
          onClick={() => {
            if (movementPermissions?.canCreate) {
              handleUpdateStatusClick(); // ✅ keep your existing function
            } else {
              alert("You don't have access to update status.");
            }
          }}
          disabled={
            selectedIds.length === 0 || !movementPermissions?.canCreate
          }
          className={`${selectedIds.length > 0 && movementPermissions?.canCreate
            ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl cursor-pointer"
            : "bg-gray-400 text-gray-200 cursor-not-allowed opacity-50"
            }`}
        >
          Update Status{" "}
          {selectedIds.length > 0 && `(${selectedIds.length})`}
        </Button>

      </div>


      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-20">
                    {canSelectAll ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                          <Button
                            onClick={handleSelectAll}
                            disabled={selectedIds.length === filteredData.length && filteredData.length > 0}
                            size="sm"
                            variant="outline"
                            className="text-xs h-6 px-2 bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Select All"
                          >
                            Select All
                          </Button>
                          <Button
                            onClick={handleDeselectAll}
                            disabled={selectedIds.length === 0}
                            size="sm"
                            variant="outline"
                            className="text-xs h-6 px-2 bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Deselect All"
                          >
                            Clear
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedIds.length > 0 ? `${selectedIds.length}/${filteredData.length} selected` : `${filteredData.length} items`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select</span>
                    )}
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Container No</TableHead>
                  <TableHead>Job No.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-center">History</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                        <span className="font-medium">Loading movement history and container locations...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-600 dark:text-gray-400">
                      No movement history data found
                    </TableCell>
                  </TableRow>
                ) : paginatedData.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`hover:bg-muted/50 transition-colors ${selectedIds.includes(row.id) ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                      }`}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={() => toggleSelectRow(row)}
                        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 border-gray-400 dark:border-gray-600"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(row.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit"
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{row.inventory?.containerNumber || "-"}</TableCell>
                    <TableCell>
                      {row.status?.toUpperCase() !== "AVAILABLE"
                        ? row.shipment?.jobNumber || row.emptyRepoJob?.jobNumber || row.jobNumber
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold border ${row.status === 'ALLOTTED'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
                          : row.status === 'AVAILABLE'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
                            : row.status === 'EMPTY PICKED UP'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700'
                              : row.status === 'LADEN GATE-IN'
                                ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700'
                                : row.status === 'SOB'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700'
                                  : row.status === 'LADEN DISCHARGE(ATA)'
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-700'
                                    : row.status === 'EMPTY RETURNED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700'
                                      : row.status === 'UNAVAILABLE'
                                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
                                        // ADD MAINTENANCE STATUSES HERE:
                                        : row.status === 'UNDER CLEANING'
                                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700'
                                          : row.status === 'UNDER SURVEY'
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700'
                                            : row.status === 'UNDER REPAIR/UNDER TESTING'
                                              ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700'
                                              : row.status === 'DAMAGED'
                                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
                                                : row.status === 'CANCELLED'
                                                  ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
                                                  : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
                          }`}
                      >
                        {row.status === "UNAVAILABLE" && row.maintenanceStatus
                          ? `${row.status} (${row.maintenanceStatus})`
                          : row.status}
                      </span>
                    </TableCell>
             <TableCell>
  {(() => {
    // Always show current movement record's port first
    if (row.port?.portName) {
      return row.port.portName;
    }
    
    // Only fall back to cache if no current port
    const containerId = row.inventory?.id || 0;
    if (latestReturnLocation[containerId]?.portName) {
      return latestReturnLocation[containerId].portName;
    }
    
    if (containerLocationCache[containerId]?.portName) {
      return containerLocationCache[containerId].portName;
    }
    
    return "-";
  })()}
</TableCell>

                  <TableCell>
  {(() => {
    // For GATE-IN and DISCHARGE statuses, show only port (hide depot)
    if (
      row.status?.toUpperCase() === "EMPTY GATE-IN" || 
      row.status?.toUpperCase() === "EMPTY DISCHARGE" ||
      row.status?.toUpperCase() === "LADEN GATE-IN" ||
      row.status?.toUpperCase() === "LADEN DISCHARGE(ATA)"
    ) {
      return "-";
    }
    
    // For SOB status, show carrier + vessel name
    if (row.status?.toUpperCase() === "SOB") {
      return row.addressBook?.companyName && row.vesselName 
        ? `${row.addressBook.companyName} - ${row.vesselName}`
        : row.addressBook?.companyName || row.vesselName || "-";
    }
    
    // For ALL other statuses, show current movement record's addressBook first
    if (row.addressBook?.companyName) {
      return row.addressBook.companyName;
    }
    
    // Only fall back to cache if no current addressBook
    const containerId = row.inventory?.id || 0;
    if (latestReturnLocation[containerId]?.depotName) {
      return latestReturnLocation[containerId].depotName;
    }
    
    if (containerLocationCache[containerId]?.depotName) {
      return containerLocationCache[containerId].depotName;
    }
    
    return "-";
  })()}
</TableCell>




                    <TableCell className="max-w-xs truncate">{row.remarks}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        onClick={() => handleViewHistory(row.inventory?.containerNumber || "")}
                        variant="ghost"
                        size="sm"
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                        title="View History"
                      >
                        <HistoryIcon size={16} />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        onClick={() => {
                          if (movementPermissions?.canEdit) {
                            openEditDateModal(row); // ✅ your existing edit modal logic
                          } else {
                            alert("You don't have access to edit.");
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className={`${movementPermissions?.canEdit
                          ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 cursor-pointer"
                          : "text-gray-400 cursor-not-allowed opacity-50"
                          }`}
                        title="Edit Date"
                        disabled={!movementPermissions?.canEdit}
                      >
                        <FaEdit />
                      </Button>

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="bg-white dark:bg-neutral-900 border-neutral-800 text-black dark:text-white cursor-pointer"
            >
              Previous
            </Button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={
                      currentPage === pageNum
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-neutral-900 border-neutral-800 text-black dark:text-white cursor-pointer"
                    }
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="bg-white dark:bg-neutral-900 border-neutral-800 text-black dark:text-white cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-lg">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Bulk Update Container Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Status Dropdown */}
              {/* New Status Dropdown */}
              {/* New Status Dropdown */}
              {(() => {
                const selectedRows = data.filter((row) => selectedIds.includes(row.id));
                const currentStatus = selectedRows.length > 0 ? selectedRows[0].status : "";
                const currentMaintenance = selectedRows[0]?.maintenanceStatus;

                return (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Status
                    </label>

                    {/* Main Status Dropdown */}
                    <select
                      value={newStatus}
                      onChange={(e) => {
                        setNewStatus(e.target.value);
                        if (e.target.value !== "UNAVAILABLE") {
                          setMaintenanceStatus(null); // reset maintenance if not unavailable
                        }
                      }}
                      className="w-full px-3 py-2 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select New Status</option>

                      {/* Show available status options */}
                      {availableStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {/* Second dropdown: Maintenance Status (only if UNAVAILABLE chosen from EMPTY RETURNED) */}
                    {newStatus === "UNAVAILABLE" && currentStatus === "EMPTY RETURNED" && (
                      <div className="space-y-2 mt-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Maintenance Status
                        </label>
                        <select
                          value={maintenanceStatus || ""}
                          onChange={(e) => setMaintenanceStatus(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="">Select Maintenance Type</option>
                          {["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Helper text */}
                    {currentStatus === "EMPTY RETURNED" && !newStatus && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Choose AVAILABLE if container is ready, or UNAVAILABLE for maintenance
                      </p>
                    )}

                    {currentStatus === "EMPTY RETURNED" && newStatus === "UNAVAILABLE" && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Select the specific maintenance type for this container
                      </p>
                    )}

                    {["UNDER CLEANING", "UNDER SURVEY", "UNDER REPAIR/UNDER TESTING"].includes(currentStatus) && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Choose AVAILABLE to complete maintenance, or switch to another maintenance type
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Show if EMPTY RETURNED or RETURNED TO DEPOT */}
              {(newStatus === "EMPTY RETURNED" || newStatus === "RETURNED TO DEPOT") && (
                <div className="space-y-4">
                  {/* Depot Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Depot
                    </label>
                    <select
                      value={selectedDepotId || ""}
                      onChange={(e) => {
                        const depotId = parseInt(e.target.value);
                        setSelectedDepotId(depotId);

                        // ✅ Find depot details and log or handle update
                        const selectedDepot = depots.find((d) => d.id === depotId);
                        if (selectedDepot) {
                          console.log("Depot selected:", selectedDepot.companyName);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                      disabled={!selectedPortId || depots.length === 0}
                    >
                      <option value="">Select Depot</option>
                      {depots.map((depot) => (
                        <option key={depot.id} value={depot.id}>
                          {depot.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {newStatus === "SOB" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Carrier Name</label>
                    <select
                      value={selectedCarrierId || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedCarrierId(value ? parseInt(value) : null);
                      }}
                      className="w-full px-3 py-2 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Select Carrier</option>
                      {carriers.map((carrier) => (
                        <option key={carrier.id} value={carrier.id}>
                          {carrier.companyName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vessel Name</label>
                    <Input
                      type="text"
                      value={vesselName}
                      onChange={(e) => setVesselName(e.target.value)}
                      placeholder="Enter vessel name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Date (DD/MM/YY)
  </label>
  <Input
    type="text"
    value={movementDate ? formatDateToDDMMYY(movementDate) : ""}
    onChange={(e) => {
      const value = e.target.value;
      // Allow only numbers and slashes
      const cleaned = value.replace(/[^\d/]/g, '');
      
      // Auto-format as user types
      let formatted = cleaned;
      if (cleaned.length > 2 && cleaned.length <= 4) {
        formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
      } else if (cleaned.length > 4) {
        formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 6);
      }
      
      // Update state with ISO format for storage
      if (formatted.length === 8) { // DD/MM/YY
        const [day, month, year] = formatted.split('/');
        const fullYear = `20${year}`; // Assuming 20xx
        const isoDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        setMovementDate(isoDate);
      } else {
        setMovementDate(formatted);
      }
    }}
    placeholder="DD/MM/YY"
    className="w-full"
  />
</div>



              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Remarks {["DAMAGED", "CANCELLED"].includes(newStatus) && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  rows={3}
                  placeholder="Enter remarks"
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button
                onClick={() => setModalOpen(false)}
                variant="outline"
                className="border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpdate}
                className="bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
              >
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Date Modal */}
      {editModalOpen && editingRow && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-lg">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Edit Movement Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Container Number</label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-md border border-gray-200 dark:border-neutral-600 font-medium">
                  {editingRow.inventory?.containerNumber || "-"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-md border border-gray-200 dark:border-neutral-600">
                  <span
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold border ${editingRow.status === 'ALLOTTED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
                      : editingRow.status === 'AVAILABLE'
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
                        : editingRow.status === 'EMPTY PICKED UP'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700'
                          : editingRow.status === 'LADEN GATE-IN'
                            ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700'
                            : editingRow.status === 'SOB'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700'
                              : editingRow.status === 'LADEN DISCHARGE(ATA)'
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-700'
                                : editingRow.status === 'EMPTY RETURNED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700'
                                  : editingRow.status === 'UNAVAILABLE'
                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
                                    // ADD MAINTENANCE STATUSES HERE:
                                    : editingRow.status === 'UNDER CLEANING'
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700'
                                      : editingRow.status === 'UNDER SURVEY'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700'
                                        : editingRow.status === 'UNDER REPAIR/UNDER TESTING'
                                          ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700'
                                          : editingRow.status === 'DAMAGED'
                                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
                                            : editingRow.status === 'CANCELLED'
                                              ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
                                              : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
                      }`}
                  >
                    {editingRow.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button
                onClick={() => setEditModalOpen(false)}
                variant="outline"
                className="border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDateUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-gray-300 dark:border-neutral-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Filter Movements</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-neutral-300 mb-2">Status</label>
                <select
                  value={tempFilters.status}
                  onChange={e => setTempFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Status</option>
                  {[...new Set(data.map(row => row.status))].filter(Boolean).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-neutral-300 mb-2">Port</label>
                <select
                  value={tempFilters.port}
                  onChange={e => handlePortFilterChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All Ports</option>
                  {ports.map(port => (
                    <option key={port.id} value={port.portName}>{port.portName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-neutral-300 mb-2">Location</label>
                <select
                  value={tempFilters.location}
                  onChange={e => setTempFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                  disabled={!tempFilters.port}
                >
                  <option value="">{tempFilters.port ? "All Locations" : "Select a port first"}</option>
                  {availableLocations.map(loc => (
                    <option key={loc.id} value={loc.companyName}>{loc.companyName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setTempFilters({ status: "", port: "", location: "" });
                  setStatusFilter("");
                  setPortFilter("");
                  setLocationFilter("");
                  setAvailableLocations([]);
                  setShowFilterModal(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md cursor-pointer"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setStatusFilter(tempFilters.status);
                  setPortFilter(tempFilters.port);
                  setLocationFilter(tempFilters.location);
                  setShowFilterModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedContainerNumber && (
        <MovementHistoryModal
          containerNumber={selectedContainerNumber}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};

export default MovementHistoryTable;