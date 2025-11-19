"use client";
import React, { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AlertTriangle, X, Calendar } from "lucide-react";
import { apiFetch } from "../../lib/api";
import dayjs from "dayjs";

// Date formatting functions to ensure consistent DD/MM/YY format
const formatDateForDisplay = (dateValue: string): string => {
  if (!dateValue) return "";

  // If it's already in YYYY-MM-DD format (from API), convert to DD/MM/YY
  if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }

  // If it's already in DD/MM/YY format, return as is
  if (dateValue.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
    return dateValue;
  }

  return dateValue;
};

const formatDateInput = (inputValue: string): string | null => {
  if (!inputValue) return null;

  // Handle YYYY-MM-DD format (from calendar selection)
  if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = inputValue.split('-');
    const date = new Date(`${year}-${month}-${day}`);
    if (date.getFullYear() == parseInt(year) && date.getMonth() == parseInt(month) - 1 && date.getDate() == parseInt(day)) {
      return inputValue; // Return as-is since it's already in correct format
    }
  }

  // Remove any non-digit characters except slashes for DD/MM/YY format
  const cleaned = inputValue.replace(/[^\d/]/g, '');

  // Handle DD/MM/YY input patterns
  if (cleaned.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
    const parts = cleaned.split('/');
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];

    // Convert 2-digit year to 4-digit (assuming 20xx for years 00-30, 19xx for 31-99)
    if (year.length === 2) {
      const yearNum = parseInt(year);
      year = yearNum <= 30 ? `20${year}` : `19${year}`;
    }

    // Validate date
    const date = new Date(`${year}-${month}-${day}`);
    if (date.getFullYear() == parseInt(year) && date.getMonth() == parseInt(month) - 1 && date.getDate() == parseInt(day)) {
      return `${year}-${month}-${day}`; // Return in YYYY-MM-DD format for API
    }
  }

  return null; // Invalid date
};

// Custom Date Picker Component
const CustomDatePicker = ({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  validationError
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder: string;
  className: string;
  validationError?: string;
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(
    value ? dayjs(value, 'YYYY-MM-DD') : null
  );
  const calendarRef = useRef<HTMLDivElement>(null);

  // Sync selectedDate with value prop changes
  useEffect(() => {
    if (value) {
      setSelectedDate(dayjs(value, 'YYYY-MM-DD'));
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const handleDateSelect = (date: dayjs.Dayjs) => {
    const formattedDate = date.format('YYYY-MM-DD');
    setSelectedDate(date);
    setShowCalendar(false);

    // Create a synthetic event with the YYYY-MM-DD format for direct form update
    const syntheticEvent = {
      target: { value: formattedDate }
    } as React.ChangeEvent<HTMLInputElement>;

    // Call onChange directly with the formatted date
    onChange(syntheticEvent);
  };

  const generateCalendarDays = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDate = startOfMonth.startOf('week');
    const endDate = endOfMonth.endOf('week');

    const days = [];
    let currentDate = startDate;

    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
      days.push(currentDate);
      currentDate = currentDate.add(1, 'day');
    }

    return days;
  };

  const isToday = (date: dayjs.Dayjs) => date.isSame(dayjs(), 'day');
  const isSelected = (date: dayjs.Dayjs) => selectedDate && date.isSame(selectedDate, 'day');
  const isCurrentMonth = (date: dayjs.Dayjs) => date.isSame(currentMonth, 'month');

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value ? formatDateForDisplay(value) : ""}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete="off"
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <Calendar size={16} />
        </button>
      </div>

      {showCalendar && (
        <div ref={calendarRef} className="absolute z-50 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-4 w-80">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {currentMonth.format('MMMM YYYY')}
            </h3>
            <button
              type="button"
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((date, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDateSelect(date)}
                className={`
                  text-xs p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-700
                  ${!isCurrentMonth(date) ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-white'}
                  ${isToday(date) ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : ''}
                  ${isSelected(date) ? 'bg-blue-500 text-white' : ''}
                `}
              >
                {date.format('D')}
              </button>
            ))}
          </div>

          {/* Today Button */}
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => handleDateSelect(dayjs())}
              className="w-full text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 py-2 rounded"
            >
              Today
            </button>
          </div>
        </div>
      )}

      {validationError && (
        <p className="text-red-500 text-xs mt-1">{validationError}</p>
      )}
    </div>
  );
};

