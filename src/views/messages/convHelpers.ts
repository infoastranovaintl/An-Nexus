import { useNexusStore, ensureConvMeta as ensureMetaEntry, type ConvMeta } from '../../store/nexus'

/** Mutates-or-creates conv meta entries in a local record copy. */
export function ensureConvMeta(meta: Record<number, ConvMeta>, nodeId: number): ConvMeta {
  if (!meta[nodeId]) meta[nodeId] = ensureMetaEntry(meta[nodeId], nodeId)
  return meta[nodeId]
}

export function useConvMeta(nodeId: number): ConvMeta {
  const meta = useNexusStore((s) => s.convMeta)
  return ensureConvMeta({ ...meta }, nodeId)
}
