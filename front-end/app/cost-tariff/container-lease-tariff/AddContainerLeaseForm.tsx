import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ContainerLeaseTariff {
  id?: number;
  tariffCode: string;
  containerCategory: string;
  containerType: string;
  containerClass: string;
  leaseRentPerDay: number;
  currencyName: string;
  status: boolean;
}

interface AddTariffModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  editData?: ContainerLeaseTariff | null;
}

const AddContainerLeaseForm: React.FC<AddTariffModalProps> = ({ onClose, onSave, editData }) => {
  const [form, setForm] = useState({
    tariffCode: editData?.tariffCode || "CLT457780",
    containerCategory: editData?.containerCategory || "Tank",
    containerType: editData?.containerType || "ISO Tank",
    containerClass: editData?.containerClass || "T11",
    leaseRentPerDay: editData?.leaseRentPerDay || 0,
    
    currencyName: editData?.currencyName || "USD",


    status: typeof editData?.status === "boolean" ? editData.status : true,
  });

  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      tariffCode: form.tariffCode,
      containerCategory: form.containerCategory,
      containerType: form.containerType,
      containerClass: form.containerClass,
      leaseRentPerDay: Number(form.leaseRentPerDay),
      currencyName: form.currencyName,
      status: form.status, // <-- use directly, do not coerce with Boolean()
    };

    try {
      const url = editData
        ? `http://localhost:8000/container-lease-tariff/${editData.id}`
        : 'http://localhost:8000/container-lease-tariff';

      const method = editData ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(editData ? 'Failed to update tariff' : 'Failed to save tariff');
      }

      const result = await response.json();
      setAlert({ type: "success", message: editData ? "Tariff updated successfully" : "Tariff added successfully" });
      setTimeout(() => {
        setAlert(null);
        onSave(result);
        onClose();
      }, 1200);
    } catch (error) {
      setAlert({
        type: "error",
        message: editData ? "Failed to update tariff" : "Failed to add tariff",
      });
      setTimeout(() => setAlert(null), 2000);
    }
  };

  const formTitle = editData ? "Edit Container Lease Tariff" : "Add Container Lease Tariff";

  return (
    <div className="fixed inset-0 backdrop-blur-lg bg-opacity-40 flex items-center justify-center z-50">
      <Dialog open onOpenChange={onClose} modal={true}>
        <DialogContent className="max-w-xl w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto p-0 border border-neutral-200 dark:border-neutral-800" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              {formTitle}
            </DialogTitle>
            {/* Removed duplicate X close button here */}
          </DialogHeader>
          {alert && (
            <div className="px-6 pt-4">
              <Alert
                variant={alert.type === "success" ? "default" : "destructive"}
                className={cn(
                  "transition-all duration-300",
                  alert.type === "success"
                    ? "bg-green-950 border-green-700 text-green-300"
                    : "bg-red-950 border-red-700 text-red-300"
                )}
              >
                <AlertTitle>
                  {alert.type === "success" ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            </div>
          )}
          <form className="px-6 pb-6 pt-2" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Status */}
              <div className="flex items-center gap-2 mt-2">
                <p className="flex items text-sm text-gray-900 dark:text-neutral-200">Status</p>
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.checked })}
                  className="accent-blue-600 w-4 h-4"
                  id="status"
                />
                <label htmlFor="status" className="text-gray-900 dark:text-neutral-200 text-sm cursor-pointer">Active</label>
              </div>
              <div></div>
              {/* Tariff Code */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Tariff Code</label>
                <Input
                  type="text"
                  value={form.tariffCode}
                  readOnly
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
              {/* Container Category */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Container Category</label>
                <Input
                  type="text"
                  value={form.containerCategory}
                  readOnly
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
              {/* Container Type */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Container Type</label>
                <Input
                  type="text"
                  value={form.containerType}
                  readOnly
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
              {/* Container Class */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Container Class</label>
                <Input
                  type="text"
                  value={form.containerClass}
                  readOnly
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
              {/* Lease Rent per Day */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Lease Rent per Day</label>
                <Input
                  type="text"
                  value={form.leaseRentPerDay}
                  onChange={(e) => setForm({ ...form, leaseRentPerDay: Number(e.target.value) })}
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
              {/* Currency */}
              <div>
                <label className="block text-xs text-gray-900 dark:text-neutral-200 mb-1">Currency</label>
                <Input
                  type="text"
                  value={form.currencyName}
                  readOnly
                  className="w-full bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                />
              </div>
            </div>
            <DialogFooter className="flex justify-center gap-3 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="px-4 py-2 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-gray-900 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {editData ? "Edit" : "Add Tariff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddContainerLeaseForm;