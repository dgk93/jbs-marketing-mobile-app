import AsyncStorage from "@react-native-async-storage/async-storage";
import ThermalPrinter, {
  text,
  line,
  feed,
  cut,
  columns,
  type Device,
} from "react-native-thermal-printer-driver";

export type { Device };

const PRINTER_ADDRESS_KEY = "selected_printer_address";
const PRINTER_NAME_KEY = "selected_printer_name";

export type InvoicePrintItem = {
  name: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
};

export type InvoiceReturnItem = {
  name: string;
  qty: number;
  price: number;
  discount?: number;
  subtotal: number;
};

export type InvoicePrintData = {
  shopName: string;
  items: InvoicePrintItem[];
  total: number;
  netTotal: number;
  cash: number;
  cheque: number;
  credit: number;
  goodReturns: InvoiceReturnItem[];
  marketReturns: InvoiceReturnItem[];
};

/** Scan returns raw MACs; the native driver requires bt:/ble:/lan: prefixes. */
export function normalizePrinterAddress(
  address: string,
  deviceType?: Device["deviceType"] | string
): string {
  const trimmed = (address || "").trim();
  if (!trimmed) return trimmed;
  if (/^(bt|ble|lan|tcp):/i.test(trimmed)) {
    // Library uses lan:, README also mentions tcp: — map tcp → lan
    if (trimmed.toLowerCase().startsWith("tcp:")) {
      return `lan:${trimmed.slice(4)}`;
    }
    return trimmed;
  }

  // Raw MAC like 86:67:7A:9C:F8:19
  if (deviceType === "ble") return `ble:${trimmed}`;
  // MTP printers are Bluetooth Classic (SPP)
  return `bt:${trimmed}`;
}

function candidateAddresses(address: string, deviceType?: Device["deviceType"] | string): string[] {
  const primary = normalizePrinterAddress(address, deviceType);
  const mac = primary.replace(/^(bt|ble):/i, "");
  const candidates = [primary];

  if (deviceType === "dual" || deviceType === "unknown" || !deviceType) {
    if (primary.startsWith("bt:")) candidates.push(`ble:${mac}`);
    if (primary.startsWith("ble:")) candidates.push(`bt:${mac}`);
  }

  // Always try classic BT for MTP-style printers if not already first
  if (!candidates.includes(`bt:${mac}`)) {
    candidates.push(`bt:${mac}`);
  }

  return [...new Set(candidates)];
}

export async function getSavedPrinter(): Promise<{ address: string; name: string } | null> {
  const address = await AsyncStorage.getItem(PRINTER_ADDRESS_KEY);
  if (!address) return null;
  const name = (await AsyncStorage.getItem(PRINTER_NAME_KEY)) || "Printer";
  return { address: normalizePrinterAddress(address), name };
}

export async function savePrinter(address: string, name: string) {
  await AsyncStorage.setItem(PRINTER_ADDRESS_KEY, normalizePrinterAddress(address));
  await AsyncStorage.setItem(PRINTER_NAME_KEY, name);
}

export async function clearSavedPrinter() {
  await AsyncStorage.removeItem(PRINTER_ADDRESS_KEY);
  await AsyncStorage.removeItem(PRINTER_NAME_KEY);
}

export async function scanPrinters(): Promise<Device[]> {
  const { paired, found } = await ThermalPrinter.scan();
  const map = new Map<string, Device>();
  [...paired, ...found].forEach((device) => {
    const address = normalizePrinterAddress(device.address, device.deviceType);
    map.set(address, { ...device, address });
  });
  return Array.from(map.values());
}

export function preferMtpPrinter(devices: Device[]): Device | undefined {
  return (
    devices.find((d) => /mtp[\s\-]?i{1,3}|mtp[\s\-]?[123]|mpt/i.test(d.name || "")) ||
    devices[0]
  );
}

export async function connectPrinter(
  address: string,
  deviceType?: Device["deviceType"] | string
) {
  const candidates = candidateAddresses(address, deviceType);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      try {
        await ThermalPrinter.disconnect(candidate);
      } catch {
        // ignore
      }

      await ThermalPrinter.connect(candidate, { timeout: 20000 });
      return candidate;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Could not connect to printer");
}

