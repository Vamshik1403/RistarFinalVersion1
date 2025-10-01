"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface InventoryFormProps {
  onClose: () => void;
  inventoryId: number;
  editData?: any;
  isEditMode?: boolean;
}

interface Certificate {
  id?: number;
  inspectionDate: string;
  inspectionType: string;
  nextDueDate: string;
  certificateFile: File | null;
  certificate?: string; // Add this line to fix the error
  isNew?: boolean;
  isModified?: boolean;
}

interface Report {
  id?: number;
  reportDate: string;
  reportDocument: File | null;
  reportDocumentName?: string;
  isNew?: boolean;
  isModified?: boolean;
}

interface Port {
  id: number;
  portName: string;
  portType: string;
}

interface Leasor {
  id: number;
  companyName: string;
  businessType: string;
}



interface LeasingRecord {
  id?: number;
  leasingRef: string;
  leasorId: string | number;
  leasoraddressbookId: string;
  leasorName: string; // Add for display
  depotId: string | number;
  portId: string | number;
  onHireDate: string;
  onHireLocation: string;
  onHireDepotaddressbookId: string;
  onHireDepotName: string; // Add for display
  offHireDate: string;
  leaseRentPerDay: string;
  remarks: string;
  isNew?: boolean;
  isModified?: boolean;
}

