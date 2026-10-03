/** Shared constants + tiny helpers for the self-booking modal. */

export const SCHOOL_PURPOSE_OPTIONS = [
  { value: 'academic',       label: 'Academic / Class'  },
  { value: 'school_event',   label: 'School Event'      },
  { value: 'department_use', label: 'Department Use'    },
]

export const PAID_PURPOSE_OPTIONS = [
  { value: 'personal',   label: 'Personal / Sports / Recreation' },
  { value: 'community',  label: 'Community Event'                },
  { value: 'commercial', label: 'Commercial / Business'          },
]

export type UseType = 'school' | 'paid'
export type Errors  = Record<string, string>

export const PH_PHONE_RE = /^((09|\+639)\d{9}|0[2-8]\d{8})$/
export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}