function money(value: number) {
  return `LKR ${value.toFixed(2)}`;
}

export async function printInvoice(address: string, data: InvoicePrintData) {
  const connectedAddress = await connectPrinter(address);

  const nodes: Parameters<typeof ThermalPrinter.print>[1] = [
    text("JBS MARKETING", { align: "center", bold: true, size: 2 }),
    text("INVOICE", { align: "center", bold: true }),
    line(),
    text(`Shop: ${data.shopName || "-"}`),
    text(`Date: ${new Date().toLocaleString()}`),
    line({ style: "dashed" }),
    text("ITEMS", { bold: true }),
  ];

  data.items.forEach((item) => {
    nodes.push(
      text(item.name, { bold: true }),
      columns([
        { content: `Qty ${item.qty}`, width: 0.4, align: "left" },
        { content: money(item.price), width: 0.5, align: "right" },
        { content: money(item.subtotal), width: 0.6, align: "right" },
      ])
    );
    if (item.discount > 0) {
      nodes.push(text(`Discount: ${money(item.discount)} x ${item.qty}`));
    }
  });

  nodes.push(
    line({ style: "dashed" }),
    columns([
      { content: `Total`, width: 0.5, align: "left" },
      { content: money(data.total), width: 0.9, align: "right" },
    ])
  );

  if (data.goodReturns.length > 0) {
    const goodTotal = data.goodReturns.reduce((sum, item) => sum + item.subtotal, 0);
    nodes.push(line({ style: "dashed" }), text("GOOD RETURN", { bold: true }));
    data.goodReturns.forEach((item) => {
      nodes.push(
        text(item.name, { bold: true }),
        columns([
          { content: `Qty ${item.qty}`, width: 0.4, align: "left" },
          { content: money(item.price), width: 0.5, align: "right" },
          { content: money(item.subtotal), width: 0.6, align: "right" },
        ])
      );
      if ((item.discount || 0) > 0) {
        nodes.push(text(`Discount: ${money(item.discount || 0)} x ${item.qty}`));
      }
    });
    nodes.push(
      columns([
        { content: "Total", width: 0.5, align: "left" },
        { content: money(goodTotal), width: 1, align: "right" },
      ])
    );
  }

  if (data.marketReturns.length > 0) {
    const marketTotal = data.marketReturns.reduce((sum, item) => sum + item.subtotal, 0);
    nodes.push(line({ style: "dashed" }), text("MARKET RETURN", { bold: true }));
    data.marketReturns.forEach((item) => {
      nodes.push(
        text(item.name, { bold: true }),
        columns([
          { content: `Qty ${item.qty}`, width: 0.4, align: "left" },
          { content: money(item.price), width: 0.5, align: "right" },
          { content: money(item.subtotal), width: 0.6, align: "right" },
        ])
      );
      if ((item.discount || 0) > 0) {
        nodes.push(text(`Discount: ${money(item.discount || 0)} x ${item.qty}`));
      }
    });
    nodes.push(
      columns([
        { content: "Total", width: 0.5, align: "left" },
        { content: money(marketTotal), width: 1, align: "right" },
      ])
    );
  }

  nodes.push(
    line({ style: "dashed" }),
    columns([
      { content: "Net Total", width: 0.5, align: "left" },
      { content: money(data.netTotal), width: 1, align: "right" },
    ]),
    feed(1),
    columns([
      { content: "Cash", width: 0.5, align: "left" },
      { content: money(data.cash), width: 1, align: "right" },
    ]),
    columns([
      { content: "Cheque", width: 0.5, align: "left" },
      { content: money(data.cheque), width: 1, align: "right" },
    ]),
    columns([
      { content: "Credit", width: 0.5, align: "left" },
      { content: money(data.credit), width: 1, align: "right" },
    ])
  );

  nodes.push(feed(2), text("Thank you!", { align: "center" }), feed(3), cut());

  await ThermalPrinter.print(connectedAddress, nodes, {
    paperWidthMm: 58,
    keepAlive: true,
    timeout: 20000,
  });
}
