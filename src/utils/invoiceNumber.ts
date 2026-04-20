import { Order } from "../modules/payments/order.model.js";

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const latestOrder = await Order.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  let nextNum = 1;
  if (latestOrder?.invoiceNumber) {
    const numStr = latestOrder.invoiceNumber.replace(prefix, "");
    nextNum = parseInt(numStr, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}