const AddInventoryForm: React.FC<InventoryFormProps> = ({
  onClose,
  inventoryId,
  editData,
  isEditMode,
}) => {
  // Timezone-safe date processing functions (same as data import)
  const parseFlexibleDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.trim() === "") return null;

    const trimmed = dateStr.trim();

    // Try manual parsing for DD-MM-YYYY format (most common)
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1]);
      const month = parseInt(ddmmyyyy[2]);
      const year = parseInt(ddmmyyyy[3]);

      const date = new Date(year, month - 1, day, 12, 0, 0, 0); // Set to noon to avoid timezone issues
      if (!isNaN(date.getTime()) && date.getFullYear() === year) {
        return date;
      }
    }

    // Try manual parsing for YYYY-MM-DD format
    const yyyymmdd = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1]);
      const month = parseInt(yyyymmdd[2]);
      const day = parseInt(yyyymmdd[3]);

      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (!isNaN(date.getTime()) && date.getFullYear() === year) {
        return date;
      }
    }

    // Try ISO date as last resort
    try {
      const isoDate = new Date(trimmed);
      if (!isNaN(isoDate.getTime()) && isoDate.getFullYear() > 1900) {
        const localDate = new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate(), 12, 0, 0, 0);
        return localDate;
      }
    } catch (e) {
      // Ignore ISO parsing errors
    }

    return null;
  };

  // Create timezone-safe ISO string for storage
  const createLocalDateISO = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}T12:00:00.000Z`;
  };

  // Create date string for form inputs (YYYY-MM-DD format)
  const createDateInputString = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    status: "Active",
    containerNumber: "",
    containerCategory: "Tank",
    containerType: "ISO Tank",
    containerSize: "20TK",
    containerClass: "T11",
    containerCapacity: "",
    capacityUnit: "MTN",
    manufacturer: "",
    buildYear: "",
    grossWeight: "",
    tareWeight: "",
    initialSurveyDate: "",
    onHireDepotaddressbookId: "",
    onHireLocation: "",
    onHireDate: "",
    offHireDate: "",
    ownership: "",
    leasingRefNo: "",
    leaseRentPerDay: "",
    remarks: "",
  });

  const [leasoraddressbookIds, setLeasoraddressbookIds] = useState<Leasor[]>([]); // Changed from leasoraddressbookIds
  const [filteredDepotsByPort, setFilteredDepotsByPort] = useState<Leasor[]>([]);
  const [allPorts, setAllPorts] = useState<Port[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedHireDepotId, setSelectedHireDepotId] = useState<number | "">("");
  const [currentLeasingRecordIndex, setCurrentLeasingRecordIndex] = useState<number | null>(null);

  const [deletedCertificateIds, setDeletedCertificateIds] = useState<number[]>([]);
  const [deletedReportIds, setDeletedReportIds] = useState<number[]>([]);

  const [showConditionalFields, setShowConditionalFields] = useState(
    formData.ownership === "Own"
  );

  // Certificates and Reports state
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [leasingRecords, setLeasingRecords] = useState<LeasingRecord[]>([]);

  // Store edit data temporarily until all reference data is loaded
  const [tempEditData, setTempEditData] = useState<any>(null);
  const [dataLoadingComplete, setDataLoadingComplete] = useState({
    ports: false,
    leasors: false,
    depots: false
  });

  useEffect(() => {
    if (editData) {
      setTempEditData(editData);
    }
  }, [editData]);

  useEffect(() => {
    if (tempEditData && dataLoadingComplete.ports && dataLoadingComplete.leasors && dataLoadingComplete.depots) {

      let ownershipType = "";
      if (tempEditData.leasingInfo && tempEditData.leasingInfo.length > 0) {
        // Use the ownershipType from the first leasing record
        ownershipType = tempEditData.leasingInfo[0].ownershipType || "";
      }

      // Determine the correct ownership value - map "Leased" to "Lease" for display
      let displayOwnership = ownershipType || tempEditData.ownershipType || "";
      if (displayOwnership === "Leased") {
        displayOwnership = "Lease"; // Map "Leased" from backend to "Lease" for frontend dropdown
      }

      setFormData(prev => ({
        ...prev,
        ...tempEditData,
        initialSurveyDate: tempEditData.InitialSurveyDate
          ? createDateInputString(new Date(tempEditData.InitialSurveyDate))
          : "",
        // Set ownership with correct mapping
        ownership: displayOwnership
      }));

      // Update the conditional fields visibility based on the ownership
      setShowConditionalFields(displayOwnership === "Own");

      // Handle ALL containers that have leasing info (both "Own" and "Lease") - load port and depot data
      if (tempEditData.leasingInfo && tempEditData.leasingInfo.length > 0) {
        const record = tempEditData.leasingInfo[0];

        // For "Own" containers, we need to populate the conditional fields
        if (displayOwnership === "Own") {
          // FIRST: Check if we have data at inventory level (new backend structure)
          let portName = "";
          let portId = "";
          let depotId = "";
          let depotName = "";

          // Check inventory level first
          if (tempEditData.onHireLocation || tempEditData.portId || tempEditData.port) {
            console.log("DEBUG: Using inventory level port data for Own container");
            portName = tempEditData.onHireLocation || "";
            portId = tempEditData.portId?.toString() || "";

            if (tempEditData.port) {
              portId = tempEditData.port.id?.toString() || "";
              portName = tempEditData.port.portName || "";
            }
          } else {
            // Fallback to leasing record
            console.log("DEBUG: Using leasing record port data for Own container");
            const matchedPort = allPorts.find(p => p.id === record.portId);
            portName = matchedPort?.portName || record.port?.portName || "";
            portId = record.portId?.toString() || "";
          }

          // Check depot at inventory level first
          if (tempEditData.onHireDepotName || tempEditData.onHireDepotaddressbookId || tempEditData.onHireDepotAddressBook) {
            console.log("DEBUG: Using inventory level depot data for Own container");
            depotId = tempEditData.onHireDepotaddressbookId?.toString() || "";
            depotName = tempEditData.onHireDepotName || "";

            if (tempEditData.onHireDepotAddressBook) {
              depotId = tempEditData.onHireDepotAddressBook.id?.toString() || "";
              depotName = tempEditData.onHireDepotAddressBook.companyName || "";
            }
          } else {
            // Fallback to leasing record
            console.log("DEBUG: Using leasing record depot data for Own container");
            depotId = record.onHireDepotaddressbookId?.toString() || "";
            depotName = record.onHireDepotAddressBook?.companyName || "";
          }

          console.log("DEBUG: Final Own container data:", { portName, portId, depotId, depotName });

          setFormData(prev => ({
            ...prev,
            onHireLocation: portName, // ✅ guaranteed to match dropdown value
            onHireDepotaddressbookId: depotId,
            onHireDepotName: depotName
          }));

          // Set the selected hire depot ID for the depot dropdown
          if (depotId) {
            const numericDepotId = Number(depotId);
            setSelectedHireDepotId(numericDepotId);
          }

          // If we have a port ID, filter depots based on that port
          if (portId) {
            console.log("Filtering depots for port ID:", portId);
            // Add delay to ensure depots are loaded before filtering
            setTimeout(() => {
              filterDepotsByPort(Number(portId));
            }, 300); // Increased delay
          }
        }

        // For "Lease" containers, we also need to populate the conditional fields
        if (displayOwnership === "Lease") {
          // Set the on-hire location (port name) and depot data in the main form
          const matchedPort = allPorts.find(p => p.id === record.portId);
          const portName = matchedPort?.portName || record.port?.portName || "";

          const depotId = record.onHireDepotaddressbookId || "";

          setFormData(prev => ({
            ...prev,
            onHireLocation: portName, // ✅ guaranteed to match dropdown value
            onHireDepotaddressbookId: depotId,
            onHireDepotName: record.onHireDepotAddressBook?.companyName || ""
          }));

          // Set the selected hire depot ID for the depot dropdown
          if (record.onHireDepotaddressbookId) {
            const numericDepotId = Number(record.onHireDepotaddressbookId);
            setSelectedHireDepotId(numericDepotId);
          }

          // If we have a port ID, filter depots based on that port
          if (record.portId) {
            console.log("Filtering depots for port ID:", record.portId);
            // Add delay to ensure depots are loaded before filtering
            setTimeout(() => {
              filterDepotsByPort(record.portId);
            }, 300); // Increased delay
          }
        }
      }

      // Handle leasing records for both "Own" and "Lease" types
      if (tempEditData.leasingInfo && tempEditData.leasingInfo.length > 0) {

        const existingLeasingRecords = tempEditData.leasingInfo.map((record: any) => ({
          id: record.id,
          leasingRef: record.leasingRefNo || "",
          leasorId: record.leasoraddressbookId || "",
          leasoraddressbookId: record.leasoraddressbookId || "",
          leasorName: record.addressBook?.companyName || "",
          depotId: record.onHireDepotaddressbookId || "",
          portId: record.portId || "",
          onHireDate: record.onHireDate ? createDateInputString(new Date(record.onHireDate)) : "",
          onHireLocation: record.port?.portName || "",
          onHireDepotaddressbookId: record.onHireDepotaddressbookId || "",
          onHireDepotName: record.onHireDepotAddressBook?.companyName || "",
          offHireDate: record.offHireDate ? createDateInputString(new Date(record.offHireDate)) : "",
          leaseRentPerDay: record.leaseRentPerDay || "",
          remarks: record.remarks || "",
          isNew: false,
          isModified: false
        }));

        setLeasingRecords(existingLeasingRecords);

        // Filter depots for each record that has a port
        existingLeasingRecords.forEach((record: any, index: number) => {
          if (record.portId) {
            console.log(`Setting up depot filtering for record ${index} with port ID ${record.portId}`);
            // Set current index and filter depots for this specific record
            setTimeout(() => {
              setCurrentLeasingRecordIndex(index);
              filterDepotsByPort(record.portId);
            }, 1000 + (index * 300)); // Increased delay and stagger
          }
        });
      } else {
        // Handle "Own" containers without leasing records (e.g., CSV imports)
        if (displayOwnership === "Own") {
          console.log("DEBUG: Handling Own container without leasing records");

          // For CSV-imported "Own" containers, the port and depot data is at inventory level
          let portName = "";
          let portId = "";
          let depotId = "";
          let depotName = "";

          // Check inventory level data
          if (tempEditData.onHireLocation || tempEditData.portId || tempEditData.port) {
            console.log("DEBUG: Using inventory level port data for Own container without leasing");
            portName = tempEditData.onHireLocation || "";
            portId = tempEditData.portId?.toString() || "";

            if (tempEditData.port) {
              portId = tempEditData.port.id?.toString() || "";
              portName = tempEditData.port.portName || "";
            }
          }

          // Check depot at inventory level
          if (tempEditData.onHireDepotName || tempEditData.onHireDepotaddressbookId || tempEditData.onHireDepotAddressBook) {
            console.log("DEBUG: Using inventory level depot data for Own container without leasing");
            depotId = tempEditData.onHireDepotaddressbookId?.toString() || "";
            depotName = tempEditData.onHireDepotName || "";

            if (tempEditData.onHireDepotAddressBook) {
              depotId = tempEditData.onHireDepotAddressBook.id?.toString() || "";
              depotName = tempEditData.onHireDepotAddressBook.companyName || "";
            }
          }

          console.log("DEBUG: Final Own container data (no leasing):", { portName, portId, depotId, depotName });

          setFormData(prev => ({
            ...prev,
            onHireLocation: portName,
            onHireDepotaddressbookId: depotId,
            onHireDepotName: depotName
          }));

          // Set the selected hire depot ID for the depot dropdown
          if (depotId) {
            const numericDepotId = Number(depotId);
            setSelectedHireDepotId(numericDepotId);
          }

          // If we have a port ID, filter depots based on that port
          if (portId) {
            console.log("Filtering depots for port ID (no leasing):", portId);
            setTimeout(() => {
              filterDepotsByPort(Number(portId));
            }, 300);
          }
        }
      }

      // Preserve existing certificates with isModified=false
      if (tempEditData.periodicTankCertificates) {
        const existingCertificates = tempEditData.periodicTankCertificates.map((cert: any) => ({
          id: cert.id,
          inspectionDate: cert.inspectionDate ? new Date(cert.inspectionDate).toISOString().split('T')[0] : "",
          inspectionType: cert.inspectionType || "",
          nextDueDate: cert.nextDueDate ? new Date(cert.nextDueDate).toISOString().split('T')[0] : "",
          certificateFile: null,
          certificate: cert.certificate,
          isNew: false,
          isModified: false,
        }));
        setCertificates(existingCertificates);
      }


      // For reports, we need to preserve the document filename
      if (tempEditData.onHireReport) {
        const reportData = tempEditData.onHireReport.map((report: any) => ({
          id: report.id,
          reportDate: report.reportDate ? new Date(report.reportDate).toISOString().split('T')[0] : "",
          reportDocument: null, // We can't load the file object
          reportDocumentName: report.reportDocument, // Store the filename
          isNew: false,
          isModified: false
        }));
        setReports(reportData);
      }

      setTempEditData(null);
    }
  }, [tempEditData, dataLoadingComplete]);

  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const response = await axios.get("http://localhost:8000/ports");
        setPorts(response.data);
        setAllPorts(response.data);
        setDataLoadingComplete(prev => ({ ...prev, ports: true }));
        console.log("Ports loaded:", response.data);
      } catch (error) {
        console.error("Error fetching ports:", error);
      }
    };

    fetchPorts();
  }, []);



  // Store all depot terminals without filtering
  const [allDepotTerminals, setAllDepotTerminals] = useState<{
    id: number;
    companyName: string;
    address: string;
    businessPorts: any[];
  }[]>([]);

  // Depot options for dropdowns
  const [hireDepotOptions, setHireDepotOptions] = useState<{
    label: string;
    value: number;
    companyName?: string;
  }[]>([]);

  useEffect(() => {
    const fetchHireDepots = async () => {
      try {
        const response = await fetch("http://localhost:8000/addressbook");
        const data = await response.json();
        const depotTerminals = data.filter((entry: any) =>
          entry.businessType &&
          (entry.businessType.toLowerCase().includes("deport terminal") ||
            entry.businessType.toLowerCase().includes("depot terminal") ||
            entry.businessType.toLowerCase().includes("depot-terminal"))
        );

        setAllDepotTerminals(depotTerminals);
        setDataLoadingComplete(prev => ({ ...prev, depots: true }));

        // Initially all depots are shown until a port is selected
        const depots = depotTerminals.map((entry: any) => ({
          label: `${entry.companyName} - ${entry.address || 'No address'}`,
          value: entry.id,
        }));

        setHireDepotOptions(depots);
      } catch (error) {
        console.error("Failed to fetch hire depots:", error);
      }
    };

    fetchHireDepots();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/addressbook");
        const data = await res.json();
        const leasors = data.filter(
          (entry: any) => entry.businessType && entry.businessType.includes("Lessor")
        );
        setLeasoraddressbookIds(leasors);
        setDataLoadingComplete(prev => ({ ...prev, leasors: true }));
      } catch (error) {
        console.error("Error fetching leasors:", error);
      }
    };

    fetchData();
  }, []);

  // Function to filter depots by port ID
  const filterDepotsByPort = (portId: number) => {

    // Filter depot terminals that are associated with this port
    const filteredDepots = allDepotTerminals.filter(depot => {
      // Check if depot has businessPorts and if any of them match the selected portId
      if (!depot.businessPorts || !Array.isArray(depot.businessPorts)) {
        return false;
      }

      const hasMatchingPort = depot.businessPorts.some(bp => {
        const bpPortId = bp.portId || (bp.port && bp.port.id);
        return Number(bpPortId) === Number(portId);
      });

      return hasMatchingPort;
    });

    // Update the depot options in the dropdown
    const options = filteredDepots.map(depot => ({
      label: `${depot.companyName} - ${depot.address || 'No address'}`,
      value: depot.id,
      companyName: depot.companyName, // Store company name for easy lookup
    }));

    setHireDepotOptions(options);

    setFilteredDepotsByPort(filteredDepots.map(depot => ({
      ...depot,
      businessType: "Deport Terminal" // Add the required businessType property
    })));

    // If there are no depots for this port, show a message
    if (options.length === 0) {
    }
  };

  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const res = await fetch("http://localhost:8000/ports");
        const data = await res.json();
        setAllPorts(data);
      } catch (err) {
        console.error("Failed to fetch ports:", err);
      }
    };

    fetchPorts();
  }, []);


  // Handle form field changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "ownership") {
      setShowConditionalFields(value === "Own");

      // If changing to "Own" in edit mode and we have leasing data, populate the fields
      if (value === "Own" && isEditMode && editData && editData.leasingInfo && editData.leasingInfo.length > 0) {
        const ownRecord = editData.leasingInfo[0];

        if (ownRecord.port?.portName) {
          setFormData(prev => ({
            ...prev,
            port: ownRecord.port.portName,
            onHireLocation: ownRecord.port.portName
          }));
        }

        if (ownRecord.portId) {
          const selectedPort = allPorts.find(port => port.id === ownRecord.portId);
          if (selectedPort) {
            setFormData(prev => ({
              ...prev,
              port: selectedPort.portName,
              onHireLocation: selectedPort.portName
            }));
          }
        }

        if (ownRecord.onHireDepotaddressbookId) {
          const numericDepotId = Number(ownRecord.onHireDepotaddressbookId);
          setSelectedHireDepotId(numericDepotId);

          // Filter depots for this port
          if (ownRecord.portId) {
            setTimeout(() => {
              filterDepotsByPort(ownRecord.portId);
            }, 100);
          }
        }
      }

      // If changing to "Lease" in edit mode, ensure leasing records are visible
      if (value === "Lease" || value === "Leased") {
        // If we don't have any leasing records yet, add a default one
        if (leasingRecords.length === 0) {
          const newRecord: LeasingRecord = {
            leasingRef: "",
            leasorId: "",
            leasoraddressbookId: "",
            leasorName: "",
            depotId: "",
            portId: "",
            onHireDate: "",
            onHireLocation: "",
            onHireDepotaddressbookId: "",
            onHireDepotName: "",
            offHireDate: "",
            leaseRentPerDay: "",
            remarks: "",
            isNew: true,
            isModified: false
          };
          setLeasingRecords([newRecord]);
        }
      }

      // If changing away from "Own", clear the conditional fields
      if (value !== "Own") {
        setFormData(prev => ({
          ...prev,
          onHireLocation: "",
          onHireDepotaddressbookId: ""
        }));
        setSelectedHireDepotId("");
      }
    }

    // When port changes in "On Hire Location", filter depots based on selected port
    if (name === "onHireLocation" && value) {
      // Find the port object based on the port name
      const selectedPort = allPorts.find((port) => port.portName === value);


      if (selectedPort) {
        console.log(`Selected port: ${selectedPort.portName} (ID: ${selectedPort.id})`);
        // Filter depots associated with this port
        filterDepotsByPort(selectedPort.id);
      } else {
        // If no port selected or invalid port, reset depot options
        const allDepots = allDepotTerminals.map((entry) => ({
          label: `${entry.companyName} - ${entry.address || 'No address'}`,
          value: entry.id,
        }));
        setHireDepotOptions(allDepots);
      }

      // Reset the selectedHireDepotId when port changes
      setSelectedHireDepotId("");
    }
  };


  // Remove certificate
  const handleDeleteCertificate = (idx: number) => {
    setCertificates((prev) => {
      const cert = prev[idx];
      if (cert.id) setDeletedCertificateIds(ids => [...ids, cert.id!]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Add report

  // Remove report
  const handleDeleteReport = (idx: number) => {
    setReports((prev) => {
      const rep = prev[idx];
      if (rep.id) setDeletedReportIds(ids => [...ids, rep.id!]);
      return prev.filter((_, i) => i !== idx);
    });
  };


  // Add leasing record
  const handleAddLeasingRecord = () => {
    // Just add an empty record to the table
    setLeasingRecords([
      ...leasingRecords,
      {
        leasingRef: "",
        leasorId: "",
        leasoraddressbookId: "",
        leasorName: "",
        depotId: "",
        portId: "",
        onHireDate: "",
        onHireLocation: "",
        onHireDepotaddressbookId: "",
        onHireDepotName: "",
        offHireDate: "",
        leaseRentPerDay: "",
        remarks: "",
        isNew: true,
        isModified: false
      }
    ]);
  };

  // Remove leasing record
  const handleDeleteLeasingRecord = (index: number) => {
    setLeasingRecords(leasingRecords.filter((_, i) => i !== index));
  };



  // Add a new function to submit leasing records
  const handleSubmitLeasingRecords = async (inventoryId: number) => {
    try {
      console.log("Submitting leasing records for inventory ID:", inventoryId);

      for (const record of leasingRecords) {
        // Skip if missing required values
        if (!record.leasingRef || (!record.leasoraddressbookId && !record.leasorName)) {
          console.log("Skipping incomplete leasing record - missing leasingRef or leasor:", record);
          continue;
        }

        // If record has an ID and isn't modified, skip it
        if (record.id && !record.isModified && !record.isNew) {
          console.log("Skipping unmodified existing record:", record.id);
          continue;
        }

        // Get the leasor ID - use the stored ID or look it up by name
        let leasorId = record.leasoraddressbookId; // This should already be the ID, not the name
        if (!leasorId && record.leasorName) {
          const selectedLeasor = leasoraddressbookIds.find(
            leasor => leasor.companyName === record.leasorName
          );
          leasorId = selectedLeasor?.id?.toString() ?? "";
        }

        // Get the port ID directly if available, otherwise look it up
        let portId = record.portId;
        if (!portId && record.onHireLocation) {
          const selectedPort = allPorts.find(
            port => port.portName === record.onHireLocation
          );
          portId = selectedPort?.id?.toString() ?? "";
        }

        // Get the depot ID - use the stored ID or look it up by name
        let depotId = record.onHireDepotaddressbookId; // This should already be the ID, not the name
        if (!depotId && record.onHireDepotName) {
          const selectedDepot = hireDepotOptions.find(
            depot => depot.companyName === record.onHireDepotName
          );
          depotId = selectedDepot?.value?.toString() ?? "";
        }

        if (!leasorId || !portId || !depotId) {
          console.error("Missing reference IDs for leasing record:", {
            leasorId,
            portId,
            depotId,
            record,
            leasorName: record.leasorName,
            onHireLocation: record.onHireLocation,
            onHireDepotName: record.onHireDepotName,
            availableLeasors: leasoraddressbookIds.map(l => l.companyName),
            availablePorts: allPorts.map(p => p.portName),
            availableDepots: hireDepotOptions.map(d => d.companyName)
          });
          continue;
        }

        // Convert IDs to numbers to ensure consistent typing
        const numericLeasorId = typeof leasorId === 'string' ? parseInt(leasorId) : leasorId;
        const numericPortId = typeof portId === 'string' ? parseInt(portId) : portId;
        const numericDepotId = typeof depotId === 'string' ? parseInt(depotId) : depotId;

        // Create the payload with correct ID references
        const leasingData = {
          ownershipType: record.leasingRef.startsWith("OWN-") ? "Own" : "Leased", // Use "Leased" for backend consistency
          leasingRefNo: record.leasingRef,
          leasoraddressbookId: numericLeasorId,
          onHireDepotaddressbookId: numericDepotId,
          portId: numericPortId,
          onHireDate: record.onHireDate ? createLocalDateISO(parseFlexibleDate(record.onHireDate) || new Date()) : createLocalDateISO(new Date()),
          offHireDate: record.offHireDate ? createLocalDateISO(parseFlexibleDate(record.offHireDate) || new Date()) : null,
          leaseRentPerDay: record.leaseRentPerDay || "",
          remarks: record.remarks || "",
          inventoryId: inventoryId
        };

        if (record.id && !record.isNew) {
          // Update existing record
          const response = await axios.patch(
            `http://localhost:8000/leasinginfo/${record.id}`,
            leasingData
          );
          console.log("Leasing record updated:", response.data);
        } else {
          // Create new record
          const response = await axios.post(
            "http://localhost:8000/leasinginfo",
            leasingData
          );
        }
      }

    } catch (error: any) {
      console.error("Error submitting leasing records:", error);
      console.error("Error details:", error.response?.data || error.message);
      throw error;
    }
  };


  // Modify handleSubmit function to collect all leasing records
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Delete removed certificates from backend ---
    for (const id of deletedCertificateIds) {
      try {
        await axios.delete(`http://localhost:8000/tankcertificate/${id}`);
      } catch (err: any) {
        if (err.response && err.response.status === 404) {
          // Ignore not found errors
          console.warn(`Certificate ${id} already deleted (404)`);
        } else {
          console.error('Failed to delete certificate', id, err);
        }
      }
    }
    // --- Delete removed reports from backend ---
    for (const id of deletedReportIds) {
      try {
        await axios.delete(`http://localhost:8000/onhirereport/${id}`);
      } catch (err: any) {
        if (err.response && err.response.status === 404) {
          // Ignore not found errors
          console.warn(`Report ${id} already deleted (404)`);
        } else {
          console.error('Failed to delete report', id, err);
        }
      }
    }

    // --- Upload certificate files if present ---
    for (let i = 0; i < certificates.length; i++) {
      const cert = certificates[i];
      if (cert.certificateFile) {
        const formData = new FormData();
        formData.append('file', cert.certificateFile);
        const response = await axios.post('http://localhost:8000/tankcertificate/certificates/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        certificates[i].certificate = response.data.fileName;
        certificates[i].certificateFile = null;
      } else if (cert.certificate) {
        // preserve existing filename
        certificates[i].certificate = cert.certificate;
      }
    }

    // --- Upload report files if present ---
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      if (report.reportDocument) {
        const formData = new FormData();
        formData.append('file', report.reportDocument);
        const response = await axios.post('http://localhost:8000/tankcertificate/reports/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        reports[i].reportDocumentName = response.data.fileName;
        // For payload, use the filename string
        reports[i].reportDocument = response.data.fileName as any;
      } else if (report.reportDocumentName) {
        // preserve existing filename for payload
        reports[i].reportDocument = report.reportDocumentName as any;
      }
    }

    if (!formData.containerNumber) {
      alert("Container Number is required");
      return;
    }

    // Case-insensitive uniqueness check for container number
    if (!isEditMode) {
      try {
        const response = await axios.get("http://localhost:8000/inventory");
        const existingContainers = response.data;

        const duplicateContainer = existingContainers.find((container: any) =>
          container.containerNumber.toLowerCase() === formData.containerNumber.toLowerCase()
        );

        if (duplicateContainer) {
          alert(`Container with number "${formData.containerNumber}" already exists match with "${duplicateContainer.containerNumber}")!`);
          return;
        }
      } catch (err) {
        console.error("Failed to check for duplicate containers:", err);
      }
    } else {
      // For edit mode, check if there's another container with same number (case-insensitive) but different ID
      try {
        const response = await axios.get("http://localhost:8000/inventory");
        const existingContainers = response.data;

        const duplicateContainer = existingContainers.find((container: any) =>
          container.id !== inventoryId &&
          container.containerNumber.toLowerCase() === formData.containerNumber.toLowerCase()
        );

        if (duplicateContainer) {
          alert(`Container with number "${formData.containerNumber}" already exists (case-insensitive match with "${duplicateContainer.containerNumber}")!`);
          return;
        }
      } catch (err) {
        console.error("Failed to check for duplicate containers:", err);
      }
    }

    const payload: any = {
      status: formData.status,
      containerNumber: formData.containerNumber,
      containerCategory: formData.containerCategory,
      containerType: formData.containerType,
      containerSize: formData.containerSize,
      containerClass: formData.containerClass,
      containerCapacity: formData.containerCapacity,
      capacityUnit: formData.capacityUnit,
      manufacturer: formData.manufacturer,
      buildYear: formData.buildYear,
      grossWeight: formData.grossWeight,
      tareWeight: formData.tareWeight,
      InitialSurveyDate: formData.initialSurveyDate,

      periodicTankCertificates: certificates.map((c) => ({
        id: c.id || undefined,
        inspectionDate: c.inspectionDate,
        inspectionType: c.inspectionType,
        nextDueDate: c.nextDueDate,
        certificate:
          typeof c.certificate === "string"
            ? c.certificate
            : c.certificateFile?.name || null,
      })),

      onHireReport: reports.map((r) => ({
        id: r.id || undefined,
        reportDate: r.reportDate,
        reportDocument: typeof r.reportDocument === "object"
          ? JSON.stringify(r.reportDocument)
          : r.reportDocument,
      })),

      leasingInfo: [],
    };

    // === Lease Logic ===
    if (!isEditMode && formData.ownership === "Lease") {
      if (leasingRecords.length === 0) {
        alert("Please add at least one leasing record for a Leased container.");
        return;
      }

      for (const record of leasingRecords) {
        const selectedPort = allPorts.find((p) => p.portName === record.onHireLocation);
        if (!selectedPort) {
          alert(`Port not found for leasing record`);
          return;
        }

        payload.leasingInfo.push({
          ownershipType: "Leased",
          leasingRefNo: record.leasingRef,
          leasoraddressbookId: parseInt(record.leasoraddressbookId),
          onHireDepotaddressbookId: parseInt(record.onHireDepotaddressbookId),
          portId: selectedPort.id,
          onHireDate: record.onHireDate ? createLocalDateISO(parseFlexibleDate(record.onHireDate) || new Date()) : createLocalDateISO(new Date()),
          offHireDate: record.offHireDate ? createLocalDateISO(parseFlexibleDate(record.offHireDate) || new Date()) : null,
          leaseRentPerDay: record.leaseRentPerDay || "0",
          remarks: record.remarks || "",
        });
      }

      payload.portId = payload.leasingInfo[0].portId;
      payload.onHireDepotaddressbookId = payload.leasingInfo[0].onHireDepotaddressbookId;
      payload.ownership = "Lease";
    }

    // === Own Logic ===
    if (!isEditMode && formData.ownership === "Own") {
      const selectedPort = allPorts.find((p) => p.portName === formData.onHireLocation);
      if (!selectedPort || !selectedHireDepotId) {
        alert("On Hire Port and Depot are required.");
        return;
      }

      payload.leasingInfo.push({
        ownershipType: "Own",
        leasingRefNo: `OWN-${formData.containerNumber}`,
        leasoraddressbookId: (selectedHireDepotId),
        onHireDepotaddressbookId: selectedHireDepotId,
        portId: selectedPort.id,
        onHireDate: new Date().toISOString(),
        offHireDate: null,
        leaseRentPerDay: "",
        remarks: "",
      });

      payload.portId = selectedPort.id;
      payload.onHireDepotaddressbookId = parseInt(selectedHireDepotId.toString());
      payload.ownership = "Own";
    }

    try {
      let createdInventoryId = inventoryId;

      if (isEditMode && inventoryId) {
        const response = await axios.patch(`http://localhost:8000/inventory/${inventoryId}`, payload);
        createdInventoryId = response.data.id || inventoryId;

        // Fix ownership type mapping - ensure consistent comparison
        const originalOwnership = editData.leasingInfo?.[0]?.ownershipType || "";
        // Map frontend "Lease" to backend "Leased" for comparison
        const currentOwnership = formData.ownership === "Lease" ? "Leased" :
          formData.ownership === "Own" ? "Own" :
            formData.ownership; // Keep original if it's already "Leased"

        console.log("Ownership comparison:", { originalOwnership, currentOwnership, formOwnership: formData.ownership });

        // Ownership changed
        if (originalOwnership !== currentOwnership) {
          for (const record of editData.leasingInfo || []) {
            await axios.delete(`http://localhost:8000/leasinginfo/${record.id}`);
          }
        }

        if (formData.ownership === "Own") {
          const selectedPort = allPorts.find((p) => p.portName === formData.onHireLocation);
          if (!selectedPort || !selectedHireDepotId) throw new Error("Port/Depot missing");

          const ownLeasingData = {
            ownershipType: "Own",
            leasingRefNo: `OWN-${formData.containerNumber}`,
            leasoraddressbookId: (selectedHireDepotId),
            onHireDepotaddressbookId: (selectedHireDepotId),
            portId: selectedPort.id,
            onHireDate: createLocalDateISO(new Date()),
            offHireDate: null,
            leaseRentPerDay: "",
            remarks: "",
            inventoryId: createdInventoryId,
          };

          if (editData.leasingInfo?.length > 0) {
            await axios.patch(`http://localhost:8000/leasinginfo/${editData.leasingInfo[0].id}`, ownLeasingData);
          } else {
            await axios.post("http://localhost:8000/leasinginfo", ownLeasingData);
          }
        }

        if (formData.ownership === "Lease" && leasingRecords.length > 0) {
          await handleSubmitLeasingRecords(createdInventoryId);
        }

      } else {
        const response = await axios.post("http://localhost:8000/inventory", payload);
        createdInventoryId = response.data.id;
      }

      // debug response
      console.log("Container saved successfully:", payload);

      alert("Container saved successfully!");
      onClose();
    } catch (error: any) {
      const status = error?.response?.status;
      const rawMsg = error?.response?.data?.message;
      const apiMessage = Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg;

      // Show the precise backend reason for 409 conflicts (shipment exists / movement progressed)
      if (status === 409 && apiMessage) {
        alert(apiMessage);
        return;
      }

      // Fallback duplicate number message
      if (status === 409 || (typeof apiMessage === 'string' && apiMessage.toLowerCase().includes('already exists'))) {
        alert('Container with this number already exists!');
        return;
      }

      console.error("Error saving container:", error?.response?.data || error?.message);
      alert("Failed to save container. Please check console for details.");
    }
  };



  // Add this derived state for easier checks
  const isTank = formData.containerCategory === "Tank";
  const isDry = formData.containerCategory === "Dry";
  const isRefrigerated = formData.containerCategory === "Refrigerated";

  // Dynamic options for Container Type and Class
  let containerTypeOptions: { value: string; label: string }[] = [];
  let containerClassOptions: { value: string; label: string }[] = [];

  if (isTank) {
    containerTypeOptions = [{ value: "ISO Tank", label: "ISO Tank" }];
    containerClassOptions = [{ value: "T11", label: "T11" }];
  } else if (isDry) {
    containerTypeOptions = [
      { value: "20ft", label: "20ft" },
      { value: "30ft", label: "30ft" },
      { value: "40ft", label: "40ft" },
    ];
    containerClassOptions = [
      { value: "Standard", label: "Standard" },
      { value: "High Cube", label: "High Cube" },
      { value: "Open Top", label: "Open Top" },
    ];
  } else if (isRefrigerated) {
    containerTypeOptions = [{ value: "Refrigerated Container", label: "Refrigerated Container" }];
    containerClassOptions = []; // No options for class
  }

  // At the beginning of your component, add this style block
  const tableStyle: React.CSSProperties = {
    tableLayout: "fixed" as const,
    width: "100%",
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        onInteractOutside={(e: any) => e.preventDefault()}
        className="!max-w-[1100px] !w-[80vw] !p-0"
      >
        <DialogTitle className="sr-only">
          {isEditMode ? "Edit Container" : "Add Container"}
        </DialogTitle>
        <div
          className="p-4 text-sm w-full bg-white dark:bg-neutral-900 rounded-lg border border-white dark:border-neutral-800 shadow-none outline-none max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-black dark:text-white">
              {isEditMode ? "Edit Container" : "Add Container"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status - using shadcn Select */}
            <div className="mb-4">
              <Label className="text-sm text-gray-700 dark:text-white mb-1">Status</Label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Two columns layout - keep structure, update styling */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Container Number */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Container No</Label>
                <input
                  type="text"
                  name="containerNumber"
                  value={formData.containerNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              {/* Container Category */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Category</Label>
                <select
                  name="containerCategory"
                  value={formData.containerCategory}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                >
                  <option value="Tank">Tank</option>
                  <option value="Dry">Dry</option>
                  <option value="Refrigerated">Refrigerated</option>
                </select>
              </div>

              {/* Container Type */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Type</Label>
                <select
                  name="containerType"
                  value={formData.containerType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                >
                  {containerTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Container Size (only for Tank) */}
              {isTank ? (
                <div>
                  <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Size</Label>
                  <select
                    name="containerSize"
                    value={formData.containerSize}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                  >
                    <option value="20TK" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">20TK</option>
                  </select>
                </div>
              ) : (
                // When not Tank, shift Container Class here
                <div>
                  <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Class</Label>
                  <select
                    name="containerClass"
                    value={formData.containerClass}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                    disabled={isRefrigerated}
                  >
                    <option value="">
                      {isRefrigerated ? "No options available" : "Select Class"}
                    </option>
                    {containerClassOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* When Tank, show Container Class in original place, else show Container Capacity here */}
              {isTank ? (
                <div>
                  <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Class</Label>
                  <select
                    name="containerClass"
                    value={formData.containerClass}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                  >
                    {containerClassOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Capacity</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="containerCapacity"
                      value={formData.containerCapacity}
                      onChange={handleChange}
                      placeholder="Enter capacity value"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                    />
                    <select
                      name="capacityUnit"
                      value={formData.capacityUnit}
                      onChange={handleChange}
                      className="px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                    >
                      <option value="">Select Unit</option>
                      <option value="MTN" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">MTN</option>
                      <option value="KG" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">KG</option>
                      <option value="LTRS" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">LTRS</option>
                    </select>
                  </div>
                </div>
              )}

              {/* When Tank, show Container Capacity in its original place */}
              {isTank && (
                <div>
                  <Label className="text-sm text-gray-700 dark:text-white mb-1">Container Capacity</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="containerCapacity"
                      value={formData.containerCapacity}
                      onChange={handleChange}
                      placeholder="Enter capacity value"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                    />
                    <select
                      name="capacityUnit"
                      value={formData.capacityUnit}
                      onChange={handleChange}
                      className="px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                    >
                      <option value="MTN" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">MTN</option>
                      <option value="KG" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">KG</option>

                      <option value="LTRS" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-800">LTRS</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Manufacturer */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Manufacturer</Label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              {/* Build Year */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Build Year</Label>
                <input
                  type="text"
                  name="buildYear"
                  value={formData.buildYear}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              {/* Gross Weight */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Gross Wt</Label>
                <input
                  type="text"
                  name="grossWeight"
                  value={formData.grossWeight}
                  onChange={handleChange}
                  placeholder="Enter gross weight"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              {/* Tare Weight */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Tare Wt</Label>
                <input
                  type="text"
                  name="tareWeight"
                  value={formData.tareWeight}
                  onChange={handleChange}
                  placeholder="Enter tare weight"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>

              {/* Initial Survey Date */}
              <div>
                <Label className="text-sm text-gray-700 dark:text-white mb-1">Initial Survey Date</Label>
                <input
                  type="date"
                  name="initialSurveyDate"
                  value={formData.initialSurveyDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex text-white flex-wrap gap-4 mb-4">
              {/* Ownership */}
              <div className="flex-1 min-w-[200px]">
                <Label className="mb-1 font-medium text-gray-700 dark:text-white">Ownership</Label>
                <select
                  name="ownership"
                  value={formData.ownership}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500"
                >
                  <option value="">Select Ownership</option>
                  <option value="Own">Own</option>
                  <option value="Lease">Lease</option>
                </select>
              </div>

              {/* Only show these if ownership is "Own" */}
              {(formData.ownership === "Own") && (
                <>
                  {/* On Hire Location (Port) */}
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-1 font-medium text-gray-700 dark:text-white">On Hire Location (Port)</Label>
                    <select
                      name="onHireLocation"
                      value={formData.onHireLocation}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">Select Port</option>
                      {allPorts.map((port) => (
                        <option key={port.id} value={port.portName}>
                          {port.portName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-1 font-medium text-gray-700 dark:text-white">On Hire Depot</Label>
                    <select
                      value={selectedHireDepotId}
                      onChange={e => {
                        const selectedId = Number(e.target.value);
                        setSelectedHireDepotId(selectedId);

                        // Also update the formData with the selected depot ID and name
                        const selectedDepot = hireDepotOptions.find(opt => opt.value === selectedId);
                        setFormData(prev => ({
                          ...prev,
                          onHireDepotaddressbookId: selectedId.toString(),
                          onHireDepotName: selectedDepot?.companyName || ""
                        }));
                      }}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-700 focus:border-blue-500 cursor-pointer"
                      disabled={!formData.onHireLocation}
                    >
                      <option value="">
                        {!formData.onHireLocation
                          ? "Select a port first"
                          : hireDepotOptions.length === 0
                            ? "No depot terminals available for this port"
                            : "Select Hire Depot"}
                      </option>
                      {hireDepotOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {formData.onHireLocation && hireDepotOptions.length === 0 && (
                      <p className="mt-1 text-xs text-amber-500">
                        No companies with business type "Deport Terminal" found for this port.
                        Please add one in Address Book first.
                      </p>
                    )}
                  </div>

                </>
              )}
            </div>

            {/* Leasing Info Section - only shows when Lease is selected */}
            {formData.ownership === "Lease" && (
              <div className="col-span-2 mt-4">
                <Label className="text-white text-sm font-medium mb-2">Leasing Info</Label>
                <div className="bg-white dark:bg-neutral-900 p-4 rounded border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full table-fixed mb-3" style={{ tableLayout: "fixed", width: "100%" }}>
                    <thead>
                      <tr>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">Leasing Ref. No</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">Lessor Name</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[100px]">On Hire Date</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">On Hire Location</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">On Hire Depot</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[100px]">Off Hire Date</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[90px]">Lease Rent</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[100px]">remarks</th>
                        <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[80px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leasingRecords.map((record, index) => (
                        <tr key={index} className="border-t border-neutral-700">
                          <td className="py-2 pr-1">
                            <input
                              type="text"
                              value={record.leasingRef}
                              onChange={e => {
                                const updated = [...leasingRecords];
                                updated[index].leasingRef = e.target.value;
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-1">
                            <select
                              value={record.leasoraddressbookId}
                              onChange={(e) => {
                                const updated = [...leasingRecords];
                                updated[index].leasoraddressbookId = e.target.value;
                                const selected = leasoraddressbookIds.find(l => l.id.toString() === e.target.value);
                                updated[index].leasorName = selected?.companyName || "";
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            >
                              <option value="">Select</option>
                              {leasoraddressbookIds.map((leasor) => (
                                <option key={leasor.id} value={leasor.id} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-700">
                                  {leasor.companyName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-1">
                            <input
                              type="date"
                              value={record.onHireDate}
                              onChange={e => {
                                const updated = [...leasingRecords];
                                updated[index].onHireDate = e.target.value;
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            />
                          </td>
                          {/* On Hire Location (Port) */}
                          <td className="py-2 pr-1">
                            <select
                              value={record.portId || ""}
                              onChange={(e) => {
                                const selectedPortId = e.target.value;
                                const selectedPort = allPorts.find((p) => p.id.toString() === selectedPortId);
                                const updated = [...leasingRecords];
                                updated[index].portId = selectedPortId;
                                updated[index].onHireLocation = selectedPort?.portName || "";
                                updated[index].onHireDepotaddressbookId = "";
                                updated[index].onHireDepotName = "";
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                                setCurrentLeasingRecordIndex(index);
                                if (selectedPort) {
                                  filterDepotsByPort(selectedPort.id);
                                }
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            >
                              <option value="">Select</option>
                              {allPorts.map((port) => (
                                <option key={port.id} value={port.id.toString()} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-700">
                                  {port.portName}
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* On Hire Depot */}
                          <td className="py-2 pr-1">
                            <select
                              value={record.onHireDepotaddressbookId || ""}
                              onChange={(e) => {
                                const selectedDepotId = e.target.value;
                                const selectedDepot = hireDepotOptions.find((opt) => opt.value.toString() === selectedDepotId);
                                const updated = [...leasingRecords];
                                updated[index].onHireDepotaddressbookId = selectedDepotId;
                                updated[index].onHireDepotName = selectedDepot?.companyName || selectedDepot?.label?.split(" - ")[0] || "";
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              disabled={!record.portId}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            >
                              <option value="">
                                {!record.portId
                                  ? "Select a port first"
                                  : currentLeasingRecordIndex !== index
                                    ? "Click port again to load depots"
                                    : hireDepotOptions.length === 0
                                      ? "No depot terminals available for this port"
                                      : "Select Depot"}
                              </option>
                              {(currentLeasingRecordIndex === index || record.onHireDepotaddressbookId) &&
                                hireDepotOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value} className="text-gray-900 dark:text-white bg-white dark:bg-neutral-700">
                                    {opt.label}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="py-2 pr-1">
                            <input
                              type="date"
                              value={record.offHireDate}
                              onChange={e => {
                                const updated = [...leasingRecords];
                                updated[index].offHireDate = e.target.value;
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-1">
                            <input
                              type="text"
                              placeholder="Lease Rent"
                              value={record.leaseRentPerDay}
                              onChange={e => {
                                const updated = [...leasingRecords];
                                updated[index].leaseRentPerDay = e.target.value;
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-1">
                            <input
                              type="text"
                              placeholder="remarks"
                              value={record.remarks}
                              onChange={e => {
                                const updated = [...leasingRecords];
                                updated[index].remarks = e.target.value;
                                updated[index].isModified = true;
                                setLeasingRecords(updated);
                              }}
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                            />
                          </td>
                          <td className="py-2">
                            <span
                              onClick={() => handleDeleteLeasingRecord(index)}
                              className="text-red-500 hover:text-red-400 cursor-pointer text-xs cursor-pointer"
                            >
                              Delete
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <Button
                    type="button"
                    onClick={handleAddLeasingRecord}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors cursor-pointer"
                  >
                    + Add Leasing Record
                  </Button>
                </div>
              </div>
            )}

            {/* Periodic Tank Certificates Section */}
            <div className="col-span-2 mt-4">
              <Label className="text-white text-sm font-medium mb-2">Periodic Tank Certificates</Label>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded border border-neutral-200 dark:border-neutral-700">
                <table className="w-full mb-3 table-fixed" style={tableStyle}>
                  <thead>
                    <tr>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">
                        Inspection Date
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">
                        Inspection Type
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[120px]">
                        Next Due Date
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[240px]">
                        Certificate File
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[70px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((cert, idx) => (
                      <tr key={idx} className="border-t border-neutral-700">
                        <td className="py-2 min-w-[150px] pr-2">
                          <input
                            type="date"
                            value={cert.inspectionDate}
                            onChange={(e) => {
                              const newCerts = [...certificates];
                              newCerts[idx].inspectionDate = e.target.value;
                              newCerts[idx].isModified = true;
                              setCertificates(newCerts);
                            }}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 min-w-[150px] pr-2">
                          <select
                            value={cert.inspectionType}
                            onChange={(e) => {
                              const newCerts = [...certificates];
                              newCerts[idx].inspectionType = e.target.value;
                              setCertificates(newCerts);
                            }}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500"
                          >
                            <option value="Periodic 2.5Yr" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-700">Periodic 2.5Yr</option>
                            <option value="Periodic 5Yr" className="text-gray-900 dark:text-white bg-white dark:bg-neutral-700">Periodic 5Yr</option>
                          </select>
                        </td>
                        <td className="py-2 min-w-[150px] pr-2">
                          <input
                            type="date"
                            value={cert.nextDueDate}
                            onChange={(e) => {
                              const newCerts = [...certificates];
                              newCerts[idx].nextDueDate = e.target.value;
                              setCertificates(newCerts);
                            }}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 text-white min-w-[240px] pr-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="file"
                              onChange={(e) => {
                                const newCerts = [...certificates];
                                newCerts[idx].certificateFile = e.target.files?.[0] || null;
                                setCertificates(newCerts);
                              }}
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-neutral-600 file:text-white cursor-pointer"
                            />
                            {cert.certificate && !cert.certificateFile && (
                              <a
                                href={`http://localhost:8000/tankcertificate/uploads/certificates/${cert.certificate}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center"
                              >
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path>
                                  <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"></path>
                                </svg>
                                View certificate: {cert.certificate.split('-').pop()}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2 min-w-[70px]">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteCertificate(idx)}
                            className="text-red-500 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button
                  type="button"
                  onClick={() =>
                    setCertificates([
                      ...certificates,
                      {
                        inspectionDate: "",
                        inspectionType: "Periodic 2.5Yr",
                        nextDueDate: "",
                        certificateFile: null,
                      },
                    ])
                  }
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors cursor-pointer"
                >
                  + Add Certificate
                </Button>
              </div>
            </div>

            {/* On Hire Reports Section */}
            <div className="col-span-2 mt-4">
              <Label className="text-white text-sm font-medium mb-2">On Hire Reports</Label>
              <div className="bg-white dark:bg-neutral-900 p-4 rounded border border-neutral-200 dark:border-neutral-700">
                <table className="w-full mb-3 table-fixed" style={tableStyle}>
                  <thead>
                    <tr>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[150px]"> {/* From 200px to 150px */}
                        Report Date
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[350px]"> {/* From 400px to 350px */}
                        Report Document
                      </th>
                      <th className="text-left text-neutral-400 text-xs font-medium pb-2 w-[70px]"> {/* From 80px to 70px */}
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report, idx) => (
                      <tr key={idx} className="border-t border-neutral-700">
                        <td className="py-2 min-w-[200px] pr-2">
                          <input
                            type="date"
                            value={report.reportDate}
                            onChange={(e) => {
                              const newReports = [...reports];
                              newReports[idx].reportDate = e.target.value;
                              setReports(newReports);
                            }}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 text-white min-w-[350px] pr-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="file"
                              onChange={(e) => {
                                const newReports = [...reports];
                                newReports[idx].reportDocument = e.target.files?.[0] || null;
                                setReports(newReports);
                              }}
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-700 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-600 focus:border-blue-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-neutral-600 file:text-white cursor-pointer"
                            />
                            {report.reportDocumentName && (
                              <a
                                href={`http://localhost:8000/tankcertificate/uploads/reports/${report.reportDocumentName}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center"
                              >
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path>
                                  <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"></path>
                                </svg>
                                View report: {report.reportDocumentName.split('-').pop()}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2 min-w-[70px]">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteReport(idx)}
                            className="text-red-500 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                          >
                            Delete

                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Button
                  type="button"
                  onClick={() =>
                    setReports([
                      ...reports,
                      {
                        reportDate: "",
                        reportDocument: null,
                      },
                    ])
                  }
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors cursor-pointer"
                >
                  + Add Report
                </Button>
              </div>
            </div>

            <div className="flex justify-center gap-3 mt-6">
              <Button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded text-sm transition-colors cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors cursor-pointer"
              >
                {isEditMode ? "Update Container" : "Add Container"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddInventoryForm;
