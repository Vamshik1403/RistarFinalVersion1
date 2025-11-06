"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, AlertTriangle } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import dayjs from "dayjs";
import { Calendar } from "lucide-react";


// Component to display latest container location data
// Component to display latest container location data (movement-history FIRST)
const ContainerLocationDisplay = ({
  inventoryId,
  emptyRepoJobId,
  fallbackDepotName,
  fallbackPortName,
}: {
  inventoryId: number | null;
  emptyRepoJobId?: number | null;
  fallbackDepotName?: string;
  fallbackPortName?: string;
}) => {
  const [locationData, setLocationData] = useState<{ depotName: string; portName: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      if (!inventoryId) {
        setLoading(false);
        return;
      }

      try {
        let depotName = "N/A";
        let portName = "N/A";

        // ✅ 1. If editing/viewing an existing Empty Repo Job
        if (emptyRepoJobId) {
          const res = await axios.get(
            `http://localhost:8000/movement-history/by-empty-repo-job/${emptyRepoJobId}`
          );
          const records = res.data || [];

          // Find ALLOTTED movement for this inventory
          const match = records.find(
            (m: any) => m.inventoryId === inventoryId && m.status === "ALLOTTED"
          );

          if (match) {
            depotName = match.addressBook?.companyName || fallbackDepotName || "N/A";
            portName = match.port?.portName || fallbackPortName || "N/A";
            setLocationData({ depotName, portName });
            setLoading(false);
            return;
          }
        }

        // ✅ 2. Fallback to live /movement-history/latest
        const latestRes = await axios.get("http://localhost:8000/movement-history/latest");
        const latest = Array.isArray(latestRes.data) ? latestRes.data : [];
        const found = latest.find((m: any) => m.inventoryId === inventoryId);

        if (found && found.port && found.addressBook) {
          depotName = found.addressBook.companyName || "N/A";
          portName = found.port.portName || "N/A";
        } else {
          depotName = fallbackDepotName || "N/A";
          portName = fallbackPortName || "N/A";
        }

        setLocationData({ depotName, portName });
      } catch (err) {
        console.error("Error fetching container location:", err);
        setLocationData({
          depotName: fallbackDepotName || "N/A",
          portName: fallbackPortName || "N/A",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [inventoryId, emptyRepoJobId, fallbackDepotName, fallbackPortName]);

  if (loading) return <span className="text-gray-400">Loading...</span>;
  return <span>{locationData ? `${locationData.depotName} - ${locationData.portName}` : "N/A"}</span>;
};

type ContainerItem = {
  containerNumber: string;
  capacity: string;
  tare: string;
  inventoryId: number | null;
  portId: number | null;
  port: { portName: string } | null;
  depotName: string;
  inventory?: {
    containerNumber: string;
    capacity: string;
    capacityUnit: string;
    tare: string;
  };
};

const AddShipmentModal = ({
  onClose,
  formTitle,
  form,
  setForm,
  selectedContainers,
  setSelectedContainers,
  refreshShipments,
}: any) => {
  const [carrierSuggestions, setCarrierSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [portSuggestions, setPortSuggestions] = useState<any[]>([]);
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [showDischargeDropdown, setShowDischargeDropdown] = useState(false);
  const [transhipmentPortSuggestions, setTranshipmentPortSuggestions] =
    useState<any[]>([]);
  const [showTranshipmentDropdown, setShowTranshipmentDropdown] =
    useState(false);
  const [impHandlingAgents, setImpHandlingAgents] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [expAgents, setExpAgents] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [emptyReturnDepots, setEmptyReturnDepots] = useState<
    { id: number; companyName: string; businessType?: string }[]
  >([]);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [modalSelectedContainers, setModalSelectedContainers] = useState<any[]>(
    []
  );
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [selectedOnHireDepot, setSelectedOnHireDepot] = useState<string>("");
  const [countries, setCountries] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [onHireDepots, setOnHireDepots] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [portSuggestionsForModal, setPortSuggestionsForModal] = useState<any[]>([]);
  const [containerSearchText, setContainerSearchText] = useState<string>("");
  const filteredContainers = React.useMemo(() => {
    const terms = containerSearchText
      .split(/[\s,\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (terms.length === 0) return containers;
    return containers.filter((c: any) => {
      const num = (c.inventory?.containerNumber || "").toLowerCase();
      return terms.some((t) => num.includes(t));
    });
  }, [containerSearchText, containers]);

  // Add validation error state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showValidationAlert, setShowValidationAlert] = useState(false);



  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const res = await axios.get("http://localhost:8000/movement-history");

        // Group by containerNumber inside inventory
        const grouped: { [key: string]: any[] } = {};
        for (const m of res.data) {
          const containerNo = m.inventory?.containerNumber;
          if (!containerNo) continue;

          if (!grouped[containerNo]) grouped[containerNo] = [];
          grouped[containerNo].push(m);
        }

        // Get latest entry per container, filter AVAILABLE ones
        const latestAvailableOnly = Object.values(grouped)
          .map(
            (group: any[]) =>
              group.sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )[0]
          )
          .filter((m) => m.status === "AVAILABLE");

        setAllMovements(latestAvailableOnly);
      } catch (err) {
        console.error("Failed to fetch movements", err);
      }
    };

    fetchMovements();
  }, []);

 const handleModalContainerSearch = async (value: string) => {
  setContainerSearchText(value);

  if (!value || value.trim().length < 2) {
    // If no search text, show all available containers for selected port
    if (!selectedPort) {
      setContainers([]);
      return;
    }
    
    // Load all available containers for the selected port
    try {
      const movementRes = await axios.get("http://localhost:8000/movement-history/latest");
      const allLatest = Array.isArray(movementRes.data) ? movementRes.data : [];
      
      const portContainers = allLatest.filter(
        (m) => m.status === "AVAILABLE" && m.port?.id?.toString() === selectedPort
      );
      
      setContainers(portContainers);
    } catch (err) {
      console.error("Error loading port containers:", err);
      setContainers([]);
    }
    return;
  }

  try {
    // 1️⃣ Fetch latest movement-history (true live availability)
    const res = await axios.get("http://localhost:8000/movement-history/latest");
    const allLatest = Array.isArray(res.data) ? res.data : [];

    // 2️⃣ Filter AVAILABLE containers that match search AND are at selected port
    const results = allLatest.filter(
      (m) =>
        m.inventory?.containerNumber?.toLowerCase().includes(value.toLowerCase()) &&
        m.status === "AVAILABLE" &&
        (!selectedPort || m.port?.id?.toString() === selectedPort) // Only filter by port if one is selected
    );

    // 3️⃣ If not found in movement-history, fall back to /inventory
    if (results.length === 0) {
      const invRes = await axios.get("http://localhost:8000/inventory");
      const invMatches = (invRes.data || []).filter((inv: any) =>
        inv.containerNumber?.toLowerCase().includes(value.toLowerCase())
      );
      
      const formatted = invMatches.map((inv: any) => ({
        id: inv.id,
        inventory: inv,
        status: "AVAILABLE",
        port: selectedPort ? { id: parseInt(selectedPort), portName: "Unknown Port" } : null,
        addressBook: { companyName: "New Container (No Movement)" },
      }));
      setContainers(formatted);
    } else {
      setContainers(results);
    }
  } catch (err) {
    console.error("Modal container search error:", err);
    setContainers([]);
  }
};


const handleContainerSearch = async (value: string) => {
  setForm({ ...form, containerNumber: value });

  // Check if quantity is valid before search
  const currentQuantity = parseInt(form.quantity);
  if (!form.quantity || isNaN(currentQuantity) || currentQuantity <= 0) {
    setSuggestions([]);
    return;
  }

  if (value.length < 2) {
    setSuggestions([]);
    return;
  }

  try {
    // Split multiple container numbers if typed
    const searchTerms = value
      .split(/[\s,\n]+/)
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);

    // STEP 1 — Fetch latest movement data
    const movementRes = await axios.get("http://localhost:8000/movement-history/latest");
    const movements = Array.isArray(movementRes.data) ? movementRes.data : [];

    // Filter containers that are AVAILABLE and match search terms
    let availableMatches = movements.filter((m) => {
      if (!m.inventory?.containerNumber) return false;
      
      const num = m.inventory.containerNumber.toLowerCase();
      const matchesSearch = searchTerms.some((t) => num.includes(t));
      const isAvailable = m.status === "AVAILABLE";
      
      // If portOfLoadingId is selected, filter by port, otherwise show all available
      const matchesPort = form.portOfLoadingId 
        ? m.port?.id?.toString() === form.portOfLoadingId?.toString()
        : true;

      return matchesSearch && isAvailable && matchesPort;
    });

    // STEP 2 — If no result found in movement-history/latest, check /inventory
    if (availableMatches.length === 0) {
      const invRes = await axios.get("http://localhost:8000/inventory");
      const allInventory = Array.isArray(invRes.data) ? invRes.data : [];

      // Take containers that match search term but have no movement record
      const freshMatches = allInventory.filter((inv: any) => {
        const num = inv.containerNumber?.toLowerCase() || "";
        const hasMovement = movements.some((m) => m.inventoryId === inv.id);
        const matchesSearch = searchTerms.some((t) => num.includes(t));
        
        return matchesSearch && !hasMovement;
      });

      // Map /inventory results to same structure for display
      availableMatches = freshMatches.map((inv: any) => ({
        id: inv.id,
        inventory: inv,
        status: "AVAILABLE",
        port: { id: form.portOfLoadingId, portName: form.portOfLoading },
        addressBook: { companyName: "New Container (No Movement)" },
      }));
    }

    // STEP 3 — Sort by createdAt (FIFO) and update UI
    const sorted = availableMatches.sort(
      (a, b) =>
        new Date(a.inventory?.createdAt || 0).getTime() -
        new Date(b.inventory?.createdAt || 0).getTime()
    );

    setSuggestions(sorted);
  } catch (err) {
    console.error("Error searching containers:", err);
    setSuggestions([]);
  }
};

  const handleSuggestionSelect = (item: any) => {
    const containerNo = item.inventory?.containerNumber;
    if (
      selectedContainers.some(
        (c: ContainerItem) => c.containerNumber === containerNo
      )
    )
      return;

    // Check quantity limit before adding container
    const currentQuantity = parseInt(form.quantity);
    if (!form.quantity || isNaN(currentQuantity) || currentQuantity <= 0) {
      alert("Please enter a valid positive number in the quantity field first.");
      return;
    }
    if (selectedContainers.length >= currentQuantity) {
      alert(`Cannot add more containers. You have set the quantity to ${currentQuantity}. Please update the quantity field if you need to add more containers.`);
      return;
    }

    const newContainer = {
      containerNumber: containerNo,
      capacity: item.inventory?.containerCapacity,
      tare: item.inventory?.tareWeight,
      inventoryId: item.inventory?.id,
      portId: item.port?.id || null,
      port: item.port || null,
      depotName: item.addressBook?.companyName || "",
    };

    const updatedContainers = [...selectedContainers, newContainer];
    setSelectedContainers(updatedContainers);

    setForm({
      ...form,
      containers: updatedContainers.map((c) => ({
        containerNumber: c.containerNumber,
        capacity: c.capacity,
        tare: c.tare,
        inventoryId: c.inventoryId,
        portId: c.portId,
        depotName: c.depotName,
      })),
      containerNumber: "",
      capacity: "",
      tare: "",
      portName: "",
      depotName: "",
    });

    setSuggestions([]);
  };

  

  // Update the handleSubmit function to properly handle transhipment port
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clear previous validation errors
      setValidationErrors({});

      // Validate required fields ONLY for new jobs (not for edits)
      if (!form.id) {
        const requiredFields = [
          "date",
          "jobNumber", 
          "houseBL",
          "shippingTerm",
          "portOfLoading",
          "portOfDischarge",
          "expHandlingAgentAddressBookId",
          "impHandlingAgentAddressBookId",
          "vesselName",
          "quantity",
          "emptyReturnDepot",
        ];

        const errors: {[key: string]: string} = {};
        
        for (const field of requiredFields) {
          if (!form[field]) {
            errors[field] = "Please fill this field";
          }
        }

        if (Object.keys(errors).length > 0) {
          setValidationErrors(errors);
          setShowValidationAlert(true);
          // Auto-hide alert after 2 seconds
          setTimeout(() => {
            setShowValidationAlert(false);
          }, 2000);
          return;
        }
      }

      // Validate quantity matches exactly with selected containers
      const currentQuantity = parseInt(form.quantity);
      if (!form.quantity || isNaN(currentQuantity) || currentQuantity <= 0) {
        alert("Please enter a valid positive number in the quantity field.");
        return;
      }
      if (selectedContainers.length !== currentQuantity) {
        alert(
          `Quantity mismatch: You have set quantity to ${currentQuantity} but selected ${selectedContainers.length} containers. Please ensure the number of selected containers exactly matches the quantity.`
        );
        return;
      }

      const payload: any = {
        date: form.date || new Date().toISOString(),
        jobNumber: form.jobNumber,
        houseBL: form.houseBL,
        shippingTerm: form.shippingTerm || "CY-CY",
        polPortId: form.portOfLoadingId,
        podPortId: form.portOfDischargeId,
        polFreeDays: form.polFreeDays,
        podFreeDays: form.podFreeDays,
        polDetentionRate: form.polDetentionRate,
        podDetentionRate: form.podDetentionRate,
        expHandlingAgentAddressBookId: form.expHandlingAgentAddressBookId,
        impHandlingAgentAddressBookId: form.impHandlingAgentAddressBookId,
        quantity: form.quantity || selectedContainers.length.toString(),
        carrierAddressBookId: parseInt(form.carrierId),
        vesselName: form.vesselName || "Default Vessel",
        gsDate: form.gateClosingDate ? new Date(form.gateClosingDate).toISOString() : undefined,
        sob: form.sobDate || null,
        etaTopod: form.etaToPod ? new Date(form.etaToPod).toISOString() : undefined,
        emptyReturnDepotAddressBookId: parseInt(form.emptyReturnDepot),
        estimateDate: form.estimatedEmptyReturnDate ? new Date(form.estimatedEmptyReturnDate).toISOString() : undefined,

        // Include containers array
        containers: selectedContainers.map((c: any) => ({
          containerNumber: c.containerNumber || "",
          capacity: c.capacity || "",
          tare: c.tare || "",
          inventoryId: c.inventoryId || null,
          portId: c.portId || null,
          depotName: c.depotName || "",
        })),
      };

      // FIX: Properly handle transhipment port
      if (form.enableTranshipmentPort && form.transhipmentPortId) {
        payload.transhipmentPortId = form.transhipmentPortId;
      }

      console.log("Payload being sent:", payload); // Debug log

      if (form.id) {
        // For PATCH (Edit)
        await apiFetch(
          `http://localhost:8000/empty-repo-job/${form.id}`,
          {
            method: 'PATCH',
            body: payload,
          }
        );
        alert("Empty repo job updated successfully!");
      } else {
        // For POST (New)
        await apiFetch("http://localhost:8000/empty-repo-job", {
          method: 'POST',
          body: payload,
        });
        alert("Empty repo job created successfully!");
      }

      if (refreshShipments) refreshShipments(); // Refresh parent
      onClose(); // Close modal
    } catch (error: any) {
      console.error("Error submitting empty repo job", error);
      alert(
        `Failed to submit empty repo job: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const fetchPorts = async (searchTerm: string) => {
    try {
      const res = await fetch("http://localhost:8000/ports");
      const data = await res.json();

      const filtered = data.filter((port: any) =>
        port.portName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setPortSuggestions(filtered);
    } catch (error) {
      console.error("Error fetching ports:", error);
    }
  };

  const fetchExpHandlingAgentsByPort = async (portId: number) => {
    try {
      const res = await fetch("http://localhost:8000/addressbook");
      const data = await res.json();

      const filtered = data.filter((entry: any) => {
        const isHandlingAgent = entry.businessType
          ?.toLowerCase()
          .includes("handling agent");

        const linkedToPort = entry.businessPorts?.some(
          (bp: any) => bp.portId === portId
        );

        return isHandlingAgent && linkedToPort;
      });

      setExpAgents(filtered);
    } catch (err) {
      console.error("Failed to fetch export handling agents:", err);
    }
  };

  useEffect(() => {
    if (form.portOfLoadingId) {
      fetchExpHandlingAgentsByPort(form.portOfLoadingId);
    } else {
      setExpAgents([]);
    }
  }, [form.portOfLoadingId]);

  const fetchImpHandlingAgentsByPort = async (portId: number) => {
    try {
      const res = await fetch("http://localhost:8000/addressbook");
      const data = await res.json();

      const filtered = data.filter((entry: any) => {
        const isHandlingAgent = entry.businessType
          ?.toLowerCase()
          .includes("handling agent");

        const linkedToPort = entry.businessPorts?.some(
          (bp: any) => bp.portId === portId
        );

        return isHandlingAgent && linkedToPort;
      });

      setImpHandlingAgents(filtered);
    } catch (err) {
      console.error("Failed to fetch import handling agents:", err);
    }
  };

  useEffect(() => {
    if (form.portOfDischargeId) {
      fetchImpHandlingAgentsByPort(form.portOfDischargeId);
    } else {
      setImpHandlingAgents([]);
    }
  }, [form.portOfDischargeId]);

  const fetchTranshipmentPorts = async (search: string) => {
    try {
      const res = await fetch(`http://localhost:8000/ports`);
      const data = await res.json();
      const filtered = data.filter((p: any) =>
        p.portName.toLowerCase().includes(search.toLowerCase())
      );
      setTranshipmentPortSuggestions(filtered);
    } catch (err) {
      console.error("Failed to fetch transhipment ports:", err);
    }
  };

  useEffect(() => {
    const fetchCarrier = async () => {
      try {
        const res = await fetch("http://localhost:8000/addressbook");
        const data = await res.json();
        const carrier = data.filter(
          (entry: any) =>
            entry.businessType && entry.businessType.includes("Carrier")
        );
        setCarrierSuggestions(carrier);
      } catch (err) {
        console.error("Error fetching carrier:", err);
      }
    };

    fetchCarrier();
  }, []);

  const fetchEmptyReturnDepotsByPort = async (portId: number) => {
    try {
      const res = await fetch("http://localhost:8000/addressbook");
      const data = await res.json();

      const filtered = data.filter((entry: any) => {
        const businessType = (entry.businessType || "").toLowerCase();

        const isDepotOrCY =
          businessType.includes("depot terminal") ||
          businessType.includes("cy terminal");

        const linkedToPort =
          Array.isArray(entry.businessPorts) &&
          entry.businessPorts.some((bp: any) => bp.portId === portId);

        return isDepotOrCY && linkedToPort;
      });

      setEmptyReturnDepots(filtered);
    } catch (err) {
      console.error("Failed to fetch empty return depots:", err);
    }
  };

  useEffect(() => {
    if (form.portOfDischargeId) {
      fetchEmptyReturnDepotsByPort(form.portOfDischargeId);
    } else {
      setEmptyReturnDepots([]);
    }
  }, [form.portOfDischargeId]);
                                        
  useEffect(() => {
    const fetchNextJobNumber = async () => {
      try {
        const res = await axios.get(
          "http://localhost:8000/empty-repo-job/job/next"
        );
        const jobNumber = res.data.jobNumber || "";
        setForm((prev: any) => ({
          ...prev,
          jobNumber: jobNumber,
          houseBL: jobNumber, // House BL is same as job number based on backend logic
        }));
      } catch (err) {
        console.error("Failed to fetch job number", err);
      }
    };

    if (!form.id) {
      fetchNextJobNumber();
    }
  }, [form.id]);

  const handleRemoveContainer = (index: number) => {
    const updated = [...selectedContainers];
    updated.splice(index, 1);
    setSelectedContainers(updated);
  };

  useEffect(() => {
    if (form.etaToPod && form.podFreeDays) {
      const etaDate = new Date(form.etaToPod);
      const freeDays = parseInt(form.podFreeDays, 10);

      if (!isNaN(freeDays)) {
        const returnDate = new Date(etaDate);
        returnDate.setDate(etaDate.getDate() + freeDays);

        const formatted = returnDate.toISOString().split("T")[0];
        setForm((prev: any) => ({
          ...prev,
          estimatedEmptyReturnDate: formatted,
        }));
      }
    }
  }, [form.etaToPod, form.podFreeDays]);

  // Add useEffect to initialize selectedContainers from form.containers when editing
  useEffect(() => {
    if (form.id && form.containers && form.containers.length > 0) {
      // Initialize selectedContainers from form.containers when editing
      const containers = form.containers.map((container: any) => ({
        containerNumber: container.containerNumber || "",
        capacity: container.capacity || "",
        tare: container.tare || "",
        inventoryId: container.inventoryId || null,
        portId: container.portId || null,
        depotName: container.depotName || "",
        port: container.port || null,
      }));
      setSelectedContainers(containers);
    }
  }, [form.id, form.containers]);

  // Add this useEffect to handle transhipment port display in edit mode
  useEffect(() => {
    if (
      form.id &&
      form.enableTranshipmentPort &&
      form.transhipmentPortId &&
      !form.transhipmentPortName
    ) {
      // If we have a transhipment port ID but no name, fetch the port name
      const fetchTranshipmentPortName = async () => {
        try {
          const res = await fetch(
            `http://localhost:8000/ports/${form.transhipmentPortId}`
          );
          const port = await res.json();
          setForm((prev: any) => ({
            ...prev,
            transhipmentPortName: port.portName,
          }));
        } catch (err) {
          console.error("Failed to fetch transhipment port name:", err);
        }
      };

      fetchTranshipmentPortName();
    }
  }, [form.id, form.enableTranshipmentPort, form.transhipmentPortId]);

  // Fetch countries on mount
  useEffect(() => {
    fetch("http://localhost:8000/country")
      .then((res) => res.json())
      .then(setCountries);
  }, []);

  // Fetch ports for modal auto-selection
  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const res = await fetch("http://localhost:8000/ports");
        const data = await res.json();
        setPortSuggestionsForModal(data);
      } catch (err) {
        console.error("Error fetching ports for modal:", err);
      }
    };

    fetchPorts();
  }, []);

  // Helper function to auto-select country and port in container modal
  const autoSelectPortInModal = () => {
    if (form.portOfLoadingId && portSuggestionsForModal.length > 0) {
      const selectedPortObj = portSuggestionsForModal.find(
        (port: any) => port.id.toString() === form.portOfLoadingId.toString()
      );
      if (selectedPortObj) {
        // Set the country - port will be set by the useEffect watching ports array
        setSelectedCountry(selectedPortObj.countryId?.toString() || "");
      }
    }
  };

  // Auto-select country and port in container modal when port of loading changes
  useEffect(() => {
    autoSelectPortInModal();
  }, [form.portOfLoadingId]);

  // Auto-select when port suggestions are loaded
  useEffect(() => {
    autoSelectPortInModal();
  }, [portSuggestionsForModal]);

  // Auto-select when countries are loaded
  useEffect(() => {
    autoSelectPortInModal();
  }, [countries]);

  // Fetch ports when country changes
  useEffect(() => {
    if (selectedCountry) {
      fetch("http://localhost:8000/ports")
        .then((res) => res.json())
        .then((data) => {
          setPorts(
            data.filter((p: any) => p.countryId?.toString() === selectedCountry)
          );
        });
    } else {
      setPorts([]);
    }
    setSelectedPort("");
    setSelectedOnHireDepot("");
    setContainers([]);
  }, [selectedCountry]);

  // Auto-select port when the modal's filtered ports are loaded for the selected country
  useEffect(() => {
    if (form.portOfLoadingId && ports.length > 0 && selectedCountry) {
      const portInFilteredList = ports.find(
        (port: any) => port.id.toString() === form.portOfLoadingId.toString()
      );
      if (portInFilteredList && selectedPort !== form.portOfLoadingId.toString()) {
        setSelectedPort(form.portOfLoadingId.toString());
      }
    }
  }, [ports, selectedCountry, form.portOfLoadingId]);

  // Fetch onhire depots when port changes
  useEffect(() => {
    if (selectedPort) {
      fetch("http://localhost:8000/leasinginfo")
        .then((res) => res.json())
        .then((data) => {
          // Filter leasing info by port and get unique depots
          const portLeasingInfo = data.filter((lease: any) => 
            lease.portId?.toString() === selectedPort
          );
          
          // Get unique depot names and IDs
          const uniqueDepots = portLeasingInfo.reduce((acc: any[], lease: any) => {
            if (lease.onHireDepotAddressBook && 
                !acc.find(depot => depot.id === lease.onHireDepotAddressBook.id)) {
              acc.push({
                id: lease.onHireDepotAddressBook.id,
                name: lease.onHireDepotAddressBook.companyName,
              });
            }
            return acc;
          }, []);
          
          setOnHireDepots(uniqueDepots);
        })
        .catch((err) => {
          console.error("Failed to fetch onhire depots:", err);
          setOnHireDepots([]);
        });
    } else {
      setOnHireDepots([]);
      setSelectedOnHireDepot("");
    }
  }, [selectedPort]);

  // Fetch containers when port or onhire depot changes
  useEffect(() => {
    if (selectedPort) {
      fetch("http://localhost:8000/inventory")
        .then((res) => res.json())
        .then((inventoryData) => {
          // Filter inventory by port using leasingInfo
          let filteredInventory = inventoryData.filter((inv: any) => {
            if (!inv.leasingInfo || inv.leasingInfo.length === 0) return false;
            
            // Check if any leasing info has the selected port
            return inv.leasingInfo.some((lease: any) => 
              lease.portId?.toString() === selectedPort
            );
          });

          // If onhire depot is selected, further filter by depot using leasingInfo
          if (selectedOnHireDepot) {
            filteredInventory = filteredInventory.filter((inv: any) => {
              return inv.leasingInfo.some((lease: any) => 
                lease.portId?.toString() === selectedPort &&
                lease.onHireDepotaddressbookId?.toString() === selectedOnHireDepot
              );
            });
          }

          // Fetch ports and address book to get proper port names and depot names
          return Promise.all([
            fetch("http://localhost:8000/movement-history/latest").then(res => res.json()),
            fetch("http://localhost:8000/ports").then(res => res.json()),
            fetch("http://localhost:8000/addressbook").then(res => res.json())
          ]).then(([movementData, portsData, addressBookData]) => {
            // Create a map of latest movement status by inventory ID
            const latestMovements = movementData.reduce((acc: any, movement: any) => {
              if (movement.inventoryId) {
                acc[movement.inventoryId] = movement;
              }
              return acc;
            }, {});

            // Create a map of ports by ID
            const portsMap = portsData.reduce((acc: any, port: any) => {
              acc[port.id] = port;
              return acc;
            }, {});

            // Create a map of address book (depots) by ID
            const addressBookMap = addressBookData.reduce((acc: any, entry: any) => {
              acc[entry.id] = entry;
              return acc;
            }, {});

              // Filter to only show available containers
              const availableContainers = filteredInventory
                .filter((inv: any) => {
                  const latestMovement = latestMovements[inv.id];
                  return latestMovement && latestMovement.status === "AVAILABLE";
                })
                .map((inv: any) => {
                  // Get the relevant leasing info for the selected port
                  const relevantLease = inv.leasingInfo.find((lease: any) => {
                    if (selectedOnHireDepot) {
                      return lease.portId?.toString() === selectedPort &&
                             lease.onHireDepotaddressbookId?.toString() === selectedOnHireDepot;
                    }
                    return lease.portId?.toString() === selectedPort;
                  });

                  const latestMovement = latestMovements[inv.id];
                  const portInfo = portsMap[relevantLease?.portId] || {};
                  const depotInfo = addressBookMap[relevantLease?.onHireDepotaddressbookId] || {};

                  return {
                    id: inv.id,
                    inventory: inv,
                    inventoryId: inv.id,
                    depotName: depotInfo.companyName || relevantLease?.onHireDepotAddressBook?.companyName || "",
                    port: { id: relevantLease?.portId, portName: portInfo.portName || "Unknown Port" },
                    addressBook: depotInfo || relevantLease?.onHireDepotAddressBook || null,
                    status: latestMovement?.status || "UNKNOWN",
                  };
                });

              setContainers(availableContainers);
            });
        })
        .catch((err) => {
          console.error("Failed to fetch containers:", err);
          setContainers([]);
        });
    } else {
      setContainers([]);
    }
    setModalSelectedContainers([]);
  }, [selectedPort, selectedOnHireDepot]);

  // Professional Top Alert Component
  const ProfessionalTopAlert = () => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] transition-all duration-500 ease-out ${
      showValidationAlert 
        ? 'translate-y-0 opacity-100 scale-100' 
        : '-translate-y-full opacity-0 scale-95'
    }`}>
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 min-w-[400px] border border-red-400">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex-grow">
          <p className="font-medium text-sm">Please fill all the required fields</p>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowValidationAlert(false);
            setValidationErrors({});
          }}
          className="flex-shrink-0 hover:bg-red-700 rounded-full p-1 transition-colors duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

// Utility to format DD/MM/YY and handle invalid values
const formatDateInput = (value: string) => {
  if (!value) return "";
  const parsed = dayjs(value, ["DD/MM/YY", "DD/MM/YYYY", "YYYY-MM-DD"], true);
  return parsed.isValid() ? parsed.format("DD/MM/YY") : value;
};


const CustomDatePicker = ({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  validationError,
}: any) => {
  const [internalValue, setInternalValue] = useState("");

  useEffect(() => {
    if (value) {
      const formatted = formatDateInput(value);
      setInternalValue(formatted);
    } else {
      setInternalValue("");
    }
  }, [value]);

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoValue = e.target.value;
    const formatted = dayjs(isoValue).format("DD/MM/YY");
    setInternalValue(formatted);
    onChange({
      target: { value: formatted },
    });
  };

  return (
    <div className="relative">
      {/* Browser date picker — only one calendar UI */}
      <input
        id={id}
        type="date"
        value={
          internalValue
            ? dayjs(internalValue, ["DD/MM/YY", "DD/MM/YYYY"]).format("YYYY-MM-DD")
            : ""
        }
        onChange={handleDateSelect}
        onBlur={onBlur}
        placeholder={placeholder || "DD/MM/YY"}
        className={className}
      />

      {/* Just the small Lucide calendar icon for aesthetics */}

      {validationError && (
        <p className="text-red-500 text-xs mt-1">{validationError}</p>
      )}
    </div>
  );
};


  return (
    <>
      <ProfessionalTopAlert />
      {/* Rest of the component */}
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-lg">
      <Dialog open onOpenChange={onClose} modal={true}>
        <DialogContent
          className="!w-[90vw] !max-w-[1200px] min-w-0 bg-white dark:bg-neutral-900 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto p-0 border border-neutral-200 dark:border-neutral-800"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              {formTitle}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Basic Information
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
               <div>
  <Label
    htmlFor="date"
    className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
  >
    Date (DD/MM/YY) <span className="text-red-500">*</span>
  </Label>
  <CustomDatePicker
    id="date"
    value={form.date || ""}
    onChange={(e:any) => {
      const formattedValue = formatDateInput(e.target.value);
      if (formattedValue !== null) {
        setForm({ ...form, date: formattedValue });
      }
      if (validationErrors.date) {
        setValidationErrors(prev => ({...prev, date: ""}));
      }
    }}
    onBlur={(e:any) => {
      const formattedValue = formatDateInput(e.target.value);
      if (formattedValue !== null) {
        setForm({ ...form, date: formattedValue });
      }
    }}
    placeholder="DD/MM/YY"
    className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-800 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
    validationError={validationErrors.date}
  />
</div>

                  {/* <div>
                    <Label
                      htmlFor="jobNumber"
                      className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                    >
                      Job Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.jobNumber || ""}
                      readOnly
                      className="w-full p-2.5 bg-neutral-100 dark:bg-neutral-700 text-gray-900 dark:text-neutral-300 rounded border border-neutral-200 dark:border-neutral-600 cursor-not-allowed"
                      placeholder="Auto-generated..."
                    />
                  </div> */}

                  {/* <div>
                    <Label
                      htmlFor="houseBL"
                      className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                    >
                      House BL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.houseBL || ""}
                      readOnly
                      className="w-full p-2.5 bg-neutral-100 dark:bg-neutral-700 text-gray-900 dark:text-neutral-300 rounded border border-neutral-200 dark:border-neutral-600 cursor-not-allowed"
                      placeholder="Auto-generated..."
                    />
                  </div> */}

                  <div>
                    <Label
                      htmlFor="shippingTerm"
                      className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                    >
                      Shipping Term <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.shippingTerm || "CY-CY"}
                      onChange={(e) => {
                        setForm({ ...form, shippingTerm: e.target.value });
                        if (validationErrors.shippingTerm) {
                          setValidationErrors(prev => ({...prev, shippingTerm: ""}));
                        }
                      }}
                      placeholder="CY-CY"
                      readOnly
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                    {validationErrors.shippingTerm && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.shippingTerm}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Port Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Port Information
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="relative">
                    <Label
                      htmlFor="portOfLoading"
                      className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                    >
                      Port Of Loading <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.portOfLoading || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev: any) => ({
                          ...prev,
                          portOfLoading: value,
                          portOfLoadingId: undefined, // reset on change
                        }));

                        if (validationErrors.portOfLoading) {
                          setValidationErrors(prev => ({...prev, portOfLoading: ""}));
                        }

                        if (value.length > 1) {
                          fetchPorts(value);
                          setShowPortDropdown(true);
                        } else {
                          setShowPortDropdown(false);
                          setPortSuggestions([]);
                        }
                      }}
                      onFocus={() => {
                        if (form.portOfLoading?.length > 1) {
                          fetchPorts(form.portOfLoading);
                          setShowPortDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowPortDropdown(false), 100);
                      }}
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      placeholder="Start typing port of loading..."
                    />
                    {showPortDropdown && portSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded mt-1 max-h-40 overflow-y-auto">
                        {portSuggestions.map((port) => (
                          <li
                            key={port.id}
                            onMouseDown={() => {
                              setForm((prev: any) => ({
                                ...prev,
                                portOfLoading: port.portName,
                                portOfLoadingId: port.id,
                              }));
                              setShowPortDropdown(false);

                              // Trigger auto-selection for container modal
                              setTimeout(() => {
                                autoSelectPortInModal();
                              }, 200);
                            }}
                            className="px-3 py-2 cursor-pointer text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600"
                          >
                            {port.portName}
                          </li>
                        ))}
                      </ul>
                    )}
                    {validationErrors.portOfLoading && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.portOfLoading}</p>
                    )}
                  </div>

                  <div className="relative">
                    <Label
                      htmlFor="portOfDischarge"
                      className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                    >
                      Port Of Discharge <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.portOfDischarge || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev: any) => ({
                          ...prev,
                          portOfDischarge: value,
                          portOfDischargeId: undefined,
                        }));

                        if (validationErrors.portOfDischarge) {
                          setValidationErrors(prev => ({...prev, portOfDischarge: ""}));
                        }

                        if (value.length > 1) {
                          fetchPorts(value);
                          setShowDischargeDropdown(true);
                        } else {
                          setShowDischargeDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        if (form.portOfDischarge?.length > 1) {
                          fetchPorts(form.portOfDischarge);
                          setShowDischargeDropdown(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowDischargeDropdown(false), 100);
                      }}
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      placeholder="Start typing port of discharge..."
                    />
                    {showDischargeDropdown && portSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded mt-1 max-h-40 overflow-y-auto">
                        {portSuggestions.map((port) => (
                          <li
                            key={port.id}
                            onMouseDown={() => {
                              setForm((prev: any) => ({
                                ...prev,
                                portOfDischarge: port.portName,
                                portOfDischargeId: port.id,
                              }));
                              setShowDischargeDropdown(false);
                            }}
                            className="px-3 py-2 cursor-pointer text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600"
                          >
                            {port.portName}
                          </li>
                        ))}
                      </ul>
                    )}
                    {validationErrors.portOfDischarge && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.portOfDischarge}</p>
                    )}
                  </div>

                  <div className="flex w-full gap-4 col-span-2">
                    <div className="flex-1">
                      <Label
                        htmlFor="polFreeDays"
                        className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                      >
                        Free Days
                      </Label>
                      <Input
                        type="text"
                        value={form.polFreeDays || ""}
                        onChange={(e) =>
                          setForm({ ...form, polFreeDays: e.target.value })
                        }
                        className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      />
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="polDetentionRate"
                        className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                      >
                        Detention Rate
                      </Label>
                      <Input
                        type="text"
                        value={form.polDetentionRate || ""}
                        onChange={(e) =>
                          setForm({ ...form, polDetentionRate: e.target.value })
                        }
                        className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      />
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="podFreeDays"
                        className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                      >
                        Free Days
                      </Label>
                      <Input
                        type="text"
                        value={form.podFreeDays || ""}
                        onChange={(e) =>
                          setForm({ ...form, podFreeDays: e.target.value })
                        }
                        className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      />
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="podDetentionRate"
                        className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                      >
                        Detention Rate
                      </Label>
                      <Input
                        type="text"
                        value={form.podDetentionRate || ""}
                        onChange={(e) =>
                          setForm({ ...form, podDetentionRate: e.target.value })
                        }
                        className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <Checkbox
                      id="enableTranshipmentPort"
                      checked={!!form.enableTranshipmentPort}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          enableTranshipmentPort: checked,
                        })
                      }
                    />
                    <Label
                      htmlFor="enableTranshipmentPort"
                      className="text-gray-900 dark:text-neutral-200 text-sm"
                    >
                      Enable Transhipment Port
                    </Label>
                  </div>

                  {form.enableTranshipmentPort && (
                    <div className="col-span-2">
                      <Label
                        htmlFor="transhipmentPortName"
                        className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                      >
                        Transhipment Port
                      </Label>
                      <div className="relative w-1/2">
                        <Input
                          type="text"
                          value={form.transhipmentPortName || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setForm((prev: any) => ({
                              ...prev,
                              transhipmentPortName: value,
                              transhipmentPortId: undefined, // Reset ID when typing
                            }));

                            if (value.length > 1) {
                              fetchTranshipmentPorts(value);
                              setShowTranshipmentDropdown(true);
                            } else {
                              setShowTranshipmentDropdown(false);
                            }
                          }}
                          onFocus={() => {
                            if ((form.transhipmentPortName || "").length > 1) {
                              fetchTranshipmentPorts(
                                form.transhipmentPortName || ""
                              );
                              setShowTranshipmentDropdown(true);
                            }
                          }}
                          onBlur={() =>
                            setTimeout(
                              () => setShowTranshipmentDropdown(false),
                              150
                            )
                          }
                          className="w-full p-2.5 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-700"
                          placeholder="Start typing transhipment port..."
                        />
                        {showTranshipmentDropdown &&
                          transhipmentPortSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded mt-1 max-h-40 overflow-y-auto">
                              {transhipmentPortSuggestions.map((port) => (
                                <li
                                  key={port.id}
                                  onMouseDown={() => {
                                    setForm((prev: any) => ({
                                      ...prev,
                                      transhipmentPortName: port.portName,
                                      transhipmentPortId: port.id,
                                    }));
                                    setShowTranshipmentDropdown(false);
                                  }}
                                  className="px-3 py-2 cursor-pointer text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600"
                                >
                                  {port.portName}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Container Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Add Inventory
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="mb-4">
                  <Label
                    htmlFor="quantity"
                    className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                  >
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={form.quantity || ""}
                    onChange={(e) => {
                      setForm({ ...form, quantity: e.target.value });
                      if (validationErrors.quantity) {
                        setValidationErrors(prev => ({...prev, quantity: ""}));
                      }
                    }}
                    disabled={!form.portOfLoading}
                    placeholder={!form.portOfLoading ? "First select Port of Loading" : "Enter quantity"}
                    className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 disabled:bg-gray-100 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed"
                  />
                  {validationErrors.quantity && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.quantity}</p>
                  )}
                </div>
                <div className="relative mb-4">
                  <Label
                    htmlFor="containerNumber"
                    className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                  >
                    Container No.
                  </Label>
                  <div className="flex gap-2">
                    <textarea
                      id="containerNumber"
                      value={form.containerNumber || ""}
                      onChange={(e) => handleContainerSearch(e.target.value)}
                      placeholder={
                        !form.portOfLoading
                          ? "First select Port of Loading"
                          : !form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0
                          ? "Please enter valid quantity first"
                          : "Search by container numbers..."
                      }
                      disabled={!form.portOfLoading || !form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0}
                      rows={3}
                      className="flex-1 p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded resize-none disabled:bg-gray-100 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed"
                    />
                    <Button
                      type="button"
                      className="flex items-center justify-center px-3 py-2 h-auto
                        bg-white hover:bg-blue-100 border border-neutral-200
                        dark:bg-neutral-800 dark:hover:bg-blue-900 dark:border-neutral-700
                        transition-colors disabled:bg-gray-100 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed cursor-pointer"
                      onClick={() => setShowContainerModal(true)}
                      disabled={!form.portOfLoading || !form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0}
                    >
                      <Plus className={`w-4 h-4 mr-2 ${!form.portOfLoading || !form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0 ? 'text-gray-400 dark:text-neutral-500' : 'text-blue-600 dark:text-blue-400'} cursor-pointer`} />
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {suggestions.length > 0 
                      ? `Found ${suggestions.length} container${suggestions.length === 1 ? '' : 's'}` 
                      : "Search by container number (min. 2 characters)"
                    }
                  </p>
                  {suggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-800 dark:border-neutral-800 shadow max-h-60 overflow-y-auto">
                      {suggestions.map((sug) => (
                        <li
                          key={sug.id}
                          onClick={() => handleSuggestionSelect(sug)}
                          className="px-4 py-2 hover:bg-neutral-400 dark:hover:bg-neutral-700 cursor-pointer text-sm"
                          >
                          <div className="font-semibold">
                            {sug.inventory.containerNumber}
                          </div>
                          <div className="text-xs text-black-400 flex justify-between">
                            <span>
                              Capacity: {sug.inventory.containerCapacity}{" "}
                              {sug.inventory.capacityUnit}
                            </span>
                          </div>
                          <div className="text-xs text-black-400 mt-1">
                            Location: <ContainerLocationDisplay 
                              inventoryId={sug.inventory?.id} 
                              emptyRepoJobId={form.id}
                              fallbackDepotName={sug.addressBook?.companyName}
                              fallbackPortName={sug.port?.portName}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedContainers.length > 0 && (
                  <div className="mt-6">
                    <h5 className="text-gray-900 dark:text-white text-sm font-semibold mb-2">
                      Selected Containers
                    </h5>
                    <div className="max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded">
                      <Table>
                      <TableHeader>
                        <TableRow className="bg-white dark:bg-neutral-900 border-b border-neutral-700">
                          <TableHead className="text-gray-900 dark:text-neutral-200 text-xs">
                            Container No
                          </TableHead>
                          <TableHead className="text-gray-900 dark:text-neutral-200 text-xs">
                            Capacity
                          </TableHead>
                          <TableHead className="text-gray-900 dark:text-neutral-200 text-xs">
                            Tare
                          </TableHead>
                          <TableHead className="text-gray-900 dark:text-neutral-200 text-xs">
                            Last Location
                          </TableHead>
                          <TableHead className="text-gray-900 dark:text-neutral-200 text-xs text-center">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedContainers.map(
                          (item: ContainerItem, index: number) => (
                            <TableRow
                              key={index}
                              className="border-t border-neutral-700"
                            >
                              <TableCell className="text-gray-900 dark:text-white">
                                {item.inventory?.containerNumber ||
                                  item.containerNumber ||
                                  "N/A"}
                              </TableCell>
                              <TableCell className="text-gray-900 dark:text-white">
                                {(item.inventory?.capacity ||
                                  item.capacity ||
                                  "N/A") +
                                  " " +
                                  (item.inventory?.capacityUnit || "")}
                              </TableCell>
                              <TableCell className="text-gray-900 dark:text-white">
                                {item.tare || item.inventory?.tare || "N/A"}
                              </TableCell>
                              <TableCell className="text-gray-900 dark:text-white">
                                <ContainerLocationDisplay 
                                  inventoryId={item.inventoryId} 
                                  emptyRepoJobId={form.id}
                                  fallbackDepotName={item.depotName}
                                  fallbackPortName={item.port?.portName}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRemoveContainer(index)}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2"
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Handling Agents */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Handling Agents
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <Label
                      htmlFor="expHandlingAgentAddressBookId"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Exp. H. Agent Name <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={
                        form.expHandlingAgentAddressBookId?.toString() || ""
                      }
                      onValueChange={(value) => {
                        const selectedId = Number(value);
                        const selected = expAgents.find(
                          (a) => a.id === selectedId
                        );
                        setForm({
                          ...form,
                          expHandlingAgentAddressBookId: selectedId,
                          expHAgentName: selected?.companyName || "",
                        });
                        if (validationErrors.expHandlingAgentAddressBookId) {
                          setValidationErrors(prev => ({...prev, expHandlingAgentAddressBookId: ""}));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                        <SelectValue placeholder="Select Agent" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700">
                        {expAgents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id.toString()}
                            className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                          >
                            {agent.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.expHandlingAgentAddressBookId && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.expHandlingAgentAddressBookId}</p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="impHandlingAgentAddressBookId"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Imp. H. Agent Name <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={
                        form.impHandlingAgentAddressBookId?.toString() || ""
                      }
                      onValueChange={(value) => {
                        const selectedId = Number(value);
                        const selected = impHandlingAgents.find(
                          (a) => a.id === selectedId
                        );
                        setForm({
                          ...form,
                          impHandlingAgentAddressBookId: selectedId,
                          impHAgentName: selected?.companyName || "",
                        });
                        if (validationErrors.impHandlingAgentAddressBookId) {
                          setValidationErrors(prev => ({...prev, impHandlingAgentAddressBookId: ""}));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                        <SelectValue placeholder="Select Agent" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700">
                        {impHandlingAgents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id.toString()}
                            className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                          >
                            {agent.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.impHandlingAgentAddressBookId && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.impHandlingAgentAddressBookId}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vessel Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Vessel Details
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="relative">
                    <Label
                      htmlFor="carrierName"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Carrier Name
                    </Label>
                    <Input
                      type="text"
                      value={form.carrierName || ""}
                      onChange={(e) => {
                        setForm((prev: any) => ({
                          ...prev,
                          carrierName: e.target.value,
                          carrierId: null,
                        }));
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 150)
                      }
                      placeholder="Start typing carrier name..."
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                    {showSuggestions && form.carrierName && (
                      <ul className="absolute z-10 w-full bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded mt-1 max-h-40 overflow-y-auto">
                        {carrierSuggestions
                          .filter((c) =>
                            c.companyName
                              .toLowerCase()
                              .includes(form.carrierName.toLowerCase())
                          )
                          .map((company) => (
                            <li
                              key={company.id}
                              onMouseDown={() => {
                                setForm((prev: any) => ({
                                  ...prev,
                                  carrierName: company.companyName,
                                  carrierId: company.id,
                                }));
                                setShowSuggestions(false);
                              }}
                              className="px-3 py-2 cursor-pointer text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600"
                            >
                              {company.companyName}
                            </li>
                          ))}
                        {carrierSuggestions.filter((c) =>
                          c.companyName
                            .toLowerCase()
                            .includes(form.carrierName?.toLowerCase())
                        ).length === 0 && (
                          <li className="px-3 py-2 text-neutral-400 text-sm">
                            No match found
                          </li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="vesselName"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Vessel Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={form.vesselName || ""}
                      onChange={(e) => {
                        setForm({ ...form, vesselName: e.target.value });
                        if (validationErrors.vesselName) {
                          setValidationErrors(prev => ({...prev, vesselName: ""}));
                        }
                      }}
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                    {validationErrors.vesselName && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.vesselName}</p>
                    )}
                  </div>
                  <div>
                    <Label
                      htmlFor="gateClosingDate"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Gate Closing Date
                    </Label>
                    <Input
                      type="date"
                      value={form.gateClosingDate || ""}
                      onChange={(e) =>
                        setForm({ ...form, gateClosingDate: e.target.value })
                      }
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="sobDate"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      SOB Date
                    </Label>
                    <Input
                      type="date"
                      value={form.sobDate || ""}
                      onChange={(e) =>
                        setForm({ ...form, sobDate: e.target.value })
                      }
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="etaToPod"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      ETA to PoD
                    </Label>
                    <Input
                      type="date"
                      value={form.etaToPod || ""}
                      onChange={(e) =>
                        setForm({ ...form, etaToPod: e.target.value })
                      }
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Return Depot Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900 dark:text-white text-base font-semibold">
                  Return Depot Information
                </h3>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded space-y-4 border border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <Label
                      htmlFor="emptyReturnDepot"
                      className="text-grey-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Empty Return Depot <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.emptyReturnDepot?.toString() || ""}
                      onValueChange={(value) => {
                        setForm({ ...form, emptyReturnDepot: value });
                        if (validationErrors.emptyReturnDepot) {
                          setValidationErrors(prev => ({...prev, emptyReturnDepot: ""}));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full p-2.5 bg-white text-black-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                        <SelectValue placeholder="Select Return Depot" />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-black border border-neutral-200 dark:border-neutral-700">
                        {emptyReturnDepots.map((depot) => (
                          <SelectItem
                            key={depot.id}
                            value={depot.id.toString()}
                            className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                          >
                            {depot.companyName} - {depot.businessType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.emptyReturnDepot && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.emptyReturnDepot}</p>
                    )}
                  </div>
                  <div>
                    <Label
                      htmlFor="estimatedEmptyReturnDate"
                      className="text-gray-900 dark:text-neutral-200 text-sm mb-1"
                    >
                      Estimated Empty Return Date
                    </Label>
                    <Input
                      type="date"
                      value={form.estimatedEmptyReturnDate || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          estimatedEmptyReturnDate: e.target.value,
                        })
                      }
                      className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit and Cancel buttons */}
            <DialogFooter className="flex justify-center gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 cursor-pointer"
              >
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Container Search Modal */}
      <Dialog open={showContainerModal} onOpenChange={setShowContainerModal}>
        <DialogContent 
          className="!w-[90vw] !max-w-[600px] min-w-0 bg-white dark:bg-neutral-900 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto p-0 border border-neutral-200 dark:border-neutral-800"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Containers
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            {/* Country, Port, and OnHire Depot Selection */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <Label
                  htmlFor="country"
                  className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                >
                  Country
                </Label>
                <Select
                  value={selectedCountry}
                  onValueChange={(value) => setSelectedCountry(value)}
                >
                  <SelectTrigger className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    {countries.map((country) => (
                      <SelectItem
                        key={country.id}
                        value={country.id.toString()}
                        className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                      >
                        {country.countryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="port"
                  className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
                >
                  Tank Collection Port
                </Label>
                <Select
                  value={selectedPort}
                  onValueChange={(value) => {
                    setSelectedPort(value);
                    setSelectedOnHireDepot(""); // Reset depot when port changes
                  }}
                  disabled={!selectedCountry}
                >
                  <SelectTrigger className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    <SelectValue placeholder="Select Port" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    {ports.map((port) => (
                      <SelectItem
                        key={port.id}
                        value={port.id.toString()}
                        className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                      >
                        {port.portName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1 h-5">
                  <Label
                    htmlFor="onHireDepot"
                    className="block text-sm text-gray-900 dark:text-neutral-200"
                  >
                    Location
                  </Label>
                  <div className="h-5 flex items-center -mt-1">
                    {selectedOnHireDepot && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOnHireDepot("")}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white border-red-600 cursor-pointer md:h-7"
                      >
                        Deselect
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Select
                    value={selectedOnHireDepot}
                    onValueChange={(value) => setSelectedOnHireDepot(value)}
                    disabled={!selectedPort || onHireDepots.length === 0}
                  >
                  <SelectTrigger className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-black dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    {onHireDepots.map((depot) => (
                      <SelectItem
                        key={depot.id}
                        value={depot.id.toString()}
                        className="text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-600 cursor-pointer"
                      >
                        {depot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>
            </div>

            {/* Search Containers */}
            <div className="mb-2">
              <Label
                htmlFor="containerSearch"
                className="block text-sm text-gray-900 dark:text-neutral-200 mb-1"
              >
                Search Containers
              </Label>
              <textarea
                id="containerSearch"
                value={containerSearchText}
onChange={(e) => handleModalContainerSearch(e.target.value)}
                placeholder="Search by container numbers..."
                rows={3}
                className="w-full p-2.5 bg-white text-gray-900 dark:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded resize-none"
              />
            </div>

            {/* Container List and Actions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="containers"
                    className="block text-sm text-gray-900 dark:text-neutral-200"
                  >
                    Containers {containerSearchText.trim() && `(${filteredContainers.length} found)`}
                  </Label>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                    {modalSelectedContainers.length} selected
                  </span>
                </div>
                {filteredContainers.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setModalSelectedContainers([...filteredContainers])}
                      className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setModalSelectedContainers([])}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      Deselect All
                    </Button>
                  </div>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto border rounded p-2 bg-white dark:bg-neutral-900">
                {filteredContainers.length === 0 && containers.length === 0 && (
                  <div className="text-center text-neutral-400 py-4">
                    No containers available for the selected port.
                  </div>
                )}
                {filteredContainers.map((container) => (
                  <div
                    key={container.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    onClick={() => {
                      if (
                        modalSelectedContainers.some(
                          (c) => c.id === container.id
                        )
                      ) {
                        setModalSelectedContainers((prev) =>
                          prev.filter((c) => c.id !== container.id)
                        );
                      } else {
                        setModalSelectedContainers((prev) => [
                          ...prev,
                          container,
                        ]);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={modalSelectedContainers.some(
                            (c) => c.id === container.id
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setModalSelectedContainers((prev) => [
                                ...prev,
                                container,
                              ]);
                            } else {
                              setModalSelectedContainers((prev) =>
                                prev.filter((c) => c.id !== container.id)
                              );
                            }
                          }}
                          className="mr-2"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-white text-sm">
                          {container.inventory?.containerNumber || "N/A"}
                        </span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {container.status || "UNKNOWN"}
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-700 dark:text-neutral-300 text-xs">
                      <ContainerLocationDisplay 
                        inventoryId={container.inventory?.id || container.inventoryId}
                       emptyRepoJobId={form.id}
                        fallbackDepotName={container.depotName || container.addressBook?.companyName}
                        fallbackPortName={container.port?.portName}
                      />
                      <div className="mt-1">
                        Capacity: {container.inventory?.containerCapacity || "N/A"} | 
                        Unit: {container.inventory?.capacityUnit || "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectedCountry("");
                setSelectedPort("");
                setSelectedOnHireDepot("");
                setModalSelectedContainers([]);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-800 text-white border border-neutral-300 cursor-pointer"
            >
              Reset
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Reset all modal state when cancelling
                setSelectedCountry("");
                setSelectedPort("");
                setSelectedOnHireDepot("");
                setModalSelectedContainers([]);
                setShowContainerModal(false);
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => {
                // Check quantity limit before adding containers
                const currentQuantity = parseInt(form.quantity);
                if (!form.quantity || isNaN(currentQuantity) || currentQuantity <= 0) {
                  alert("Please enter a valid positive number in the quantity field first.");
                  return;
                }
                const totalAfterAdding = selectedContainers.length + modalSelectedContainers.length;
                if (totalAfterAdding > currentQuantity) {
                  alert(`Cannot add ${modalSelectedContainers.length} containers. You have set the quantity to ${currentQuantity}. Please update the quantity field or select fewer containers.`);
                  return;
                }

                // Map modalSelectedContainers to the proper structure
                const mapped = modalSelectedContainers.map((item: any) => ({
                  containerNumber: item.inventory?.containerNumber,
                  capacity: item.inventory?.containerCapacity,
                  tare: item.inventory?.tareWeight,
                  inventoryId: item.inventory?.id,
                  portId: item.port?.id || null,
                  port: item.port || null,
                  depotName: item.depotName || item.addressBook?.companyName || "",
                  inventory: item.inventory,
                }));

                // Merge and deduplicate containers by containerNumber
                setSelectedContainers((prev: any[]) => {
                  const all = [...prev, ...mapped];
                  const unique = all.filter(
                    (c, idx, arr) =>
                      arr.findIndex(
                        (x) =>
                          (x.containerNumber ||
                            x.inventory?.containerNumber) ===
                          (c.containerNumber || c.inventory?.containerNumber)
                      ) === idx
                  );
                  return unique;
                });
                setShowContainerModal(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 cursor-pointer"
              disabled={modalSelectedContainers.length === 0}
            >
              Add Selected Containers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};



export default AddShipmentModal;
