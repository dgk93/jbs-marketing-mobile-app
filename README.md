# JBS Marketing Mobile App

## Expo Go (temporary — Bluetooth disabled)

Bluetooth printing is stubbed so you can use **Expo Go**.

1. Fix ownership if needed (files created with sudo):
```bash
sudo chown -R "$(whoami)" .
```

2. In `app.json`, temporarily keep plugins as only:
```json
"plugins": ["expo-router", "expo-secure-store"]
```
(remove `expo-dev-client` and `react-native-thermal-printer-driver`)

3. Start for Expo Go:
```bash
npx expo start --go
```
Scan the QR with Expo Go.

Flag: `config/features.json` → `"disableBluetoothPrinter": true`

## Re-enable Bluetooth / custom build

1. Set `config/features.json` → `"disableBluetoothPrinter": false`
2. Restore plugins in `app.json` (`expo-dev-client` + thermal printer)
3. Run `npx expo start --dev-client` or install your APK
