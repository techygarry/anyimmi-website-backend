import PDFDocument from "pdfkit";
import { IOrder } from "./order.model.js";

const NAVY = "#0F2B46";
const EMERALD = "#059669";
const SLATE = "#64748B";
const DARK = "#1E293B";
const BORDER = "#E2E8F0";
const BG_LIGHT = "#F8FAFC";

const TIER_DISPLAY: Record<string, string> = {
  starter: "Starter Bundle",
  custom: "Custom Branded Bundle",
  ultimate: "Ultimate Launch Kit",
  portal_pro: "Portal Pro Subscription",
  portal_business: "Portal Business Subscription",
};

export function generateInvoicePDF(order: IOrder): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // ─── Header ───────────────────────────────────────────────
  // Navy background bar
  doc.rect(0, 0, 595.28, 80).fill(NAVY);
  doc.fontSize(22).fillColor("#ffffff").text("AnyImmi", 50, 28);
  doc.fontSize(24).fillColor("#ffffff").text("INVOICE", 0, 28, {
    align: "right",
    width: 545.28,
  });

  // ─── Invoice Details (right) & Bill-To (left) ────────────
  const metaY = 100;

  // Bill-To
  doc.fontSize(9).fillColor(SLATE).text("BILL TO", 50, metaY);
  doc.fontSize(12).fillColor(DARK).text(order.name || "Customer", 50, metaY + 16);
  doc.fontSize(10).fillColor(SLATE).text(order.email, 50, metaY + 32);

  // Invoice meta (right side)
  doc.fontSize(9).fillColor(SLATE).text("INVOICE NUMBER", 380, metaY);
  doc.fontSize(11).fillColor(DARK).text(order.invoiceNumber || "N/A", 380, metaY + 14);

  doc.fontSize(9).fillColor(SLATE).text("DATE", 380, metaY + 34);
  doc
    .fontSize(10)
    .fillColor(DARK)
    .text(
      order.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      380,
      metaY + 48
    );

  doc.fontSize(9).fillColor(SLATE).text("STATUS", 380, metaY + 68);
  doc.fontSize(10).fillColor(EMERALD).text("PAID", 380, metaY + 82);

  // ─── Divider ──────────────────────────────────────────────
  const divY = metaY + 108;
  doc.moveTo(50, divY).lineTo(545.28, divY).strokeColor(BORDER).lineWidth(1).stroke();

  // ─── Table Header ─────────────────────────────────────────
  const tableTop = divY + 16;
  // Header background
  doc.rect(50, tableTop - 4, 495.28, 22).fill(BG_LIGHT);

  doc.fontSize(8).fillColor(SLATE);
  doc.text("DESCRIPTION", 58, tableTop + 2);
  doc.text("QTY", 340, tableTop + 2);
  doc.text("PRICE", 400, tableTop + 2);
  doc.text("TOTAL", 480, tableTop + 2, { align: "right", width: 58 });

  // ─── Line Item: Tier ──────────────────────────────────────
  const row1Y = tableTop + 28;
  const tierName = TIER_DISPLAY[order.tier] || order.tier;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency || "usd",
  }).format(order.amount);

  doc.fontSize(10).fillColor(DARK);
  doc.text(tierName, 58, row1Y);
  doc.text("1", 340, row1Y);
  doc.text(formattedAmount, 400, row1Y);
  doc.text(formattedAmount, 480, row1Y, { align: "right", width: 58 });

  // Underline
  doc
    .moveTo(50, row1Y + 18)
    .lineTo(545.28, row1Y + 18)
    .strokeColor("#F1F5F9")
    .stroke();

  // ─── Line Item: Portal Pro (if applicable) ────────────────
  let currentY = row1Y + 26;
  if (order.portalProMonths > 0) {
    doc.fontSize(10).fillColor(DARK);
    doc.text(`Portal Pro Access (${order.portalProMonths} months)`, 58, currentY);
    doc.text("1", 340, currentY);
    doc.fillColor(EMERALD).text("Included", 400, currentY);
    doc.fillColor(DARK).text("$0.00", 480, currentY, { align: "right", width: 58 });

    doc
      .moveTo(50, currentY + 18)
      .lineTo(545.28, currentY + 18)
      .strokeColor("#F1F5F9")
      .stroke();

    currentY += 26;
  }

  // ─── Total Row ────────────────────────────────────────────
  doc.rect(50, currentY, 495.28, 28).fill(BG_LIGHT);
  doc.fontSize(11).fillColor(NAVY);
  doc.text("Total", 58, currentY + 7, { width: 200 });
  doc.fontSize(12).text(
    `${formattedAmount} ${(order.currency || "usd").toUpperCase()}`,
    480,
    currentY + 7,
    { align: "right", width: 58 }
  );

  // ─── Payment Information ──────────────────────────────────
  currentY += 48;
  doc.fontSize(9).fillColor(SLATE).text("PAYMENT INFORMATION", 50, currentY);
  currentY += 16;
  doc.fontSize(9).fillColor("#475569");
  doc.text("Payment Method: Credit/Debit Card via Stripe", 50, currentY);
  currentY += 14;
  if (order.stripePaymentIntent) {
    doc.text(`Payment Reference: ${order.stripePaymentIntent}`, 50, currentY);
    currentY += 14;
  }
  if (order.stripeCustomerId) {
    doc.text(`Customer ID: ${order.stripeCustomerId}`, 50, currentY);
  }

  // ─── Footer ───────────────────────────────────────────────
  doc
    .fontSize(9)
    .fillColor("#94A3B8")
    .text(
      "Thank you for your purchase! This invoice serves as your receipt. No payment is due.",
      50,
      740,
      { align: "center", width: 495.28 }
    );

  doc
    .fontSize(8)
    .fillColor("#CBD5E1")
    .text("AnyImmi — Digital Assets for Immigration Consultants", 50, 760, {
      align: "center",
      width: 495.28,
    });

  doc.end();
  return doc;
}
