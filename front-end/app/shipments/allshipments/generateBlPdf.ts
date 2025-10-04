import jsPDF from "jspdf";
import axios from "axios";
import dayjs from "dayjs";

const ristarLogoBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABj 'lines tariff.',AAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAEPA5kDASIAAhEBAxEB/8QAHgABAAICAgMBAAAAAAAAAAAAAAgJBgcBBQIDBAr/xABvEAABAgUCAwUDBQgHDRMJCQEBAgMABAUGEQcIEiExCRNBUWEUInEVIzKBkRVCUmJyobGyCR";

// Define BL types
export type BLType = "original" | "draft" | "seaway" | "non-negotiable";

export interface BLFormData {
  shipmentId: number;
  blType: BLType;
  date: string;
  blNumber: string;
  shipper: string;
  consignee: string;
  notifyParty: string;
  placeOfAcceptance: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  vesselVoyageNo: string;
  containerInfo: string;
  marksNumbers: string;
  descriptionOfGoods: string;
  grossWeight: string;
  netWeight: string;
   unit?: string;
  tareWt?: string;
  cbmWt?: string;
  shippersealNo?: string;
  shippingMarks: string;
  freightCharges: string;
  freightPayableAt: string;
  numberOfOriginals: string;
  placeOfIssue: string;
  dateOfIssue: string;
  containers: any[];
}



// Normalize text heading into PDF to avoid odd spacing issues
function normalizePdfText(input: string): string {
  return (input || "")
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ") // collapse multiple spaces
    .replace(/\u2019/g, "'") // smart apostrophe
    .replace(/\u2013/g, "-") // en dash
    .replace(/\u2014/g, "--") // em dash
    .trim(); // remove leading/trailing whitespace
}

