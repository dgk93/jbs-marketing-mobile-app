/**
 * Temporary stub for Expo Go.
 * Real native module is used when config/features.json has disableBluetoothPrinter: false
 * and you run a dev/release build.
 */

export type Device = {
  address: string;
  name: string;
  deviceType?: "bt" | "ble" | "dual" | "unknown" | "lan" | string;
};

export function text(..._args: unknown[]) {
  return { type: "text" as const };
}

export function line(..._args: unknown[]) {
  return { type: "line" as const };
}

export function feed(..._args: unknown[]) {
  return { type: "feed" as const };
}

export function cut(..._args: unknown[]) {
  return { type: "cut" as const };
}

export function columns(..._args: unknown[]) {
  return { type: "columns" as const };
}

const ThermalPrinter = {
  async scan() {
    return { paired: [] as Device[], found: [] as Device[] };
  },
  async stopScan() {},
  async connect(_address: string, _options?: unknown) {
    throw new Error("Bluetooth printing is disabled in Expo Go. Use a custom build to print.");
  },
  async disconnect(_address?: string) {},
  async print(_address: string, _nodes: unknown[], _options?: unknown) {
    throw new Error("Bluetooth printing is disabled in Expo Go. Use a custom build to print.");
  },
};

export default ThermalPrinter;