const AddQuotationModal = ({
  onClose,
  formTitle,
  form,
  setForm,
  fetchQuotations,
}: any) => {
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [portSuggestions, setPortSuggestions] = useState<any[]>([]);
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [showDischargeDropdown, setShowDischargeDropdown] = useState(false);
  const [expDepots, setExpDepots] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [emptyReturnDepots, setEmptyReturnDepots] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [expAgents, setExpAgents] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [impHandlingAgents, setImpHandlingAgents] = useState<
    { id: number; companyName: string }[]
  >([]);
  const [transhipmentPortSuggestions, setTranshipmentPortSuggestions] =
    useState<any[]>([]);
  const [showTranshipmentDropdown, setShowTranshipmentDropdown] =
    useState(false);
  const [trsHandlingAgents, setTrsHandlingAgents] = useState<any[]>([]);

  // Add validation error state
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [highlightProduct, setHighlightProduct] = useState(-1);
  const [highlightPOL, setHighlightPOL] = useState(-1);
  const [highlightPOD, setHighlightPOD] = useState(-1);
  const productInputRef = useRef<HTMLInputElement>(null);
  const portLoadingInputRef = useRef<HTMLInputElement>(null);
  const portDischargeInputRef = useRef<HTMLInputElement>(null);

  const customerInputRef = useRef<HTMLInputElement>(null);

  const handleNav = (
    e: React.KeyboardEvent<HTMLInputElement>,
    list: any[],
    highlight: number,
    setHighlight: Function,
    onSelect: Function
  ) => {
    if (list.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(highlight < list.length - 1 ? highlight + 1 : 0);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(highlight > 0 ? highlight - 1 : list.length - 1);
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && list[highlight]) {
        onSelect(list[highlight]);
      }
    }
  };

  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const filtered = productSuggestions;
    handleNav(
      e,
      filtered,
      highlightProduct,
      setHighlightProduct,
      (product: any) => {
        setForm((prev: any) => ({
          ...prev,
          productName: `${product.productId} - ${product.productName} - ${product.productType}`,
          productId: product.id,
          productCategory: product.containerCategory,
          productType: product.containerType,
          productClass: product.classType,
        }));
        setShowProductDropdown(false);
        setHighlightProduct(-1);
      }
    );
  };
  const handleLoadingPortKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const filtered = portSuggestions;
    handleNav(
      e,
      filtered,
      highlightPOL,
      setHighlightPOL,
      (port: any) => {
        setForm((prev: any) => ({
          ...prev,
          portOfLoading: port.portName,
          portOfLoadingId: port.id,
        }));
        setShowPortDropdown(false);
        setHighlightPOL(-1);
      }
    );
  };
  const handleDischargePortKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const filtered = portSuggestions;
    handleNav(
      e,
      filtered,
      highlightPOD,
      setHighlightPOD,
      (port: any) => {
        setForm((prev: any) => ({
          ...prev,
          portOfDischarge: port.portName,
          portOfDischargeId: port.id,
        }));
        setShowDischargeDropdown(false);
        setHighlightPOD(-1);
      }
    );
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;        // ⛔ prevent double click
    setIsSubmitting(true);           // 🔐 lock submit button


    // Clear previous validation errors
    setValidationErrors({});

    // Required field validations
    const requiredFields = [
      "customerId",
      "productId",
      "portOfLoadingId",
      "portOfDischargeId",
    ];

    const errors: { [key: string]: string } = {};

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
      setIsSubmitting(false);
      return;
    }

    // Ensure none of the string fields are null
    const ensureString = (value: any) =>
      value === null || value === undefined ? "" : value;

    // Use existing dates for edit mode or set new dates for new records
    let effectiveDate, validTillDate;

    if (form.isEditing && form.effectiveDate && form.validTillDate) {
      // form.effectiveDate and form.validTillDate are already in YYYY-MM-DD format from formatDateInput
      effectiveDate = new Date(form.effectiveDate).toISOString();
      validTillDate = new Date(form.validTillDate).toISOString();
    } else {
      const today = new Date();
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(today.getDate() + 7);
      effectiveDate = today.toISOString();
      validTillDate = sevenDaysLater.toISOString();
    }

    const payload = {
      quotationRefNumber: form.quotationRef,
      status: form.status ? "ACTIVE" : "INACTIVE",
      effectiveDate: effectiveDate,
      validTillDate: validTillDate,
      shippingTerm: form.shippingTerm || "",
      custAddressBookId: Number(form.customerId),
      billingParty: form.billingParty || "",
      rateType: form.rateType || "",
      billingType: form.billingType || "",
      productId: Number(form.productId),
      polPortId: Number(form.portOfLoadingId),
      podPortId: Number(form.portOfDischargeId),
      polFreeDays: form.expFreeDays || "",
      podFreeDays: form.impFreeDays || "",
      polDetentionRate: form.expDetentionRate || "",
      podDetentionRate: form.impDetentionRate || "",
      expDepotAddressBookId: Number(form.expDepotId),
      emptyReturnAddressBookId: Number(form.emptyReturnDepot),
      expHandlingAgentAddressBookId: Number(form.expHAgentId),
      impHandlingAgentAddressBookId: Number(form.impHAgentId),
      transitDays: form.transitDays || "",
      transhipmentPortId: form.enableTranshipmentPort
        ? Number(form.transhipmentPortId)
        : null,
      transhipmentHandlingAgentAddressBookId: form.enableTranshipmentPort
        ? Number(form.transhipmentAgentId)
        : null,
      slotRate: ensureString(form.slotRate),
      depotAvgCost: ensureString(form.depotAvgCost),
      leasingCost: form.leasingCost,
      depotCleaningCost: ensureString(form.depotCleaningCost),
      terminalHandlingFee: ensureString(form.terminalHandlingFee),
      containerPreparationCost: form.containerPreparationCost,
      expAgencyCommission: ensureString(form.expAgencyCommission),
      impAgencyCommission: ensureString(form.impAgencyCommission),
      expCollectionCharges: ensureString(form.expCollection),
      impCollectionCharges: ensureString(form.impCollection),
      totalCost: ensureString(form.totalCost),
      sellingAmount: ensureString(form.sellingAmount),
      totalRevenueAmount: form.totalRevenueAmount,
      totalPLAmount: form.totalPLAmount,
      plMargin: ensureString(form.plMargin),
    };

    try {
      const isUpdate = Boolean(form.id);
      const url = isUpdate
        ? `http://localhost:8000/quotations/${form.id}`
        : 'http://localhost:8000/quotations';

      const result = await apiFetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: payload, // 👈 plain object allowed now
      });

      alert(isUpdate ? 'Quotation updated successfully!' : 'Quotation created successfully!');
      fetchQuotations?.();
      onClose();
    } catch (err: any) {
      console.error('Error submitting quotation:', err);
      alert(`Failed to save quotation. ${err?.message ? `Details: ${err.message}` : 'Please try again.'}`);
    }
    finally {
      setIsSubmitting(false);       // 🔓 always unlock on end
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch("http://localhost:8000/addressbook");
        const data = await res.json();
        const customers = data.filter(
          (entry: any) =>
            entry.businessType && entry.businessType.includes("Customer")
        );
        setCustomerSuggestions(customers);
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
    };

    fetchCustomers();
  }, []);

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    const filtered = customerSuggestions.filter((c) =>
      c.companyName.toLowerCase().includes(form.customerName.toLowerCase())
    );

    if (filtered.length === 0) return;

    // ↓ Move Down
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : 0
      );
    }

    // ↑ Move Up
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filtered.length - 1
      );
    }

    // ENTER → SELECT highlighted item
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        const selected = filtered[highlightIndex];
        setForm((prev: any) => ({
          ...prev,
          customerName: selected.companyName,
          customerId: selected.id,
        }));
        setShowSuggestions(false);
        setHighlightIndex(-1);
      }
    }
  };


  useEffect(() => {
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    // Set default form values if creating a new quote
    if (!form.id) {
      setForm((prev: any) => ({
        ...prev,
        // formatDate returns YYYY-MM-DD format which is correct for our internal storage
        effectiveDate: prev.effectiveDate || formatDate(today),
        validTillDate: prev.validTillDate || formatDate(sevenDaysLater),
      }));
    }

    const fetchNextRef = async () => {
      try {
        if (!form.quotationRef) {
          const res = await fetch("http://localhost:8000/quotations/next-ref");
          const data = await res.json();
          setForm((prev: any) => ({
            ...prev,
            quotationRef: data.quotationRefNumber,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch quotation ref:", error);
      }
    };

    fetchNextRef();
  }, []);

  const fetchProducts = async (searchTerm: string) => {
    try {
      const res = await fetch("http://localhost:8000/products");
      const data = await res.json();

      const filtered = data.filter((product: any) =>
        product.productName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setProductSuggestions(filtered);
    } catch (error) {
      console.error("Error fetching products:", error);
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

  const fetchExpDepotsByPort = async (portId: number) => {
    try {
      const res = await fetch("http://localhost:8000/addressbook");
      const data = await res.json();
      console.log("Fetched AddressBook:", data);

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

      console.log("Filtered Exp Depots:", filtered);
      setExpDepots(filtered);
    } catch (err) {
      console.error("Failed to fetch Exp. Depots:", err);
    }
  };

  useEffect(() => {
    if (form.portOfLoadingId) {
      fetchExpDepotsByPort(form.portOfLoadingId);
    } else {
      setExpDepots([]);
    }
  }, [form.portOfLoadingId]);

  const fetchEmptyReturnDepotsByPort = async (portId: number) => {
    try {
      const res = await fetch("http://localhost:8000/addressbook");
      const data = await res.json();
      console.log("Fetched address book data:", data); // ✅ check actual data

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

      console.log("Filtered Depots:", filtered); // ✅ check final result
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
  const fetchTrsHandlingAgents = async (portId: number) => {
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

      setTrsHandlingAgents(filtered);
    } catch (err) {
      console.error("Failed to fetch TRS H. Agents:", err);
    }
  };
  useEffect(() => {
    if (form.enableTranshipmentPort && form.transhipmentPortId) {
      fetchTrsHandlingAgents(form.transhipmentPortId);
    } else {
      setTrsHandlingAgents([]);
    }
  }, [form.transhipmentPortId, form.enableTranshipmentPort]);

  const calculateLeasingCost = async (product: any) => {
    try {
      const res = await fetch("http://localhost:8000/container-lease-tariff");
      const data = await res.json();

      const matchedTariff = data.find(
        (t: any) =>
          t.containerCategory === product.containerCategory &&
          t.containerType === product.containerType &&
          t.containerClass === product.classType
      );

      if (!matchedTariff) {
        console.warn("No lease tariff matched.");
        return;
      }

      const leasePerDay = parseFloat(matchedTariff.leaseRentPerDay || "0");

      const exp = parseInt(form.expFreeDays || "0");
      const imp = parseInt(form.impFreeDays || "0");
      const transit = parseInt(form.transitDays || "0");

      const totalDays = exp + imp + transit;
      const leasingCost = leasePerDay * totalDays;

      setForm((prev: any) => ({
        ...prev,
        leasingCost: leasingCost.toFixed(2),
      }));
    } catch (err) {
      console.error("Error fetching lease tariff:", err);
    }
  };

  useEffect(() => {
    const parse = (val: string) => parseFloat(val) || 0;

    const totalCost =
      parse(form.slotRate) +
      parse(form.depotAvgCost) +
      parse(form.leasingCost) +
      parse(form.depotCleaningCost) +
      parse(form.terminalHandlingFee) +
      parse(form.containerPreparationCost) +
      parse(form.expAgencyCommission) +
      parse(form.impAgencyCommission);

    const selling = parse(form.sellingAmount);
    const expCollection = parse(form.expCollection);
    const impCollection = parse(form.impCollection);

    const totalRevenue = selling + expCollection + impCollection;
    const totalPL = selling - totalCost;
    const plMargin = selling ? ((totalPL / selling) * 100).toFixed(2) : "0";

    setForm((prev: any) => ({
      ...prev,
      totalCost: totalCost.toFixed(2),
      totalRevenueAmount: totalRevenue.toFixed(2),
      totalPLAmount: totalPL.toFixed(2),
      plMargin,
    }));
  }, [
    form.slotRate,
    form.depotAvgCost,
    form.leasingCost,
    form.depotCleaningCost,
    form.terminalHandlingFee,
    form.containerPreparationCost,
    form.expAgencyCommission,
    form.impAgencyCommission,
    form.sellingAmount,
    form.expCollection,
    form.impCollection,
  ]);

  useEffect(() => {
    const recalcIfApplicable = async () => {
      if (
        form.productCategory === "Tank" &&
        form.productType === "ISO Tank" &&
        form.productClass === "T11"
      ) {
        const product = {
          containerCategory: form.productCategory,
          containerType: form.productType,
          classType: form.productClass,
        };
        calculateLeasingCost(product);
      }
    };

    recalcIfApplicable();
  }, [form.expFreeDays, form.impFreeDays, form.transitDays]);

  // useEffect(() => {
  //   setForm((prev: any) => ({ ...prev, leasingCost: "" }));
  // }, [form.productId]);

  useEffect(() => {
    const { productId, portOfDischargeId, emptyReturnDepot } = form;

    // If any of the required values are missing, reset depotCleaningCost
    if (!productId || !portOfDischargeId || !emptyReturnDepot) {
      setForm((prev: any) => ({
        ...prev,
        depotCleaningCost: "",
      }));
      return;
    }

    const calculateDepotCleaningCost = async () => {
      const { productId, portOfDischargeId, emptyReturnDepot } = form;

      if (!productId || !portOfDischargeId || !emptyReturnDepot) return;

      try {
        const [res, exchangeRes] = await Promise.all([
          fetch("http://localhost:8000/depot-cleaning-tariff-cost"),
          fetch("http://localhost:8000/exchange-rates"),
        ]);

        const [data, exchangeRateData] = await Promise.all([
          res.json(),
          exchangeRes.json(),
        ]);

        const matched = data.find(
          (item: any) =>
            Number(item.productId) === Number(productId) &&
            Number(item.portId) === Number(portOfDischargeId) &&
            Number(item.addressBookId) === Number(emptyReturnDepot)
        );

        if (matched) {
          const total = parseFloat(matched.cleaningCharges || "0");
          const currencyId = matched.currencyId;

          const exchange = exchangeRateData.find(
            (rate: any) => Number(rate.fromCurrencyId) === Number(currencyId)
          );

          const rate = exchange ? parseFloat(exchange.exchangeRate || "1") : 1;
          const variance = exchange ? parseFloat(exchange.variance || "0") : 0;
          const adjustedRate = rate + (rate * variance) / 100;

          const finalCleaningCost = total * adjustedRate;

          setForm((prev: any) => ({
            ...prev,
            depotCleaningCost: finalCleaningCost.toFixed(2),
          }));
        } else {
          setForm((prev: any) => ({
            ...prev,
            depotCleaningCost: "",
          }));
          console.warn("No depot cleaning cost matched.");
        }
      } catch (err) {
        console.error("Error fetching depot cleaning cost:", err);
        setForm((prev: any) => ({
          ...prev,
          depotCleaningCost: "",
        }));
      }
    };

    calculateDepotCleaningCost();
  }, [form.productId, form.portOfDischargeId, form.emptyReturnDepot]);

  useEffect(() => {
    const fetchDepotAvgTariff = async () => {
      try {
        const [tariffRes, currencyRes, exchangeRateRes] = await Promise.all([
          fetch("http://localhost:8000/depot-avg-tariff"),
          fetch("http://localhost:8000/currency"),
          fetch("http://localhost:8000/exchange-rates"),
        ]);

        const [tariffData, currencyData, exchangeRateData] = await Promise.all([
          tariffRes.json(),
          currencyRes.json(),
          exchangeRateRes.json(),
        ]);

        const getAdjustedTotal = (portId: number, depotId: number) => {
          const match = tariffData.find(
            (item: any) =>
              Number(item.portId) === Number(portId) &&
              Number(item.addressBookId) === Number(depotId)
          );

          if (!match) return 0;

          const total = parseFloat(match.total || "0");
          const currencyId = match.currencyId;

          const exchange = exchangeRateData.find(
            (rate: any) => Number(rate.fromCurrencyId) === Number(currencyId)
          );

          if (!exchange) return total;

          const rate = parseFloat(exchange.exchangeRate || "1");
          const variance = parseFloat(exchange.variance || "0");
          const adjustedRate = rate + (rate * variance) / 100;

          return total * adjustedRate;
        };

        // Guard clause to prevent running with incomplete data
        if (!form.portOfDischargeId || !form.emptyReturnDepot) return;

        // Only use POD (port of discharge) and its depot
        const total2 = getAdjustedTotal(
          form.portOfDischargeId,
          form.emptyReturnDepot
        );

        setForm((prev: any) => ({
          ...prev,
          depotAvgCost: total2.toFixed(2),
        }));
      } catch (err) {
        console.error("Failed to fetch depot avg tariff:", err);
        setForm((prev: any) => ({
          ...prev,
          depotAvgCost: "",
        }));
      }
    };

    fetchDepotAvgTariff(); // ✅ Now it's inside useEffect
  }, [form.portOfDischargeId, form.emptyReturnDepot]);

  useEffect(() => {
    // Special handling for edit mode to load all dependent data
    if (form.isEditing) {
      // Load customer suggestions
      if (form.customerId) {
        fetch("http://localhost:8000/addressbook")
          .then((res) => res.json())
          .then((data) => {
            const customers = data.filter(
              (entry: any) =>
                entry.businessType && entry.businessType.includes("Customer")
            );
            setCustomerSuggestions(customers);
          });
      }

      // Load product data
      if (form.productId) {
        fetchProducts(form.productName || "");
      }

      // Load port data and related entities
      if (form.portOfLoadingId) {
        fetchPorts(form.portOfLoading || "");
        fetchExpDepotsByPort(Number(form.portOfLoadingId));
        fetchExpHandlingAgentsByPort(Number(form.portOfLoadingId));
      }

      if (form.portOfDischargeId) {
        fetchPorts(form.portOfDischarge || "");
        fetchEmptyReturnDepotsByPort(Number(form.portOfDischargeId));
        fetchImpHandlingAgentsByPort(Number(form.portOfDischargeId));
      }

      // Load transhipment data if applicable
      if (form.enableTranshipmentPort && form.transhipmentPortId) {
        fetchTranshipmentPorts(form.transhipmentPortName || "");
        fetchTrsHandlingAgents(Number(form.transhipmentPortId));
      }

      if (form.product) {
        calculateLeasingCost(form.product);
      }
    }
  }, [form.isEditing]); // Only run when isEditing changes

  useEffect(() => {
    const fetchExpAgencyCommission = async () => {
      const portId = form.portOfLoadingId;
      const addressBookId = form.expHAgentId;

      if (!portId || !addressBookId) {
        setForm((prev: any) => ({
          ...prev,
          expAgencyCommission: "",
        }));
        return;
      }

      try {
        const [res, exchangeRes] = await Promise.all([
          fetch("http://localhost:8000/handling-agent-tariff-cost"),
          fetch("http://localhost:8000/exchange-rates"),
        ]);

        const [data, exchangeRateData] = await Promise.all([
          res.json(),
          exchangeRes.json(),
        ]);

        const matched = data.find(
          (item: any) =>
            Number(item.portId) === Number(portId) &&
            Number(item.addressBookId) === Number(addressBookId)
        );

        if (matched && matched.expCommission) {
          const total = parseFloat(matched.expCommission || "0");
          const currencyId = matched.currencyId;

          const exchange = exchangeRateData.find(
            (rate: any) => Number(rate.fromCurrencyId) === Number(currencyId)
          );

          const rate = exchange ? parseFloat(exchange.exchangeRate || "1") : 1;
          const variance = exchange ? parseFloat(exchange.variance || "0") : 0;
          const adjustedRate = rate + (rate * variance) / 100;

          const finalCommission = total * adjustedRate;

          setForm((prev: any) => ({
            ...prev,
            expAgencyCommission: finalCommission.toFixed(2),
          }));
        } else {
          setForm((prev: any) => ({
            ...prev,
            expAgencyCommission: "",
          }));
        }
      } catch (error) {
        console.error("Failed to fetch exp commission:", error);
        setForm((prev: any) => ({
          ...prev,
          expAgencyCommission: "",
        }));
      }
    };

    fetchExpAgencyCommission();
  }, [form.portOfLoadingId, form.expHAgentId]);

  useEffect(() => {
    const fetchImpAgencyCommission = async () => {
      const portId = form.portOfDischargeId;
      const addressBookId = form.impHAgentId;

      if (!portId || !addressBookId) {
        setForm((prev: any) => ({
          ...prev,
          impAgencyCommission: "",
        }));
        return;
      }

      try {
        const [res, exchangeRes] = await Promise.all([
          fetch("http://localhost:8000/handling-agent-tariff-cost"),
          fetch("http://localhost:8000/exchange-rates"),
        ]);

        const [data, exchangeRateData] = await Promise.all([
          res.json(),
          exchangeRes.json(),
        ]);

        const matched = data.find(
          (item: any) =>
            Number(item.portId) === Number(portId) &&
            Number(item.addressBookId) === Number(addressBookId)
        );

        if (matched && matched.impCommission) {
          const total = parseFloat(matched.impCommission || "0");
          const currencyId = matched.currencyId;

          const exchange = exchangeRateData.find(
            (rate: any) => Number(rate.fromCurrencyId) === Number(currencyId)
          );

          const rate = exchange ? parseFloat(exchange.exchangeRate || "1") : 1;
          const variance = exchange ? parseFloat(exchange.variance || "0") : 0;
          const adjustedRate = rate + (rate * variance) / 100;

          const finalCommission = total * adjustedRate;

          setForm((prev: any) => ({
            ...prev,
            impAgencyCommission: finalCommission.toFixed(2),
          }));
        } else {
          setForm((prev: any) => ({
            ...prev,
            impAgencyCommission: "",
          }));
        }
      } catch (error) {
        console.error("Failed to fetch imp commission:", error);
        setForm((prev: any) => ({
          ...prev,
          impAgencyCommission: "",
        }));
      }
    };

    fetchImpAgencyCommission();
  }, [form.portOfDischargeId, form.impHAgentId]);

  // Professional Top Alert Component
  const ProfessionalTopAlert = () => (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] transition-all duration-500 ease-out ${showValidationAlert
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



  return (
    <>
      <ProfessionalTopAlert />
      {/* Rest of the component */}
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-[1200px] max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between items-center px-6 pt-6 pb-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{formTitle}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
            >
              &times;
            </button>
          </div>
          <form
            className="px-6 pb-6 pt-2 [&_label]:text-gray-900 [&_input]:bg-white [&_input]:text-gray-900 [&_select]:bg-white [&_select]:text-gray-900 dark:[&_label]:text-white dark:[&_input]:bg-neutral-900 dark:[&_input]:text-white dark:[&_select]:bg-neutral-900 dark:[&_select]:text-white"
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Status */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-900 dark:text-white">Status</span>
                <Checkbox
                  id="status"
                  checked={form.status}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, status: checked })
                  }
                />
                <Label htmlFor="status" className="text-gray-900 dark:text-white text-sm">
                  Active
                </Label>
              </div>
              <div></div>

              {/* Quotation Ref No. */}
              <div className="col-span-2">
                <Label htmlFor="quotationRef" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Quotation Ref No.
                </Label>
                <Input
                  type="text"
                  value={form.quotationRef || ""}
                  readOnly
                  id="quotationRef"
                  className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800"
                />
              </div>

              {/* Effective Date */}
              <div>
                <Label htmlFor="effectiveDate" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Effective Date (DD/MM/YY)
                </Label>
                <CustomDatePicker
                  id="effectiveDate"
                  value={form.effectiveDate || ""}
                  onChange={(e) => {
                    const formattedValue = formatDateInput(e.target.value);
                    if (formattedValue !== null) {
                      setForm({ ...form, effectiveDate: formattedValue });
                    }
                  }}
                  onBlur={(e) => {
                    const formattedValue = formatDateInput(e.target.value);
                    if (formattedValue !== null) {
                      setForm({ ...form, effectiveDate: formattedValue });
                    }
                  }}
                  placeholder="DD/MM/YY"
                  className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800"
                />
              </div>

              {/* Valid Till */}
              <div>
                <Label htmlFor="validTillDate" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Valid Till (DD/MM/YY)
                </Label>
                <CustomDatePicker
                  id="validTillDate"
                  value={form.validTillDate || ""}
                  onChange={(e) => {
                    const formattedValue = formatDateInput(e.target.value);
                    if (formattedValue !== null) {
                      setForm({ ...form, validTillDate: formattedValue });
                    }
                  }}
                  onBlur={(e) => {
                    const formattedValue = formatDateInput(e.target.value);
                    if (formattedValue !== null) {
                      setForm({ ...form, validTillDate: formattedValue });
                    }
                  }}
                  placeholder="DD/MM/YY"
                  className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800"
                />
              </div>

              {/* Shipping Term */}
              <div>
                <Label htmlFor="shippingTerm" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Shipping Term
                </Label>
                <Select onValueChange={(value) => setForm({ ...form, shippingTerm: value })} value={form.shippingTerm}>
                  <SelectTrigger className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800">
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CY-CY">CY-CY</SelectItem>
                    <SelectItem value="CY-Door">CY-Door</SelectItem>
                    <SelectItem value="Door-CY">Door-CY</SelectItem>
                    <SelectItem value="Door-Door">Door-Door</SelectItem>
                    <SelectItem value="EX-WORK-CY">EX-WORK-CY</SelectItem>
                    <SelectItem value="EX-WORK-DOOR">EX-WORK-DOOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Name */}
              <div className="relative">
                <Label htmlFor="customerName" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={form.customerName || ""}
                  ref={customerInputRef}
                  onKeyDown={(e) => handleCustomerKeyDown(e)}
                  onChange={(e) => {
                    setForm((prev: any) => ({
                      ...prev,
                      customerName: e.target.value,
                      customerId: null,
                    }));
                    setShowSuggestions(true);

                    if (validationErrors.customerId) {
                      setValidationErrors(prev => ({ ...prev, customerId: "" }));
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  id="customerName"
                  className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800"
                  placeholder="Start typing customer name..."
                />

                {showSuggestions && form.customerName && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded mt-1 max-h-40 overflow-y-auto">
                    {customerSuggestions
                      .filter((c) =>
                        c.companyName
                          .toLowerCase()
                          .includes(form.customerName.toLowerCase())
                      )
                      .map((company, index) => (
                        <li
                          key={company.id}
                          onMouseDown={() => {
                            setForm((prev: any) => ({
                              ...prev,
                              customerName: company.companyName,
                              customerId: company.id,
                            }));
                            setShowSuggestions(false);
                          }}
                          className={`px-3 py-1 cursor-pointer text-sm
    ${highlightIndex === index
                              ? "bg-blue-600 text-white"
                              : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}
  `}
                        >
                          {company.companyName}
                        </li>

                      ))}
                    {customerSuggestions.filter((c) =>
                      c.companyName
                        .toLowerCase()
                        .includes(form.customerName?.toLowerCase())
                    ).length === 0 && (
                        <li className="px-3 py-1 text-gray-400 text-sm">
                          No match found
                        </li>
                      )}
                  </ul>
                )}
                {validationErrors.customerId && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.customerId}</p>
                )}
              </div>

              {/* Billing Party */}
              <div>
                <Label htmlFor="billingParty" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Billing Party
                </Label>
                <Select onValueChange={(value) => setForm({ ...form, billingParty: value })} value={form.billingParty}>
                  <SelectTrigger className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Freight Forwarder">Freight Forwarder</SelectItem>
                    <SelectItem value="Shipper">Shipper</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rate Type */}
              <div>
                <Label htmlFor="rateType" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Rate Type
                </Label>
                <Select onValueChange={(value) => setForm({ ...form, rateType: value })} value={form.rateType}>
                  <SelectTrigger className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-200 dark:border-neutral-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tender">Tender</SelectItem>
                    <SelectItem value="Spot">Spot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Billing Type */}
              <div>
                <Label htmlFor="billingType" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Billing Type
                </Label>
                <Select onValueChange={(value) => setForm({ ...form, billingType: value })} value={form.billingType}>
                  <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ocean Freight">Ocean Freight</SelectItem>
                    <SelectItem value="Rental">Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Name */}
              <div className="relative">
                <Label htmlFor="productName" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  ref={productInputRef}
                  value={form.productName || ""}
                  onKeyDown={handleProductKeyDown}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev: any) => ({
                      ...prev,
                      productName: value,
                      productId: undefined,
                    }));

                    if (validationErrors.productId) {
                      setValidationErrors((p) => ({ ...p, productId: "" }));
                    }

                    if (value.length > 1) {
                      fetchProducts(value);
                      setShowProductDropdown(true);
                    } else {
                      setShowProductDropdown(false);
                      setProductSuggestions([]);
                    }
                    setHighlightProduct(-1);
                  }}
                  onFocus={() => {
                    if ((form.productName || "").length > 1) {
                      fetchProducts(form.productName);
                      setShowProductDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
                  id="productName"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  placeholder="Start typing product name..."
                />

                {showProductDropdown && productSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-neutral-900 border border-neutral-800 rounded mt-1 max-h-40 overflow-y-auto">
                    {productSuggestions.map((product, index) => (
                      <li
                        key={product.id}
                        onMouseDown={() => {
                          setForm((prev: any) => ({
                            ...prev,
                            productName: `${product.productId} - ${product.productName} - ${product.productType}`,
                            productId: product.id,
                            productCategory: product.containerCategory,
                            productType: product.containerType,
                            productClass: product.classType,
                          }));
                          setShowProductDropdown(false);
                        }}
                        className={`px-3 py-1 cursor-pointer text-sm 
          ${highlightProduct === index
                            ? "bg-blue-600 text-white"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}
        `}
                      >
                        {`${product.productId} - ${product.productName} - ${product.productType}`}
                      </li>
                    ))}
                  </ul>
                )}

                {validationErrors.productId && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.productId}</p>
                )}
              </div>

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              {/* Port Of Loading */}
              <div className="relative">
                <Label htmlFor="portOfLoading" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Port Of Loading <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  ref={portLoadingInputRef}
                  value={form.portOfLoading || ""}
                  onKeyDown={handleLoadingPortKeyDown}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev: any) => ({
                      ...prev,
                      portOfLoading: value,
                      portOfLoadingId: undefined,
                    }));

                    if (validationErrors.portOfLoadingId) {
                      setValidationErrors((p) => ({ ...p, portOfLoadingId: "" }));
                    }

                    if (value.length > 1) {
                      fetchPorts(value);
                      setShowPortDropdown(true);
                    } else {
                      setShowPortDropdown(false);
                      setPortSuggestions([]);
                    }
                    setHighlightPOL(-1);
                  }}
                  onFocus={() => {
                    if ((form.portOfLoading || "").length > 1) {
                      fetchPorts(form.portOfLoading);
                      setShowPortDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowPortDropdown(false), 150)}
                  id="portOfLoading"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  placeholder="Start typing port of loading..."
                />

                {showPortDropdown && portSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-neutral-900 border border-neutral-800 rounded mt-1 max-h-40 overflow-y-auto">
                    {portSuggestions.map((port, index) => (
                      <li
                        key={port.id}
                        onMouseDown={() => {
                          setForm((prev: any) => ({
                            ...prev,
                            portOfLoading: port.portName,
                            portOfLoadingId: port.id,
                          }));
                          setShowPortDropdown(false);
                        }}
                        className={`px-3 py-1 cursor-pointer text-sm 
          ${highlightPOL === index
                            ? "bg-blue-600 text-white"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}
        `}
                      >
                        {port.portName}
                      </li>
                    ))}
                  </ul>
                )}
                {validationErrors.portOfLoadingId && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.portOfLoadingId}</p>
                )}
              </div>

              {/* Port Of Discharge */}
              <div className="relative">
                <Label htmlFor="portOfDischarge" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Port Of Discharge <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  ref={portDischargeInputRef}
                  value={form.portOfDischarge || ""}
                  onKeyDown={handleDischargePortKeyDown}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev: any) => ({
                      ...prev,
                      portOfDischarge: value,
                      portOfDischargeId: undefined,
                    }));

                    if (validationErrors.portOfDischargeId) {
                      setValidationErrors((p) => ({ ...p, portOfDischargeId: "" }));
                    }

                    if (value.length > 1) {
                      fetchPorts(value);
                      setShowDischargeDropdown(true);
                    } else {
                      setShowDischargeDropdown(false);
                      setPortSuggestions([]);
                    }
                    setHighlightPOD(-1);
                  }}
                  onFocus={() => {
                    if ((form.portOfDischarge || "").length > 1) {
                      fetchPorts(form.portOfDischarge);
                      setShowDischargeDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowDischargeDropdown(false), 150)}
                  id="portOfDischarge"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  placeholder="Start typing port of discharge..."
                />
                {showDischargeDropdown && portSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-neutral-900 border border-neutral-800 rounded mt-1 max-h-40 overflow-y-auto">
                    {portSuggestions.map((port, index) => (
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
                        className={`px-3 py-1 cursor-pointer text-sm 
          ${highlightPOD === index
                            ? "bg-blue-600 text-white"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}
        `}
                      >
                        {port.portName}
                      </li>
                    ))}
                  </ul>
                )}

                {validationErrors.portOfDischargeId && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.portOfDischargeId}</p>
                )}
              </div>

              {/* Free Days and Detention Rate */}
              <div className="flex w-full gap-4 col-span-2">
                <div className="flex-5">
                  <Label htmlFor="expFreeDays" className="block text-sm text-gray-900 dark:text-white mb-1">
                    Free Days
                  </Label>
                  <Input
                    type="text"
                    value={form.expFreeDays}
                    onChange={(e) =>
                      setForm({ ...form, expFreeDays: e.target.value })
                    }
                    id="expFreeDays"
                    className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  />
                </div>

                <div className="flex-5 gap-1">
                  <Label htmlFor="expDetentionRate" className="block text-sm text-gray-900 dark:text-white mb-1">
                    Detention Rate
                  </Label>
                  <Input
                    type="text"
                    value={form.expDetentionRate}
                    onChange={(e) =>
                      setForm({ ...form, expDetentionRate: e.target.value })
                    }
                    id="expDetentionRate"
                    className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  />
                </div>

                <div className="flex-5">
                  <Label htmlFor="impFreeDays" className="block text-sm text-gray-900 dark:text-white mb-1">
                    Free Days
                  </Label>
                  <Input
                    type="text"
                    value={form.impFreeDays}
                    onChange={(e) =>
                      setForm({ ...form, impFreeDays: e.target.value })
                    }
                    id="impFreeDays"
                    className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  />
                </div>

                <div className="flex-5">
                  <Label htmlFor="impDetentionRate" className="block text-sm text-gray-900 dark:text-white mb-1">
                    Detention Rate
                  </Label>
                  <Input
                    type="text"
                    value={form.impDetentionRate}
                    onChange={(e) =>
                      setForm({ ...form, impDetentionRate: e.target.value })
                    }
                    id="impDetentionRate"
                    className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  />
                </div>
              </div>

              {/* Exp. Depot Name */}
              <div>
                <Label htmlFor="expDepotId" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Exp. Depot Name <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => {
                  const selectedId = Number(value);
                  const selectedDepot = expDepots.find(
                    (d: any) => d.id === selectedId
                  );
                  setForm({
                    ...form,
                    expDepotId: selectedId,
                    expDepotName: selectedDepot?.companyName || "",
                  });
                }} value={form.expDepotId || ""}>
                  <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                    <SelectValue placeholder="First Select Port of Loading" />
                  </SelectTrigger>
                  <SelectContent>
                    {expDepots.map((depot: any) => (
                      <SelectItem key={depot.id} value={depot.id}>
                        {depot.companyName} - {depot.businessType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Empty Return Depot */}
              <div>
                <Label htmlFor="emptyReturnDepot" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Empty Return Depot <span className="text-red-500">*</span>
                </Label>

                <Select onValueChange={(value) => {
                  const selectedId = Number(value);
                  const selectedDepot = emptyReturnDepots.find(
                    (d) => d.id === selectedId
                  );
                  setForm({
                    ...form,
                    emptyReturnDepot: selectedId,
                    emptyReturnDepotName: selectedDepot?.companyName || "",
                  });
                }} value={form.emptyReturnDepot || ""}>
                  <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                    <SelectValue placeholder="First Select Port of Discharge" />
                  </SelectTrigger>
                  <SelectContent>
                    {emptyReturnDepots.map((depot: any) => (
                      <SelectItem key={depot.id} value={depot.id}>
                        {depot.companyName} - {depot.businessType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exp. H. Agent Name */}
              <div>
                <Label htmlFor="expHAgentId" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Exp. H. Agent Name  <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => {
                  const selectedId = Number(value);
                  const selected = expAgents.find(
                    (a: any) => a.id === selectedId
                  );
                  setForm({
                    ...form,
                    expHAgentId: selectedId,
                    expHAgentName: selected?.companyName || "",
                  });
                }} value={form.expHAgentId || ""}>
                  <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {expAgents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Imp. H. Agent Name */}
              <div>
                <Label htmlFor="impHAgentId" className="block text-sm text-gray-900 dark:text-white mb-1">
                  Imp. H. Agent Name  <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => {
                  const selectedId = Number(value);
                  const selected = impHandlingAgents.find(
                    (a: any) => a.id === selectedId
                  );
                  setForm({
                    ...form,
                    impHAgentId: selectedId,
                    impHAgentName: selected?.companyName || "",
                  });
                }} value={form.impHAgentId || ""}>
                  <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {impHandlingAgents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              {/* Transit Days */}
              <div className="col-span-2">
                <Label htmlFor="transitDays" className="block text-sm text-white mb-1">
                  Transit Days
                </Label>
                <Input
                  type="text"
                  value={form.transitDays}
                  onChange={(e) =>
                    setForm({ ...form, transitDays: e.target.value })
                  }
                  id="transitDays"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                />
              </div>

              {/* Enable Transhipment Port */}
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="enableTranshipmentPort"
                  checked={form.enableTranshipmentPort ?? false}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, enableTranshipmentPort: checked })
                  }
                />

                <Label
                  htmlFor="enableTranshipmentPort"
                  className="text-white text-sm"
                >
                  Enable Transhipment Port
                </Label>
              </div>

              {form.enableTranshipmentPort && (
                <>
                  {/* Transhipment Port */}
                  <div className="col-span-2">
                    <Label htmlFor="transhipmentPortName" className="block text-sm text-white mb-1">
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
                            transhipmentPortId: undefined,
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
                        id="transhipmentPortName"
                        className="w-full p-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded border border-neutral-800"
                        placeholder="Start typing transhipment port..."
                      />
                      {showTranshipmentDropdown &&
                        transhipmentPortSuggestions.length > 0 && (
                          <ul className="absolute z-10 w-full bg-white dark:bg-neutral-900 border border-neutral-800 rounded mt-1 max-h-40 overflow-y-auto">
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
                                className="px-3 py-1 hover:bg-blue-600 hover:text-white cursor-pointer text-sm text-gray-900 dark:text-white"
                              >
                                {port.portName}
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  </div>

                  {/* TRS. H. Agent Name */}
                  <div className="col-span-2">
                    <Label htmlFor="transhipmentAgentId" className="block text-sm text-white mb-1">
                      TRS. H. Agent Name
                    </Label>
                    <div className="w-1/2">
                      <Select
                        onValueChange={(value) => {
                          const selectedId = Number(value);
                          const selected = trsHandlingAgents.find((a) => a.id === selectedId);
                          setForm({
                            ...form,
                            transhipmentAgentId: selectedId,
                            transhipmentAgentName: selected?.companyName || "",
                          });
                        }}
                        value={form.transhipmentAgentId || ""}
                      >
                        <SelectTrigger className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {trsHandlingAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              {/* Financial Details */}
              <div>
                <Label htmlFor="slotRate" className="block text-sm text-white mb-1">
                  Slot Rate
                </Label>
                <Input
                  type="text"
                  value={form.slotRate ?? ""}
                  onChange={(e) => setForm({ ...form, slotRate: e.target.value })}
                  id="slotRate"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                />
              </div>

              <div>
                <Label htmlFor="depotAvgCost" className="block text-sm text-white mb-1">
                  Depot Avg Cost
                </Label>
                <Input
                  type="text"
                  value={form.depotAvgCost ?? ""}
                  readOnly
                  id="depotAvgCost"
                  className="w-full p-2 bg-white dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  placeholder={form.isEditing ? "" : "Auto-calculated"}
                />
              </div>

              <div>
                <Label htmlFor="leasingCost" className="block text-sm text-white mb-1">
                  Leasing Cost
                </Label>
                <Input
                  type="text"
                  value={form.leasingCost ?? ""}
                  readOnly
                  id="leasingCost"
                  className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800 bg-opacity-70 cursor-not-allowed"
                  placeholder={form.isEditing ? "" : "Auto-calculated"}
                />
              </div>

              <div>
                <Label htmlFor="depotCleaningCost" className="block text-sm text-white mb-1">
                  Depot Cleaning Cost
                </Label>
                <Input
                  type="text"
                  value={form.depotCleaningCost ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, depotCleaningCost: e.target.value })
                  }
                  id="depotCleaningCost"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  placeholder={form.isEditing ? "" : "Auto-calculated"}
                  readOnly
                />
              </div>


              <div>
                <Label htmlFor="terminalHandlingFee" className="block text-sm text-white mb-1">
                  Other Cost
                </Label>
                <Input
                  type="text"
                  value={form.terminalHandlingFee ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, terminalHandlingFee: e.target.value })
                  }
                  id="terminalHandlingFee"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                />
              </div>


              <div>
                <Label htmlFor="containerPreparationCost" className="block text-sm text-white mb-1">
                  Container Preparation
                </Label>
                <Input
                  type="text"
                  value={form.containerPreparationCost ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, containerPreparationCost: e.target.value })
                  }
                  id="containerPreparationCost"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                />
              </div>

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              <div>
                <Label htmlFor="expAgencyCommission" className="block text-sm text-white mb-1">
                  Exp. Agency Commission
                </Label>
                <Input
                  type="text"
                  value={form.expAgencyCommission ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, expAgencyCommission: e.target.value })
                  }
                  id="expAgencyCommission"
                  className="w-full p-2 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded border border-neutral-800"
                  readOnly
                  placeholder={form.isEditing ? "" : "Auto-calculated"}
                />
              </div>

              <div>
                <Label htmlFor="impAgencyCommission" className="block text-sm text-white mb-1">
                  Imp. Agency Commission
                </Label>
                <Input
                  type="text"
                  value={form.impAgencyCommission ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, impAgencyCommission: e.target.value })
                  }
                  id="impAgencyCommission"
                  className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                  readOnly
                  placeholder={form.isEditing ? "" : "Auto-calculated"}
                />
              </div>

              <div>
                <Label htmlFor="expCollection" className="block text-sm text-white mb-1">
                  Exp. Collection
                </Label>
                <Input
                  type="text"
                  value={form.expCollection ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, expCollection: e.target.value })
                  }
                  id="expCollection"
                  className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                />
              </div>

              <div>
                <Label htmlFor="impCollection" className="block text-sm text-white mb-1">
                  Imp. Collection
                </Label>
                <Input
                  type="text"
                  value={form.impCollection ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, impCollection: e.target.value })
                  }
                  id="impCollection"
                  className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                />
              </div>

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              <div className="space-y-4">
                {" "}
                {/* Ensures vertical stacking with spacing */}
                <div>
                  <Label htmlFor="totalCost" className="block text-sm text-white mb-1">
                    Total Cost
                  </Label>
                  <Input
                    type="text"
                    value={form.totalCost ?? ""}
                    readOnly
                    id="totalCost"
                    className="w-full p-2 bg-gray-800 text-white rounded border border-gray-700"
                  />
                </div>
                <div>
                  <Label htmlFor="sellingAmount" className="block text-sm text-white mb-1">
                    Selling Amount (Ocean Freight)
                  </Label>
                  <Input
                    type="text"
                    value={form.sellingAmount ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, sellingAmount: e.target.value })
                    }
                    id="sellingAmount"
                    className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                  />
                </div>
                <div>
                  <Label htmlFor="totalRevenueAmount" className="block text-sm text-white mb-1">
                    Total Revenue Amount
                  </Label>
                  <Input
                    type="text"
                    value={form.totalRevenueAmount ?? ""}
                    readOnly
                    id="totalRevenueAmount"
                    className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                  />
                </div>
                <div>
                  <Label htmlFor="totalPLAmount" className="block text-sm text-white mb-1">
                    Total P & L
                  </Label>
                  <Input
                    type="text"
                    value={form.totalPLAmount ?? ""}
                    readOnly
                    id="totalPLAmount"
                    className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800"
                  />
                </div>
                <div>
                  <Label htmlFor="plMargin" className="block text-sm text-white mb-1">
                    P/L Margin %
                  </Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={form.plMargin ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, plMargin: e.target.value })
                      }
                      id="plMargin"
                      className="w-full p-2 bg-neutral-900 text-white rounded border border-neutral-800 pr-6"
                    />
                    <span className="absolute right-2 top-2 text-white">%</span>
                  </div>
                </div>
              </div>

              <hr className="border-t border-gray-600 my-4 col-span-2" />

              {/* Continue mapping remaining fields similarly based on your form design */}
            </div>

            <div className="flex justify-center gap-3 mt-8">
              <Button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-800 cursor-pointer text-white rounded hover:bg-neutral-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 text-white rounded ${isSubmitting
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 cursor-pointer"
                  }`}
              >
                {isSubmitting ? "Please wait..." : "Submit"}
              </Button>

            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddQuotationModal;
