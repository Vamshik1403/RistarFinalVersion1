"use client";

import React, { useEffect, useState } from 'react';
import { Eye, Search, Filter, X, DollarSign } from "lucide-react";
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
import ViewShipmentModal from "../../shipments/allshipments/ViewShipmentModal";

const SalesInvoicesPage = () => {
  const [loading, setLoading] = useState(true);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    billingStatus: "",
    paymentStatus: ""
  });
  const [tempFilters, setTempFilters] = useState({
    billingStatus: "",
    paymentStatus: ""
  });
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showUpdateFormModal, setShowUpdateFormModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [formData, setFormData] = useState({
    invoiceNo: '',
    invoiceAmount: '',
    paidAmount: '',
    dueAmount: ''
  });
  const [formErrors, setFormErrors] = useState({
    invoiceNo: '',
    invoiceAmount: '',
    paidAmount: ''
  });
  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    fetchSalesInvoices();
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      try {
        const response = await fetch(`http://localhost:8000/permissions?userId=${userId}`);
        const data = await response.json();
        const billManagementPerm = data.find(
          (p: any) => p.module.toLowerCase() === "billmanagement"
        );
        setPermissions(billManagementPerm);
      } catch (err) {
        console.error("Failed to fetch permissions:", err);
      }
    }
  };

  const fetchSalesInvoices = async () => {
    try {
      const response = await axios.get('http://localhost:8000/bill-management');
      setSalesInvoices(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sales invoices:', error);
      setLoading(false);
    }
  };

  const handleViewShipment = async (invoice: any) => {
    if (invoice.remarks === 'Shipment Deleted') {
      alert('Cannot view shipment details - shipment has been deleted');
      return;
    }
    
    if (!invoice.shipmentId) {
      alert('No shipment linked to this invoice');
      return;
    }

    try {
      const response = await axios.get(`http://localhost:8000/shipment/${invoice.shipmentId}`);
      setSelectedShipment(response.data);
      setShowShipmentModal(true);
    } catch (error) {
      console.error('Error fetching shipment details:', error);
      alert('Failed to fetch shipment details');
    }
  };

  const handleUpdateBillingStatus = async (id: number, newStatus: string) => {
    try {
      await axios.patch(`http://localhost:8000/bill-management/${id}/billing-status`, {
        billingStatus: newStatus
      });
      fetchSalesInvoices(); // Refresh the list
      alert('Billing status updated successfully');
    } catch (error) {
      console.error('Error updating billing status:', error);
      alert('Failed to update billing status');
    }
  };

  const handleOpenUpdateForm = (invoice: any) => {
    setSelectedInvoice(invoice);
    setFormData({
      invoiceNo: invoice.invoiceNo || '',
      invoiceAmount: invoice.invoiceAmount > 0 ? invoice.invoiceAmount.toString() : '',
      paidAmount: invoice.paidAmount > 0 ? invoice.paidAmount.toString() : '',
      dueAmount: invoice.dueAmount > 0 ? invoice.dueAmount.toString() : ''
    });
    setFormErrors({ invoiceNo: '', invoiceAmount: '', paidAmount: '' });
    setShowUpdateFormModal(true);
  };

  const validateForm = () => {
    const errors = { invoiceNo: '', invoiceAmount: '', paidAmount: '' };
    let isValid = true;

    if (!formData.invoiceNo.trim()) {
      errors.invoiceNo = 'Invoice number is required';
      isValid = false;
    }

    const invoiceAmount = formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0;
    const paidAmount = formData.paidAmount ? parseFloat(formData.paidAmount) : 0;

    if (invoiceAmount < 0) {
      errors.invoiceAmount = 'Invoice amount cannot be negative';
      isValid = false;
    }

    if (paidAmount < 0) {
      errors.paidAmount = 'Paid amount cannot be negative';
      isValid = false;
    }

    if (paidAmount > invoiceAmount) {
      errors.paidAmount = 'Paid amount cannot be greater than invoice amount';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;

    try {
      await axios.patch(`http://localhost:8000/bill-management/${selectedInvoice.id}/invoice-details`, {
        invoiceNo: formData.invoiceNo,
        invoiceAmount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0,
        paidAmount: formData.paidAmount ? parseFloat(formData.paidAmount) : 0
      });
      
      fetchSalesInvoices(); // Refresh the list
      setShowUpdateFormModal(false);
      alert('Invoice details updated successfully');
    } catch (error: any) {
      console.error('Error updating invoice details:', error);
      alert('Failed to update invoice details: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleFormInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user starts typing
    if (formErrors[field as keyof typeof formErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleUpdateWithPermission = (invoice: any) => {
    if (permissions?.canEdit) {
      handleOpenUpdateForm(invoice);
    } else {
      alert("You don't have access to update invoice details.");
    }
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setShowFilterModal(false);
  };

  const handleResetTempFilters = () => {
    setTempFilters({
      billingStatus: "",
      paymentStatus: ""
    });
  };

  // Filter data based on search term AND filters
  const filteredData = salesInvoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.shipment?.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.shipment?.customerAddressBook?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBillingStatus = !filters.billingStatus || 
      invoice.billingStatus.toLowerCase() === filters.billingStatus.toLowerCase();
    
    const matchesPaymentStatus = !filters.paymentStatus || 
      invoice.paymentStatus.toLowerCase() === filters.paymentStatus.toLowerCase();
    
    return matchesSearch && matchesBillingStatus && matchesPaymentStatus;
  });

  // Check if any filters are active
  const hasActiveFilters = filters.billingStatus || filters.paymentStatus;

  const getStatusBadge = (status: string, type: 'billing' | 'payment') => {
    const baseClasses = "inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold border";
    
     if (type === 'billing') {
       switch (status.toLowerCase()) {
         case 'pending':
           return `${baseClasses} bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700`;
         case 'generated':
           return `${baseClasses} bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700`;
         default:
           return `${baseClasses} bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700`;
       }
     } else {
       switch (status.toLowerCase()) {
         case 'unpaid':
           return `${baseClasses} bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700`;
         case 'partial':
           return `${baseClasses} bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700`;
         case 'paid':
           return `${baseClasses} bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700`;
         default:
           return `${baseClasses} bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700`;
       }
     }
  };

  return (
    <div className="px-4 py-6 bg-white dark:bg-black min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center w-full max-w-sm">
            <Search size={18} className="absolute left-3 text-gray-400" />
            <Input
              placeholder="Search invoices..."
              className="pl-10 bg-white dark:bg-neutral-900 border-neutral-800 text-black dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Filter Button */}
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
            {hasActiveFilters && (
              <span className="ml-1 bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-medium">
                {Object.values(filters).filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales Invoices</h1>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-neutral-400">Active filters:</span>
          {filters.billingStatus && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              Billing: {filters.billingStatus}
              <button
                onClick={() => setFilters(prev => ({ ...prev, billingStatus: "" }))}
                className="ml-1 hover:bg-blue-700 rounded-full p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.paymentStatus && (
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              Payment: {filters.paymentStatus}
              <button
                onClick={() => setFilters(prev => ({ ...prev, paymentStatus: "" }))}
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
              <TableHead className="text-black dark:text-neutral-200">Invoice No</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Shipment No</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Shipment Date</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Customer</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Port</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Invoice Amount</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Paid Amount</TableHead>
              <TableHead className="text-black dark:text-neutral-200">Due Amount</TableHead>
               <TableHead className="text-black dark:text-neutral-200">Billing Status</TableHead>
               <TableHead className="text-black dark:text-neutral-200">Payment Status</TableHead>
               <TableHead className="text-black dark:text-neutral-200 text-center">Actions</TableHead>
               <TableHead className="text-black dark:text-neutral-200">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
               <TableRow>
                 <TableCell colSpan={12} className="text-center py-4 text-neutral-400">
                   Loading...
                 </TableCell>
               </TableRow>
             ) : filteredData.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={12} className="text-center py-4 text-neutral-400">
                   No sales invoices found
                 </TableCell>
               </TableRow>
            ) : (
              filteredData.map((invoice) => (
                <TableRow key={invoice.id} className="border-b border-border bg-background text-foreground">
                  <TableCell className="bg-background text-foreground font-medium">
                    {invoice.invoiceNo || '-'}
                  </TableCell>
                   <TableCell className="bg-background text-foreground">
                     {invoice.remarks === 'Shipment Deleted' 
                       ? invoice.shipmentNumber || 'Deleted'
                       : invoice.shipment?.jobNumber || 'N/A'
                     }
                   </TableCell>
                   <TableCell className="bg-background text-foreground">
                     {invoice.remarks === 'Shipment Deleted' 
                       ? (invoice.shipmentDate ? new Date(invoice.shipmentDate).toLocaleDateString() : 'Deleted')
                       : (invoice.shipment?.date ? new Date(invoice.shipment.date).toLocaleDateString() : 'N/A')
                     }
                   </TableCell>
                   <TableCell className="bg-background text-foreground">
                     {invoice.remarks === 'Shipment Deleted' 
                       ? invoice.customerName || 'Deleted'
                       : invoice.shipment?.customerAddressBook?.companyName || 'N/A'
                     }
                   </TableCell>
                   <TableCell className="bg-background text-foreground">
                     {invoice.remarks === 'Shipment Deleted' 
                       ? invoice.portDetails || 'Deleted'
                       : (invoice.shipment?.polPort?.portName && invoice.shipment?.podPort?.portName 
                           ? `${invoice.shipment.polPort.portName} → ${invoice.shipment.podPort.portName}`
                           : 'N/A')
                     }
                   </TableCell>
                  <TableCell className="bg-background text-foreground">
                    {invoice.invoiceAmount > 0 ? `$${invoice.invoiceAmount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    {invoice.paidAmount > 0 ? `$${invoice.paidAmount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    {invoice.dueAmount > 0 ? `$${invoice.dueAmount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="bg-background text-foreground">
                    <span className={getStatusBadge(invoice.billingStatus, 'billing')}>
                      {invoice.billingStatus}
                    </span>
                  </TableCell>
                   <TableCell className="bg-background text-foreground">
                     <span className={getStatusBadge(invoice.paymentStatus, 'payment')}>
                       {invoice.paymentStatus}
                     </span>
                   </TableCell>
                   <TableCell className="bg-background text-foreground text-center">
                     <div className="flex gap-2 justify-center">
                       <Button
                         variant="ghost"
                         size="icon"
                         className={`h-8 w-8 ${
                           !permissions?.canRead || invoice.remarks === 'Shipment Deleted'
                             ? 'text-gray-400 cursor-not-allowed' 
                             : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 dark:hover:bg-blue-900/40'
                         }`}
                         onClick={() => permissions?.canRead && invoice.remarks !== 'Shipment Deleted' && handleViewShipment(invoice)}
                         disabled={!permissions?.canRead || invoice.remarks === 'Shipment Deleted'}
                       >
                         <Eye size={16} />
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         className={`h-8 px-3 ${
                           invoice.remarks === 'Shipment Deleted' || !permissions?.canEdit
                             ? 'text-gray-400 cursor-not-allowed' 
                             : 'text-green-400 hover:text-green-300 hover:bg-green-900/40 dark:hover:bg-green-900/40'
                         }`}
                         onClick={() => invoice.remarks !== 'Shipment Deleted' && handleUpdateWithPermission(invoice)}
                         disabled={invoice.remarks === 'Shipment Deleted' || !permissions?.canEdit}
                       >
                         Update Status
                       </Button>
                     </div>
                   </TableCell>
                   <TableCell className="bg-background text-foreground">
                     {invoice.remarks ? (
                       <span className="text-red-600 dark:text-red-400 font-medium">
                         {invoice.remarks}
                       </span>
                     ) : '-'}
                   </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-lg">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Filter Sales Invoices</h3>
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
              {/* Billing Status Filter */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-2">
                  Billing Status
                </label>
                 <select
                   value={tempFilters.billingStatus}
                   onChange={(e) => setTempFilters(prev => ({ ...prev, billingStatus: e.target.value }))}
                   className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                 >
                   <option value="">All Billing Status</option>
                   <option value="Pending">Pending</option>
                   <option value="Generated">Generated</option>
                 </select>
              </div>
              
              {/* Payment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-black-300 mb-2">
                  Payment Status
                </label>
                 <select
                   value={tempFilters.paymentStatus}
                   onChange={(e) => setTempFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                   className="w-full px-3 py-2 bg-white dark:bg-neutral-700 text-black dark:text-white rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                 >
                   <option value="">All Payment Status</option>
                   <option value="Unpaid">Unpaid</option>
                   <option value="Partial">Partial Paid</option>
                   <option value="Paid">Fully Paid</option>
                 </select>
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

      {/* Shipment Details Modal */}
      {showShipmentModal && selectedShipment && (
        <ViewShipmentModal
          shipment={selectedShipment}
          onClose={() => setShowShipmentModal(false)}
        />
      )}

      {/* Update Invoice Details Form Modal */}
      {showUpdateFormModal && selectedInvoice && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-lg">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Update Invoice Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUpdateFormModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Invoice Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Number *
                </label>
                <Input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => handleFormInputChange('invoiceNo', e.target.value)}
                  className={`w-full bg-white dark:bg-neutral-700 text-black dark:text-white border-neutral-600 ${
                    formErrors.invoiceNo ? 'border-red-500' : ''
                  }`}
                  placeholder="Enter invoice number"
                />
                {formErrors.invoiceNo && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.invoiceNo}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Enter invoice number manually</p>
              </div>
              
              {/* Invoice Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Amount *
                </label>
                <Input
                  type="text"
                  min="0"
                  step="0.01"
                  value={formData.invoiceAmount}
                  onChange={(e) => handleFormInputChange('invoiceAmount', e.target.value)}
                  className={`w-full bg-white dark:bg-neutral-700 text-black dark:text-white border-neutral-600 ${
                    formErrors.invoiceAmount ? 'border-red-500' : ''
                  }`}
                  placeholder="Enter invoice amount"
                />
                {formErrors.invoiceAmount && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.invoiceAmount}</p>
                )}
              </div>
              
              {/* Paid Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paid Amount *
                </label>
                <Input
                  type="text"
                  min="0"
                  step="0.01"
                  max={formData.invoiceAmount}
                  value={formData.paidAmount}
                  onChange={(e) => handleFormInputChange('paidAmount', e.target.value)}
                  className={`w-full bg-white dark:bg-neutral-700 text-black dark:text-white border-neutral-600 ${
                    formErrors.paidAmount ? 'border-red-500' : ''
                  }`}
                  placeholder="Enter paid amount"
                />
                {formErrors.paidAmount && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.paidAmount}</p>
                )}
              </div>
              
              {/* Due Amount (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Amount
                </label>
                <Input
                  type="text"
                  value={formData.invoiceAmount && formData.paidAmount 
                    ? (parseFloat(formData.invoiceAmount) - parseFloat(formData.paidAmount)).toFixed(2)
                    : formData.invoiceAmount 
                      ? parseFloat(formData.invoiceAmount).toFixed(2)
                      : ''
                  }
                  className="w-full bg-gray-100 dark:bg-neutral-600 text-black dark:text-white border-neutral-600"
                  placeholder="Auto-calculated"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Automatically calculated</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowUpdateFormModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white cursor-pointer"
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleFormSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Update Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoicesPage;
