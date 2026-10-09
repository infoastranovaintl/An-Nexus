import { Dialog, type DialogProps } from './Dialog'

export function Modal({ width, ...props }: DialogProps) {
  return <Dialog {...props} centered width={width ?? 'max-w-[420px]'} />
}
