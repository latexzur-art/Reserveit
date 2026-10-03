'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Phone, Building2, IdCard, ExternalLink, ShieldCheck, ShieldX, Star } from 'lucide-react'
import type { DirectoryPersonDetail } from '@/backend/admin/building/building.types'
import { ROUTES } from '@/lib/routes'
import { userRoleLabel } from '@/lib/enum-labels'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function Field({ icon: Icon, label, value }: { icon?: any; label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

interface Props {
  detail: DirectoryPersonDetail
}

export function AccountTab({ detail }: Props) {
  const isExternal = detail.category === 'external_client'
  const isMaintenance = detail.category === 'maintenance_staff'

  return (
    <div className="space-y-5 py-2">
      {/* Core info */}
      <div className="grid grid-cols-1 gap-4">
        <Field icon={Mail} label="Email" value={detail.email} />
        <Field icon={Phone} label="Phone" value={detail.phone ?? detail.contactPhone} />
        <Field icon={IdCard} label="Employee / ID" value={detail.employeeId} />
        {!isExternal && !isMaintenance && (
          <Field icon={Building2} label="Department" value={
            detail.departmentName
              ? `${detail.departmentName}${detail.departmentCode ? ` (${detail.departmentCode})` : ''}`
              : null
          } />
        )}
        {detail.roles.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Roles</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.roles.map(r => (
                <Badge key={r} variant="secondary" className="text-xs capitalize">{userRoleLabel(r)}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* External client extras */}
      {isExternal && (
        <>
          <hr className="border-border" />
          <div className="grid grid-cols-1 gap-4">
            <Field label="Organization" value={detail.organizationName} />
            <Field label="Org Type" value={detail.organizationType} />
            <Field label="Contact Person" value={detail.contactPerson} />
            <Field label="Contact Email" value={detail.contactEmail} />
            <Field label="Location" value={[detail.city, detail.province].filter(Boolean).join(', ') || null} />
            <Field label="Address" value={detail.address} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {detail.isVerified !== null && (
              <Badge className={detail.isVerified ? 'bg-green-100 text-green-700 border-none' : 'bg-amber-100 text-amber-700 border-none'}>
                {detail.isVerified ? <><ShieldCheck className="w-3 h-3 mr-1" />Verified</> : 'Unverified'}
              </Badge>
            )}
            {detail.isBlacklisted && (
              <Badge variant="destructive">
                <ShieldX className="w-3 h-3 mr-1" />Blacklisted
              </Badge>
            )}
            {detail.trustScore !== null && (
              <Badge variant="outline" className="text-xs">
                <Star className="w-3 h-3 mr-1" />Trust Score: {detail.trustScore}/100
              </Badge>
            )}
          </div>
          {detail.verificationNotes && (
            <p className="text-xs text-muted-foreground italic">{detail.verificationNotes}</p>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={ROUTES.userManager.root} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Manage in Users
            </a>
          </Button>
        </>
      )}

      {/* Maintenance staff extras */}
      {isMaintenance && (
        <>
          <hr className="border-border" />
          <div className="grid grid-cols-1 gap-4">
            <Field label="Position" value={detail.position} />
            <Field label="Specialization" value={detail.specialization} />
            <Field label="Hire Date" value={detail.hireDate
              ? new Date(detail.hireDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
              : null}
            />
            <Field label="Notes" value={detail.notes} />
          </div>
        </>
      )}
    </div>
  )
}
