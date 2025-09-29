import React, { useState, useEffect } from "react";
import { Download, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

// Component to display latest container location data
const ContainerLocationDisplay = ({ 
  inventoryId, 
  fallbackDepotName, 
  fallbackPortName 
}: { 
  inventoryId: number | null; 
  fallbackDepotName?: string; 
  fallbackPortName?: string; 
}) => {
  const [locationData, setLocationData] = useState<{
    depotName: string;
    portName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestLocation = async () => {
      if (!inventoryId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch latest container data
        const inventoryResponse = await axios.get(`http://localhost:8000/inventory/${inventoryId}`);
        const inventory = inventoryResponse.data;

        // Get the latest leasing info
        const latestLeasingInfo = inventory.leasingInfo?.[0];
        
        if (latestLeasingInfo) {
          // Fetch port name
          let portName = fallbackPortName || "N/A";
          if (latestLeasingInfo.portId) {
            try {
              const portResponse = await axios.get(`http://localhost:8000/ports/${latestLeasingInfo.portId}`);
              portName = portResponse.data.portName;
            } catch (portError) {
              console.warn("Failed to fetch port name:", portError);
            }
          }

          // Fetch depot name
          let depotName = fallbackDepotName || "N/A";
          if (latestLeasingInfo.onHireDepotaddressbookId) {
            try {
              const depotResponse = await axios.get(`http://localhost:8000/addressbook/${latestLeasingInfo.onHireDepotaddressbookId}`);
              depotName = depotResponse.data.companyName;
            } catch (depotError) {
              console.warn("Failed to fetch depot name:", depotError);
            }
          }

          setLocationData({ depotName, portName });
        } else {
          // Fallback to stored values if no leasing info
          setLocationData({
            depotName: fallbackDepotName || "N/A",
            portName: fallbackPortName || "N/A"
          });
        }
      } catch (error) {
        console.error("Failed to fetch latest container location:", error);
        // Fallback to stored values
        setLocationData({
          depotName: fallbackDepotName || "N/A",
          portName: fallbackPortName || "N/A"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLatestLocation();
  }, [inventoryId, fallbackDepotName, fallbackPortName]);

  if (loading) {
    return <span className="text-gray-400">Loading...</span>;
  }

  return (
    <span>
      {locationData ? `${locationData.depotName} - ${locationData.portName}` : "N/A"}
    </span>
  );
};

interface ViewShipmentModalProps {
  shipment: any;
  onClose?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
}

const ViewShipmentModal: React.FC<ViewShipmentModalProps> = ({
  shipment,
  onClose,
  onDownload,
  onEdit,
}) => {
  const handleClose = () => {
    if (onClose) onClose();
  };

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString() : "";

  // Helper to render a section with filtered fields
  const renderSection = (title: string, fields: [string, any][]) => {
    const visibleFields = fields.filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    );
    if (visibleFields.length === 0) return null;

    return (
      <div>
        <h3 className="text-lg font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
          {title}
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {visibleFields.map(([label, value], idx) => (
            <div key={idx}>
              <label className="block text-sm text-neutral-700 dark:text-neutral-400 mb-1">
                {label}
              </label>
              <div className="text-black dark:text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-[1000px] max-h-[90vh] overflow-y-auto border border-neutral-800 relative">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 z-10 flex justify-between items-center px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-xl font-bold text-black dark:text-white">Shipment Details</h2>
            <p className="text-sm text-neutral-700 dark:text-neutral-400">
              Job Number: {shipment?.jobNumber || "-"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-1 text-blue-400 border-blue-800 hover:border-blue-700"
              >
                <Pencil size={16} />
                Edit Shipment
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-1 text-green-400 border-green-800 hover:border-green-700"
            >
              <Download size={16} />
              Download CRO
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-neutral-400 hover:text-black dark:hover:text-white"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Status + Created */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-medium text-black dark:text-white">
                Quotation Ref No:
              </span>
              <span className="text-black dark:text-white">
                {shipment.quotationRefNumber || "-"}
              </span>
            </div>
            <div className="text-sm text-black dark:text-neutral-400">
              <span className="mr-2">Created:</span>
              {shipment.createdAt
                ? new Date(shipment.createdAt).toLocaleString()
                : "-"}
            </div>
          </div>

          {/* Section Blocks */}
          {renderSection("General Information", [
            ["Date", formatDate(shipment.date)],
            ["Job Number", shipment.jobNumber],
            ["Reference Number", shipment.refNumber],
            ["Master BL", shipment.masterBL],
            ["Shipping Term", shipment.shippingTerm],
          ])}

          {renderSection("Company Information", [
            ["Customer Name", shipment.customerAddressBook?.companyName],
            ["Consignee Name", shipment.consigneeAddressBook?.companyName],
            ["Tank Preparation", shipment.tankPreparation],
            ["Shipper Name", shipment.shipperAddressBook?.companyName],
            ["Carrier Name", shipment.carrierAddressBook?.companyName],
          ])}

          {renderSection("Product Information", [
            ["Product Name", shipment.product ? `${shipment.product.productId} - ${shipment.product.productName} - ${shipment.product.productType}` : ""],
          ])}

          {renderSection("Port Information", [
            ["Port Of Loading", shipment.polPort?.portName],
            ["Port Of Discharge", shipment.podPort?.portName],
            ["Free Days (POL)", shipment.polFreeDays],
            ["Free Days (POD)", shipment.podFreeDays],
            ["Detention Rate (POL)", shipment.polDetentionRate],
            ["Detention Rate (POD)", shipment.podDetentionRate],
            ...(shipment.transhipmentPort
              ? ([
                  ["Transhipment Port", shipment.transhipmentPort?.portName],
                ] as [string, any][])
              : ([] as [string, any][])),
          ])}

          {renderSection("Handling Agents", [
            [
              "Exp. Handling Agent",
              shipment.expHandlingAgentAddressBook?.companyName,
            ],
            [
              "Imp. Handling Agent",
              shipment.impHandlingAgentAddressBook?.companyName,
            ],
            
          ])}

          {renderSection("Vessel Details", [
            ["Vessel Name", shipment.vesselName],
            ["Gate Closing Date", formatDate(shipment.gsDate)],
            ["SOB Date", formatDate(shipment.sob)],
            ["ETA to POD", formatDate(shipment.etaTopod)],
            
          ])}
           {renderSection("Return Depot Information", [
            [
                "Empty Return Depot",
                shipment.emptyReturnDepotAddressBook?.companyName,
              ],
            ["Estimated Empty Return Date", formatDate(shipment.estimateDate)],
          ])}

          {renderSection("Container Information", [
            ["Quantity", shipment.quantity],
            [
              "Container Numbers",
              shipment.containers
                ?.map((c: any) => c.containerNumber)
                .join(", "),
            ],
          ])}

          {/* Containers Table */}
          {shipment.containers && shipment.containers.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
                Container Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <thead className="bg-neutral-100 dark:bg-neutral-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                        Container Number
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                        Capacity
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                        Tare Weight
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                        Depot
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.containers.map((container: any, index: number) => (
                      <tr
                        key={index}
                        className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        <td className="px-4 py-2 text-sm text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                          {container.containerNumber || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                          {container.capacity || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                          {container.tare || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-black dark:text-white border-b border-neutral-200 dark:border-neutral-700">
                          <ContainerLocationDisplay 
                            inventoryId={container.inventoryId} 
                            fallbackDepotName={container.depotName}
                            fallbackPortName={container.port?.portName}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-black dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ViewShipmentModal; 