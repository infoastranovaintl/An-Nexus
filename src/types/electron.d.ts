export {}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean
      platform: string
      onBluetoothPinRequest: (callback: (details: { deviceId: string; pin: string | undefined }) => void) => void
      respondBluetoothPin: (pin: string) => void
      onBluetoothDevices: (callback: (devices: { deviceId: string; deviceName: string }[]) => void) => void
      selectBluetoothDevice: (deviceId: string) => void
      cancelBluetoothScan: () => void
    }
  }
}
