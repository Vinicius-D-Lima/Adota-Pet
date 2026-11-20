import type { HTMLAttributes } from 'react'
import { cx } from './ui'

/** Grade responsiva de cartões de pet: 1 coluna no celular, 2 no tablet e 3 no desktop. */
export function PetGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}
      {...props}
    />
  )
}
