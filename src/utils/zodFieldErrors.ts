import type { ZodError } from 'zod'

export type FieldErrors<T extends string> = Partial<Record<T, string>>

export function getZodFieldErrors<T extends string>(error: ZodError): FieldErrors<T> {
  return error.issues.reduce<FieldErrors<T>>((errors, issue) => {
    const field = issue.path[0]

    if (typeof field === 'string' && !errors[field as T]) {
      errors[field as T] = issue.message
    }

    return errors
  }, {})
}
