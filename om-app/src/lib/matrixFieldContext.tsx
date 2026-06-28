import { createContext, useContext, type ReactNode } from 'react'
import type { FieldEditMatrix } from './fieldEditMatrix'
import type { Role } from './roles'

/**
 * Context that MatrixField reads to decide how to render itself.
 *
 *   matrix     The field-edit matrix for the current entity (request or WO).
 *   role       The effective role of the current user.
 *   status     The current lifecycle status of the entity being viewed.
 *   isEditing  Whether the parent detail panel is in edit mode. When false,
 *              MatrixField always renders read-only (no inputs), regardless
 *              of access level.
 */
export type MatrixFieldContextValue = {
  matrix: FieldEditMatrix
  role: Role
  status: string
  isEditing: boolean
}

const MatrixFieldContext = createContext<MatrixFieldContextValue | null>(null)

type ProviderProps = MatrixFieldContextValue & { children: ReactNode }

export function MatrixFieldProvider({
  matrix,
  role,
  status,
  isEditing,
  children,
}: ProviderProps) {
  return (
    <MatrixFieldContext.Provider value={{ matrix, role, status, isEditing }}>
      {children}
    </MatrixFieldContext.Provider>
  )
}

/**
 * Hook that MatrixField uses to read its context. Throws if used outside
 * a MatrixFieldProvider — that's a programming error, not a runtime case
 * to handle gracefully.
 */
export function useMatrixFieldContext(): MatrixFieldContextValue {
  const ctx = useContext(MatrixFieldContext)
  if (!ctx) {
    throw new Error(
      'useMatrixFieldContext must be used inside a <MatrixFieldProvider>',
    )
  }
  return ctx
}