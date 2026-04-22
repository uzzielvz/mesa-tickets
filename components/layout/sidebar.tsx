'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Wordmark from '@/components/brand/wordmark'
import UserMenu from '@/components/layout/user-menu'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface SidebarProps {
  profile: Profile
  counts?: {
    mios: number
    asignados: number
  }
}

interface NavItemProps {
  href: string
  label: string
  count?: number
  active: boolean
}

function NavItem({ href, label, count, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between px-[10px] py-[6px] rounded-[5px] transition-colors
        ${active
          ? 'bg-white border border-[#ECECEC] text-navy font-medium'
          : 'text-ink-500 hover:bg-surface-hover'
        }
      `}
    >
      <span className="text-[13px]">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-[11px] ${active ? 'text-orange' : 'text-ink-400'}`}>
          {count}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({ profile, counts }: SidebarProps) {
  const pathname = usePathname()

  const isAdmin = profile.rol === 'admin'
  const isResponsable = profile.rol === 'responsable' || isAdmin

  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface-sidebar border-r border-[#ECECEC] border-r-[0.5px] flex flex-col min-h-screen">
      <div className="flex-1 px-[14px] py-5">
        <div className="mb-6">
          <Wordmark />
        </div>

        {/* Nav principal */}
        <nav className="flex flex-col gap-0.5">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            active={pathname === '/dashboard'}
          />
          <NavItem
            href="/tickets/mios"
            label="Mis tickets"
            count={counts?.mios}
            active={pathname === '/tickets/mios'}
          />
          {isResponsable && (
            <NavItem
              href="/tickets/asignados"
              label="Asignados a mí"
              count={counts?.asignados}
              active={pathname === '/tickets/asignados'}
            />
          )}
        </nav>

        {/* Sección admin */}
        {isAdmin && (
          <div className="mt-5">
            <p className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium px-[10px] mb-1">
              Administración
            </p>
            <nav className="flex flex-col gap-0.5">
              <NavItem
                href="/admin/catalogo"
                label="Catálogo"
                active={pathname.startsWith('/admin/catalogo')}
              />
              <NavItem
                href="/admin/areas"
                label="Áreas"
                active={pathname.startsWith('/admin/areas')}
              />
              <NavItem
                href="/admin/usuarios"
                label="Usuarios"
                active={pathname.startsWith('/admin/usuarios')}
              />
              <NavItem
                href="/admin/metricas"
                label="Métricas"
                active={pathname.startsWith('/admin/metricas')}
              />
            </nav>
          </div>
        )}
      </div>

      {/* User card */}
      <div className="border-t border-[#ECECEC] border-t-[0.5px] px-[14px] py-4">
        <UserMenu profile={profile} />
      </div>
    </aside>
  )
}
