'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Search, Trash2, Plus, Eye, MoreVertical, Download } from 'lucide-react';
import axios from 'axios';
import AddEmptyRepoModal from './EmptyRepoJobForm';
import ViewEmptyRepoJobModal from './ViewEmptyRepoJobModal';


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
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
import { apiFetch } from '../../../lib/api';
import { generateEmptyRepoCroPdf } from './generateEmptyRepoCroPdf';



const EmptyRepo = () => {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCroModal, setShowCroModal] = useState(false);
  const [viewEmptyRepoJob, setViewEmptyRepoJob] = useState<any>(null);
  const [emptyRepoJobs, setEmptyRepoJobs] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // ADD THIS: State for selected containers
  const [selectedContainers, setSelectedContainers] = useState<any[]>([]);

  // CRO form data state
  const [croFormData, setCroFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    houseBL: '',
    shipperRefNo: '',
    shipper: '',
    releaseDate: new Date().toISOString().split('T')[0],
    pol: '',
    finalDestination: '',
    tankPrep: 'N/A',
    pod: '',
    depotName: '',
    depotAddress: '',
    depotContact: '',
    depotEmail: '',
    depotCountry: '',
    depotMobile: '',
    containers: []
  });

  // CRO generation status tracking
  const [croGenerationStatus, setCroGenerationStatus] = useState<{[key: number]: {hasCroGenerated: boolean, firstCroGenerationDate: string | null}}>({});

  // Initial empty form data
  const [formData, setFormData] = useState({
    id: undefined,
    date: new Date().toISOString().split('T')[0],
    jobNumber: '',
    houseBL: '',
    shippingTerm: 'CY-CY',
    portOfLoading: '',
    portOfDischarge: '',
    portOfLoadingId: undefined,
    portOfDischargeId: undefined,
    polFreeDays: '',
    polDetentionRate: '',
    podFreeDays: '',
    podDetentionRate: '',
    enableTranshipmentPort: false,
    transhipmentPortName: '',
    transhipmentPortId: undefined,
    expHandlingAgentAddressBookId: undefined,
    impHandlingAgentAddressBookId: undefined,
    quantity: '',
    carrierName: '',
    carrierId: undefined,
    vesselName: '',
    gateClosingDate: '',
    sobDate: '',
    etaToPod: '',
    emptyReturnDepot: '',
    estimatedEmptyReturnDate: '',
    containers: [],
  });

  // Fetch empty repo jobs
  const fetchEmptyRepoJobs = async () => {
    try {
      const res = await axios.get('http://localhost:8000/empty-repo-job');
      // Sort by creation date in descending order (latest first)
      const sortedData = res.data.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setEmptyRepoJobs(sortedData);

      // Populate CRO generation status
      const statusMap: {[key: number]: {hasCroGenerated: boolean, firstCroGenerationDate: string | null}} = {};
      sortedData.forEach((job: any) => {
        statusMap[job.id] = {
          hasCroGenerated: job.hasCroGenerated || false,
          firstCroGenerationDate: job.firstCroGenerationDate || null
        };
      });
      setCroGenerationStatus(statusMap);
    } catch (err) {
      console.error('Failed to fetch empty repo jobs', err);
    }
  };

  useEffect(() => {
    fetchEmptyRepoJobs();
  }, []);

  // Handle delete
  const handleDelete = async (id: number) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this empty repo job?');
    if (!confirmDelete) return;

    try {
      await apiFetch(`http://localhost:8000/empty-repo-job/${id}`, {
        method: 'DELETE',
      });
      await fetchEmptyRepoJobs();
    } catch (err) {
      console.error('Failed to delete empty repo job', err);
      alert('Error deleting empty repo job.');
    }
  };

  // Handle edit
  const handleEdit = async (job: any) => {
    // Fetch port information for proper port names
    let portsData = [];
    try {
      const portsRes = await fetch("http://localhost:8000/ports");
      portsData = await portsRes.json();
    } catch (err) {
      console.error("Failed to fetch ports for edit mode:", err);
    }

    // Initialize selectedContainers with the existing containers and proper port names
    const existingContainers = (job.containers || []).map((container: any) => {
      // Find the port info from the fetched ports data
      const portInfo = portsData.find((port: any) => port.id === container.portId);
      
      return {
        containerNumber: container.containerNumber || "",
        capacity: container.capacity || "",
        tare: container.tare || "",
        inventoryId: container.inventoryId || null,
        portId: container.portId || null,
        depotName: container.depotName || "",
        port: portInfo ? { id: portInfo.id, portName: portInfo.portName } : (container.port || null),
      };
    });

    setSelectedContainers(existingContainers);

    // FIX: Fetch transhipment port name if transhipmentPortId exists
    let transhipmentPortName = "";
    if (job.transhipmentPortId) {
      try {
        const res = await fetch(`http://localhost:8000/ports/${job.transhipmentPortId}`);
        const port = await res.json();
        transhipmentPortName = port.portName || "";
      } catch (err) {
        console.error("Failed to fetch transhipment port:", err);
      }
    }

    setFormData({
      id: job.id,
      date: job.date ? new Date(job.date).toISOString().split('T')[0] : '',
      jobNumber: job.jobNumber || '',
      houseBL: job.houseBL || '', // ADD THIS LINE
      shippingTerm: job.shippingTerm || 'CY-CY',
      
      // Port info
      portOfLoading: job.polPort?.portName || '',
      portOfDischarge: job.podPort?.portName || '',
      portOfLoadingId: job.polPortId,
      portOfDischargeId: job.podPortId,
      
      // Free days and detention
      polFreeDays: job.polFreeDays || '',
      polDetentionRate: job.polDetentionRate || '',
      podFreeDays: job.podFreeDays || '',
      podDetentionRate: job.podDetentionRate || '',
      
      // FIX: Transhipment - properly set both the flag and the port name
      enableTranshipmentPort: !!job.transhipmentPortId,
      transhipmentPortName: transhipmentPortName, // Use the fetched port name
      transhipmentPortId: job.transhipmentPortId, // Keep the ID for submission
      
      // Agents
      expHandlingAgentAddressBookId: job.expHandlingAgentAddressBookId,
      impHandlingAgentAddressBookId: job.impHandlingAgentAddressBookId,
      
      // Container info
      quantity: job.quantity || '',
      containers: existingContainers,
      
      // Vessel details
      carrierName: job.carrierAddressBook?.companyName || '',
      carrierId: job.carrierAddressBookId,
      vesselName: job.vesselName || '',
      gateClosingDate: job.gsDate ? new Date(job.gsDate).toISOString().split('T')[0] : '',
      sobDate: job.sob ? new Date(job.sob).toISOString().split('T')[0] : '',
      etaToPod: job.etaTopod ? new Date(job.etaTopod).toISOString().split('T')[0] : '',
      
      // Return depot
      emptyReturnDepot: job.emptyReturnDepotAddressBookId?.toString() || '',
      estimatedEmptyReturnDate: job.estimateDate ? new Date(job.estimateDate).toISOString().split('T')[0] : '',
    });
    
    setShowModal(true);
  };

  // Handle view empty repo job
  const handleView = (job: any) => {
    setViewEmptyRepoJob(job);
    setShowViewModal(true);
  };

  // Handle opening CRO modal with pre-filled data
  const handleOpenCroModal = async (job: any) => {
    try {
      // Fetch fresh data for the job
      const [addressBooksRes] = await Promise.all([
        axios.get(`http://localhost:8000/addressbook`),
      ]);
      
      const addressBooks = addressBooksRes.data;
      
      // Get company information
      const shipper = addressBooks.find(
        (ab: any) => ab.id === job.shipperAddressBookId
      );
      
      const primaryDepot = addressBooks.find(
        (ab: any) => ab.companyName === (job.containers?.[0]?.depotName || "Unknown Depot")
      ) || addressBooks.find(
        (ab: any) => ab.name === (job.containers?.[0]?.depotName || "Unknown Depot")
      ) || addressBooks.find(
        (ab: any) => {
          const depotName = job.containers?.[0]?.depotName || "Unknown Depot";
          return ab.companyName?.includes(depotName) || depotName.includes(ab.companyName);
        }
      );

      // Pre-fill form data with current job data
      setCroFormData({
        date: new Date().toISOString().split('T')[0],
        houseBL: job.houseBL || job.masterBL || '',
        shipperRefNo: job.refNumber || '',
        shipper: shipper?.companyName || '',
        releaseDate: job.gsDate ? new Date(job.gsDate).toISOString().split('T')[0] : '',
        pol: job.polPort?.portName || '',
        finalDestination: job.podPort?.portName || '',
        tankPrep: job.tankPreparation || 'N/A',
        pod: job.podPort?.portName || '',
        depotName: job.containers?.[0]?.depotName || 'Unknown Depot',
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
        containers: job.containers || []
      });
      
      setShowCroModal(true);
    } catch (error) {
      console.error('Error loading CRO data:', error);
    }
  };

  // Handle editing job from CRO modal
  const handleEditJobFromCro = async () => {
    try {
      // Find the current job data
      const jobToEdit = emptyRepoJobs.find((j: any) => j.houseBL === croFormData.houseBL);
      if (jobToEdit) {
        // Close CRO modal first
        setShowCroModal(false);
        // Use existing handleEdit function to open edit form
        await handleEdit(jobToEdit);
      }
    } catch (error) {
      console.error('Error opening edit form:', error);
    }
  };

  // Handle downloading CRO PDF
  const handleDownloadEmptyRepoCroPdf = async () => {
    try {
      // Find the current job data
      const currentJob = emptyRepoJobs.find((j: any) => j.houseBL === croFormData.houseBL);
      if (currentJob) {
        // Use the first generation date if CRO was already generated, otherwise use current date
        const formDate = croGenerationStatus[currentJob.id]?.hasCroGenerated && croGenerationStatus[currentJob.id]?.firstCroGenerationDate
          ? new Date(croGenerationStatus[currentJob.id].firstCroGenerationDate!).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Mark CRO as generated and capture first generation date if not already done
        const response = await apiFetch(`http://localhost:8000/empty-repo-job/mark-cro-generated/${currentJob.id}`, {
          method: 'POST',
        });
        const updatedJob = response;

        // Update CRO generation status
        setCroGenerationStatus(prev => ({
          ...prev,
          [currentJob.id]: {
            hasCroGenerated: updatedJob.hasCroGenerated || true,
            firstCroGenerationDate: updatedJob.firstCroGenerationDate || formDate
          }
        }));

        // Generate PDF with consistent date
        await generateEmptyRepoCroPdf(currentJob.id, croFormData.containers, formDate);
        setShowCroModal(false);
      }
    } catch (error) {
      console.error('Error generating CRO PDF:', error);
      alert('Error generating CRO PDF. Please try again.');
    }
  };

  // Handle direct download of CRO PDF from table
  const handleDirectCroDownload = async (job: any) => {
    try {
      // Use the first generation date if CRO was already generated, otherwise use current date
      const formDate = croGenerationStatus[job.id]?.hasCroGenerated && croGenerationStatus[job.id]?.firstCroGenerationDate
        ? new Date(croGenerationStatus[job.id].firstCroGenerationDate!).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Mark CRO as generated and capture first generation date if not already done
      const response = await apiFetch(`http://localhost:8000/empty-repo-job/mark-cro-generated/${job.id}`, {
        method: 'POST',
      });
      const updatedJob = response;

      // Update CRO generation status
      setCroGenerationStatus(prev => ({
        ...prev,
        [job.id]: {
          hasCroGenerated: updatedJob.hasCroGenerated || true,
          firstCroGenerationDate: updatedJob.firstCroGenerationDate || formDate
        }
      }));

      // Generate PDF with consistent date
      await generateEmptyRepoCroPdf(job.id, job.containers || [], formDate);
    } catch (error) {
      console.error('Error generating CRO PDF:', error);
      alert('Error generating CRO PDF. Please try again.');
    }
  };

  // Filter jobs based on search
  const filteredJobs = emptyRepoJobs.filter((job: any) => {
    const searchLower = searchText.toLowerCase();
    return (
      job.jobNumber?.toLowerCase().includes(searchLower) ||
      job.houseBL?.toLowerCase().includes(searchLower) ||
      job.polPort?.portName?.toLowerCase().includes(searchLower) ||
      job.podPort?.portName?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination logic
  const totalItems = filteredJobs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

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
              placeholder="Search by job number, house BL, or ports..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-black dark:text-white placeholder:text-neutral-400 focus-visible:ring-neutral-700"
            />
          </div>
        </div>

        <Button
          onClick={() => {
            // FIX: Reset selectedContainers when creating new job
            setSelectedContainers([]);
            
            setFormData({
              id: undefined,
              date: new Date().toISOString().split('T')[0],
              jobNumber: '',
              houseBL: '',
              shippingTerm: 'CY-CY',
              portOfLoading: '',
              portOfDischarge: '',
              portOfLoadingId: undefined,
              portOfDischargeId: undefined,
              polFreeDays: '',
              polDetentionRate: '',
              podFreeDays: '',
              podDetentionRate: '',
              enableTranshipmentPort: false,
              transhipmentPortName: '',
              transhipmentPortId: undefined,
              expHandlingAgentAddressBookId: undefined,
              impHandlingAgentAddressBookId: undefined,
              quantity: '',
              carrierName: '',
              carrierId: undefined,
              vesselName: '',
              gateClosingDate: '',
              sobDate: '',
              etaToPod: '',
              emptyReturnDepot: '',
              estimatedEmptyReturnDate: '',
              containers: [],
            });
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Empty Repo Job
        </Button>

        {showModal && (
          <AddEmptyRepoModal
            onClose={() => setShowModal(false)}
            formTitle={formData.id ? 'Edit Empty Repo Job' : 'New Empty Repo Job'}
            form={formData}
            setForm={setFormData}
            selectedContainers={selectedContainers} // ADD THIS
            setSelectedContainers={setSelectedContainers} // ADD THIS
            refreshShipments={fetchEmptyRepoJobs}
          />
        )}

        {/* View Modal */}
        {showViewModal && viewEmptyRepoJob && (
          <ViewEmptyRepoJobModal
            emptyRepoJob={viewEmptyRepoJob}
            onClose={() => {
              setShowViewModal(false);
            }}
            onDownload={() => {
              // You can implement download functionality here if needed
              console.log('Download functionality not implemented yet');
            }}
            onEdit={() => {
              // Close view modal first
              setShowViewModal(false);
              
              // Then trigger edit with a slight delay
              setTimeout(() => {
                handleEdit(viewEmptyRepoJob);
              }, 100);
            }}
          />
        )}

        {/* CRO Form Modal */}
        <Dialog open={showCroModal} onOpenChange={setShowCroModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Container Release Order</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Document Information */}
              <div className="grid w-full">
                <div className="space-y-2">
                  <Label htmlFor="date">CRO Issued Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={(() => {
                      // Find the current job to get CRO generation status
                      const currentJob = emptyRepoJobs.find((j: any) => j.houseBL === croFormData.houseBL);
                      if (currentJob && croGenerationStatus[currentJob.id]?.hasCroGenerated && croGenerationStatus[currentJob.id]?.firstCroGenerationDate) {
                        // If CRO was already generated, use the first generation date
                        return new Date(croGenerationStatus[currentJob.id].firstCroGenerationDate!).toISOString().split('T')[0];
                      }
                      // Otherwise use the current form date
                      return croFormData.date;
                    })()}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>
                {/* <div className="space-y-2">
                  <Label htmlFor="houseBL">House BL</Label>
                  <Input
                    id="houseBL"
                    value={croFormData.houseBL}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div> */}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* <div className="space-y-2">
                  <Label htmlFor="shipperRefNo">Reference No.</Label>
                  <Input
                    id="shipperRefNo"
                    value={croFormData.shipperRefNo}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div> */}
                {/* <div className="space-y-2">
                  <Label htmlFor="shipper">Shipper</Label>
                  <Input
                    id="shipper"
                    value={croFormData.shipper}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div> */}
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
              <Button variant="outline" onClick={handleEditJobFromCro} className='cursor-pointer'>
                Edit Empty Repo Job Form
              </Button>
              <Button onClick={handleDownloadEmptyRepoCroPdf} className='cursor-pointer'>
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto shadow-sm">
        <Table>
          <TableHeader className="bg-white dark:bg-neutral-900">
            <TableRow>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">Job Number</TableHead>
              {/* <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">House BL</TableHead> */}
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">Port of Loading</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">Port of Discharge</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">Vessel</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">ETD</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">CRO Status</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-neutral-400 py-6">
                  No empty repo jobs found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedJobs.map((job: any) => (
                <TableRow
                  key={job.id}
                  className="text-black dark:text-white border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <TableCell className="font-medium">{job.jobNumber}</TableCell>
                  {/* <TableCell>{job.houseBL || '-'}</TableCell> */}
                  <TableCell>{job.polPort?.portName || '-'}</TableCell>
                  <TableCell>{job.podPort?.portName || '-'}</TableCell>
                  <TableCell>{job.vesselName || '-'}</TableCell>
<TableCell>{job.etaTopod ? new Date(job.etaTopod).toLocaleDateString('en-GB') : '-'}</TableCell>                 
                  <TableCell>
                    {croGenerationStatus[job.id]?.hasCroGenerated ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 text-sm font-medium">Generated</span>
                        {croGenerationStatus[job.id]?.firstCroGenerationDate && (
                         <span className="text-xs text-gray-500">
  ({new Date(croGenerationStatus[job.id].firstCroGenerationDate!).toLocaleDateString('en-GB')})
</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-gray-500 text-sm">Not Generated</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      onClick={() => handleView(job)}
                      title="View Details"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-900/40 cursor-pointer dark:hover:bg-purple-900/40"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      onClick={() => handleEdit(job)}
                      title="Edit"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 cursor-pointer dark:hover:bg-blue-900/40"
                    >
                      <Pencil size={16} />
                    </Button>
                  
                    <Button
                      onClick={() => handleDelete(job.id)}
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
                          <span onClick={() => handleOpenCroModal(job)} className="flex-1 hover:text-blue-600">
                            Generate CRO
                          </span>
                          <Download 
                            size={16} 
                            className="text-green-600 hover:text-green-700 cursor-pointer" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectCroDownload(job);
                            }}
                          />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
};

export default EmptyRepo;