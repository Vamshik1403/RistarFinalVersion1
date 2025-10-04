'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Eye, Download, Loader, Plus } from 'lucide-react';
import ViewQuotationModal from './ViewQuotationModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import AddQuotationModal from './QuotationForm';
import { apiFetch } from '../../lib/api';

const QuotationPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false); // New state for view modal
  const [formData, setFormData] = useState<any>(defaultFormData());
  const [viewQuotation, setViewQuotation] = useState<any>(null); // State for viewing
  const [quotations, setQuotations] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false); // New state for PDF generation
  const [permissions, setPermissions] = useState<any>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchQuotations();
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`http://localhost:8000/permissions?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          const permObj = data.reduce((acc: any, p: any) => {
            if (p.module.toLowerCase() === "quotation") {
              acc.canCreate = p.canCreate;
              acc.canRead = p.canRead;
              acc.canEdit = p.canEdit;
              acc.canDelete = p.canDelete;
            }
            return acc;
          }, {});
          setPermissions(permObj);
        })
        .catch(err => console.error("Failed to fetch permissions:", err));

    }
  }, []);

  const fetchQuotations = async () => {
    try {
      const res = await fetch("http://localhost:8000/quotations");
      const data = await res.json();

      // Sort by creation date in descending order
      const sortedData = data.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.effectiveDate || 0);
        const dateB = new Date(b.createdAt || b.effectiveDate || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setQuotations(sortedData);
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    }
  };
  const checkPermission = (permKey: keyof typeof permissions, actionFn: Function, ...args: any[]) => {
    if (permissions?.[permKey]) {
      actionFn(...args);
    } else {
      const permKeyStr = typeof permKey === 'string' ? permKey : String(permKey);
      alert(`You don't have ${permKeyStr.replace("can", "").toLowerCase()} access.`);
    }
  };


  // Update the handleEdit function to correctly map field names
  const handleEdit = (quote: any) => {

    setFormData({
      // Basic info
      id: quote.id,
      quotationRef: quote.quotationRefNumber,
      status: quote.status === 'ACTIVE',
      effectiveDate: quote.effectiveDate?.split('T')[0],
      validTillDate: quote.validTillDate?.split('T')[0],
      shippingTerm: quote.shippingTerm || '',

      // Customer info with names for display
      customerId: quote.custAddressBookId,
      customerName: quote.custAddressBook?.companyName || '',

      // Billing info
      billingParty: quote.billingParty || '',
      rateType: quote.rateType || '',
      billingType: quote.billingType || '',

      // Product info
      productId: quote.productId,
      productName: quote.product?.productName || '',

      // Port info
      portOfLoadingId: quote.polPortId,
      portOfLoading: quote.polPort?.portName || '',
      portOfDischargeId: quote.podPortId,
      portOfDischarge: quote.podPort?.portName || '',

      // Free days and detention rates
      expFreeDays: quote.polFreeDays || '',
      expDetentionRate: quote.polDetentionRate || '',
      impFreeDays: quote.podFreeDays || '',
      impDetentionRate: quote.podDetentionRate || '',

      // Depots and agents with names for display
      expDepotId: quote.expDepotAddressBookId || '',
      expDepotName: quote.expDepotAddressBook?.companyName || '',

      emptyReturnDepot: quote.emptyReturnAddressBookId || '',
      emptyReturnDepotName: quote.emptyReturnAddressBook?.companyName || '',

      expHAgentId: quote.expHandlingAgentAddressBookId || '',
      expHAgentName: quote.expHandlingAgentAddressBook?.companyName || '',

      impHAgentId: quote.impHandlingAgentAddressBookId || '',
      impHAgentName: quote.impHandlingAgentAddressBook?.companyName || '',

      // Transit info
      transitDays: quote.transitDays || '',

      // Transhipment info
      enableTranshipmentPort: !!quote.transhipmentPortId,
      transhipmentPortId: quote.transhipmentPortId || '',
      transhipmentPortName: quote.transhipmentPort?.portName || '',
      transhipmentAgentId: quote.transhipmentHandlingAgentAddressBookId || '',
      transhipmentAgentName: quote.transhipmentHandlingAgentAddressBook?.companyName || '',

      // Cost fields - explicitly log each field for debugging
      slotRate: quote.slotRate || '',
      depotAvgCost: quote.depotAvgCost || '',
      leasingCost: quote.leasingCost || '',
      depotCleaningCost: quote.depotCleaningCost || '',
      terminalHandlingFee: quote.terminalHandlingFee || '',
      containerPreparationCost: quote.containerPreparationCost || '', // Match name with form inputs


      expAgencyCommission: quote.expAgencyCommission || '',
      impAgencyCommission: quote.impAgencyCommission || '',
      expCollection: quote.expCollectionCharges || '',
      impCollection: quote.impCollectionCharges || '',

      // Totals
      totalCost: quote.totalCost || '',
      sellingAmount: quote.sellingAmount || '',
      totalRevenue: quote.totalRevenueAmount || '',
      totalPL: quote.totalPLAmount || '',
      plMargin: quote.plMargin || '',

      // Flag to indicate edit mode
      isEditing: true,
    });

    setShowModal(true);
  };

  // New function for viewing a quotation
  const handleView = (quote: any) => {
    setViewQuotation(quote);
    setShowViewModal(true);
  };

  // Replace the handleDownloadPDF function with this pure jsPDF implementation
  const handleDownloadPDF = async (quote: any) => {
    try {
      setIsGenerating(true);
      const loadingToast = toast.loading("Generating PDF...");

      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf');

      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Define constants
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const textColor = '#000000';
      const lineColor = '#cccccc';

      // Set default font
      doc.setFont('helvetica');

      // Helper function for text
      const addText = (
        text: string,
        x: number,
        y: number,
        options: { fontSize?: number; align?: 'left' | 'center' | 'right'; style?: 'normal' | 'bold' } = {}
      ) => {
        const { fontSize = 10, align = 'left', style = 'normal' } = options;
        doc.setFontSize(fontSize);
        doc.setTextColor(textColor);

        if (style === 'bold') {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }

        // Only show N/A for required fields, otherwise empty string
        const displayText = text || '';
        doc.text(displayText, x, y, { align });
      };

      // Helper function for section title
      const addSectionTitle = (text: string, y: number) => {
        doc.setFillColor('#f9f9f9');
        doc.rect(margin, y - 6, pageWidth - 2 * margin, 8, 'F');
        doc.setDrawColor(lineColor);
        doc.line(margin, y + 4, pageWidth - margin, y + 4);
        addText(text, margin, y, { fontSize: 12, style: 'bold' });
        return y + 8;
      };

      // Helper function to add a two-column data row
      const addDataRow = (
        label1: string,
        value1: string,
        label2: string,
        value2: string,
        y: number
      ) => {
        // Fixed widths to ensure consistent alignment
        const col1 = margin;                    // Label 1 start
        const col2 = margin + 45;               // Value 1 start - widened for longer labels
        const col3 = pageWidth / 2;             // Label 2 start - exactly at half page
        const col4 = pageWidth / 2 + 45;        // Value 2 start - widened for longer labels

        // Draw the labels and values
        addText(label1 + ':', col1, y, { style: 'bold' });
        addText(value1, col2, y);

        // Only add the second column if there's a label
        if (label2) {
          addText(label2 + ':', col3, y, { style: 'bold' });
          addText(value2, col4, y);
        }

        return y + 7; // Increment the Y position for the next row
      };

      // Helper for date formatting
      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '';
        try {
          return new Date(dateStr).toLocaleDateString();
        } catch (e) {
          return dateStr;
        }
      };

      // Start creating the PDF content
      let yPos = margin;

      // Header with company logo (if available)
      addText('QUOTATION', pageWidth / 2, yPos, { fontSize: 18, align: 'center', style: 'bold' });
      yPos += 10;

      addText(`Reference: ${quote.quotationRefNumber || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // General Information Section
      yPos = addSectionTitle('General Information', yPos);
      yPos = addDataRow('Status', quote.status || '', 'Effective Date', formatDate(quote.effectiveDate), yPos);
      yPos = addDataRow('Valid Till', formatDate(quote.validTillDate), 'Shipping Term', quote.shippingTerm || '', yPos);
      yPos = addDataRow('Customer', quote.custAddressBook?.companyName || '', 'Billing Party', quote.billingParty || '', yPos);
      yPos = addDataRow('Rate Type', quote.rateType || '', 'Billing Type', quote.billingType || '', yPos);
      yPos = addDataRow('Product', quote.product?.productName || '', '', '', yPos);
      yPos += 5;

      // Port Information Section
      yPos = addSectionTitle('Port Information', yPos);
      yPos = addDataRow('Port of Loading', quote.polPort?.portName || '', 'Port of Discharge', quote.podPort?.portName || '', yPos);
      yPos = addDataRow('POL Free Days', quote.polFreeDays || '', 'POD Free Days', quote.podFreeDays || '', yPos);
      yPos = addDataRow('POL Detention Rate', quote.polDetentionRate || '', 'POD Detention Rate', quote.podDetentionRate || '', yPos);
      yPos = addDataRow('Transit Days', quote.transitDays || '', '', '', yPos);

      // Add transhipment if available
      if (quote.transhipmentPortId) {
        yPos = addDataRow('Transhipment Port', quote.transhipmentPort?.portName || '', 'Transhipment Agent', quote.transhipmentHandlingAgentAddressBook?.companyName || '', yPos);
      }
      yPos += 5;

      // Agents and Depots Section
      yPos = addSectionTitle('Agents and Depots', yPos);
      yPos = addDataRow('Exp. Depot', quote.expDepotAddressBook?.companyName || '', 'Empty Return Depot', quote.emptyReturnAddressBook?.companyName || '', yPos);
      yPos = addDataRow('Exp. Handling Agent', quote.expHandlingAgentAddressBook?.companyName || '', 'Imp. Handling Agent', quote.impHandlingAgentAddressBook?.companyName || '', yPos);
      yPos += 5;

      // Check if we need a new page
      if (yPos > doc.internal.pageSize.height - 70) {
        doc.addPage();
        yPos = margin;
      }

      // Costs & Fees Section
      yPos = addSectionTitle('Costs & Fees', yPos);
      yPos = addDataRow('Slot Rate', quote.slotRate || '', 'Depot Avg Cost', quote.depotAvgCost || '', yPos);
      yPos = addDataRow('Leasing Cost', quote.leasingCost || '', 'Terminal Handling', quote.terminalHandlingFee || '', yPos);
      yPos = addDataRow('Cleaning Cost', quote.depotCleaningCost || '', 'Container Prep', quote.containerPreparationCost || '', yPos);
      yPos = addDataRow('Exp. Agency Commission', quote.expAgencyCommission || '', 'Imp. Agency Commission', quote.impAgencyCommission || '', yPos);

      // Add collections if present
      if (quote.expCollectionCharges || quote.impCollectionCharges) {
        yPos = addDataRow('Exp. Collection', quote.expCollectionCharges || '', 'Imp. Collection', quote.impCollectionCharges || '', yPos);
      }
      yPos += 5;

      // Financial Summary - with highlighting
      yPos = addSectionTitle('Financial Summary', yPos);

      // Highlight box for financial data
      doc.setFillColor('#f0f0f0');
      doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 28, 'F');
      doc.setDrawColor(lineColor);
      doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 28, 'S');

      yPos = addDataRow('Total Cost', quote.totalCost || '', 'Selling Amount', quote.sellingAmount || '', yPos);
      yPos = addDataRow('Revenue', quote.totalRevenueAmount || '', 'P&L Amount', quote.totalPLAmount || '', yPos);
      yPos = addDataRow('P&L Margin', (quote.plMargin ? quote.plMargin + '%' : ''), '', '', yPos);
      yPos += 10;

      // Footer
      const footerY = doc.internal.pageSize.height - 10;
      addText(`Generated on ${new Date().toLocaleDateString()} | Ristar Logistics`, pageWidth / 2, footerY, { fontSize: 8, align: 'center' });

      // Save the PDF
      doc.save(`Quotation_${quote.quotationRefNumber || 'download'}.pdf`);

      // Clean up
      toast.dismiss(loadingToast);
      toast.success("PDF downloaded successfully!");

    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    try {
           await apiFetch(`http://localhost:8000/quotations/${id}`, {
             method: 'DELETE',
           });
     
      fetchQuotations();
    } catch (err) {
      console.error('Failed to delete quotation:', err);
    }
  };

  // Pagination logic
  const totalItems = quotations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuotations = quotations.slice(startIndex, endIndex);

  return (
    <div className="px-4 pt-4 pb-4 dark:bg-black">
      <div className="flex items-center justify-between mt-0 mb-4">
        <div className="relative w-full mr-4">
          <p className="text-xl font-bold text-gray-900 dark:text-white">Quotation</p>
        </div>
        <Button
          className={`bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 px-6 shadow rounded-md whitespace-nowrap cursor-pointer ${!permissions?.canCreate ? "opacity-50 cursor-not-allowed" : ""
            }`}
          onClick={() => {
            if (permissions?.canCreate) {
              setFormData(defaultFormData());
              setShowModal(true);
            } else {
              alert("You don't have access to create quotations.");
            }
          }}
        >
          <Plus size={16} className="mr-2" />
          Create Quote
        </Button>

      </div>

      <div className="rounded-lg shadow border border-neutral-800 bg-neutral-900 overflow-x-auto">
        <Table>
          <TableHeader className="bg-white dark:bg-neutral-900">
            <TableRow className="bg-white dark:bg-neutral-900">
              {[
                'Quote Ref.',
                'createdAt',
                'Effective',
                'Valid Till',
                'Customer',
                'Product',
                'Rate Type',
                'POL',
                'POD',
                'Sales',
                'Status',
                'Actions',
              ].map((heading, i) => (
                <TableHead
                  key={i}
                  className="text-center px-2 py-2 whitespace-nowrap text-black dark:text-neutral-200 bg-white dark:bg-neutral-900"
                >
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedQuotations.map((q) => (
              <TableRow key={q.id} className="border-b border-neutral-200 dark:border-neutral-800 text-black dark:text-white bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                <TableCell className="text-center">{q.quotationRefNumber}</TableCell>
                <TableCell className="text-center">
                  {q.createdAt ? new Date(q.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }) : '-'}
                </TableCell>
                <TableCell className="text-center">{q.effectiveDate?.split('T')[0]}</TableCell>
                <TableCell className="text-center">{q.validTillDate?.split('T')[0]}</TableCell>
                <TableCell className="text-center">{q.custAddressBook?.companyName}</TableCell>
                <TableCell className="text-center">{q.product.productName}</TableCell>
                <TableCell className="text-center">{q.rateType}</TableCell>
                <TableCell className="text-center">{q.polPort?.portName ?? '-'}</TableCell>
                <TableCell className="text-center">{q.podPort?.portName ?? '-'}</TableCell>
                <TableCell className="text-center">{q.sellingAmount}</TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={q.status} />
                </TableCell>
                <TableCell className="text-center bg-white dark:bg-neutral-900">
                  <div className="flex justify-center gap-2">
                    {/* View button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(q)}
                      className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-900/40 cursor-pointer dark:hover:bg-purple-900/40"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </Button>

                    {/* Download button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadPDF(q)}
                      className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-900/40 cursor-pointer dark:hover:bg-green-900/40"
                      title="Download PDF"
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                    </Button>

                    {/* Existing edit button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (permissions?.canEdit) {
                          handleEdit(q);
                        } else {
                          alert("You don't have access to edit quotations.");
                        }
                      }}
                      className={`h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 dark:hover:bg-blue-900/40 ${!permissions?.canEdit ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Button>


                    {/* Existing delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (permissions?.canDelete) {
                          handleDelete(q.id);
                        } else {
                          alert("You don't have access to delete quotations.");
                        }
                      }}
                      className={`h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/40 dark:hover:bg-red-900/40 ${!permissions?.canDelete ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </Button>

                  </div>
                </TableCell>
              </TableRow>
            ))}
            {quotations.length === 0 && (
              <TableRow className="bg-white dark:bg-neutral-900">
                <TableCell colSpan={12} className="text-center py-8 text-neutral-400 bg-white dark:bg-neutral-900">
                  No quotations found.
                </TableCell>
              </TableRow>
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

      {showModal && (
        <AddQuotationModal
          onClose={() => setShowModal(false)}
          formTitle={formData.id ? 'Edit Quotation' : 'Create Quotation'}
          form={formData}
          setForm={setFormData}
          fetchQuotations={fetchQuotations}
        />
      )}

      {/* New modal for viewing quotation details */}
      {showViewModal && viewQuotation && (
        <ViewQuotationModal
          quotation={viewQuotation}
          onClose={() => {
            setShowViewModal(false);
          }}
          onDownload={() => handleDownloadPDF(viewQuotation)}
          onEdit={() => {
            // Close view modal first
            setShowViewModal(false);

            // Then trigger edit with a slight delay
            setTimeout(() => {
              handleEdit(viewQuotation);
            }, 100);
          }}
        />
      )}
    </div>
  );
};

// StatusBadge component
const StatusBadge = ({ status }: { status: string }) => {
  const isActive = status?.toLowerCase() === 'active';
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold
        ${isActive
          ? 'bg-green-900/80 text-green-200 border border-green-700'
          : 'bg-red-900/80 text-red-200 border border-red-700'}
        shadow transition-all duration-300`}
      style={{
        minWidth: 70,
        textAlign: 'center',
        letterSpacing: 1,
      }}
    >
      {status}
    </span>
  );
};

// Create a new function specifically for PDF content with no modern styling
function generatePdfContentHTML(quote: any) {
  return `
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.5;
        color: #333;
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
      }
      .header h1 {
        margin-bottom: 5px;
        font-size: 24px;
      }
      .section {
        margin-bottom: 20px;
      }
      .section h2 {
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
        margin-bottom: 10px;
        font-size: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      td {
        padding: 4px 6px;
        vertical-align: top;
        word-wrap: break-word;
      }
      strong {
        font-weight: bold;
      }
    </style>
    <div class="header">
      <h1>QUOTATION</h1>
      <p>Reference: ${quote.quotationRefNumber || ''}</p>
    </div>
    
    <div class="section">
      <h2>General Information</h2>
      <table>
        <tr>
          <td width="25%"><strong>Status:</strong></td>
          <td width="25%">${quote.status || ''}</td>
          <td width="25%"><strong>Effective Date:</strong></td>
          <td width="25%">${quote.effectiveDate ? new Date(quote.effectiveDate).toLocaleDateString() : ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Valid Till:</strong></td>
          <td width="25%">${quote.validTillDate ? new Date(quote.validTillDate).toLocaleDateString() : ''}</td>
          <td width="25%"><strong>Shipping Term:</strong></td>
          <td width="25%">${quote.shippingTerm || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Customer:</strong></td>
          <td width="25%">${quote.custAddressBook?.companyName || ''}</td>
          <td width="25%"><strong>Billing Party:</strong></td>
          <td width="25%">${quote.billingParty || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Rate Type:</strong></td>
          <td width="25%">${quote.rateType || ''}</td>
          <td width="25%"><strong>Billing Type:</strong></td>
          <td width="25%">${quote.billingType || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Product:</strong></td>
          <td width="25%">${quote.product?.productName || ''}</td>
          <td width="25%"></td>
          <td width="25%"></td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Port Information</h2>
      <table>
        <tr>
          <td width="25%"><strong>Port of Loading:</strong></td>
          <td width="25%">${quote.polPort?.portName || ''}</td>
          <td width="25%"><strong>Port of Discharge:</strong></td>
          <td width="25%">${quote.podPort?.portName || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>POL Free Days:</strong></td>
          <td width="25%">${quote.polFreeDays || ''}</td>
          <td width="25%"><strong>POD Free Days:</strong></td>
          <td width="25%">${quote.podFreeDays || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>POL Detention Rate:</strong></td>
          <td width="25%">${quote.polDetentionRate || ''}</td>
          <td width="25%"><strong>POD Detention Rate:</strong></td>
          <td width="25%">${quote.podDetentionRate || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Transit Days:</strong></td>
          <td width="25%">${quote.transitDays || ''}</td>
          <td width="25%"></td>
          <td width="25%"></td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Costs & Fees</h2>
      <table>
        <tr>
          <td width="25%"><strong>Slot Rate:</strong></td>
          <td width="25%">${quote.slotRate || ''}</td>
          <td width="25%"><strong>Depot Avg Cost:</strong></td>
          <td width="25%">${quote.depotAvgCost || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Leasing Cost:</strong></td>
          <td width="25%">${quote.leasingCost || ''}</td>
          <td width="25%"><strong>Terminal Handling:</strong></td>
          <td width="25%">${quote.terminalHandlingFee || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Cleaning Cost:</strong></td>
          <td width="25%">${quote.depotCleaningCost || ''}</td>
          <td width="25%"><strong>Container Prep:</strong></td>
          <td width="25%">${quote.containerPreparationCost || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Exp. Agency Commission:</strong></td>
          <td width="25%">${quote.expAgencyCommission || ''}</td>
          <td width="25%"><strong>Imp. Agency Commission:</strong></td>
          <td width="25%">${quote.impAgencyCommission || ''}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>Financial Summary</h2>
      <table>
        <tr>
          <td width="25%"><strong>Total Cost:</strong></td>
          <td width="25%">${quote.totalCost || ''}</td>
          <td width="25%"><strong>Selling Amount:</strong></td>
          <td width="25%">${quote.sellingAmount || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>Revenue:</strong></td>
          <td width="25%">${quote.totalRevenueAmount || ''}</td>
          <td width="25%"><strong>P&L Amount:</strong></td>
          <td width="25%">${quote.totalPLAmount || ''}</td>
        </tr>
        <tr>
          <td width="25%"><strong>P&L Margin:</strong></td>
          <td width="25%">${quote.plMargin ? quote.plMargin + '%' : ''}</td>
          <td width="25%"></td>
          <td width="25%"></td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666666;">
      <p>Generated on ${new Date().toLocaleDateString()} | Ristar Logistics</p>
    </div>
  `;
}

// Default empty form structure
const defaultFormData = () => ({
  id: null,
  status: true,
  quotationRef: '',
  effectiveDate: '',
  validTillDate: '',
  shippingTerm: '',

  // Customer info
  customerId: '',
  customerName: '',

  billingParty: '',
  rateType: '',
  billingType: '',

  // Product info
  productId: '',
  productName: '',

  // Port info
  portOfLoadingId: '',
  portOfLoading: '',
  portOfDischargeId: '',
  portOfDischarge: '',

  expFreeDays: '',
  expDetentionRate: '',
  impFreeDays: '',
  impDetentionRate: '',

  // Depot and agent info
  expDepotId: '',
  expDepotName: '',
  emptyReturnDepot: '',
  emptyReturnDepotName: '',
  expHAgentId: '',
  expHAgentName: '',
  impHAgentId: '',
  impHAgentName: '',

  transitDays: '',
  enableTranshipmentPort: false,
  transhipmentPortId: '',
  transhipmentPortName: '',
  transhipmentAgentId: '',
  transhipmentAgentName: '',

  slotRate: '',
  depotAvgCost: '',
  leasingCost: '',
  depotCleaningCost: '',
  terminalHandlingFee: '',
  containerPreparation: '',
  expAgencyCommission: '',
  impAgencyCommission: '',
  expCollection: '',
  impCollection: '',
  totalCost: '',
  sellingAmount: '',
  totalRevenue: '',
  totalPL: '',
  plMargin: '',

  isEditing: false,
});

export default QuotationPage;