// Helper to load an image from public folder as Data URL for jsPDF
async function loadImageAsDataURL(path: string): Promise<string> {
  const res = await fetch(path);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function generateBlPdf(
  blType: BLType,
  formData: BLFormData,
  blFormData?: any, // Add the BL form data parameter
  copyNumber: number = 0 // Add copy number parameter (0=original, 1=2nd copy, 2=3rd copy)
) {
  // First calculate the required content height based on filled fields
  const calculateRequiredHeight = () => {
    let totalHeight = 0;

    // Base header height (constant): ~150mm
    totalHeight += 150;

    // Container section height (varies based on containers): ~50-80mm
    const containersToShow =
      blFormData?.containers && blFormData.containers.length > 0
        ? blFormData.containers
        : [];

    if (containersToShow.length > 3) {
      // If more than 3 containers, they go to a separate page - reduced height to eliminate empty space
      totalHeight += 55; // Increased from 50 to 55 to make page number visible for 4+ containers
    } else if (containersToShow.length === 1) {
      // For 1 container, increase height to prevent terms cutoff
      const containerHeightMm = 50; // Increased from 30mm to 50mm to fix terms cutoff
      totalHeight += containerHeightMm;
    } else if (containersToShow.length === 2) {
      // For 2 containers, increase height to prevent terms cutoff
      const containerHeightMm = 60; // Increased from 40mm to 60mm to fix terms cutoff
      totalHeight += containerHeightMm;
    } else if (containersToShow.length === 3) {
      // For 3 containers, more height to prevent cutoff (reduced due to smaller font and spacing)
      const containerHeightMm = 50; // Reduced from 70mm to 50mm due to smaller font and spacing
      totalHeight += containerHeightMm;
    }

    // Bottom section (delivery agent, freight, etc.): dynamic height based on container count
    const bottomSectionHeight = containersToShow.length > 3 ? 65 : 
                                containersToShow.length === 1 ? 60 : 
                                containersToShow.length === 2 ? 65 : 50; // Increased height for 1 and 2 containers to fix terms cutoff
    totalHeight += bottomSectionHeight;

    // Terms section height (constant for all container counts - increased for 1 container to prevent cutoff)
    let termsHeight = 0;
    if (blFormData?.chargesAndFees && blFormData.chargesAndFees.trim()) {
      // Height varies slightly based on container count - more height for 1 container
      const chargesLength = blFormData.chargesAndFees.length;
      if (containersToShow.length === 1) {
        termsHeight = Math.max(160, Math.min(200, 160 + (chargesLength / 100) * 10)); // Increased height for 1 container
      } else {
        termsHeight = Math.max(140, Math.min(180, 140 + (chargesLength / 100) * 10)); // Standard height for other container counts
      }
    } else {
      // Height varies based on container count - more height for 1 container
      if (containersToShow.length === 1) {
        termsHeight = 160; // Increased height for 1 container
      } else {
        termsHeight = 140; // Standard height for other container counts
      }
    }
    totalHeight += termsHeight;

     // Footer text height (For RISTAR LOGISTICS PVT LTD + As Agent for the Carrier) - positioned above terms
     // totalHeight += 20; // Removed - footer is positioned above terms section

     // Page number height - positioned below border (increased to prevent cutoff)
     totalHeight += 10; // Increased from 5 to 10 to prevent page number cutoff

     // Bottom margin - increased to ensure page number visibility
     totalHeight += 8; // Increased from 5 to 8 for better page number spacing

    // Minimum height for proper proportions
    return Math.max(totalHeight, 250);
  };

  const initialPageHeight = calculateRequiredHeight();

  // Create PDF with A3 width and initial calculated height
  const doc = new jsPDF("p", "mm", [297, initialPageHeight]);

  // Get container count early for dynamic positioning calculations
  const containersToShow =
    blFormData?.containers && blFormData.containers.length > 0
      ? blFormData.containers
      : [];
  const actualContainerCount = containersToShow.length;

  try {
    // Fetch shipment data for additional info like ports and vessel details
    console.log(
      "Starting BL PDF generation for shipment:",
      formData.shipmentId
    );
    const [shipmentRes, addressBooksRes, productsRes] = await Promise.all([
      axios.get(`http://localhost:8000/shipment/${formData.shipmentId}`),
      axios.get(`http://localhost:8000/addressbook`),
      axios.get(`http://localhost:8000/products`),
    ]);

    const shipment = shipmentRes.data;
    const addressBooks = addressBooksRes.data;
    const products = productsRes.data;

    // Use BL form data instead of address book lookups - prefer combined fields
    const shipper = blFormData
      ? {
          combinedInfo: blFormData.shipperInfo,
          companyName: blFormData.shippersName,
          address: blFormData.shippersAddress,
          phone: blFormData.shippersContactNo,
          email: blFormData.shippersEmail,
        }
      : {
          companyName: formData.shipper || "",
          address: "",
          phone: "",
          email: "",
        };

    const consignee = blFormData
      ? {
          combinedInfo: blFormData.consigneeInfo,
          companyName: blFormData.consigneeName,
          address: blFormData.consigneeAddress,
          phone: blFormData.consigneeContactNo,
          email: blFormData.consigneeEmail,
        }
      : {
          companyName: formData.consignee || "",
          address: "",
          phone: "",
          email: "",
        };

    const notifyParty = blFormData
      ? {
          combinedInfo: blFormData.notifyPartyInfo,
          companyName: blFormData.notifyPartyName,
          address: blFormData.notifyPartyAddress,
          phone: blFormData.notifyPartyContactNo,
          email: blFormData.notifyPartyEmail,
        }
      : consignee;

    // Get product information
    const product = products.find((p: any) => p.id === shipment.productId);

    // Format dates - Use the consistent date from formData instead of current date
    const blDate = dayjs(formData.date).format("DD.MM.YYYY");
    const shippedOnboardDate = dayjs(shipment.gsDate).format("DD.MM.YYYY");

    // Derive ports and labels
    const polName = shipment.polPort?.portName || "";
    const podName = shipment.podPort?.portName || "";

    // Container and weights from BL form or shipment
    const containers = shipment.containers || [];
    const sealNumber = blFormData?.sealNo || containers[0]?.sealNumber || "";

    // Use weights from BL form if available
    const grossWeight = blFormData
      ? blFormData.grossWt
      : formData.grossWeight || "";
    const netWeight = blFormData ? blFormData.netWt : formData.netWeight || "";
    const tareWeight = blFormData ? blFormData.tareWt : ""; // NEW
    const cbmWeight = blFormData ? blFormData.cbmWt : ""; // NEW
    const unit = blFormData?.unit || "KGS"; // NEW - default to KGS
    const shipperSealNo = blFormData?.shippersealNo || ""; // NEW
    
    // Use delivery agent info from BL form - prefer combined field
    const deliveryAgent = blFormData
      ? {
          combinedInfo: blFormData.deliveryAgentInfo,
          name: blFormData.deliveryAgentName,
          address: blFormData.deliveryAgentAddress,
          contactNo: blFormData.deliveryAgentContactNo,
          email: blFormData.deliveryAgentEmail,
          vat: blFormData.Vat,
        }
      : null;

    // Use freight amount from BL form - it's mapped as freightCharges in the pdfData
    // const freightAmount = blFormData?.freightAmount || formData?.freightCharges || '';

    // Use BL details from form
    const blDetails = blFormData?.billofLadingDetails || "";

    // Set font globally
    doc.setFont("arial");
    // Reset all text spacing and formatting properties to ensure normal rendering
    if ((doc as any).setCharSpace) {
      (doc as any).setCharSpace(0);
    }
    if ((doc as any).setWordSpace) {
      (doc as any).setWordSpace(0);
    }
    if ((doc as any).setTextScale) {
      (doc as any).setTextScale(1);
    }
    // Tighten line height to reduce wasted vertical space
    if ((doc as any).setLineHeightFactor) {
      (doc as any).setLineHeightFactor(1.05);
    }

  const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

// small margins
const marginX = 2; // Further reduced from 5 to 2 to move borderline even closer to corners
const marginY = 2; // Further reduced from 5 to 2 to move borderline even closer to corners

// usable area
const contentWidth = pageWidth - marginX * 2;
const contentHeight = pageHeight - marginY * 2;


    // Main border (centered) with dynamic height
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    // Draw outer border with calculated dimensions
    doc.line(marginX, marginY, marginX + contentWidth, marginY); // top

    // Track border positions - will be updated after terms section is calculated
     let bottomBorderY = initialPageHeight - 15; // Default position
    let leftBorderY = bottomBorderY; // Track left border position
    let rightBorderY = bottomBorderY; // Track right border position
    // Vertical borders will be drawn later after calculating correct position
    // Bottom border will be drawn later after calculating correct position

    // Header big box and split column like first image
    // Move header up to overlap the outer border top (removes the top gap/second line)
    const headerTop = marginY;
    const headerLeft = marginX;
    const headerWidth = contentWidth;
    const headerRightX = headerLeft + headerWidth;
    // helper to scale X positions from 190-wide reference to current header width
    const scaleX = (x: number) => marginX + (x / 190) * headerWidth;
    // Shift split further left to give more space to the right panel
    const headerSplitX = headerLeft + Math.floor(headerWidth * 0.43);

    // We will place text first to compute the required height, then draw the surrounding box
    const leftX = headerLeft + 5;
    const rightX = headerSplitX + 5;
    const leftMaxWidth = headerSplitX - headerLeft - 10;
    const rightMaxWidth = headerRightX - rightX - 5;

    // Left column content with very compact spacing to prevent footer cutoff
    // Reduced gap from headerTop + 6 to headerTop + 2 to minimize gap above shipper
    let y = headerTop + 2;
    const sectionPadding = 8; // Increased title padding to prevent overlap
    const fieldSpacing = 3; // Space between fields
    const sectionGap = 3; // Reduced gap between sections

    // Much smaller section heights to preserve space for footer
    const shipperMaxHeight = 24; // Significantly reduced
    const consigneeMaxHeight = 24; // Significantly reduced
    const notifyMaxHeight = 24; // Significantly reduced

     // SHIPPER section - very compact with more padding from top
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
     doc.text("Shipper", leftX, y + 2); // Added +2 to prevent overlap with borderline while maintaining gap to content
    y += sectionPadding;

    const shipperStartY = y;
    let currentFieldY = y;

    // Use combined shipper info if available, otherwise fall back to individual fields
    if (shipper?.combinedInfo && shipper.combinedInfo.trim()) {
      // Use combined field like charges and fees
      doc.setFont("arial", "normal");
      doc.setFontSize(10);
      const combinedLines = doc.splitTextToSize(
        shipper.combinedInfo,
        leftMaxWidth
      );

      // Display as many lines as fit in the available space
      combinedLines.forEach((line: string, index: number) => {
        if (currentFieldY + index * 4 < shipperStartY + shipperMaxHeight - 2) {
          doc.text(line, leftX, currentFieldY + index * 4);
        }
      });
    } else {
      // Fallback to individual fields if combined field is empty
      // Shipper Name - Bold (only if space available)
      if (
        shipper?.companyName &&
        currentFieldY < shipperStartY + shipperMaxHeight - 4
      ) {
        doc.setFont("arial", "bold");
        doc.setFontSize(10);
        const nameLines = doc.splitTextToSize(
          shipper.companyName,
          leftMaxWidth
        );
        doc.text(nameLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Shipper Address - Normal (only if space available)
      if (
        shipper?.address &&
        currentFieldY < shipperStartY + shipperMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const addressLines = doc.splitTextToSize(shipper.address, leftMaxWidth);
        doc.text(addressLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Shipper Phone - Normal (only if space available)
      if (
        shipper?.phone &&
        currentFieldY < shipperStartY + shipperMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const telLines = doc.splitTextToSize(
          `TEL: ${shipper.phone}`,
          leftMaxWidth
        );
        doc.text(telLines[0], leftX, currentFieldY);
        currentFieldY += 4;
      }

      // Shipper Email - Normal (only if space available)
      if (
        shipper?.email &&
        currentFieldY < shipperStartY + shipperMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const emailLines = doc.splitTextToSize(
          `EMAIL: ${shipper.email}`,
          leftMaxWidth
        );
        doc.text(emailLines[0], leftX, currentFieldY);
      }
    }

    // Fixed shipper underline position - moved down to prevent overlapping with text
    const shipperUnderlineY = headerTop + 2 + sectionPadding + shipperMaxHeight + 2; // Added +2 to move underline down
    doc.setLineWidth(0.4);
    // Extend underline fully to the panel borders (no side gaps)
    doc.line(headerLeft, shipperUnderlineY, headerSplitX, shipperUnderlineY);

    // CONSIGNEE section - very compact (shifted slightly down from underline)
    y = shipperUnderlineY + sectionGap + 2;
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Consignee (or order)", leftX, y);
    y += sectionPadding;

    const consigneeStartY = y;
    currentFieldY = y;

    // Use combined consignee info if available, otherwise fall back to individual fields
    if (consignee?.combinedInfo && consignee.combinedInfo.trim()) {
      // Use combined field like charges and fees
      doc.setFont("arial", "normal");
      doc.setFontSize(10);
      const combinedLines = doc.splitTextToSize(
        consignee.combinedInfo,
        leftMaxWidth
      );

      // Display as many lines as fit in the available space
      combinedLines.forEach((line: string, index: number) => {
        if (
          currentFieldY + index * 4 <
          consigneeStartY + consigneeMaxHeight - 2
        ) {
          doc.text(line, leftX, currentFieldY + index * 4);
        }
      });
    } else {
      // Fallback to individual fields if combined field is empty
      // Consignee Name - Bold (only if space available)
      if (
        consignee?.companyName &&
        currentFieldY < consigneeStartY + consigneeMaxHeight - 4
      ) {
        doc.setFont("arial", "bold");
        doc.setFontSize(10);
        const nameLines = doc.splitTextToSize(
          consignee.companyName,
          leftMaxWidth
        );
        doc.text(nameLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Consignee Address - Normal (only if space available)
      if (
        consignee?.address &&
        currentFieldY < consigneeStartY + consigneeMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const addressLines = doc.splitTextToSize(
          consignee.address,
          leftMaxWidth
        );
        doc.text(addressLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Consignee Phone - Normal (only if space available)
      if (
        consignee?.phone &&
        currentFieldY < consigneeStartY + consigneeMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const telLines = doc.splitTextToSize(
          `TEL: ${consignee.phone}`,
          leftMaxWidth
        );
        doc.text(telLines[0], leftX, currentFieldY);
        currentFieldY += 4;
      }

      // Consignee Email - Normal (only if space available)
      if (
        consignee?.email &&
        currentFieldY < consigneeStartY + consigneeMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const emailLines = doc.splitTextToSize(
          `EMAIL: ${consignee.email}`,
          leftMaxWidth
        );
        doc.text(emailLines[0], leftX, currentFieldY);
      }
    }

    // Fixed consignee underline position
    const consigneeUnderlineY =
      shipperUnderlineY + sectionGap + sectionPadding + consigneeMaxHeight;
    // Extend underline fully to the panel borders (no side gaps)
    doc.line(
      headerLeft,
      consigneeUnderlineY,
      headerSplitX,
      consigneeUnderlineY
    );

    // NOTIFY PARTY section - very compact (shifted slightly down from underline)
    y = consigneeUnderlineY + sectionGap + 2;
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Notify Party", leftX, y);
    y += sectionPadding;

    const notifyStartY = y;
    currentFieldY = y;

    // Use combined notify party info if available, otherwise fall back to individual fields
    if (notifyParty?.combinedInfo && notifyParty.combinedInfo.trim()) {
      // Use combined field like charges and fees
      doc.setFont("arial", "normal");
      doc.setFontSize(10);
      const combinedLines = doc.splitTextToSize(
        notifyParty.combinedInfo,
        leftMaxWidth
      );

      // Display as many lines as fit in the available space
      combinedLines.forEach((line: string, index: number) => {
        if (currentFieldY + index * 4 < notifyStartY + notifyMaxHeight - 2) {
          doc.text(line, leftX, currentFieldY + index * 4);
        }
      });
    } else {
      // Fallback to individual fields if combined field is empty
      // Notify Party Name - Bold (only if space available)
      if (
        notifyParty?.companyName &&
        currentFieldY < notifyStartY + notifyMaxHeight - 4
      ) {
        doc.setFont("arial", "bold");
        doc.setFontSize(10);
        const nameLines = doc.splitTextToSize(
          notifyParty.companyName,
          leftMaxWidth
        );
        doc.text(nameLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Notify Party Address - Normal (only if space available)
      if (
        notifyParty?.address &&
        currentFieldY < notifyStartY + notifyMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const addressLines = doc.splitTextToSize(
          notifyParty.address,
          leftMaxWidth
        );
        doc.text(addressLines[0], leftX, currentFieldY); // Only first line
        currentFieldY += 4;
      }

      // Notify Party Phone - Normal (only if space available)
      if (
        notifyParty?.phone &&
        currentFieldY < notifyStartY + notifyMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const telLines = doc.splitTextToSize(
          `TEL: ${notifyParty.phone}`,
          leftMaxWidth
        );
        doc.text(telLines[0], leftX, currentFieldY);
        currentFieldY += 4;
      }

      // Notify Party Email - Normal (only if space available)
      if (
        notifyParty?.email &&
        currentFieldY < notifyStartY + notifyMaxHeight - 4
      ) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const emailLines = doc.splitTextToSize(
          `EMAIL: ${notifyParty.email}`,
          leftMaxWidth
        );
        doc.text(emailLines[0], leftX, currentFieldY);
      }
    }

    // Fixed notify party end position
    const notifyPartyUnderlineY =
      consigneeUnderlineY + sectionGap + sectionPadding + notifyMaxHeight;
    const leftBottomY = notifyPartyUnderlineY;

    // Right column content: BL number, RISTAR logo, company info, terms paragraph
    let ry = headerTop + 8;

    // Get houseBL value for use elsewhere
    const houseBLValue = blFormData?.houseBL || shipment?.houseBL || "";

    doc.setFont("arial", "bold");
    doc.setFontSize(12);
    // Use houseBL as the main BL number if available, otherwise use the generated BL number
    const actualBlNumber =
      houseBLValue ||
      blFormData?.blNumber ||
      formData?.blNumber ||
      `BL RST/NSADMN/25/${String(formData.shipmentId).padStart(5, "0")}`;
    doc.text(actualBlNumber, rightX, ry);
    ry += 8;
    // Insert company logo image from public folder in marked area - centered horizontally
    try {
      const logoDataUrl = await loadImageAsDataURL("/crologo.jpg");
      const logoMaxWidth = Math.min(rightMaxWidth, 90);
      const aspectRatio = 271 / 921; // based on provided image dimensions
      const logoHeight = logoMaxWidth * aspectRatio;
      // Center the logo horizontally within the right panel
      const logoCenterX = rightX + (rightMaxWidth - logoMaxWidth) / 2;
      doc.addImage(
        logoDataUrl,
        "JPEG",
        logoCenterX,
        ry,
        logoMaxWidth,
        logoHeight
      );
      ry += logoHeight + 8;
    } catch (e) {
      // Fallback: keep spacing even if image fails to load
      ry += 22;
    }
    doc.setFont("arial", "bold");
    doc.setFontSize(12);
    // Center the company name horizontally
    const companyNameCenterX = rightX + rightMaxWidth / 2;
    doc.text("RISTAR LOGISTICS PVT LTD", companyNameCenterX, ry, {
      align: "center",
    });
    doc.setFont("arial", "bold");
    doc.setFontSize(12); // Increased font size from 10 to 12
    let rLines = doc.splitTextToSize(
      "Office No. C- 0010, Akshar Business Park, Plot No 3, Sector 25, Vashi Navi Mumbai - 400703",
      rightMaxWidth
    );
    // Center the address text
    doc.text(rLines, companyNameCenterX, ry + 12, { align: "center" });
    ry += 6 + rLines.length * 5 + 3;
    doc.setFontSize(9);
    // Terms block with dynamic fitting
    const maxRightTermsY = headerTop + 120; // Maximum Y for right terms to prevent overlap
    const termsBlock = [
      "Taken in charge in apparently good condition herein at the place of receipt for transport and delivery as mentioned above, unless otherwise stated. The MTO in accordance with the provision contained in the MTD undertakes to perform or to procure the performance of the multimodal transport from the place at which the goods are taken in charge, to the place designated for delivery and assumes responsibility for such transport. Once of the MTD(s) must be surrendered, duty endorsed in exchange for the goods. In witness where of the original MTD all of this tenor and date have been signed in the number indicated below one of which accomplished the other(s) to be void.",
    ];
    const termsWrapped = doc.splitTextToSize(
      termsBlock.join(" "),
      rightMaxWidth
    );

    // Calculate available space and limit text if needed
    const availableSpace = maxRightTermsY - (ry + 10);
    const maxTermsLines = Math.floor(availableSpace / 3.2);
    const displayedTerms = termsWrapped.slice(0, maxTermsLines);

    doc.text(displayedTerms, rightX, ry + 10);
    const rightBottomY = ry + displayedTerms.length * 3.2;

    // Determine header height dynamically
    const contentBottomY = Math.max(leftBottomY, rightBottomY);
    const portsTop = contentBottomY + 2; // Reduced from 4 to 2 to shift content up
    const rowH = 10; // Reduced from 12 to 10 to save space
    const portsHeight = rowH * 4; // four stacked rows on left
    const totalHeaderHeight = portsTop - headerTop + portsHeight + 2;

    // Draw header box (omit top edge so only the outer border top line is visible)
    doc.setLineWidth(0.5);
    // left edge
    doc.line(headerLeft, headerTop, headerLeft, headerTop + totalHeaderHeight);
    // bottom edge
    doc.line(
      headerLeft,
      headerTop + totalHeaderHeight,
      headerLeft + headerWidth,
      headerTop + totalHeaderHeight
    );
    // right edge
    doc.line(
      headerLeft + headerWidth,
      headerTop,
      headerLeft + headerWidth,
      headerTop + totalHeaderHeight
    );
    doc.line(
      headerSplitX,
      headerTop,
      headerSplitX,
      headerTop + totalHeaderHeight
    );
    // Separator above ports grid (left panel only)
    doc.line(headerLeft, portsTop, headerSplitX, portsTop);

    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    const pLeftX = headerLeft + 5;
    const innerSplitX =
      headerLeft + Math.floor((headerSplitX - headerLeft) / 2);
    const pMidX = innerSplitX + 5; // right side of the left panel

    // Row 1: Place Of Acceptance only
    doc.text("Place Of Acceptance", pLeftX, portsTop + 4);
    doc.setFontSize(10);
    doc.setFont("arial", "normal");
    doc.text(polName || "", pLeftX, portsTop + 9);

    // underline row 1
    doc.line(headerLeft, portsTop + rowH, headerSplitX, portsTop + rowH);

    // Row 2: Port Of Loading (left) + Port Of Discharge (right)
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Port Of Loading", pLeftX, portsTop + rowH + 4);
    doc.setFontSize(10);
    doc.setFont("arial", "normal");
    doc.text(polName || "", pLeftX, portsTop + rowH + 9);

    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Port Of Discharge", pMidX, portsTop + rowH + 4);
    doc.setFontSize(10);
    doc.setFont("arial", "normal");
    doc.text(podName || "", pMidX, portsTop + rowH + 9);

    // underline row 2
    doc.line(
      headerLeft,
      portsTop + rowH * 2,
      headerSplitX,
      portsTop + rowH * 2
    );

    // Row 3: Place Of Delivery
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Place Of Delivery", pLeftX, portsTop + rowH * 2 + 4);
    doc.setFont("arial", "normal");
    doc.text(podName || "", pLeftX, portsTop + rowH * 2 + 9);

    // underline row 3
    doc.line(
      headerLeft,
      portsTop + rowH * 3,
      headerSplitX,
      portsTop + rowH * 3
    );

    // Row 4: Vessel & Voyage No.
    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.text("Vessel & Voyage No.", pLeftX, portsTop + rowH * 3 + 4);
    doc.setFontSize(10);
    doc.setFont("arial", "normal");
    doc.text(shipment.vesselName || "", pLeftX, portsTop + rowH * 3 + 10);

    // Removed final underline to avoid double line with the header box bottom border

    // Title positioned in right panel above table - moved down slightly
    let yPos = headerTop + totalHeaderHeight + 3;
    const blTitleY = portsTop + rowH * 2 + 12; // Increased from 6 to 12 to move it down more
    doc.setFontSize(18);
    doc.setFont("arial", "bold");
    // Dynamic BL title based on copy number and type
    let blTypeText = "";
    if (blType === "original") {
      if (copyNumber === 0) {
        blTypeText = "1st ORIGINAL B/L";
      } else if (copyNumber === 1) {
        blTypeText = "2nd ORIGINAL B/L";
      } else if (copyNumber === 2) {
        blTypeText = "3rd ORIGINAL B/L";
      }
    } else if (blType === "draft") {
      if (copyNumber === 0) {
        blTypeText = "DRAFT B/L";
      } else if (copyNumber === 1) {
        blTypeText = "2nd COPY B/L";
      } else if (copyNumber === 2) {
        blTypeText = "3rd COPY B/L";
      }
    } else if (blType === "seaway") {
      if (copyNumber === 0) {
        blTypeText = "SEAWAY B/L";
      } else if (copyNumber === 1) {
        blTypeText = "2nd COPY B/L";
      } else if (copyNumber === 2) {
        blTypeText = "3rd COPY B/L";
      }
    } else if (blType === "non-negotiable") {
      if (copyNumber === 0) {
        blTypeText = "1st NON NEGOTIABLE B/L";
      } else if (copyNumber === 1) {
        blTypeText = "2nd COPY NON NEGOTIABLE B/L";
      } else if (copyNumber === 2) {
        blTypeText = "3rd COPY NON NEGOTIABLE B/L";
      }
    }
    // Move title to the right section centered within the right panel
    const rightPanelCenterX = headerSplitX + (headerRightX - headerSplitX) / 2;
    doc.text(blTypeText, rightPanelCenterX, blTitleY, { align: "center" });

    // No extra thick separator before the table region (prevents double lines)
    const tableTop = yPos + 6; // Reduced from 10 to 6 to save space
    doc.setLineWidth(1);

    // Table container
    // Place the container headers closer to the header box
    const containerTopY = headerTop + totalHeaderHeight + 1; // Reduced from 2 to 1
    const tableHeaderY = containerTopY + 2; // Reduced from 4 to 2
    doc.setLineWidth(0.5);

    // Headers
    doc.setFontSize(10);
    doc.setFont("arial", "bold");
    doc.text("Container No.(s)", marginX + 5, tableHeaderY + 2);
    doc.text("Marks and numbers", marginX + 60, tableHeaderY + 2);
    doc.text(
      "Number of packages, kinds of packages;",
      marginX + 110,
      tableHeaderY + 2
    );
    doc.text("general description of goods", marginX + 110, tableHeaderY + 6);
    // Removed the Gross/Net Weight header while keeping their values below
    // Add a header underline right below the header row
    doc.setLineWidth(0.6);
    const headerUnderlineY = tableHeaderY + 8; // increased header height for table columns
    doc.line(
      marginX,
      headerUnderlineY,
      marginX + headerWidth,
      headerUnderlineY
    );

    // Column x coordinates
    const col1X = marginX;
    const colRightX = marginX + 190;
    // No vertical/horizontal lines for the container section as requested
    const firstRowTextY = tableHeaderY + 8;
    let rowEndY = firstRowTextY + 50; // initial value, will be updated after containers are positioned
    // Header bottom line
    // No header underline

    // Row content
    doc.setFontSize(9);
    doc.setFont("arial", "normal");

    // Display all containers with their details vertically with pagination support
    let containerY = firstRowTextY + 6;
    const maxYOnPage = 250;
    const containerSpacing = 12;
    const shouldMoveAllContainersToNextPage = containersToShow.length > 3;

    if (shouldMoveAllContainersToNextPage) {
      // Add message in container section indicating containers are on next page
      doc.setFont("arial", "bold");
      doc.setFontSize(10);
      doc.text(
        "Find the containers details list below the page annexure.",
        marginX + 5,
        containerY + 30
      );

      // Update rowEndY to account for the message space
      rowEndY = Math.max(rowEndY, containerY + 20);

      // Add new page for all containers
      doc.addPage();
      containerY = 80; // Start lower to accommodate header

      // Calculate centered positions for second page
      const page2MarginX = (pageWidth - contentWidth) / 2;
      const page2MarginY = 20;

      // Add company header information (centered)
      doc.setFont("arial", "bold");
      doc.setFontSize(14);
      doc.text("RISTAR LOGISTICS PVT LTD", pageWidth / 2, page2MarginY + 10, {
        align: "center",
      });

      doc.setFont("arial", "bold");
      doc.setFontSize(12);
      doc.text("B/L ATTACHMENT", pageWidth / 2, page2MarginY + 20, {
        align: "center",
      });

      // Add BL details from form data (centered layout)
      doc.setFont("arial", "bold");
      doc.setFontSize(10);

      const houseBLValue = blFormData?.houseBL || shipment?.houseBL || "";
      // Use houseBL as the main BL number if available, otherwise use generated BL number
      const blNumber =
        houseBLValue || blFormData?.blNumber || `RST/ NSACMB /25/00179`;
      const dateOfIssue = blFormData?.dateOfIssue || blDate;
      const vesselName =
        blFormData?.vesselNo || shipment?.vesselName || "MV. EVER LYRIC 068E";

      doc.text(`BL NO.`, page2MarginX + 5, page2MarginY + 40);
      doc.text(`: ${blNumber}`, page2MarginX + 70, page2MarginY + 40);
      doc.text(`DATE OF ISSUE`, page2MarginX + 130, page2MarginY + 40);
      doc.text(`: ${dateOfIssue}`, page2MarginX + 180, page2MarginY + 40);

      doc.text(`VESSEL NAME / VOYAGE NO`, page2MarginX + 5, page2MarginY + 50);
      doc.text(`: ${vesselName}`, page2MarginX + 70, page2MarginY + 50);

      // Draw line separator (centered) - no need for conditional positioning since no more House BL
      const separatorY = page2MarginY + 60;
      doc.line(
        page2MarginX + 5,
        separatorY,
        page2MarginX + contentWidth - 5,
        separatorY
      );

      // Add container details title (centered)
      doc.setFont("arial", "bold");
      doc.setFontSize(12);
      const titleY = separatorY + 15;
      doc.text("CONTAINER DETAILS", pageWidth / 2, titleY, { align: "center" });

      containerY = titleY + 10; // Adjust for header content

      // Page number will be added for all pages later ("Page X of Y")
    }

    // Draw container display based on container count
    if (containersToShow.length > 0) {
      if (containersToShow.length <= 3) {
        // Vertical display on the left side for 3 or fewer containers
        const containerStartX = marginX + 15; // Left side position
        const containerStartY = containerY;


        const getContainerHeight = (container: any) => {
      let height = 20; // Base height for container number
      
      // Add height for each data field that has actual data (reduced from 7 to 5)
      if (container.sealNumber && container.sealNumber !== "N/A") height += 5;
      if (container.shippersealNo && container.shippersealNo !== "N/A") height += 5;
      if (container.grossWt && container.grossWt !== "N/A") height += 5;
      if (container.netWt && container.netWt !== "N/A") height += 5;
      if (container.tareWt && container.tareWt !== "N/A") height += 5;
      if (container.cbmWt && container.cbmWt !== "N/A") height += 5;
      
      return Math.max(height, 25); // Minimum height
    };

        let currentContainerY = containerStartY;


        doc.setFont("arial", "bold");
        doc.setFontSize(10);

        // Variables to calculate totals
        let totalGrossWt = 0;
        let totalNetWt = 0;
          let totalTareWt = 0; // NEW
        let totalCbmWt = 0; // NEW

      containersToShow.forEach((container: any, index: number) => {
  if (!container.containerNumber) return;

  const containerHeight = getContainerHeight(container);
  const yPos = currentContainerY;

  // Container number - always show
  doc.setFont("arial", "normal");
  doc.setFontSize(11);
  doc.text(container.containerNumber, containerStartX, yPos);

  let lineOffset = 7;
  
  // Carrier Seal - only show if data exists and is not "N/A"
  if (container.sealNumber && container.sealNumber !== "N/A") {
    const carrierSeals = container.sealNumber 
      ? container.sealNumber.split(',').map((s: string) => s.trim()).join(', ')
      : "N/A";
    if (carrierSeals !== "N/A") {
       doc.setFontSize(9); // Increased from 8 to 9 for better readability
      doc.text(`CARRIER SEAL: ${carrierSeals}`, containerStartX, yPos + lineOffset);
       lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
    }
  }

  // Shipper Seal - add this section
  if (container.shippersealNo && container.shippersealNo !== "N/A") {
    const shipperSeals = container.shippersealNo 
      ? container.shippersealNo.split(',').map((s: string) => s.trim()).join(', ')
      : "N/A";
    if (shipperSeals !== "N/A") {
       doc.setFontSize(9); // Increased from 8 to 9 for better readability
      doc.text(`SHIPPER SEAL: ${shipperSeals}`, containerStartX, yPos + lineOffset);
       lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
    }
  }
  
  // Weights - use formatted values that include units
  // Get the unit for this specific container (handle comma-separated units from multiple containers)
  const containerUnit = container.unit 
    ? (container.unit.includes(',') ? container.unit.split(',')[0].trim() : container.unit)
    : unit;
  
  if (container.grossWt && container.grossWt !== "N/A") {
    // Handle comma-separated values properly
    const grossValues = container.grossWt.split(',').map((s: string) => s.trim());
    const formattedGrossValues = grossValues.map((value: string) => {
      const grossNum = parseFloat(value);
      return !isNaN(grossNum) ? 
        `${grossNum} ${containerUnit}` : 
        value;
    });
    
     doc.setFontSize(8); // Reduced from 9 to 8
    doc.text(`GROSS WT: ${formattedGrossValues.join(', ')}`, containerStartX, yPos + lineOffset);
     lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
  }

  if (container.netWt && container.netWt !== "N/A") {
    // Handle comma-separated values properly
    const netValues = container.netWt.split(',').map((s: string) => s.trim());
    const formattedNetValues = netValues.map((value: string) => {
      const netNum = parseFloat(value);
      return !isNaN(netNum) ? 
        `${netNum} ${containerUnit}` : 
        value;
    });
    
     doc.setFontSize(8); // Reduced from 9 to 8
    doc.text(`NET WT: ${formattedNetValues.join(', ')}`, containerStartX, yPos + lineOffset);
     lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
  }

  if (container.tareWt && container.tareWt !== "N/A") {
    // Handle comma-separated values properly
    const tareValues = container.tareWt.split(',').map((s: string) => s.trim());
    const formattedTareValues = tareValues.map((value: string) => {
      const tareNum = parseFloat(value);
      return !isNaN(tareNum) ? 
        `${tareNum} ${containerUnit}` : 
        value;
    });
    
     doc.setFontSize(8); // Reduced from 9 to 8
    doc.text(`TARE WT: ${formattedTareValues.join(', ')}`, containerStartX, yPos + lineOffset);
     lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
  }

  if (container.cbmWt && container.cbmWt !== "N/A") {
    // Handle comma-separated values properly
    const cbmValues = container.cbmWt.split(',').map((s: string) => s.trim());
    const formattedCbmValues = cbmValues.map((value: string) => {
      const cbmNum = parseFloat(value);
      return !isNaN(cbmNum) ? 
        `${cbmNum} CBM` : 
        value;
    });
    
     doc.setFontSize(8); // Reduced from 9 to 8
    doc.text(`CBM: ${formattedCbmValues.join(', ')}`, containerStartX, yPos + lineOffset);
     lineOffset += 6; // Increased from 5 to 6 to accommodate larger font
  }

  // Add spacing between containers (reduced from 8 to 5)
  currentContainerY += containerHeight + 5;
});

    containerY = currentContainerY;
    rowEndY = Math.max(rowEndY, containerY);

  } else {
    // Table format for more than 3 containers
    const tableStartY = containerY;
    const tableWidth = 280; // Reduced table width to add proper margins
    const tableX = (pageWidth - tableWidth) / 2;
    
    // Define column widths - optimized for better space distribution with proper margins
    const col1Width = 60; // CONTAINER NO - adjusted for reduced table width
    const col2Width = 40; // GROSS WT - adjusted for reduced table width
    const col3Width = 40; // NET WT - adjusted for reduced table width
    const col4Width = 40; // TARE WT - adjusted for reduced table width
    const col5Width = 30; // CBM - adjusted for reduced table width
    const col6Width = tableWidth - (col1Width + col2Width + col3Width + col4Width + col5Width); // SEAL NO - gets remaining space (70mm)

    // Table header with borders
    doc.setFont("arial", "bold");
    doc.setFontSize(9);

    // Draw header background and borders
    doc.rect(tableX, tableStartY - 2, tableWidth, 12);

    // Header text (centered within each column)
    const cell1CenterX = tableX + col1Width / 2;
    const cell2CenterX = tableX + col1Width + col2Width / 2;
    const cell3CenterX = tableX + col1Width + col2Width + col3Width / 2;
    const cell4CenterX = tableX + col1Width + col2Width + col3Width + col4Width / 2;
    const cell5CenterX = tableX + col1Width + col2Width + col3Width + col4Width + col5Width / 2;
    const cell6CenterX = tableX + col1Width + col2Width + col3Width + col4Width + col5Width + col6Width / 2;

    doc.text("CONTAINER NO.", cell1CenterX, tableStartY + 6, { align: "center" });
    doc.text("GROSS WT", cell2CenterX, tableStartY + 6, { align: "center" });
    doc.text("NET WT", cell3CenterX, tableStartY + 6, { align: "center" });
    doc.text("TARE WT", cell4CenterX, tableStartY + 6, { align: "center" });
    doc.text("CBM", cell5CenterX, tableStartY + 6, { align: "center" });
    doc.text("SEAL NO.", cell6CenterX, tableStartY + 6, { align: "center" });

    // Draw vertical lines for header
    doc.line(tableX + col1Width, tableStartY - 2, tableX + col1Width, tableStartY + 10);
    doc.line(tableX + col1Width + col2Width, tableStartY - 2, tableX + col1Width + col2Width, tableStartY + 10);
    doc.line(tableX + col1Width + col2Width + col3Width, tableStartY - 2, tableX + col1Width + col2Width + col3Width, tableStartY + 10);
    doc.line(tableX + col1Width + col2Width + col3Width + col4Width, tableStartY - 2, tableX + col1Width + col2Width + col3Width + col4Width, tableStartY + 10);
    doc.line(tableX + col1Width + col2Width + col3Width + col4Width + col5Width, tableStartY - 2, tableX + col1Width + col2Width + col3Width + col4Width + col5Width, tableStartY + 10);

    containerY = tableStartY + 12;

    // Variables to calculate totals
    let totalGrossWt = 0;
    let totalNetWt = 0;
    let totalTareWt = 0;
    let totalCbmWt = 0;

        // Container data rows with borders
    doc.setFont("arial", "normal");
    doc.setFontSize(9);

    containersToShow.forEach((container: any, index: number) => {
      if (!container.containerNumber) return;

      const rowY = containerY;
      
      // Calculate dynamic row height based on SEAL NO text length
      let rowHeight = 12; // Default row height
      const carrierSeals = (container.sealNumber && container.sealNumber !== "N/A") 
        ? container.sealNumber.split(',').map((s: string) => s.trim()).join(', ')
        : "";
      const shipperSeals = (container.shippersealNo && container.shippersealNo !== "N/A") 
        ? container.shippersealNo.split(',').map((s: string) => s.trim()).join(', ')
        : "";
      
      let allSeals = "";
      if (carrierSeals && shipperSeals) {
        allSeals = `C:${carrierSeals} S:${shipperSeals}`;
      } else if (carrierSeals) {
        allSeals = carrierSeals;
      } else if (shipperSeals) {
        allSeals = shipperSeals;
      } else {
        allSeals = "-";
      }
      
      // Check if SEAL NO text needs wrapping
      const maxSealWidth = col6Width - 4;
      const textWidth = doc.getTextWidth(allSeals);
      if (textWidth > maxSealWidth) {
        const wrappedSealText = doc.splitTextToSize(allSeals, maxSealWidth);
        if (wrappedSealText.length > 1) {
          rowHeight = 16; // Increase row height for wrapped text
        }
      }

      // Draw row borders with dynamic height
      doc.rect(tableX, rowY, tableWidth, rowHeight);

      // Draw vertical lines for data rows with dynamic height
      doc.line(tableX + col1Width, rowY, tableX + col1Width, rowY + rowHeight);
      doc.line(tableX + col1Width + col2Width, rowY, tableX + col1Width + col2Width, rowY + rowHeight);
      doc.line(tableX + col1Width + col2Width + col3Width, rowY, tableX + col1Width + col2Width + col3Width, rowY + rowHeight);
      doc.line(tableX + col1Width + col2Width + col3Width + col4Width, rowY, tableX + col1Width + col2Width + col3Width + col4Width, rowY + rowHeight);
      doc.line(tableX + col1Width + col2Width + col3Width + col4Width + col5Width, rowY, tableX + col1Width + col2Width + col3Width + col4Width + col5Width, rowY + rowHeight);


          // Container data (centered in each column)
      doc.text(container.containerNumber || "N/A", cell1CenterX, rowY + 8, { align: "center" });

        // Parse and add to totals
      const grossWtNum = parseFloat(container.grossWt) || 0;
      const netWtNum = parseFloat(container.netWt) || 0;
      const tareWtNum = parseFloat(container.tareWt) || 0;
      const cbmWtNum = parseFloat(container.cbmWt) || 0;
      
      totalGrossWt += grossWtNum;
      totalNetWt += netWtNum;
      totalTareWt += tareWtNum;
      totalCbmWt += cbmWtNum;


          // Only show values if they exist and are not "N/A"
      const grossWt = (container.grossWt && container.grossWt !== "N/A") ? container.grossWt : "-";
      const netWt = (container.netWt && container.netWt !== "N/A") ? container.netWt : "-";
      const tareWt = (container.tareWt && container.tareWt !== "N/A") ? container.tareWt : "-";
      const cbmWt = (container.cbmWt && container.cbmWt !== "N/A") ? container.cbmWt : "-";

      doc.text(grossWt, cell2CenterX, rowY + 8, { align: "center" });
      doc.text(netWt, cell3CenterX, rowY + 8, { align: "center" });
      doc.text(tareWt, cell4CenterX, rowY + 8, { align: "center" });
      doc.text(cbmWt, cell5CenterX, rowY + 8, { align: "center" });


      // Handle SEAL NO text wrapping to prevent overflow
      const sealText = allSeals || "-";
      
      // Check if text fits in the column (reuse variables from earlier calculation)
      if (textWidth > maxSealWidth) {
        // Text is too long, wrap it
        const wrappedSealText = doc.splitTextToSize(sealText, maxSealWidth);
        if (wrappedSealText.length === 1) {
          // Single line, center it
          doc.text(wrappedSealText[0], cell6CenterX, rowY + 8, { align: "center" });
        } else {
          // Multiple lines, center the first line
          doc.text(wrappedSealText[0], cell6CenterX, rowY + 6, { align: "center" });
          // If there's a second line, show it below
          if (wrappedSealText[1]) {
            doc.text(wrappedSealText[1], cell6CenterX, rowY + 10, { align: "center" });
          }
        }
      } else {
        // Text fits, display normally
        doc.text(sealText, cell6CenterX, rowY + 8, { align: "center" });
      }

      containerY += rowHeight; // Use dynamic row height
    });

        // Add TOTAL row at the bottom
    const totalRowY = containerY;
    doc.rect(tableX, totalRowY, tableWidth, 12);


         // Draw vertical lines for total row
    doc.line(tableX + col1Width, totalRowY, tableX + col1Width, totalRowY + 12);
    doc.line(tableX + col1Width + col2Width, totalRowY, tableX + col1Width + col2Width, totalRowY + 12);
    doc.line(tableX + col1Width + col2Width + col3Width, totalRowY, tableX + col1Width + col2Width + col3Width, totalRowY + 12);
    doc.line(tableX + col1Width + col2Width + col3Width + col4Width, totalRowY, tableX + col1Width + col2Width + col3Width + col4Width, totalRowY + 12);
    doc.line(tableX + col1Width + col2Width + col3Width + col4Width + col5Width, totalRowY, tableX + col1Width + col2Width + col3Width + col4Width + col5Width, totalRowY + 12);

    doc.setFont("arial", "bold");
    doc.text(`TOTAL: ${containersToShow.length} CONTAINERS`, cell1CenterX, totalRowY + 8, { align: "center" });
       // Only show totals for fields that have data
    const showGrossTotal = totalGrossWt > 0;
    const showNetTotal = totalNetWt > 0;
    const showTareTotal = totalTareWt > 0;
    const showCbmTotal = totalCbmWt > 0;

     doc.text(showGrossTotal ? totalGrossWt.toFixed(2) : "-", cell2CenterX, totalRowY + 8, { align: "center" });
    doc.text(showNetTotal ? totalNetWt.toFixed(2) : "-", cell3CenterX, totalRowY + 8, { align: "center" });
    doc.text(showTareTotal ? totalTareWt.toFixed(2) : "-", cell4CenterX, totalRowY + 8, { align: "center" });
    doc.text(showCbmTotal ? totalCbmWt.toFixed(3) : "-", cell5CenterX, totalRowY + 8, { align: "center" });
    doc.text("", cell6CenterX, totalRowY + 8, { align: "center" });

    containerY += 12;
      }
    }

    

    // Container weights are shown individually with each container, no need for overall weights

    // Reset to first page for remaining content (only if we moved to a new page for containers)
    if (shouldMoveAllContainersToNextPage) {
      // Go back to first page to add remaining content
      doc.setPage(1);
    }



    // --- Dynamic container count logic with better positioning and formatting ---
    const selectedFromForm = (
      Array.isArray(blFormData?.containers) ? blFormData.containers : []
    )
      .map((c: any) => c?.containerNumber)
      .filter(Boolean);

    const allFromShipment = (
      Array.isArray(shipment?.containers) ? shipment.containers : []
    )
      .map((c: any) => c?.containerNumber)
      .filter(Boolean);

    const containersForHeader =
      selectedFromForm.length > 0 ? selectedFromForm : allFromShipment;
    const containerText = `${containersForHeader.length
      .toString()
      .padStart(2, "0")}X20 ISO TANK SAID TO CONTAINS`;

    // Set consistent font for this section
    doc.setFont("arial", "normal");
    doc.setFontSize(10);
    doc.text(containerText, marginX + 110, firstRowTextY + 6);

    // Set consistent font for this section
    doc.setFont("arial", "normal");
    doc.setFontSize(10);
    doc.text(containerText, marginX + 110, firstRowTextY + 6);

    // Use BL Details if provided, with dynamic text fitting
    const descriptionMaxY = firstRowTextY + 45; // Maximum Y position for description content
    const descriptionMaxWidth = 78;
    let currentDescriptionY = firstRowTextY + 12;

    if (blDetails.trim()) {
      // Display the BL details field content with constrained height
      const blDetailsLines = doc.splitTextToSize(
        blDetails,
        descriptionMaxWidth
      );
      doc.setFont("arial", "normal");
      doc.setFontSize(10);

      // Limit the number of lines to prevent overflow
      const maxDescriptionLines = Math.floor(
        (descriptionMaxY - currentDescriptionY) / 4
      );
      const displayedLines = blDetailsLines.slice(0, maxDescriptionLines);

      displayedLines.forEach((line: string) => {
        if (currentDescriptionY < descriptionMaxY) {
          doc.text(line, marginX + 110, currentDescriptionY);
          currentDescriptionY += 4;
        }
      });
    }

     if (unit) {
      doc.setFont("arial", "bold");
      doc.setFontSize(9);
    }

    

    // Get freight payable option and related port info
    const freightPayableAt = blFormData?.freightPayableAt || "";
    const freightText =
      freightPayableAt === "prepaid"
        ? '"FREIGHT PREPAID"'
        : freightPayableAt === "postpaid"
        ? '"FREIGHT POSTPAID"'
        : '"FREIGHT PREPAID"';

    // Get free days and detention rate from shipment data - Use only POD (destination port) values
    const freeDays = shipment?.podFreeDays || "";
    const detentionRate = shipment?.podDetentionRate || "";

    // Additional block under description - improved spacing and alignment
    // Additional block under description - improved spacing and alignment
let addY = firstRowTextY + 50;

// Add "Shipped on Board" section just above freight text
doc.setFont("arial", "bold");
doc.setFontSize(9);
doc.text("Shipped on Board", marginX + 110, addY);
doc.text(blDate, marginX + 110 + 40, addY); // Date aligned to the right of "Shipped on Board"
addY += 8;

// Freight text
doc.setFont("arial", "normal");
doc.setFontSize(9);
doc.text(freightText, marginX + 110, addY);
addY += 8;

// Dynamic free days text
const freeDaysText = freeDays
  ? `FREE ${freeDays} DAYS AT DESTINATION PORT THERE AFTER AT`
  : "";
if (freeDaysText) {
  doc.text(freeDaysText, marginX + 110, addY);
  addY += 8; // Increased from 5 to 8 for better spacing
}

// Dynamic detention rate text
const detentionText = detentionRate ? `USD ${detentionRate} /DAY/TANK` : "";
if (detentionText) {
  doc.text(detentionText, marginX + 110, addY);
  // Dynamic spacing based on container count - reduced spacing for 4+ containers to create room for charges
  const detentionSpacing = actualContainerCount > 3 ? 8 : 15; // Reduced spacing for 4+ containers to create room
  addY += detentionSpacing;
}

    // Charge lines with better formatting - Use single charges field or default format
    doc.setFont("arial", "bold");
    // Dynamic font size based on container count - reduced font size for 4+ containers
    const chargesFontSize = actualContainerCount > 3 ? 9 : 8; // Reduced font size for 4+ containers from 10 to 9
    doc.setFontSize(chargesFontSize);

    let chargeLines: string[] = [];

    if (blFormData?.chargesAndFees && blFormData.chargesAndFees.trim()) {
      // If chargesAndFees field has content, use it directly
      chargeLines = [
        "SHIPPING LINE /SHIPPING LINE AGENTS ARE ELIGIBLE UNDER THIS B/L TERMS, TO",

        "COLLECT CHARGES SUCH AS",
      ];

      // Split chargesAndFees by line breaks and add each line separately
      const chargesLines = blFormData.chargesAndFees
        .split("\n")
        .filter((line: string) => line.trim());
      chargeLines.push(...chargesLines);
    } else {
      // If empty, don't show any charges (as requested)
      chargeLines = [];
    }

    chargeLines.forEach((t: string) => {
      const normalized = normalizePdfText(t);
      // Ensure character spacing is reset to prevent spacing artifacts
      if ((doc as any).setCharSpace) {
        (doc as any).setCharSpace(0);
      }

      // For charges and fees, render each line directly without wrapping to preserve line breaks
      if (t.includes("SHIPPING LINE") || t.includes("COLLECT CHARGES")) {
        // These are the header lines, render them as is
        doc.text(normalized, marginX + 110, addY);
        // Increased spacing to prevent overlap with borderlines
        const headerSpacing = actualContainerCount > 3 ? 6 : 7; // Increased spacing to prevent overlap
        addY += headerSpacing;
      } else {
        // These are the charges lines from textarea, render each line separately
        doc.text(normalized, marginX + 110, addY);
        // Increased spacing to prevent overlap with borderlines
        const chargeSpacing = actualContainerCount > 3 ? 6 : 7; // Increased spacing to prevent overlap
        addY += chargeSpacing;
      }

    });

    // Add extra spacing after charges section to prevent overlap with borderline
    if (actualContainerCount > 3) {
      addY += 10; // Increased buffer space to prevent overlap with borderline
    } else {
      addY += 8; // Add buffer space for all container counts to prevent overlap
    }

    rowEndY = Math.max(rowEndY, addY);

    // // Shift the right-side Gross/Net weight further right to avoid collision with product text
    // if (grossKgsLong) doc.text(`GROSS WT. ${grossKgsLong}`, 220, firstRowTextY + 6);
    // if (netKgsLong) doc.text(`NET WT. ${netKgsLong}`, 220, firstRowTextY + 12);

    const tableBottomY = rowEndY;

    // Removed extra separator line before bottom section to avoid double lines

    // Bottom grid box (no BL SURRENDERED text)
    // Move bottom section down for single container to prevent freight prepaid text overflow
    let bottomBoxTop = tableBottomY - 10; // Default position
    if (actualContainerCount === 1) {
      bottomBoxTop = tableBottomY + 15; // Move down 25mm for single container to create more space above
    } else if (actualContainerCount === 2) {
      bottomBoxTop = tableBottomY + 5; // Move down 15mm for two containers to provide more space for charges and fees section
    } else if (actualContainerCount > 3) {
      bottomBoxTop = tableBottomY + 15; // Reduced from 25 to 15 to prevent charges text overlap while maintaining space
    }
    // Reduced height to free more space for the terms section below
    const bottomBoxHeight = 48; // Reduced from 52 to 48


     // Calculate terms section positioning early for border calculations
     const termsBoxTop = bottomBoxTop + bottomBoxHeight;
     // Terms box height varies based on container count - increased for 1 container to prevent cutoff
     let termsBoxHeight;
     if (blFormData?.chargesAndFees && blFormData.chargesAndFees.trim()) {
       // Height varies based on container count - more height for 1 container
       const chargesLength = blFormData?.chargesAndFees?.length || 0;
       if (actualContainerCount === 1) {
         termsBoxHeight = Math.max(160, Math.min(200, 160 + (chargesLength / 100) * 10)); // Increased height for 1 container
       } else {
         termsBoxHeight = Math.max(140, Math.min(180, 140 + (chargesLength / 100) * 10)); // Standard height for other container counts
       }
     } else {
       // Height varies based on container count - more height for 1 container
       if (actualContainerCount === 1) {
         termsBoxHeight = 160; // Increased height for 1 container
       } else {
         termsBoxHeight = 140; // Standard height for other container counts
       }
     }

     // Bottom border position will be calculated after terms content is processed

    doc.setLineWidth(0.5);
    // Draw bottom box without bottom edge so there is only one line between this box and the terms box below
    // left vertical
    doc.line(marginX, bottomBoxTop, marginX, bottomBoxTop + bottomBoxHeight);
    // top horizontal
    doc.line(marginX, bottomBoxTop, marginX + headerWidth, bottomBoxTop);
    // right vertical
    doc.line(
      marginX + headerWidth,
      bottomBoxTop,
      marginX + headerWidth,
      bottomBoxTop + bottomBoxHeight
    );

    // Four-column layout with better proportions: Delivery Agent | Freight Payable At/Amount | Number of original & Place/date
    const colDA_X = marginX; // left start
    const colFA_X = marginX + (75 / 190) * headerWidth; // Freight section start
    const colNUM_X = marginX + (125 / 190) * headerWidth; // Number of original / Place/date start
    const colRightEnd = marginX + headerWidth;

    // Draw vertical separators confined to their respective sections
    doc.line(colFA_X, bottomBoxTop, colFA_X, bottomBoxTop + bottomBoxHeight);
    doc.line(colNUM_X, bottomBoxTop, colNUM_X, bottomBoxTop + bottomBoxHeight);

    // Bottom box headers with better spacing
    doc.setFont("arial", "bold");
    doc.setFontSize(11);
    const rightSectionPaddingLeft = 2;
    const rightSectionPaddingRight = 2;
    const rightColX = colNUM_X + rightSectionPaddingLeft;
    const rightSectionRight = colRightEnd - rightSectionPaddingRight; // keep a small inset from border
    doc.text("Delivery Agent", marginX + 5, bottomBoxTop + 8);
    doc.text("Freight payable at", colFA_X + 5, bottomBoxTop + 8);

    // Add horizontal separator in freight section for "Freight Amount"
    // doc.line(colFA_X, bottomBoxTop + 18, colNUM_X, bottomBoxTop + 18);
    // doc.text('Freight Amount', colFA_X + 5, bottomBoxTop + 26);

    // Right section headers - improved alignment and slight extra separation
    doc.text("Number of original BL/MTD(s)", rightColX, bottomBoxTop + 8);
    doc.text("Date of issue", rightSectionRight, bottomBoxTop + 8, {
      align: "right",
    });

    // Bottom box values with proper spacing and alignment
    doc.setFont("arial", "bold");
    doc.setFontSize(10);

    // Delivery Agent section - Ultra compact to save space for terms
    let deliveryAgentY = bottomBoxTop + 12; // Reduced from 14
    const deliveryAgentMaxY = bottomBoxTop + bottomBoxHeight - 2; // Reduced margin
    const deliveryAgentMaxWidth = colFA_X - marginX - 4; // Reduced padding

    // Use very compact spacing for all fields
    const compactLineSpacing = 4; // Reduced from 4-5

    // Use combined delivery agent info if available, otherwise fall back to individual fields
    if (deliveryAgent?.combinedInfo && deliveryAgent.combinedInfo.trim()) {
      // Use combined field like charges and fees
      doc.setFont("arial", "normal");
      doc.setFontSize(10);
      const combinedLines = doc.splitTextToSize(
        deliveryAgent.combinedInfo,
        deliveryAgentMaxWidth
      );

      // Display as many lines as fit in the available space
      combinedLines.forEach((line: string, index: number) => {
        if (
          deliveryAgentY + index * compactLineSpacing <
          deliveryAgentMaxY - 2
        ) {
          doc.text(
            line,
            marginX + 5,
            deliveryAgentY + 2 + index * compactLineSpacing
          );
        }
      });
      deliveryAgentY += combinedLines.length * compactLineSpacing;
    } else {
      // Fallback to individual fields if combined field is empty
      // Delivery Agent Name - Bold (single line only)
      if (deliveryAgent?.name && deliveryAgentY < deliveryAgentMaxY - 10) {
        doc.setFont("arial", "bold");
        doc.setFontSize(10);
        const nameLines = doc.splitTextToSize(
          deliveryAgent.name,
          deliveryAgentMaxWidth
        );
        doc.text(nameLines[0], marginX + 5, deliveryAgentY + 2);
        deliveryAgentY += compactLineSpacing;
      }

      // Delivery Agent Address - Normal (single line only)
      if (deliveryAgent?.address && deliveryAgentY < deliveryAgentMaxY - 6) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const agentAddressLines = doc.splitTextToSize(
          deliveryAgent.address,
          deliveryAgentMaxWidth
        );
        doc.text(agentAddressLines[0], marginX + 5, deliveryAgentY + 2);
        deliveryAgentY += compactLineSpacing;
      }

      // Delivery Agent Contact - Normal (single line only)
      if (deliveryAgent?.contactNo && deliveryAgentY < deliveryAgentMaxY - 3) {
        doc.setFont("arial", "normal");
        doc.setFontSize(10);
        const telLines = doc.splitTextToSize(
          `TEL: ${deliveryAgent.contactNo}`,
          deliveryAgentMaxWidth
        );
        doc.text(telLines[0], marginX + 5, deliveryAgentY + 2);
        deliveryAgentY += compactLineSpacing;
      }

      // Delivery Agent Email - Normal (single line only)
      if (deliveryAgent?.email && deliveryAgentY < deliveryAgentMaxY) {

        doc.setFont("arial", "bold");
        doc.setFontSize(10);
        const emailLines = doc.splitTextToSize(
          `EMAIL: ${deliveryAgent.email}`,
          deliveryAgentMaxWidth
        );
        doc.text(emailLines[0], marginX + 5, deliveryAgentY + 2);
        deliveryAgentY += compactLineSpacing;
      }
    }

    // VAT field is now included in the combined delivery agent info field above, so no separate VAT display needed

    // Dynamic port selection based on freight payable option
    let freightPayablePort = "Nhava Sheva"; // default
    if (freightPayableAt === "prepaid") {
      freightPayablePort = polName || "Nhava Sheva"; // Port of Loading
    } else if (freightPayableAt === "postpaid") {
      freightPayablePort = podName || "Nhava Sheva"; // Port of Discharge
    }

    // Freight section with exchanged positions - freightPayablePort at top, freight amount at bottom
    doc.text(freightPayablePort, colFA_X + 5, bottomBoxTop + 16);
    // Show freight amount in bottom position (currently commented as per previous request)
    // doc.text(freightAmount || '2000', colFA_X + 5, bottomBoxTop + 34);

    // Right section - Number of originals and place/date
    // For original BLs (all copies), show 3(THREE) as requested
    let copyNumberText = "3(THREE)";
    if (blType === "original") {
      copyNumberText = "3(THREE)"; // Show 3(THREE) for all original BL copies
    } else {
      // For draft and seaway BLs, use the copy number
      const copyNumberTexts = ["0(ZERO)", "1(ONE)", "2(TWO)"];
      copyNumberText = copyNumberTexts[copyNumber] || "0(ZERO)";
    }
    doc.text(
      `${copyNumberText} ${freightPayablePort}`,
      rightColX,
      bottomBoxTop + 16
    );
    // Horizontal rule just below the copy number/place text within the rightmost section
    doc.line(colNUM_X, bottomBoxTop + 18, colRightEnd, bottomBoxTop + 18);

    // Place and date of issue - right aligned with extra padding from border
    doc.text(blDate, rightSectionRight, bottomBoxTop + 16, { align: "right" });

    // Terms block moved below the bottom grid (new section)
    // Using fixed terms box height calculated earlier
    // Draw the top separator only under Delivery Agent + Freight sections (exclude rightmost section)
    doc.line(marginX, termsBoxTop, colNUM_X, termsBoxTop);
     // Note: Vertical separator will be drawn after bottom border position is calculated
    // Remove left and right vertical borders of terms box as requested
    // Omit bottom edge of terms box so only the outer page border shows at the end
    // Reduce top padding so the first line starts higher (closer to the separator line)
    // Add some spacing from the top separator before the terms text begins
    const miniTermsY = termsBoxTop + 4; // Reduced padding from 6 to 4
    doc.setFont("arial", "bold"); // Set font to bold for terms text
    doc.setFontSize(8); // Further reduced from 7 to 6 for better fit inside the section
    const miniTerms = [
      "By accepting this Bill of lading shipper accepts and abides by all terms, conditions clauses printed and stamped on the face or reverse side of this bill of lading.",
      "By accepting this Bill of lading, the shipper accepts his responsibility towards the carrier for payment of freight (in case of freight collect shipments), Accrued",
      "Government, reshipment or disposal costs (as the case may be) if the consignee fails to take delivery of the cargo within 90 days from the date of cargo reaches destination.",
      "For freight prepaid Bill of Ladings, delivery of Cargo is subject to realisation of freight cheque. Demurrage/Detention charges at port of destination payable by consignee as per",
      "line's tariff.",
      "The carrier reserves the right to repack the goods if the same are not in seaworthy packing.The packing condition will be certified by the local bonded",
      "warehouse of competent surveyor , and the shipper by virtue of accepting this bill of lading accepts the liability towards the cost for the same.",
      "For shipments where inland trucking is involved it is mandatory on consignee to custom clear the shipment at port of discharge.",
      "In case of any discrepancy found in declared weight & volume the carrier reserve the right to hold the shipment & recover all charges as per the revised weight & volume whichever is high from shipper or consignee.",
    ];
    let mtY = miniTermsY;
    // Constrain terms text to the left of the new vertical separator
    const miniTermsMaxWidth = Math.max(40, colNUM_X - (marginX + 9));

     // Height for terms text varies based on container count - increased for 1 container to prevent cutoff
     let availableHeight;
     if (blFormData?.chargesAndFees && blFormData.chargesAndFees.trim()) {
       // Height varies based on container count - more height for 1 container
       const chargesLength = blFormData?.chargesAndFees?.length || 0;
       if (actualContainerCount === 1) {
         availableHeight = Math.max(160, Math.min(200, 160 + (chargesLength / 100) * 10)); // Increased height for 1 container
       } else {
         availableHeight = Math.max(140, Math.min(180, 140 + (chargesLength / 100) * 10)); // Standard height for other container counts
       }
     } else {
       // Height varies based on container count - more height for 1 container
       if (actualContainerCount === 1) {
         availableHeight = 160; // Increased height for 1 container
       } else {
         availableHeight = 140; // Standard height for other container counts
       }
     }
     const maxBottomY = termsBoxTop + availableHeight;

     let lastDrawnTextY = mtY; // Track the actual Y position of the last drawn text

    miniTerms.forEach((t) => {
      // Check if we have space for more text
      if (mtY >= maxBottomY) return; // Stop adding text if we've reached the limit

      const wrapped = doc.splitTextToSize(t, miniTermsMaxWidth);

      // Check if this text block will fit
      const textBlockHeight = wrapped.length * 2.5 + 0.5;
      if (mtY + textBlockHeight <= maxBottomY) {
        doc.text(wrapped, marginX + 7, mtY); // Slightly indented for alignment
         lastDrawnTextY = mtY + (wrapped.length * 2.5); // Track actual end of drawn text (without extra spacing)
        mtY += textBlockHeight;
      }
    });

     // Calculate actual content height used
     const actualTermsContentHeight = lastDrawnTextY - miniTermsY;

     // Update bottom border position to create equal margins above and below
     // Calculate the proper bottom border position to balance top and bottom margins
     const topMargin = marginY; // Top margin (2mm)
     const bottomMargin = topMargin; // Equal bottom margin (2mm)
     const availableContentHeight = initialPageHeight - topMargin - bottomMargin;
     const contentUsedHeight = lastDrawnTextY - topMargin;
     const extraSpace = availableContentHeight - contentUsedHeight;
     
     // Position bottom border to create equal margins
     bottomBorderY = lastDrawnTextY + (extraSpace / 2); // Add half the extra space below content

     // Calculate the actual required page height based on content
     const actualPageHeight = bottomBorderY + 5; // Add small margin for page number
     
     // Note: jsPDF doesn't support dynamic page resizing, so we'll work with the calculated height

     // Add footer text positioned above the terms content, below the "0(ZERO) Nhava Sheva" section
     const footerY = bottomBoxTop + bottomBoxHeight - 12; // Move up closer to "0(ZERO) Nhava Sheva"
     doc.setFont("arial", "bold");
     doc.setFontSize(10);
     doc.text("For RISTAR LOGISTICS PVT LTD", rightColX, footerY - 7);
     doc.text("As Agent for the Carrier", rightColX, footerY + (actualContainerCount > 3 ? 50 : 55)); // Moved down for 4+ containers to fix positioning

     // Now draw the bottom border at the correct position
     doc.line(marginX, bottomBorderY, marginX + contentWidth, bottomBorderY); // bottom

     // Draw the vertical separator from terms top to bottom border
     doc.line(colNUM_X, termsBoxTop, colNUM_X, bottomBorderY);

     // Update left and right borders to match the new bottom position
     leftBorderY = bottomBorderY;
     rightBorderY = bottomBorderY;

     // Now draw the left and right vertical borders at the correct position
     doc.line(marginX, marginY, marginX, leftBorderY); // left
     doc.line(
       marginX + contentWidth,
       marginY,
       marginX + contentWidth,
       rightBorderY
     ); // right

    // Removed rightmost stamp cell per request

    // Save the PDF with dynamic port names from shipment data
    let fileName = "";
    const copySuffix =
      copyNumber === 0 ? "" : copyNumber === 1 ? "_2nd_Copy" : "_3rd_Copy";

    // Get port codes from shipment data for dynamic filename
    const polPortCode = shipment.polPort?.portCode || "NSA";
    const podPortCode = shipment.podPort?.portCode || "JEV";

    // Use the actual port codes (3-letter abbreviations) for filename
    const polCode = polPortCode.substring(0, 3).toUpperCase();
    const podCode = podPortCode.substring(0, 3).toUpperCase();

    // Create filename with POL first, then POD (matching the actual shipment route)
    const portCode = `${polCode}${podCode}`;

    switch (blType) {
      case "original":
        fileName = `RST_${portCode}_25_00001_Original_BL${copySuffix}.pdf`;
        break;
      case "draft":
        fileName = `RST_${portCode}_25_00001_Draft_BL${copySuffix}.pdf`;
        break;
      case "seaway":
        fileName = `RST_${portCode}_25_00001_Seaway_BL${copySuffix}.pdf`;
        break;
    }

    // Add page numbers to all pages as "Page X of Y"
    const totalPages = (doc as any).getNumberOfPages
      ? (doc as any).getNumberOfPages()
      : 1;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("arial", "normal");
      doc.setFontSize(10);
      const pageNumberText = `Page ${p} of ${totalPages}`;
       // Position page number below the main borderline with equal margin, moved down a bit
       const pageNumberY = bottomBorderY + bottomMargin + (actualContainerCount > 3 ? 3 : 2); // Increased spacing for 4+ containers to make page number visible
       doc.text(pageNumberText, pageWidth - 40, pageNumberY);
    }

    doc.save(fileName);
  } catch (err) {
    console.error("Error generating BL PDF", err);
  }
}
