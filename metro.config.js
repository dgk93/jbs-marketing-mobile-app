const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

let disableBluetoothPrinter = false;
try {
  disableBluetoothPrinter = !!require("./config/features.json").disableBluetoothPrinter;
} catch {
  disableBluetoothPrinter = false;
}

if (disableBluetoothPrinter) {
  const stubPath = path.resolve(__dirname, "lib/thermal-printer-stub.ts");
  const defaultResolveRequest = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-thermal-printer-driver") {
      return {
        filePath: stubPath,
        type: "sourceFile",
      };
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = withNativeWind(config, { input: "./global.css" });
