'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Search, Trash2, Plus, History, Download, Eye, MoreVertical } from 'lucide-react';
import axios from 'axios';
import AddShipmentForm from './AddShipmentForm';
import ViewShipmentModal from './ViewShipmentModal';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateCroPdf } from './generateCroPdf';
import { generateBlPdf, type BLType, type BLFormData } from './generateBlPdf';
import { apiFetch } from '../../../lib/api';


interface Shipment {
  id: number;
  [key: string]: any;
}




const AllShipmentsPage = () => {

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewShipment, setViewShipment] = useState<any>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [containerSearch, setContainerSearch] = useState('');
  const [blGroups, setBlGroups] = useState<string[][]>([]);

  // --- helpers (place near getAllContainersFromForm / above Multi BL UI) ---
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));



  // Add state for selected containers
  const [selectedContainers, setSelectedContainers] = useState<any[]>([]);

  // Add state for CRO modal
  const [showCroModal, setShowCroModal] = useState(false);
  const [croFormData, setCroFormData] = useState({
    shipmentId: 0,
    date: '', // Will be set only if user fills it or uses existing date
    houseBL: '',
    shipperRefNo: '',
    shipper: '',
    releaseDate: '',
    pol: '',
    finalDestination: '',
    tankPrep: '',
    pod: '',
    depotName: '',
    depotAddress: '',
    depotContact: '',
    depotEmail: '',
    depotCountry: '',
    depotMobile: '',
    containers: [] as any[]
  });

  // Add state for BL modal with schema fields
  const [showBlModal, setShowBlModal] = useState(false);
  const [currentBlType, setCurrentBlType] = useState<BLType>('original');
  const [blJustSaved, setBlJustSaved] = useState(false);
  const [blGenerationStatus, setBlGenerationStatus] = useState<{ [key: number]: { hasDraftBlGenerated: boolean, hasOriginalBLGenerated: boolean, firstGenerationDate: string | null } }>({});
  const [croGenerationStatus, setCroGenerationStatus] = useState<{ [key: number]: { hasCroGenerated: boolean, firstCroGenerationDate: string | null } }>({});

  // Add state to track copy downloads for each shipment and BL type
  const [blCopyDownloadStatus, setBlCopyDownloadStatus] = useState<{
    [shipmentId: number]: {
      [blType in BLType]: {
        originalDownloaded: boolean;
        secondCopyDownloaded: boolean;
        thirdCopyDownloaded: boolean;
      }
    }
  }>({});
  const [blFormData, setBlFormData] = useState({
    // Core BillofLading schema fields
    shippersName: '',
    shippersAddress: '',
    shippersContactNo: '',
    shippersEmail: '',
    shipperInfo: '', // Combined field
    consigneeName: '',
    consigneeAddress: '',
    consigneeContactNo: '',
    consigneeEmail: '',
    consigneeInfo: '', // Combined field
    notifyPartyName: '',
    notifyPartyAddress: '',
    notifyPartyContactNo: '',
    notifyPartyEmail: '',
    notifyPartyInfo: '', // Combined field
    containerNos: '',
    sealNo: '',
    grossWt: '',
    netWt: '',
    billofLadingDetails: '',
    freightPayableAt: '',
    deliveryAgentName: '',
    deliveryAgentAddress: '',
    Vat: '',
    deliveryAgentContactNo: '',
    deliveryAgentEmail: '',
    deliveryAgentInfo: '', // Combined field
    freightAmount: '',
    // Empty charges and fees field by default
    chargesAndFees: '',
    // Fields fetched from shipment
    portOfLoading: '',
    portOfDischarge: '',
    vesselNo: '',
    // Container-specific fields
    containers: [] as Array<{ containerNumber: string, sealNumber: string, grossWt: string, netWt: string }>,
    // Additional fields for form management
    shipmentId: 0,
    blType: 'original' as BLType,
    // Add date field for BL generation
    date: '' // Will be set only if user fills it or uses existing date
  });




  // Add state for allMovements
  const [allMovements, setAllMovements] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    id: undefined,
    status: true,
    quotationRefNo: '',
    referenceNumber: '',
    masterBL: '',
    houseBL: '', // Add houseBL field
    shippingTerm: '',
    date: '', // Will be set only if user fills it or uses existing date
    jobNumber: '',

    // Customer/Company fields
    customerName: '',
    customerDisplayName: '', // Add display name field
    customerId: '',
    consigneeName: '',
    consigneeId: '',
    consigneeAddressBookId: '',
    shipperName: '',
    shipperId: '',
    shipperAddressBookId: '',
    carrierName: '',
    carrierId: '',
    carrierAddressBookId: '',

    // Product fields
    productId: '',
    productName: '',
    productDisplayName: '', // Add display name field

    // Port fields
    portOfLoading: '',
    portOfLoadingName: '', // Add display name field
    portOfDischarge: '',
    portOfDischargeName: '', // Add display name field
    podPortId: '',
    polPortId: '',
    enableTranshipmentPort: false,
    transhipmentPortName: '',
    transhipmentPortId: '',

    // Agent fields
    expHandlingAgent: '',
    expHandlingAgentId: '',
    expHandlingAgentAddressBookId: '',
    impHandlingAgent: '',
    impHandlingAgentId: '',
    impHandlingAgentAddressBookId: '',

    // Depot fields
    emptyReturnDepot: '',
    emptyReturnDepotId: '',
    emptyReturnDepotAddressBookId: '',

    // Container fields
    quantity: '',
    containerNumber: '',
    capacity: '',
    tare: '',

    // Date fields
    gateClosingDate: '',
    sobDate: '',
    etaToPod: '',
    estimatedEmptyReturnDate: '',
    gsDate: '',
    sob: '',
    etaTopod: '',
    estimateDate: '',

    // Free days and detention
    freeDays1: '',
    detentionRate1: '',
    freeDays2: '',
    detentionRate2: '',

    // Vessel
    vesselName: '',

    // Tank preparation
    tankPreparation: '',
  });

  // === MULTI BL: state & helpers ===
  type BLType = 'draft' | 'original' | 'seaway';

  // how many BLs to create (e.g., 4)
  const [blCount, setBlCount] = React.useState<number>(1);




  // has the “groups” UI been initialized?
  const [multiBlStageReady, setMultiBlStageReady] = React.useState(false);
  const downloadBlockedByAssign = multiBlStageReady && blGroups.length > 1;



  function AssignedBlDownloads({
    shipmentId,
    blType,
    label,
    onClickDownload,
  }: {
    shipmentId: number;
    blType: BLType;
    label: string;
    onClickDownload: (index: number) => void;
  }) {
    const [groups, setGroups] = React.useState<string[][]>([]);
    React.useEffect(() => {
      let mounted = true;
      fetchBlAssignments(shipmentId, blType).then((g) => {
        if (mounted) setGroups(g);
      });
      return () => { mounted = false; };
    }, [shipmentId, blType]);

    if (!groups?.length) return null;
    const ord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

    return (
      <>
        <div className="px-3 py-1 text-xs text-gray-500">
          Assigned {groups.length} BL(s) – {label}
        </div>
        {groups.map((_, idx) => (
          <DropdownMenuItem
            key={`${blType}-split-${idx}`}
            className="cursor-pointer text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              onClickDownload(idx);
            }}
          >
            Download {ord(idx + 1)} BL ({label})
          </DropdownMenuItem>
        ))}
      </>
    );
  }



  /** GET persisted container groups for a shipment + BL type */
  const fetchBlAssignments = async (
    shipmentId: number,
    blType: BLType
  ): Promise<string[][]> => {
    try {
      // apiFetch returns parsed JSON directly (not { data })
      const data = await apiFetch(
        `http://localhost:8000/shipment/assignments/${shipmentId}/${blType}`,
        { method: 'GET' }
      );
      return Array.isArray((data as any)?.groups) ? (data as any).groups : [];
    } catch {
      return [];
    }
  };


  /** PUT (create/replace) groups for a shipment + BL type */
  const saveBlAssignments = async (
    shipmentId: number,
    blType: BLType,
    groups: string[][]
  ) => {
    // apiFetch auto-JSONs plain objects, adds auth headers, and throws on non-2xx
    await apiFetch(
      `http://localhost:8000/shipment/assignments/${shipmentId}/${blType}`,
      {
        method: 'PUT',
        body: { groups },
      }
    );
  };




  // read all container numbers visible in this form (deduped)
  const getAllContainersFromForm = (): string[] => {
    const fromArray = (blFormData?.containers || [])
      .map((c: any) => c?.containerNumber)
      .filter(Boolean);
    const fromString = (Array.isArray(blFormData?.containerNos)
      ? blFormData.containerNos
      : (blFormData?.containerNos || ''))
      .toString()
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    return Array.from(new Set([...fromArray, ...fromString]));
  };

  // Total containers available for this shipment (deduped)
  const totalContainers = React.useMemo(
    () => getAllContainersFromForm().length,
    // if getAllContainersFromForm has no deps, you can also depend on blFormData
    // but the function itself already reads blFormData safely
    [blFormData]
  );
  // init N groups; preserve any existing picks if count changes
  // init N groups; preserve any existing picks if count changes
  const initBlGroups = (count: number) => {
    const safeCount = clamp(count, 1, Math.max(1, totalContainers));  // <- enforce cap here too
    setBlGroups(prev => {
      const next = Array.from({ length: safeCount }, (_, i) => (prev[i] ? [...prev[i]] : []));
      return next.map(g => Array.from(new Set(g)));
    });
    setMultiBlStageReady(true);
  };


  // toggle container in a group and ensure container exists in only ONE group
  const toggleContainerInGroup = (groupIdx: number, containerNumber: string) => {
    setBlGroups(prev => {
      const next = prev.map(g => g.filter(n => n !== containerNumber)); // remove from all groups
      const alreadyIn = prev[groupIdx]?.includes(containerNumber);
      if (!alreadyIn) next[groupIdx] = [...(next[groupIdx] || []), containerNumber];
      return next;
    });
  };



  // Load groups for the requested BL type; if none and not draft, fall back to draft
  const hydrateAssignmentsForModal = async (shipmentId: number, blType: BLType) => {
    try {
      // Try the current BL type first
      const savedGroups = await fetchBlAssignments(shipmentId, blType);
      if (savedGroups.length > 0) {
        setBlCount(savedGroups.length);
        setBlGroups(savedGroups);
        setMultiBlStageReady(true);
        return;
      }

      // If nothing saved for this type, and we're NOT on draft, try to copy from draft
      if (blType !== 'draft') {
        const draftGroups = await fetchBlAssignments(shipmentId, 'draft');
        if (draftGroups.length > 0) {
          setBlCount(draftGroups.length);
          setBlGroups(draftGroups);
          setMultiBlStageReady(true);
          return;
        }
      }

      // Nothing to show
      setBlCount(1);
      setBlGroups([]);
      setMultiBlStageReady(false);
    } catch {
      setBlCount(1);
      setBlGroups([]);
      setMultiBlStageReady(false);
    }
  };




  const fetchShipments = async () => {
    try {
      const res = await axios.get('http://localhost:8000/shipment');

      // Enhanced sorting with better date handling and fallback to ID
      const sortedData = res.data.sort((a: any, b: any) => {
        // Try to get valid dates from multiple possible fields
        const getValidDate = (item: any) => {
          const dateFields = ['date', 'createdAt', 'updatedAt'];
          for (const field of dateFields) {
            if (item[field]) {
              const date = new Date(item[field]);
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
          }
          return new Date(0); // Fallback to epoch if no valid date
        };

        const dateA = getValidDate(a);
        const dateB = getValidDate(b);

        // First sort by date (descending)
        const dateComparison = dateB.getTime() - dateA.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }

        // If dates are equal, sort by job number (descending) as secondary sort
        if (a.jobNumber && b.jobNumber) {
          // Extract numeric part from job number (e.g., "25/00005" -> 5)
          const getJobNumber = (jobNumber: string) => {
            const match = jobNumber.match(/\/(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          };

          const jobNumA = getJobNumber(a.jobNumber);
          const jobNumB = getJobNumber(b.jobNumber);

          if (jobNumA !== jobNumB) {
            return jobNumB - jobNumA; // Descending order
          }
        }

        // If job numbers are equal or don't exist, sort by ID (descending) as final fallback
        return (b.id || 0) - (a.id || 0);
      });

      // Debug: Log the raw data first, then sorted data
      console.log('Raw shipments data:', res.data.map((s: any) => ({
        id: s.id,
        date: s.date,
        jobNumber: s.jobNumber,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })));

      console.log('Sorted shipments:', sortedData.map((s: any) => ({
        id: s.id,
        date: s.date,
        jobNumber: s.jobNumber,
        formattedDate: new Date(s.date).toLocaleDateString()
      })));

      setShipments(sortedData);

      // Load BL generation status for all shipments
      await fetchBlGenerationStatuses(sortedData);

      // Load CRO generation status for all shipments
      await fetchCroGenerationStatuses(sortedData);

      // Initialize copy download status for all shipments by checking database
      await initializeBlCopyDownloadStatus(sortedData);
    } catch (err) {
      console.error('Failed to fetch shipments', err);
    }
  };

  // Function to initialize BL copy download status - check database for existing BLs
  const initializeBlCopyDownloadStatus = async (shipments: any[]) => {
    const initialStatus: typeof blCopyDownloadStatus = {};

    // Initialize with default values
    shipments.forEach((shipment) => {
      initialStatus[shipment.id] = {
        original: {
          originalDownloaded: false,
          secondCopyDownloaded: false,
          thirdCopyDownloaded: false
        },
        draft: {
          originalDownloaded: false,
          secondCopyDownloaded: false,
          thirdCopyDownloaded: false
        },
        seaway: {
          originalDownloaded: false,
          secondCopyDownloaded: false,
          thirdCopyDownloaded: false
        }
      };
    });

    // Check database for existing BL records to determine originalDownloaded status
    for (const shipment of shipments) {
      try {
        const response = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipment.id}`);
        if (response.data) {
          // Handle both array and single object responses
          const blRecords = Array.isArray(response.data) ? response.data : [response.data];

          // Check each BL type for existing records
          blRecords.forEach((bl: any) => {
            if (bl.blType && initialStatus[shipment.id]) {
              // If BL record exists, mark originalDownloaded as true
              if (initialStatus[shipment.id][bl.blType as BLType]) {
                initialStatus[shipment.id][bl.blType as BLType].originalDownloaded = true;
              }
            }
          });
        }
      } catch (error) {
        console.log(`No BL records found for shipment ${shipment.id}`);
        // Keep default false values for this shipment
      }
    }

    setBlCopyDownloadStatus(initialStatus);
  };

  // Function to fetch BL generation statuses for all shipments
  const fetchBlGenerationStatuses = async (shipments: any[]) => {
    try {
      const statusMap: { [key: number]: { hasDraftBlGenerated: boolean, hasOriginalBLGenerated: boolean, firstGenerationDate: string | null } } = {};

      // Fetch BL status for each shipment
      for (const shipment of shipments) {
        try {
          const response = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipment.id}`);
          if (response.data) {
            statusMap[shipment.id] = {
              hasDraftBlGenerated: response.data.hasDraftBlGenerated || false,
              hasOriginalBLGenerated: response.data.hasOriginalBLGenerated || false,
              firstGenerationDate: response.data.firstGenerationDate || null
            };
          } else {
            statusMap[shipment.id] = {
              hasDraftBlGenerated: false,
              hasOriginalBLGenerated: false,
              firstGenerationDate: null
            };
          }
        } catch (error) {
          // If no BL exists, set default values
          statusMap[shipment.id] = {
            hasDraftBlGenerated: false,
            hasOriginalBLGenerated: false,
            firstGenerationDate: null
          };
        }
      }

      setBlGenerationStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch BL generation statuses:', error);
    }
  };

  // Function to fetch CRO generation statuses for all shipments
  const fetchCroGenerationStatuses = async (shipments: any[]) => {
    try {
      const statusMap: { [key: number]: { hasCroGenerated: boolean, firstCroGenerationDate: string | null } } = {};

      // Set CRO status based on shipment data
      for (const shipment of shipments) {
        statusMap[shipment.id] = {
          hasCroGenerated: shipment.hasCroGenerated || false,
          firstCroGenerationDate: shipment.firstCroGenerationDate || null
        };
      }

      setCroGenerationStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch CRO generation statuses:', error);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  useEffect(() => {
    // Fetch allMovements data from backend (update the URL as needed)
    axios.get('http://localhost:8000/shipment')
      .then(res => setAllMovements(res.data))
      .catch(err => console.error('Failed to fetch movements', err));
  }, []);

  const handleDelete = async (id: number) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this shipment?');
    if (!confirmDelete) return;

    try {
      await apiFetch(`http://localhost:8000/shipment/${id}`, {
        method: 'DELETE',
      });
      await fetchShipments();
    } catch (err) {
      console.error('Failed to delete shipment', err);
      alert('Error deleting shipment.');
    }
  };

  const handleEdit = async (shipment: any) => {
    // Pre-fetch required data for proper display names
    let customerName = '';
    let productDisplayName = '';
    let consigneeName = '';
    let shipperName = '';
    let carrierName = '';
    let portOfLoadingName = '';
    let portOfDischargeName = '';

    try {
      // Fetch customer name
      if (shipment.custAddressBookId) {
        const customerRes = await fetch(`http://localhost:8000/addressbook/${shipment.custAddressBookId}`);
        const customerData = await customerRes.json();
        customerName = customerData.companyName || '';
      }

      // Fetch product info
      if (shipment.productId) {
        const productRes = await fetch(`http://localhost:8000/products`);
        const productsData = await productRes.json();
        const product = productsData.find((p: any) => p.id === shipment.productId);
        if (product) {
          productDisplayName = `${product.productId} - ${product.productName} - ${product.productType}`;
        }
      }

      // Fetch consignee name
      if (shipment.consigneeAddressBookId) {
        const consigneeRes = await fetch(`http://localhost:8000/addressbook/${shipment.consigneeAddressBookId}`);
        const consigneeData = await consigneeRes.json();
        consigneeName = consigneeData.companyName || '';
      }

      // Fetch shipper name
      if (shipment.shipperAddressBookId) {
        const shipperRes = await fetch(`http://localhost:8000/addressbook/${shipment.shipperAddressBookId}`);
        const shipperData = await shipperRes.json();
        shipperName = shipperData.companyName || '';
      }

      // Fetch carrier name
      if (shipment.carrierAddressBookId) {
        const carrierRes = await fetch(`http://localhost:8000/addressbook/${shipment.carrierAddressBookId}`);
        const carrierData = await carrierRes.json();
        carrierName = carrierData.companyName || '';
      }

      // Fetch port names
      const portsRes = await fetch("http://localhost:8000/ports");
      const portsData = await portsRes.json();

      if (shipment.polPortId) {
        const polPort = portsData.find((p: any) => p.id === shipment.polPortId);
        portOfLoadingName = polPort?.portName || '';
      }

      if (shipment.podPortId) {
        const podPort = portsData.find((p: any) => p.id === shipment.podPortId);
        portOfDischargeName = podPort?.portName || '';
      }

      // Set selected containers with proper port names (using fetched portsData)
      const existingContainers = shipment.containers?.map((container: any) => {
        // Find the port info from the fetched ports data
        const portInfo = portsData.find((port: any) => port.id === container.portId);

        return {
          containerNumber: container.containerNumber,
          capacity: container.capacity,
          tare: container.tare,
          inventoryId: container.inventoryId,
          portId: container.portId,
          depotName: container.depotName || '',
          port: portInfo ? { id: portInfo.id, portName: portInfo.portName } : (container.port || null),
        };
      }) || [];

      setSelectedContainers(existingContainers);

    } catch (err) {
      console.error("Failed to fetch data for edit mode:", err);
      // Set empty containers as fallback
      setSelectedContainers([]);
    }

    setFormData({
      id: shipment.id,
      status: true,
      quotationRefNo: shipment.quotationRefNumber || '',
      date: shipment.date ? new Date(shipment.date).toISOString().split('T')[0] : '',
      jobNumber: shipment.jobNumber || '',
      referenceNumber: shipment.refNumber || '',
      masterBL: shipment.masterBL || '',
      houseBL: shipment.houseBL || '', // Add houseBL field

      // FIX: Ensure shipping term is passed correctly
      shippingTerm: shipment.shippingTerm || '',

      // Field names must match what the form expects
      customerName: shipment.custAddressBookId?.toString() || '',
      customerDisplayName: customerName, // Set the display name
      customerId: shipment.custAddressBookId?.toString() || '',
      consigneeName: consigneeName, // Set the actual name
      consigneeId: shipment.consigneeAddressBookId?.toString() || '',
      consigneeAddressBookId: shipment.consigneeAddressBookId,
      shipperName: shipperName, // Set the actual name
      shipperId: shipment.shipperAddressBookId?.toString() || '',
      shipperAddressBookId: shipment.shipperAddressBookId,
      carrierId: shipment.carrierAddressBookId?.toString() || '',
      carrierAddressBookId: shipment.carrierAddressBookId,
      carrierName: carrierName, // Set the actual name

      // FIX: Ensure productId is passed as number, not string
      productId: shipment.productId || '', // Keep as number/empty string
      productName: productDisplayName, // Set the display name
      productDisplayName: productDisplayName, // Also set this for the form

      // FIX: Port fields - use the actual port IDs for the select components and set display names
      polPortId: shipment.polPortId,
      podPortId: shipment.podPortId,
      portOfLoading: shipment.polPortId?.toString() || '', // Use ID for selection
      portOfLoadingName: portOfLoadingName, // Set display name for the input field
      portOfDischarge: shipment.podPortId?.toString() || '', // Use ID for selection
      portOfDischargeName: portOfDischargeName, // Set display name for the input field
      enableTranshipmentPort: !!shipment.transhipmentPortId,
      transhipmentPortName: shipment.transhipmentPortId?.toString() || '',
      transhipmentPortId: shipment.transhipmentPortId?.toString() || '',

      // Free days and detention - Form expects these exact field names
      freeDays1: shipment.polFreeDays || '',
      detentionRate1: shipment.polDetentionRate || '',
      freeDays2: shipment.podFreeDays || '',
      detentionRate2: shipment.podDetentionRate || '',

      // Handling agents - Form expects these exact field names
      expHandlingAgent: shipment.expHandlingAgentAddressBookId?.toString() || '',
      expHandlingAgentId: shipment.expHandlingAgentAddressBookId?.toString() || '',
      expHandlingAgentAddressBookId: shipment.expHandlingAgentAddressBookId,
      impHandlingAgent: shipment.impHandlingAgentAddressBookId?.toString() || '',
      impHandlingAgentId: shipment.impHandlingAgentAddressBookId?.toString() || '',
      impHandlingAgentAddressBookId: shipment.impHandlingAgentAddressBookId,

      // FIX: Depot - use the correct field names from the backend
      emptyReturnDepotAddressBookId: shipment.emptyReturnDepotAddressBookId,
      emptyReturnDepot: shipment.emptyReturnDepotAddressBookId?.toString() || '',
      emptyReturnDepotId: shipment.emptyReturnDepotAddressBookId?.toString() || '',

      // Container fields
      quantity: shipment.quantity || '',
      containerNumber: '',
      capacity: '',
      tare: '',

      // Date fields - Form expects these exact field names
      gateClosingDate: shipment.gsDate ? new Date(shipment.gsDate).toISOString().split('T')[0] : '',
      sobDate: shipment.sob ? new Date(shipment.sob).toISOString().split('T')[0] : '',
      etaToPod: shipment.etaTopod ? new Date(shipment.etaTopod).toISOString().split('T')[0] : '',
      estimatedEmptyReturnDate: shipment.estimateDate ? new Date(shipment.estimateDate).toISOString().split('T')[0] : '',

      // Additional fields for the useEffect - pass the raw date strings
      gsDate: shipment.gsDate,
      sob: shipment.sob,
      etaTopod: shipment.etaTopod,
      estimateDate: shipment.estimateDate,

      // Vessel name
      vesselName: shipment.vesselName || '',

      // Tank preparation field
      tankPreparation: shipment.tankPreparation || '',
    });

    setShowModal(true);
  };

  // Handle view shipment
  const handleView = (shipment: any) => {
    setViewShipment(shipment);
    setShowViewModal(true);
  };

  const handleDownloadPDF = async (shipmentId: number, containers: any[]) => {
    const getSize = (inventoryId: number) => {
      const container = allMovements.find(m => m.inventoryId === inventoryId);
      return container?.inventory?.containerSize || "N/A";
    };

    await generateCroPdf(shipmentId, containers);
  };

  // Handle opening CRO modal with pre-filled data
  const handleOpenCroModal = async (shipment: any) => {
    try {
      // Fetch fresh data for the shipment
      const [addressBooksRes] = await Promise.all([
        axios.get(`http://localhost:8000/addressbook`),
      ]);

      const addressBooks = addressBooksRes.data;

      // Get company information
      const shipper = addressBooks.find(
        (ab: any) => ab.id === shipment.shipperAddressBookId
      );

      const primaryDepot = addressBooks.find(
        (ab: any) => ab.companyName === (shipment.containers?.[0]?.depotName || "Unknown Depot")
      ) || addressBooks.find(
        (ab: any) => ab.name === (shipment.containers?.[0]?.depotName || "Unknown Depot")
      ) || addressBooks.find(
        (ab: any) => {
          const depotName = shipment.containers?.[0]?.depotName || "Unknown Depot";
          return ab.companyName?.includes(depotName) || depotName.includes(ab.companyName);
        }
      );

      // Pre-fill form data with current shipment data
      setCroFormData({
        shipmentId: shipment.id,
        date: '', // Will be filled by user as needed
        houseBL: shipment.houseBL || shipment.masterBL || '',
        shipperRefNo: shipment.refNumber || '',
        shipper: shipper?.companyName || '',
        releaseDate: shipment.gsDate ? new Date(shipment.gsDate).toISOString().split('T')[0] : '',
        pol: shipment.polPort?.portName || '',
        finalDestination: shipment.podPort?.portName || '',
        tankPrep: shipment.tankPreparation || 'N/A',
        pod: shipment.podPort?.portName || '',
        depotName: shipment.containers?.[0]?.depotName || 'Unknown Depot',
        depotAddress: primaryDepot?.address || '',
        depotContact: primaryDepot?.phone || '',
        depotEmail: primaryDepot?.email || '',
        depotCountry: primaryDepot?.country?.name || primaryDepot?.country?.countryName || primaryDepot?.country || '',
        depotMobile: (() => {
          // First check contacts array for mobile number
          if (primaryDepot?.contacts && Array.isArray(primaryDepot.contacts) && primaryDepot.contacts.length > 0) {
            const firstContact = primaryDepot.contacts[0];
            // Look specifically for mobile number in contacts
            if (firstContact?.mobileNo) return firstContact.mobileNo;
            if (firstContact?.mobile) return firstContact.mobile;
            // Don't use phoneNumber from contacts as it might be landline
          }
          // If not found in contacts, check direct mobile fields only (avoid phone/contact fields)
          return primaryDepot?.mobile || primaryDepot?.mobileNumber || '';
        })(),
        containers: shipment.containers || []
      });

      setShowCroModal(true);
      const saved = croGenerationStatus[shipment.id]?.firstCroGenerationDate;
      const initialDate =
        saved
          ? new Date(saved).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

      setCroFormData(prev => ({
        ...prev,
        date: prev.date || initialDate
      }));

    } catch (error) {
      console.error('Error loading CRO data:', error);
    }
  };



  // Handle editing shipment from CRO modal
  const handleEditShipmentFromCro = async () => {
    try {
      // Find the current shipment data
      const shipmentToEdit = shipments.find(s => s.id === croFormData.shipmentId);
      if (shipmentToEdit) {
        // Close CRO modal first
        setShowCroModal(false);
        // Use existing handleEdit function to open edit form
        await handleEdit(shipmentToEdit);
      }
    } catch (error) {
      console.error('Error opening edit form:', error);
    }
  };

  // Handle downloading PDF with current form data and consistent date logic
  const handleDownloadCroPdf = async () => {
    try {
      // 1) Pick the date: user edit > previously saved > today
      const today = new Date().toISOString().split('T')[0];
      const saved = croGenerationStatus[croFormData.shipmentId]?.firstCroGenerationDate;
      const formDate = (croFormData.date || (saved ? new Date(saved).toISOString().split('T')[0] : '') || today);

      // 2) Persist to DB (ensure backend stores this in your CRO "date" column)
      const updatedShipment = await apiFetch(
        `http://localhost:8000/shipment/mark-cro-generated/${croFormData.shipmentId}`,
        {
          method: 'POST',
          body: { date: formDate }, // <-- IMPORTANT: send the chosen date
        }
      );

      // 3) Update local UI state so it shows immediately (and on next open)
      setCroGenerationStatus(prev => ({
        ...prev,
        [croFormData.shipmentId]: {
          hasCroGenerated: updatedShipment?.hasCroGenerated ?? true,
          firstCroGenerationDate: updatedShipment?.firstCroGenerationDate || formDate,
        },
      }));
      setCroFormData(prev => ({ ...prev, date: formDate }));

      // 4) Generate PDF with the exact same date
      await generateCroPdf(croFormData.shipmentId, croFormData.containers, formDate);

      setShowCroModal(false);
    } catch (error) {
      console.error('Error generating CRO PDF:', error);
      alert('Error generating CRO PDF. Please try again.');
    }
  };


  // Handle opening BL modal with empty form based on BillofLading schema
  const handleOpenBlModal = async (shipment: any, blType: BLType) => {
    setCurrentBlType(blType);
    setBlJustSaved(false); // Reset save flag initially

    try {
      // ALWAYS fetch the latest shipment data first to get current container information
      const latestShipmentResponse = await axios.get(`http://localhost:8000/shipment/${shipment.id}`);
      const latestShipment = latestShipmentResponse.data;

      // Try to fetch existing BL data for this shipment
      const response = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipment.id}`);
      const existingBl = response.data;

      if (existingBl) {
        // Update BL generation status
        setBlGenerationStatus(prev => ({
          ...prev,
          [shipment.id]: {
            hasDraftBlGenerated: existingBl.hasDraftBlGenerated || false,
            hasOriginalBLGenerated: existingBl.hasOriginalBLGenerated || false,
            firstGenerationDate: existingBl.firstGenerationDate || null
          }
        }));

        // Parse existing BL data for weights and seal numbers (preserve these from saved BL)
        const savedSealNumbers = existingBl.sealNo ? String(existingBl.sealNo).split(',').map((s: string) => s.trim()) : [];
        const savedGrossWeights = existingBl.grossWt ? String(existingBl.grossWt).split(',').map((s: string) => s.trim()) : [];
        const savedNetWeights = existingBl.netWt ? String(existingBl.netWt).split(',').map((s: string) => s.trim()) : [];

        // CHANGED: Use LATEST shipment containers but preserve saved weights and seal numbers
        const currentContainers = latestShipment.containers?.map((container: any, index: number) => ({
          containerNumber: container.containerNumber || '',
          sealNumber: savedSealNumbers[index] || '', // Preserve saved seal numbers
          grossWt: savedGrossWeights[index] || '', // Preserve saved gross weights
          netWt: savedNetWeights[index] || ''  // Preserve saved net weights
        })) || [];

        setBlFormData({
          shipmentId: shipment.id,
          blType: blType,
          date: existingBl.date || new Date().toISOString().split('T')[0], // Use saved date or current date
          // Fill with existing BL data for other fields
          shippersName: existingBl.shippersName || '',
          shippersAddress: existingBl.shippersAddress || '',
          shippersContactNo: existingBl.shippersContactNo || '',
          shippersEmail: existingBl.shippersEmail || '',
          shipperInfo: existingBl.shipperInfo || '',
          consigneeName: existingBl.consigneeName || '',
          consigneeAddress: existingBl.consigneeAddress || '',
          consigneeContactNo: existingBl.consigneeContactNo || '',
          consigneeEmail: existingBl.consigneeEmail || '',
          consigneeInfo: existingBl.consigneeInfo || '',
          notifyPartyName: existingBl.notifyPartyName || '',
          notifyPartyAddress: existingBl.notifyPartyAddress || '',
          notifyPartyContactNo: existingBl.notifyPartyContactNo || '',
          notifyPartyEmail: existingBl.notifyPartyEmail || '',
          notifyPartyInfo: existingBl.notifyPartyInfo || '',
          // CHANGED: Use LATEST container list from current shipment
          containerNos: currentContainers.map((c: any) => c.containerNumber).join(', '),
          sealNo: existingBl.sealNo || '',
          grossWt: existingBl.grossWt || '',
          netWt: existingBl.netWt || '',
          billofLadingDetails: existingBl.billofLadingDetails || '',
          freightPayableAt: existingBl.freightPayableAt || '',
          deliveryAgentName: existingBl.deliveryAgentName || '',
          deliveryAgentAddress: existingBl.deliveryAgentAddress || '',
          Vat: existingBl.Vat || '',
          deliveryAgentContactNo: existingBl.deliveryAgentContactNo || '',
          deliveryAgentEmail: existingBl.deliveryAgentEmail || '',
          deliveryAgentInfo: existingBl.deliveryAgentInfo || '',
          freightAmount: existingBl.freightAmount || '',
          // Charges and fees field with existing value or empty
          chargesAndFees: existingBl.chargesAndFees || '',
          // CHANGED: Always use LATEST shipment data for ports and vessel
          portOfLoading: latestShipment.polPort?.portName || '',
          portOfDischarge: latestShipment.podPort?.portName || '',
          vesselNo: latestShipment.vesselName || '',
          // Container-specific fields - use LATEST container data with preserved weights/seals
          containers: currentContainers
        });
        // Set the flag to true so download button is visible for existing BL
        setBlJustSaved(true);
        await hydrateAssignmentsForModal(shipment.id, blType);
      } else {
        // Initialize BL generation status as not generated
        setBlGenerationStatus(prev => ({
          ...prev,
          [shipment.id]: {
            hasDraftBlGenerated: false,
            hasOriginalBLGenerated: false,
            firstGenerationDate: null
          }
        }));

        // Show empty form for first time using LATEST shipment data
        setBlFormData({
          shipmentId: shipment.id,
          blType: blType,
          date: new Date().toISOString().split('T')[0], // Set current date for new BL
          // Empty form fields based on BillofLading schema
          shippersName: '',
          shippersAddress: '',
          shippersContactNo: '',
          shippersEmail: '',
          shipperInfo: '',
          consigneeName: '',
          consigneeAddress: '',
          consigneeContactNo: '',
          consigneeEmail: '',
          consigneeInfo: '',
          notifyPartyName: '',
          notifyPartyAddress: '',
          notifyPartyContactNo: '',
          notifyPartyEmail: '',
          notifyPartyInfo: '',
          containerNos: latestShipment.containers?.map((c: any) => c.containerNumber).join(', ') || '',
          sealNo: '',
          grossWt: '',
          netWt: '',
          billofLadingDetails: '',
          freightPayableAt: '',
          deliveryAgentName: '',
          deliveryAgentAddress: '',
          Vat: '',
          deliveryAgentContactNo: '',
          deliveryAgentEmail: '',
          deliveryAgentInfo: '',
          freightAmount: '',
          // Empty charges and fees field by default
          chargesAndFees: '',
          // Fields fetched from LATEST shipment data
          portOfLoading: latestShipment.polPort?.portName || '',
          portOfDischarge: latestShipment.podPort?.portName || '',
          vesselNo: latestShipment.vesselName || '',
          // Container-specific fields - use LATEST shipment data
          containers: latestShipment.containers?.map((c: any) => ({
            containerNumber: c.containerNumber || '',
            sealNumber: c.sealNumber || '',
            grossWt: '',
            netWt: ''
          })) || []
        });
        // Keep blJustSaved as false for new forms
        setBlJustSaved(false);
        await hydrateAssignmentsForModal(shipment.id, blType);
      }
    } catch (error) {
      console.log('No existing BL found, showing empty form with latest shipment data');

      // Always fetch latest shipment data even in catch block
      try {
        const latestShipmentResponse = await axios.get(`http://localhost:8000/shipment/${shipment.id}`);
        const latestShipment = latestShipmentResponse.data;

        // Show empty form with LATEST shipment data if no existing data or error occurred
        setBlFormData({
          shipmentId: shipment.id,
          blType: blType,
          date: new Date().toISOString().split('T')[0], // Set current date for new BL
          // Empty form fields based on BillofLading schema
          shippersName: '',
          shippersAddress: '',
          shippersContactNo: '',
          shippersEmail: '',
          shipperInfo: '',
          consigneeName: '',
          consigneeAddress: '',
          consigneeContactNo: '',
          consigneeEmail: '',
          consigneeInfo: '',
          notifyPartyName: '',
          notifyPartyAddress: '',
          notifyPartyContactNo: '',
          notifyPartyEmail: '',
          notifyPartyInfo: '',
          containerNos: latestShipment.containers?.map((c: any) => c.containerNumber).join(', ') || '',
          sealNo: '',
          grossWt: '',
          netWt: '',
          billofLadingDetails: '',
          freightPayableAt: '',
          deliveryAgentName: '',
          deliveryAgentAddress: '',
          Vat: '',
          deliveryAgentContactNo: '',
          deliveryAgentEmail: '',
          deliveryAgentInfo: '',
          freightAmount: '',
          // Empty charges and fees field by default
          chargesAndFees: '',
          // Fields fetched from LATEST shipment data
          portOfLoading: latestShipment.polPort?.portName || '',
          portOfDischarge: latestShipment.podPort?.portName || '',
          vesselNo: latestShipment.vesselName || '',
          // Container-specific fields - use LATEST shipment data
          containers: latestShipment.containers?.map((c: any) => ({
            containerNumber: c.containerNumber || '',
            sealNumber: c.sealNumber || '',
            grossWt: '',
            netWt: ''
          })) || []
        });

        // Rehydrate saved BL groups from the server (persists across devices)
        try {
          const savedGroups = await fetchBlAssignments(shipment.id, blType as BLType);
          if (savedGroups.length > 0) {
            setBlCount(savedGroups.length);
            setBlGroups(savedGroups);
            setMultiBlStageReady(true);
          } else {
            setBlCount(1);
            setBlGroups([]);
            setMultiBlStageReady(false);
          }
        } catch {
          setBlCount(1);
          setBlGroups([]);
          setMultiBlStageReady(false);
        }

      } catch (shipmentError) {
        console.error('Error fetching latest shipment data:', shipmentError);
        // Fallback to original shipment data if latest fetch fails
        setBlFormData({
          shipmentId: shipment.id,
          blType: blType,
          date: new Date().toISOString().split('T')[0], // Set current date for new BL
          // Empty form fields based on BillofLading schema
          shippersName: '',
          shippersAddress: '',
          shippersContactNo: '',
          shippersEmail: '',
          shipperInfo: '',
          consigneeName: '',
          consigneeAddress: '',
          consigneeContactNo: '',
          consigneeEmail: '',
          consigneeInfo: '',
          notifyPartyName: '',
          notifyPartyAddress: '',
          notifyPartyContactNo: '',
          notifyPartyEmail: '',
          notifyPartyInfo: '',
          containerNos: shipment.containers?.map((c: any) => c.containerNumber).join(', ') || '',
          sealNo: '',
          grossWt: '',
          netWt: '',
          billofLadingDetails: '',
          freightPayableAt: '',
          deliveryAgentName: '',
          deliveryAgentAddress: '',
          Vat: '',
          deliveryAgentContactNo: '',
          deliveryAgentEmail: '',
          deliveryAgentInfo: '',
          freightAmount: '',
          // Empty charges and fees field by default
          chargesAndFees: '',
          // Fields fetched from original shipment data
          portOfLoading: shipment.polPort?.portName || '',
          portOfDischarge: shipment.podPort?.portName || '',
          vesselNo: shipment.vesselName || '',
          // Container-specific fields
          containers: shipment.containers?.map((c: any) => ({
            containerNumber: c.containerNumber || '',
            sealNumber: c.sealNumber || '',
            grossWt: '',
            netWt: ''
          })) || []
        });
      }
      // Keep blJustSaved as false for new forms
      setBlJustSaved(false);
      await hydrateAssignmentsForModal(shipment.id, blType);

    }

    setShowBlModal(true);
  };

  // Handle saving BL form data (NO auto download here)
  // Handle saving BL form data (NO auto download; CLOSE modal immediately)
  const handleSaveBlData = async () => {
    try {
      // Detect create vs update
      let isExistingBl = false;
      try {
        const existingBlResponse = await axios.get(
          `http://localhost:8000/bill-of-lading/shipment/${blFormData.shipmentId}`
        );
        isExistingBl = !!existingBlResponse.data;
      } catch {
        isExistingBl = false;
      }

      // Build payload for backend
      const blPayload = {
        date: blFormData.date,
        shippersName: blFormData.shippersName,
        shippersAddress: blFormData.shippersAddress,
        shippersContactNo: blFormData.shippersContactNo,
        shippersEmail: blFormData.shippersEmail,
        shipperInfo: blFormData.shipperInfo,
        consigneeName: blFormData.consigneeName,
        consigneeAddress: blFormData.consigneeAddress,
        consigneeContactNo: blFormData.consigneeContactNo,
        consigneeEmail: blFormData.consigneeEmail,
        consigneeInfo: blFormData.consigneeInfo,
        notifyPartyName: blFormData.notifyPartyName,
        notifyPartyAddress: blFormData.notifyPartyAddress,
        notifyPartyContactNo: blFormData.notifyPartyContactNo,
        notifyPartyEmail: blFormData.notifyPartyEmail,
        notifyPartyInfo: blFormData.notifyPartyInfo,
        containerNos: blFormData.containerNos,
        sealNo: blFormData.sealNo,
        grossWt: blFormData.grossWt,
        netWt: blFormData.netWt,
        billofLadingDetails: blFormData.billofLadingDetails,
        freightPayableAt: blFormData.freightPayableAt,
        deliveryAgentName: blFormData.deliveryAgentName,
        deliveryAgentAddress: blFormData.deliveryAgentAddress,
        Vat: blFormData.Vat,
        deliveryAgentContactNo: blFormData.deliveryAgentContactNo,
        deliveryAgentEmail: blFormData.deliveryAgentEmail,
        deliveryAgentInfo: blFormData.deliveryAgentInfo,
        freightAmount: blFormData.freightAmount,
        portOfLoading: blFormData.portOfLoading,
        portOfDischarge: blFormData.portOfDischarge,
        vesselNo: blFormData.vesselNo,
        chargesAndFees: blFormData.chargesAndFees,
      };

      // Create/Update on backend — no PDF generation here
      const response = await axios.post(
        `http://localhost:8000/bill-of-lading/generate/${blFormData.shipmentId}`,
        blPayload
      );
      const savedBl = response.data;

      // Update flags so Download button appears if needed later
      setBlGenerationStatus(prev => ({
        ...prev,
        [blFormData.shipmentId]: {
          hasDraftBlGenerated: savedBl.hasDraftBlGenerated || true,
          hasOriginalBLGenerated: savedBl.hasOriginalBLGenerated || false,
          firstGenerationDate: savedBl.firstGenerationDate || new Date().toISOString(),
        },
      }));

      alert(
        `${currentBlType === 'original'
          ? 'Original'
          : currentBlType === 'draft'
            ? 'Draft'
            : 'Seaway'
        } Bill of Lading saved successfully!`
      );
      setBlJustSaved(true);

      // Persist current group assignments locally (optional; your server save is elsewhere)
      try {
        const key = `blGroups:${blFormData.shipmentId}:${currentBlType}`;
        if (blGroups && blGroups.length > 0) {
          localStorage.setItem(key, JSON.stringify(blGroups));
        }
      } catch { }

      // ✅ CLOSE THE MODAL IMMEDIATELY (no timeout)
      setShowBlModal(false);

    } catch (error) {
      console.error('Error saving Bill of Lading:', error);
      alert('Error saving Bill of Lading. Please try again.');
    }
  };

  const handleDownloadAssignedBl = async (shipmentId: number, blType: BLType, index: number) => {
    try {
      // get latest server-saved groups
      const groups = await fetchBlAssignments(shipmentId, blType);
      const selected = groups[index] || [];
      if (!selected.length) {
        alert(`No containers assigned for ${index + 1} BL.`);
        return;
      }

      // build an override limited to selected containers
      const perBlOverride = {
        ...blFormData,
        containers: (blFormData?.containers || []).filter((c: any) =>
          selected.includes(c?.containerNumber)
        ),
        containerNos: selected.join(', '),
      };

      const generationStatus = blGenerationStatus[shipmentId];
      const consistentDate = generationStatus?.firstGenerationDate
        ? new Date(generationStatus.firstGenerationDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const pdfData = {
        shipmentId,
        blType,
        date: consistentDate,
        blNumber: `${blType.toUpperCase()}-${Date.now()}-${index + 1}`,
        shipper: blFormData.shippersName,
        consignee: blFormData.consigneeName,
        notifyParty: blFormData.notifyPartyName,
        placeOfAcceptance: '',
        portOfLoading: blFormData.portOfLoading,
        portOfDischarge: blFormData.portOfDischarge,
        placeOfDelivery: '',
        vesselVoyageNo: blFormData.vesselNo,
        containerInfo: '',
        marksNumbers: '',
        descriptionOfGoods: blFormData.billofLadingDetails,
        grossWeight: blFormData.grossWt,
        netWeight: blFormData.netWt,
        shippingMarks: '',
        freightCharges: blFormData.freightAmount,
        freightPayableAt: blFormData.freightPayableAt,
        numberOfOriginals: '',
        placeOfIssue: '',
        dateOfIssue: consistentDate,
        containers: [],
      };

      await generateBlPdf(blType, pdfData as any, perBlOverride as any, 0);
    } catch (e) {
      console.error(e);
      alert('Failed to download assigned BL.');
    }
  };




  // Handle downloading BL PDF with current form data
  const handleDownloadBlPdf = async () => {
    try {
      // Use the date from the form (user can edit this)
      const formDate = blFormData.date || new Date().toISOString().split('T')[0];

      // Convert form data to match BLFormData interface structurea
      const pdfData: BLFormData = {
        shipmentId: blFormData.shipmentId,
        blType: currentBlType,
        date: formDate,
        blNumber: `${currentBlType.toUpperCase()}-${Date.now()}`,
        shipper: blFormData.shippersName,
        consignee: blFormData.consigneeName,
        notifyParty: blFormData.notifyPartyName,
        placeOfAcceptance: '',
        portOfLoading: '',
        portOfDischarge: '',
        placeOfDelivery: '',
        vesselVoyageNo: '',
        containerInfo: '',
        marksNumbers: '',
        descriptionOfGoods: blFormData.billofLadingDetails,
        grossWeight: blFormData.grossWt,
        netWeight: blFormData.netWt,
        shippingMarks: '',
        freightCharges: blFormData.freightAmount,
        freightPayableAt: '',
        numberOfOriginals: '',
        placeOfIssue: '',
        dateOfIssue: formDate,
        containers: []
      };

      await generateBlPdf(currentBlType, pdfData, blFormData, 0); // 0 = original copy

      // If this is an original BL download and hasn't been generated before, mark it as generated
      if (currentBlType === 'original' && !blGenerationStatus[blFormData.shipmentId]?.hasOriginalBLGenerated) {
        try {
          await axios.post(`http://localhost:8000/bill-of-lading/mark-original-generated/${blFormData.shipmentId}`);

          // Update the local state to reflect that original BL has been generated
          setBlGenerationStatus(prev => ({
            ...prev,
            [blFormData.shipmentId]: {
              ...prev[blFormData.shipmentId],
              hasOriginalBLGenerated: true
            }
          }));
        } catch (error) {
          console.error('Error marking original BL as generated:', error);
          // Don't block the download process if this fails
        }
      }

      // Mark original as downloaded in local state (for UI purposes)
      setBlCopyDownloadStatus(prev => ({
        ...prev,
        [blFormData.shipmentId]: {
          ...prev[blFormData.shipmentId],
          [currentBlType]: {
            ...prev[blFormData.shipmentId]?.[currentBlType],
            originalDownloaded: true,
            secondCopyDownloaded: false,
            thirdCopyDownloaded: false
          }
        }
      }));

      setShowBlModal(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Handler for 2nd copy download
  const handleDownload2ndCopyBlPdf = async (shipmentId: number, blType: BLType) => {
    try {
      // Fetch the latest shipment data to get current container information
      const latestShipmentResponse = await axios.get(`http://localhost:8000/shipment/${shipmentId}`);
      const latestShipment = latestShipmentResponse.data;

      // Fetch the existing BL data for this shipment
      const existingBlResponse = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipmentId}`);
      const existingBl = existingBlResponse.data;

      if (!existingBl) {
        alert('Original BL data not found. Please generate the original BL first.');
        return;
      }

      // Use the saved date from existing BL or current date as fallback
      const formDate = existingBl.date || new Date().toISOString().split('T')[0];

      // Use LATEST container data with preserved BL-specific information
      const savedSealNumbers = existingBl.sealNo ? String(existingBl.sealNo).split(',').map((s: string) => s.trim()) : [];
      const savedGrossWeights = existingBl.grossWt ? String(existingBl.grossWt).split(',').map((s: string) => s.trim()) : [];
      const savedNetWeights = existingBl.netWt ? String(existingBl.netWt).split(',').map((s: string) => s.trim()) : [];

      // Build containers using LATEST shipment data but preserve BL-specific values
      const latestContainers = latestShipment.containers?.map((container: any, index: number) => ({
        containerNumber: container.containerNumber || '',
        sealNumber: savedSealNumbers[index] || '', // Preserve saved seal numbers
        grossWt: savedGrossWeights[index] || '', // Preserve saved gross weights  
        netWt: savedNetWeights[index] || ''  // Preserve saved net weights
      })) || [];

      const blDataWithCurrentContainers = {
        ...existingBl,
        containers: latestContainers, // Use latest containers
        vesselNo: latestShipment.vesselName || '', // Always use latest vessel name
        portOfLoading: latestShipment.polPort?.portName || '', // Always use latest port
        portOfDischarge: latestShipment.podPort?.portName || '', // Always use latest port
        containerNos: latestContainers.map((c: any) => c.containerNumber).join(', ') // Update container numbers
      };

      const pdfData: BLFormData = {
        shipmentId: shipmentId,
        blType: blType,
        date: formDate,
        blNumber: `${blType.toUpperCase()}-${Date.now()}`,
        shipper: existingBl.shippersName,
        consignee: existingBl.consigneeName,
        notifyParty: existingBl.notifyPartyName,
        placeOfAcceptance: '',
        portOfLoading: '',
        portOfDischarge: '',
        placeOfDelivery: '',
        vesselVoyageNo: '',
        containerInfo: '',
        marksNumbers: '',
        descriptionOfGoods: existingBl.billofLadingDetails,
        grossWeight: existingBl.grossWt,
        netWeight: existingBl.netWt,
        shippingMarks: '',
        freightCharges: existingBl.freightAmount,
        freightPayableAt: '',
        numberOfOriginals: '',
        placeOfIssue: '',
        dateOfIssue: formDate,
        containers: []
      };

      await generateBlPdf(blType, pdfData, blDataWithCurrentContainers, 1); // 1 = 2nd copy

      // Mark 2nd copy as downloaded
      setBlCopyDownloadStatus(prev => ({
        ...prev,
        [shipmentId]: {
          ...prev[shipmentId],
          [blType]: {
            ...prev[shipmentId]?.[blType],
            secondCopyDownloaded: true
          }
        }
      }));

    } catch (error) {
      console.error('Error generating 2nd copy PDF:', error);
      alert('Error generating 2nd copy PDF. Please try again.');
    }
  };

  // Handler for 3rd copy download
  const handleDownload3rdCopyBlPdf = async (shipmentId: number, blType: BLType) => {
    try {
      // Fetch the latest shipment data to get current container information
      const latestShipmentResponse = await axios.get(`http://localhost:8000/shipment/${shipmentId}`);
      const latestShipment = latestShipmentResponse.data;

      // Fetch the existing BL data for this shipment
      const existingBlResponse = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipmentId}`);
      const existingBl = existingBlResponse.data;

      if (!existingBl) {
        alert('Original BL data not found. Please generate the original BL first.');
        return;
      }

      // Use the saved date from existing BL or current date as fallback
      const formDate = existingBl.date || new Date().toISOString().split('T')[0];

      // Use LATEST container data with preserved BL-specific information
      const savedSealNumbers = existingBl.sealNo ? String(existingBl.sealNo).split(',').map((s: string) => s.trim()) : [];
      const savedGrossWeights = existingBl.grossWt ? String(existingBl.grossWt).split(',').map((s: string) => s.trim()) : [];
      const savedNetWeights = existingBl.netWt ? String(existingBl.netWt).split(',').map((s: string) => s.trim()) : [];

      // Build containers using LATEST shipment data but preserve BL-specific values
      const latestContainers = latestShipment.containers?.map((container: any, index: number) => ({
        containerNumber: container.containerNumber || '',
        sealNumber: savedSealNumbers[index] || '', // Preserve saved seal numbers
        grossWt: savedGrossWeights[index] || '', // Preserve saved gross weights  
        netWt: savedNetWeights[index] || ''  // Preserve saved net weights
      })) || [];

      const blDataWithCurrentContainers = {
        ...existingBl,
        containers: latestContainers, // Use latest containers
        vesselNo: latestShipment.vesselName || '', // Always use latest vessel name
        portOfLoading: latestShipment.polPort?.portName || '', // Always use latest port
        portOfDischarge: latestShipment.podPort?.portName || '', // Always use latest port
        containerNos: latestContainers.map((c: any) => c.containerNumber).join(', ') // Update container numbers
      };

      const pdfData: BLFormData = {
        shipmentId: shipmentId,
        blType: blType,
        date: formDate,
        blNumber: `${blType.toUpperCase()}-${Date.now()}`,
        shipper: existingBl.shippersName,
        consignee: existingBl.consigneeName,
        notifyParty: existingBl.notifyPartyName,
        placeOfAcceptance: '',
        portOfLoading: '',
        portOfDischarge: '',
        placeOfDelivery: '',
        vesselVoyageNo: '',
        containerInfo: '',
        marksNumbers: '',
        descriptionOfGoods: existingBl.billofLadingDetails,
        grossWeight: existingBl.grossWt,
        netWeight: existingBl.netWt,
        shippingMarks: '',
        freightCharges: existingBl.freightAmount,
        freightPayableAt: '',
        numberOfOriginals: '',
        placeOfIssue: '',
        dateOfIssue: formDate,
        containers: []
      };

      await generateBlPdf(blType, pdfData, blDataWithCurrentContainers, 2); // 2 = 3rd copy

      // Mark 3rd copy as downloaded
      setBlCopyDownloadStatus(prev => ({
        ...prev,
        [shipmentId]: {
          ...prev[shipmentId],
          [blType]: {
            ...prev[shipmentId]?.[blType],
            thirdCopyDownloaded: true
          }
        }
      }));

    } catch (error) {
      console.error('Error generating 3rd copy PDF:', error);
      alert('Error generating 3rd copy PDF. Please try again.');
    }
  };

  // Direct BL download function without opening modal
  const handleDirectBlDownload = async (shipmentId: number, blType: BLType) => {
    try {
      // Fetch the existing BL data for this shipment
      const existingBlResponse = await axios.get(`http://localhost:8000/bill-of-lading/shipment/${shipmentId}`);
      const existingBl = existingBlResponse.data;

      if (!existingBl) {
        alert(`${blType.charAt(0).toUpperCase() + blType.slice(1)} BL data not found. Please generate it first.`);
        return;
      }

      // Fetch the latest shipment data to get current container information
      const latestShipmentResponse = await axios.get(`http://localhost:8000/shipment/${shipmentId}`);
      const latestShipment = latestShipmentResponse.data;

      // Use the saved date from existing BL or current date as fallback
      const formDate = existingBl.date || new Date().toISOString().split('T')[0];

      // Build BL data using the saved BL data
      const pdfData = {
        shipmentId: shipmentId,
        blType: blType,
        date: formDate,
        blNumber: `${blType.toUpperCase()}-${Date.now()}`,
        shipper: existingBl.shippersName,
        consignee: existingBl.consigneeName,
        notifyParty: existingBl.notifyPartyName,
        placeOfAcceptance: '',
        portOfLoading: '',
        portOfDischarge: '',
        placeOfDelivery: '',
        vesselVoyageNo: '',
        containerInfo: '',
        marksNumbers: '',
        descriptionOfGoods: existingBl.billofLadingDetails,
        grossWeight: existingBl.grossWt,
        netWeight: existingBl.netWt,
        shippingMarks: '',
        freightCharges: existingBl.freightAmount,
        freightPayableAt: '',
        numberOfOriginals: '',
        placeOfIssue: '',
        dateOfIssue: formDate,
        containers: []
      };

      // Use LATEST container data with preserved BL-specific information
      const savedSealNumbers = existingBl.sealNo ? String(existingBl.sealNo).split(',').map((s: string) => s.trim()) : [];
      const savedGrossWeights = existingBl.grossWt ? String(existingBl.grossWt).split(',').map((s: string) => s.trim()) : [];
      const savedNetWeights = existingBl.netWt ? String(existingBl.netWt).split(',').map((s: string) => s.trim()) : [];

      // Build containers using LATEST shipment data but preserve BL-specific values
      const latestContainers = latestShipment.containers?.map((container: any, index: number) => ({
        containerNumber: container.containerNumber || '',
        sealNumber: savedSealNumbers[index] || '', // Preserve saved seal numbers
        grossWt: savedGrossWeights[index] || '', // Preserve saved gross weights  
        netWt: savedNetWeights[index] || ''  // Preserve saved net weights
      })) || [];

      const blDataWithCurrentContainers = {
        ...existingBl,
        containers: latestContainers, // Use latest containers
        vesselNo: latestShipment.vesselName || '', // Always use latest vessel name
        portOfLoading: latestShipment.polPort?.portName || '', // Always use latest port
        portOfDischarge: latestShipment.podPort?.portName || '', // Always use latest port
        containerNos: latestContainers.map((c: any) => c.containerNumber).join(', ') // Update container numbers
      };

      await generateBlPdf(blType, pdfData, blDataWithCurrentContainers, 0); // 0 = original copy

      // Update BL generation status for direct downloads so copy options appear
      if (blType === 'original') {
        setBlGenerationStatus(prev => ({
          ...prev,
          [shipmentId]: {
            ...prev[shipmentId],
            hasOriginalBLGenerated: true,
            firstGenerationDate: existingBl.firstGenerationDate || new Date().toISOString()
          }
        }));
      }

    } catch (error) {
      console.error('Error downloading BL PDF directly:', error);
      alert('Error downloading BL PDF. Please try again.');
    }
  };

  // Direct CRO download function (reusing existing CRO modal data)
  const handleDirectCroDownload = async (shipmentId: number) => {
    try {
      // Fetch shipment data
      const shipment = await apiFetch(
        `http://localhost:8000/shipment/${shipmentId}`,
        { method: 'GET' }
      );

      if (!shipment.containers || shipment.containers.length === 0) {
        alert('No containers found for this shipment.');
        return;
      }

      // Use current date as we don't have a specific CRO date saved
      const currentDate = new Date().toISOString().split('T')[0];

      await generateCroPdf(shipmentId, shipment.containers, currentDate);

    } catch (error) {
      console.error('Error downloading CRO PDF directly:', error);
      alert('Error downloading CRO PDF. Please try again.');
    }
  };







  return (
    <div className="px-4 pt-4 pb-4 bg-white dark:bg-black min-h-screen">
      <div className="flex items-center justify-between mt-0 mb-4">
        <div className="relative mr-4 w-full max-w-sm">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <Input
              type="text"
              placeholder="Search by container..."
              value={containerSearch}
              onChange={(e) => setContainerSearch(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder:text-neutral-400 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700"
            />
          </div>
        </div>

        <Button
          onClick={() => {
            setFormData({
              id: undefined,
              status: true,
              quotationRefNo: '',
              referenceNumber: '',
              masterBL: '',
              houseBL: '', // Add houseBL field
              shippingTerm: '',
              date: '', // Will be filled by user as needed
              jobNumber: '',

              // Customer/Company fields
              customerName: '',
              customerDisplayName: '', // Add display name field
              customerId: '',
              consigneeName: '',
              consigneeId: '',
              consigneeAddressBookId: '',
              shipperName: '',
              shipperId: '',
              shipperAddressBookId: '',
              carrierName: '',
              carrierId: '',
              carrierAddressBookId: '',

              // Product fields
              productId: '',
              productName: '',
              productDisplayName: '', // Add display name field

              // Port fields
              portOfLoading: '',
              portOfLoadingName: '', // Add display name field
              portOfDischarge: '',
              portOfDischargeName: '', // Add display name field
              podPortId: '',
              polPortId: '',
              enableTranshipmentPort: false,
              transhipmentPortName: '',
              transhipmentPortId: '',

              // Agent fields
              expHandlingAgent: '',
              expHandlingAgentId: '',
              expHandlingAgentAddressBookId: '',
              impHandlingAgent: '',
              impHandlingAgentId: '',
              impHandlingAgentAddressBookId: '',

              // Depot fields
              emptyReturnDepot: '',
              emptyReturnDepotId: '',
              emptyReturnDepotAddressBookId: '',

              // Container fields
              quantity: '',
              containerNumber: '',
              capacity: '',
              tare: '',

              // Date fields
              gateClosingDate: '',
              sobDate: '',
              etaToPod: '',
              estimatedEmptyReturnDate: '',
              gsDate: '',
              sob: '',
              etaTopod: '',
              estimateDate: '',

              // Free days and detention
              freeDays1: '',
              detentionRate1: '',
              freeDays2: '',
              detentionRate2: '',

              // Vessel
              vesselName: '',

              // Tank preparation
              tankPreparation: '',
            });
            setSelectedContainers([]);
            setShowModal(true);
          }}
          className="bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Shipment
        </Button>

        {showModal && (
          <AddShipmentForm
            onClose={() => {
              setShowModal(false);
              setSelectedContainers([]);
            }}
            formTitle={formData.id ? 'Edit Shipment' : 'New Shipment Job'}
            form={formData}
            setForm={setFormData}
            selectedContainers={selectedContainers}
            setSelectedContainers={setSelectedContainers}
            refreshShipments={fetchShipments}
          />
        )}

        {/* View Modal */}
        {showViewModal && viewShipment && (
          <ViewShipmentModal
            shipment={viewShipment}
            onClose={() => {
              setShowViewModal(false);
            }}
            onDownload={() => handleDownloadPDF(viewShipment.id, viewShipment.containers ?? [])}
            onEdit={() => {
              // Close view modal first
              setShowViewModal(false);

              // Then trigger edit with a slight delay
              setTimeout(() => {
                handleEdit(viewShipment);
              }, 100);
            }}
          />
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black overflow-x-auto shadow-sm">
        <Table>
          <TableHeader className="bg-neutral-100 dark:bg-neutral-900">
            <TableRow className="hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800">
              <TableHead className="text-black dark:text-neutral-200 font-medium">Shipment No.</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Date</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Customer</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Shipper</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Product</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Ports</TableHead>
              <TableHead className="text-black dark:text-neutral-200 font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-neutral-400 py-6 bg-white dark:bg-black">
                  No shipments found.
                </TableCell>
              </TableRow>
            ) : (
              shipments
                .filter((s: any) => {
                  // If search is empty, show all shipments
                  if (!containerSearch.trim()) return true;

                  // If containers array doesn't exist or is empty, don't filter it out
                  if (!s.containers || s.containers.length === 0) return false;

                  // Otherwise check if any container matches search
                  return s.containers.some((c: any) =>
                    c.containerNumber?.toLowerCase().includes(containerSearch.toLowerCase())
                  );
                })
                .map((shipment: any) => (
                  <TableRow
                    key={shipment.id}
                    className="text-black dark:text-white border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <TableCell className="font-medium">{shipment.jobNumber}</TableCell>
                    <TableCell>{new Date(shipment.date).toLocaleDateString()}</TableCell>
                    <TableCell>{shipment.customerAddressBook?.companyName || '-'}</TableCell>
                    <TableCell>{shipment.shipperAddressBook?.companyName || '-'}</TableCell>
                    <TableCell>{shipment.product?.productName || '-'}</TableCell>
                    <TableCell>{shipment.polPort?.portName || '-'} → {shipment.podPort?.portName || '-'}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        onClick={() => handleView(shipment)}
                        title="View Details"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-900/40 cursor-pointer dark:hover:bg-purple-900/40"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        onClick={() => handleEdit(shipment)}
                        title="Edit"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 cursor-pointer dark:hover:bg-blue-900/40"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        onClick={() => handleDelete(shipment.id)}
                        title="Delete"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/40 cursor-pointer dark:hover:bg-red-900/40"
                      >
                        <Trash2 size={16} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-gray-300 hover:bg-gray-900/40 cursor-pointer dark:hover:bg-gray-900/40"
                            title="More options"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[240px]">
                          {/* CRO Options */}
                          <DropdownMenuItem className='cursor-pointer flex items-center justify-between py-2'>
                            <span onClick={() => handleOpenCroModal(shipment)} className="flex-1 hover:text-blue-600">
                              Generate CRO
                            </span>
                            {croGenerationStatus[shipment.id]?.hasCroGenerated && (
                              <div className="ml-4 border-l border-gray-200 pl-3">
                                <Download
                                  size={16}
                                  className="text-green-600 hover:text-green-700 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDirectCroDownload(shipment.id);
                                  }}

                                />
                              </div>
                            )}
                          </DropdownMenuItem>





                          {/* Draft BL Options */}
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center justify-between py-2"
                            onClick={() => handleOpenBlModal(shipment, 'draft')}
                          >
                            <span className="flex-1 hover:text-blue-600">Generate Draft BL</span>
                            {blGenerationStatus[shipment.id]?.hasDraftBlGenerated && (
                              <div className="ml-4 border-l border-gray-200 pl-3">
                                <Download
                                  size={16}
                                  className="text-green-600 hover:text-green-700 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDirectBlDownload(shipment.id, 'draft');
                                  }}
                                />
                              </div>
                            )}
                          </DropdownMenuItem>

                          {/* Assigned BL downloads — Draft */}
                          <AssignedBlDownloads
                            shipmentId={shipment.id}
                            blType="draft"
                            label="Draft"
                            onClickDownload={(i) => handleDownloadAssignedBl(shipment.id, 'draft', i)}
                          />

                          {/* Original and Seaway BL Options - only after draft has been generated */}
                          {blGenerationStatus[shipment.id]?.hasDraftBlGenerated && (
                            <>
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center justify-between py-2"
                                onClick={() => handleOpenBlModal(shipment, 'original')}
                              >
                                <span className="flex-1 hover:text-blue-600">Generate Original BL</span>
                                {blGenerationStatus[shipment.id]?.hasOriginalBLGenerated && (
                                  <div className="ml-4 border-l border-gray-200 pl-3">
                                    <Download
                                      size={16}
                                      className="text-green-600 hover:text-green-700 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDirectBlDownload(shipment.id, 'original');
                                      }}
                                    />
                                  </div>
                                )}
                              </DropdownMenuItem>

                              {/* Assigned BL downloads — Original */}
                              <AssignedBlDownloads
                                shipmentId={shipment.id}
                                blType="original"
                                label="Original"
                                onClickDownload={(i) => handleDownloadAssignedBl(shipment.id, 'original', i)}
                              />

                              <DropdownMenuItem
                                className="cursor-pointer flex items-center justify-between py-2"
                                onClick={() => handleOpenBlModal(shipment, 'seaway')}
                              >
                                <span className="flex-1 hover:text-blue-600">Generate Seaway BL</span>
                                {blGenerationStatus[shipment.id]?.hasDraftBlGenerated && (
                                  <div className="ml-4 border-l border-gray-200 pl-3">
                                    <Download
                                      size={16}
                                      className="text-green-600 hover:text-green-700 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDirectBlDownload(shipment.id, 'seaway');
                                      }}
                                    />
                                  </div>
                                )}
                              </DropdownMenuItem>

                              {/* Assigned BL downloads — Seaway */}
                              <AssignedBlDownloads
                                shipmentId={shipment.id}
                                blType="seaway"
                                label="Seaway"
                                onClickDownload={(i) => handleDownloadAssignedBl(shipment.id, 'seaway', i)}
                              />
                            </>
                          )}

                          {/* Original BL Copy Options */}
                          {blGenerationStatus[shipment.id]?.hasOriginalBLGenerated && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleDownload2ndCopyBlPdf(shipment.id, 'original')}
                                className="cursor-pointer text-blue-600"
                              >
                                Download Original BL 2nd Copy
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDownload3rdCopyBlPdf(shipment.id, 'original')}
                                className="cursor-pointer text-blue-600"
                              >
                                Download Original BL 3rd Copy
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>

                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* CRO Form Modal */}
      <Dialog open={showCroModal} onOpenChange={setShowCroModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Container Release Order</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Document Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">CRO Issued Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={croFormData.date || ""}
                  onChange={(e) => setCroFormData({ ...croFormData, date: e.target.value })}
                  className="bg-white dark:bg-black"
                />

              </div>



              <div className="space-y-2">
                <Label htmlFor="houseBL">House BL</Label>
                <Input
                  id="houseBL"
                  value={croFormData.houseBL}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipperRefNo">Reference No.</Label>
                <Input
                  id="shipperRefNo"
                  value={croFormData.shipperRefNo}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipper">Shipper</Label>
                <Input
                  id="shipper"
                  value={croFormData.shipper}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Shipment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={croFormData.releaseDate}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pol">Port of Loading (POL)</Label>
                <Input
                  id="pol"
                  value={croFormData.pol}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pod">Port of Discharge (POD)</Label>
                <Input
                  id="pod"
                  value={croFormData.pod}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finalDestination">Final Destination</Label>
                <Input
                  id="finalDestination"
                  value={croFormData.finalDestination}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tankPrep">Tank Preparation</Label>
              <Input
                id="tankPrep"
                value={croFormData.tankPrep}
                readOnly
                disabled
                className="bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Depot Information */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Depot Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depotName">Depot Name</Label>
                  <Input
                    id="depotName"
                    value={croFormData.depotName}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depotAddress">Depot Address</Label>
                  <Input
                    id="depotAddress"
                    value={croFormData.depotAddress}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="depotContact">Depot Contact</Label>
                  <Input
                    id="depotContact"
                    value={croFormData.depotContact}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depotEmail">Depot Email</Label>
                  <Input
                    id="depotEmail"
                    value={croFormData.depotEmail}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="depotCountry">Depot Country</Label>
                  <Input
                    id="depotCountry"
                    value={croFormData.depotCountry}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depotMobile">Depot Mobile</Label>
                  <Input
                    id="depotMobile"
                    value={croFormData.depotMobile}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Container Information */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Container Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 border dark:border-neutral-700 dark:bg-neutral-800">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {croFormData.containers.length > 0 ? (
                    croFormData.containers.map((container: any, index: number) => (
                      <div key={index} className="bg-white rounded-md p-3 border border-gray-200 shadow-sm dark:bg-neutral-700 dark:border-neutral-600">
                        <div className="space-y-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {container.containerNumber || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white">
                            Size: {container.containerSize || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white">
                            Depot: {container.depotName || 'N/A'}
                          </div>
                          {container.last3Cargo && container.last3Cargo.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Last Cargo: {container.last3Cargo.slice(0, 1).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-gray-500 py-4">
                      No containers selected
                    </div>
                  )}
                </div>
                <div className="mt-3 text-sm text-gray-600 dark:text-white">
                  Total Containers: {croFormData.containers.length}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setShowCroModal(false)} className='cursor-pointer'>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleEditShipmentFromCro} className='cursor-pointer'>
              Edit Shipment Form
            </Button>
            <Button onClick={handleDownloadCroPdf} className='cursor-pointer'>
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BL Form Modal */}
      <Dialog open={showBlModal} onOpenChange={setShowBlModal}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto !w-[600px] !max-w-[600px] bl-modal-content"
          style={{
            width: '600px !important',
            maxWidth: '600px !important',
            minWidth: '600px',
            '--radix-dialog-content-width': '600px',
            '--radix-dialog-content-max-width': '600px'
          } as React.CSSProperties}
        >
          <DialogHeader>
            <DialogTitle>Generate {currentBlType === 'original' ? 'Original' : currentBlType === 'draft' ? 'Draft' : 'Seaway'} Bill of Lading</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">

            {/* Date Field - Added at the top */}
            <div className="grid grid-cols-3 gap-4">
              {currentBlType !== 'draft' && (
                <div className="space-y-2">
                  <Label htmlFor="blDate">BL Issued Date</Label>
                  <Input
                    id="blDate"
                    type="date"
                    value={blFormData.date}
                    onChange={(e) =>
                      setBlFormData({ ...blFormData, date: e.target.value })
                    }
                    className="bg-white dark:bg-black"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="blTypeDisplay">BL Type</Label>
                <Input
                  id="blTypeDisplay"
                  value={currentBlType === 'original' ? 'Original' : currentBlType === 'draft' ? 'Draft' : 'Seaway'}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>



            </div>
            {/* Shipper Information */}
            <hr className="dark:border-black  " />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Shipper Section</h3>
              <div className="space-y-2">
                <Label htmlFor="shipperInfo">Shipper Information</Label>
                <Textarea
                  id="shipperInfo"
                  value={blFormData.shipperInfo}
                  onChange={(e) => setBlFormData({ ...blFormData, shipperInfo: e.target.value })}
                  placeholder="Enter all shipper information here. You can copy and paste from existing sources."
                  className="bg-white dark:bg-black min-h-[120px] resize-vertical"
                  rows={6}
                />
              </div>
            </div>

            {/* Consignee Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Consignee Section</h3>
              <div className="space-y-2">
                <Label htmlFor="consigneeInfo">Consignee Information</Label>
                <Textarea
                  id="consigneeInfo"
                  value={blFormData.consigneeInfo}
                  onChange={(e) => setBlFormData({ ...blFormData, consigneeInfo: e.target.value })}
                  placeholder="Enter all consignee information here. You can copy and paste from existing sources."
                  className="bg-white dark:bg-black min-h-[120px] resize-vertical"
                  rows={6}
                />
              </div>
            </div>

            {/* Notify Party Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Notify Party Section</h3>
              <div className="space-y-2">
                <Label htmlFor="notifyPartyInfo">Notify Party Information</Label>
                <Textarea
                  id="notifyPartyInfo"
                  value={blFormData.notifyPartyInfo}
                  onChange={(e) => setBlFormData({ ...blFormData, notifyPartyInfo: e.target.value })}
                  placeholder="Enter all notify party information here. You can copy and paste from existing sources."
                  className="bg-white dark:bg-black min-h-[120px] resize-vertical"
                  rows={6}
                />
              </div>
            </div>

            {/* Delivery Agent Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Delivery Agent Section</h3>
              <div className="space-y-2">
                <Label htmlFor="deliveryAgentInfo">Delivery Agent Information</Label>
                <Textarea
                  id="deliveryAgentInfo"
                  value={blFormData.deliveryAgentInfo}
                  onChange={(e) => setBlFormData({ ...blFormData, deliveryAgentInfo: e.target.value })}
                  placeholder="Enter all delivery agent information here. You can copy and paste from existing sources."
                  className="bg-white dark:bg-black min-h-[120px] resize-vertical"
                  rows={6}
                />
              </div>
              {/* VAT field removed - now included in delivery agent info field above */}
            </div>

            {/* Port & Vessel Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Port & Vessel Information</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="portOfLoading">Port of Loading</Label>
                  <Input
                    id="portOfLoading"
                    value={blFormData.portOfLoading}
                    onChange={(e) => setBlFormData({ ...blFormData, portOfLoading: e.target.value })}
                    placeholder="Port of loading"
                    className="bg-white dark:bg-black"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                  <Input
                    id="portOfDischarge"
                    value={blFormData.portOfDischarge}
                    onChange={(e) => setBlFormData({ ...blFormData, portOfDischarge: e.target.value })}
                    placeholder="Port of discharge"
                    className="bg-white dark:bg-black"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vesselNo">Vessel No</Label>
                  <Input
                    id="vesselNo"
                    value={blFormData.vesselNo}
                    onChange={(e) => setBlFormData({ ...blFormData, vesselNo: e.target.value })}
                    placeholder="Vessel number"
                    className="bg-white dark:bg-black"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Cargo Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Cargo Information</h3>
              {/* Dynamic Container and Seal Number fields */}
              <div className="space-y-4">
                {blFormData.containers.map((container, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`containerNo_${index}`}>
                        {index === 0 ? 'Container No(s)' : `Container No ${index + 1}`}
                      </Label>
                      <Input
                        id={`containerNo_${index}`}
                        value={container.containerNumber}
                        onChange={(e) => {
                          const updatedContainers = [...blFormData.containers];
                          updatedContainers[index].containerNumber = e.target.value;
                          setBlFormData({
                            ...blFormData,
                            containers: updatedContainers,
                            containerNos: updatedContainers.map(c => c.containerNumber).join(', ')
                          });
                        }}
                        placeholder="Container number"
                        className="bg-white dark:bg-black"
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`grossWt_${index}`}>
                        {index === 0 ? 'Gross Weight *' : `Gross Wt ${index + 1} *`}
                      </Label>
                      <Input
                        id={`grossWt_${index}`}
                        value={container.grossWt || ''}
                        onChange={(e) => {
                          const updatedContainers = [...blFormData.containers];
                          updatedContainers[index].grossWt = e.target.value;
                          setBlFormData({
                            ...blFormData,
                            containers: updatedContainers,
                            grossWt: updatedContainers.map(c => c.grossWt || '').join(', ')
                          });
                        }}
                        placeholder="Enter gross weight"
                        className="bg-white dark:bg-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`netWt_${index}`}>
                        {index === 0 ? 'Net Weight *' : `Net Wt ${index + 1} *`}
                      </Label>
                      <Input
                        id={`netWt_${index}`}
                        value={container.netWt || ''}
                        onChange={(e) => {
                          const updatedContainers = [...blFormData.containers];
                          updatedContainers[index].netWt = e.target.value;
                          setBlFormData({
                            ...blFormData,
                            containers: updatedContainers,
                            netWt: updatedContainers.map(c => c.netWt || '').join(', ')
                          });
                        }}
                        placeholder="Enter net weight"
                        className="bg-white dark:bg-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`sealNo_${index}`}>
                        {index === 0 ? 'Seal No *' : `Seal No ${index + 1} *`}
                      </Label>
                      <Input
                        id={`sealNo_${index}`}
                        value={container.sealNumber}
                        onChange={(e) => {
                          const updatedContainers = [...blFormData.containers];
                          updatedContainers[index].sealNumber = e.target.value;
                          setBlFormData({
                            ...blFormData,
                            containers: updatedContainers,
                            sealNo: updatedContainers.map(c => c.sealNumber || '').join(', ')
                          });
                        }}
                        placeholder="Enter seal number"
                        className="bg-white dark:bg-black"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="space-y-2 mt-4">
                  <Label htmlFor="billofLadingDetails">Bill of Lading Details</Label>
                  <Textarea
                    id="billofLadingDetails"
                    value={blFormData.billofLadingDetails}
                    onChange={(e) => setBlFormData({ ...blFormData, billofLadingDetails: e.target.value })}
                    placeholder="Enter bill of lading details (multiple lines supported)"
                    className="bg-white dark:bg-black min-h-[100px] resize-vertical"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Freight Information */}
            <hr className="border-black" />
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-3">Freight Information</h3>
              <div className="grid w-full">
                <div className="space-y-2">
                  <Label htmlFor="freightPayableAt">Freight Payable At</Label>
                  <Select
                    value={blFormData.freightPayableAt}
                    onValueChange={(value) => setBlFormData({ ...blFormData, freightPayableAt: value })}
                  >
                    <SelectTrigger className="w-full bg-white dark:bg-black">
                      <SelectValue placeholder="Select freight payable option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">Freight Prepaid</SelectItem>
                      <SelectItem value="postpaid">Freight Postpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* <div className="space-y-2">
                  <Label htmlFor="freightAmount">Freight Amount</Label>
                  <Input
                    id="freightAmount"
                    value={blFormData.freightAmount}
                    onChange={(e) => setBlFormData({...blFormData, freightAmount: e.target.value})}
                    placeholder="Enter freight amount"
                    className="bg-white dark:bg-black"
                  />
                </div> */}
              </div>

              {/* Charges Section */}
              <hr className="dark:border-black mt-4" />
              <div className="mt-4">
                <h3 className="text-lg font-semibold">Charges and Fees Section</h3>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="chargesAndFees">Charges and Fees</Label>
                  <Textarea
                    id="chargesAndFees"
                    value={blFormData.chargesAndFees}
                    onChange={(e) => setBlFormData({ ...blFormData, chargesAndFees: e.target.value })}
                    placeholder="Enter all charges and fees information here. You can copy and paste from existing sources."
                    className="bg-white dark:bg-black min-h-32"
                    rows={8}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBlModal(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>

            {!blJustSaved ? (
              <Button onClick={handleSaveBlData} className="cursor-pointer">
                Save Bill of Lading
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSaveBlData}
                  variant="outline"
                  className="cursor-pointer"
                >
                  Update Bill of Lading
                </Button>
                {!downloadBlockedByAssign && (
                  <Button
                    onClick={handleDownloadBlPdf}
                    className="cursor-pointer bg-green-600 hover:bg-green-700"
                    title="Download PDF"
                  >
                    Download PDF
                  </Button>
                )}

              </>
            )}
          </DialogFooter>



        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllShipmentsPage;