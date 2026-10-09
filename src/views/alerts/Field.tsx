export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[0.5rem] font-bold uppercase tracking-wider text-tx3">{label}</label>
      {children}
    </div>
  )
}
