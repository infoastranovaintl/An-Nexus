/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLE_MASTER_NAME?: string
  readonly VITE_WS_URL?: string
  readonly VITE_MAP_LAT?: string
  readonly VITE_MAP_LNG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}