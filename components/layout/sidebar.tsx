'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Wordmark from '@/components/brand/wordmark'
import UserMenu from '@/components/layout/user-menu'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface SidebarProps {
  profile: Profile
  counts?: { mios: number; asignados: number }
}

interface NavItemProps {
  href: string
  label: string
  count?: number
  active: boolean
  onClick?: () => void
}

function NavItem({ href, label, count, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
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

function NavContent({
  pathname,
  profile,
  counts,
  onNav,
}: {
  pathname: string
  profile: Profile
  counts?: SidebarProps['counts']
  onNav?: () => void
}) {
  const isAdmin = profile.rol === 'admin'
  const isResponsable = profile.rol === 'responsable' || isAdmin

  return (
    <>
      <nav className="flex flex-col gap-0.5">
        <NavItem href="/dashboard" label="Dashboard" active={pathname === '/dashboard'} onClick={onNav} />
        <NavItem href="/tickets/mios" label="Mis tickets" count={counts?.mios} active={pathname === '/tickets/mios'} onClick={onNav} />
        {isResponsable && (
          <NavItem href="/tickets/asignados" label="Asignados a mí" count={counts?.asignados} active={pathname === '/tickets/asignados'} onClick={onNav} />
        )}
      </nav>

      {isAdmin && (
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium px-[10px] mb-1">
            Administración
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavItem href="/admin/catalogo" label="Catálogo" active={pathname.startsWith('/admin/catalogo')} onClick={onNav} />
            <NavItem href="/admin/areas" label="Áreas" active={pathname.startsWith('/admin/areas')} onClick={onNav} />
            <NavItem href="/admin/usuarios" label="Usuarios" active={pathname.startsWith('/admin/usuarios')} onClick={onNav} />
            <NavItem href="/admin/metricas" label="Métricas" active={pathname.startsWith('/admin/metricas')} onClick={onNav} />
          </nav>
        </div>
      )}
    </>
  )
}

export default function Sidebar({ profile, counts }: SidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-sidebar border-b border-[#ECECEC] flex items-center justify-between px-4 h-12">
        <Wordmark />
        <button onClick={() => setOpen(v => !v)} className="text-ink-500 p-1">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-30 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.2)' }}
        onClick={() => setOpen(false)}
      >
        <div
          className={`absolute top-12 left-0 bottom-0 w-[220px] bg-surface-sidebar border-r border-[#ECECEC] flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-1 px-[14px] py-5 overflow-y-auto">
            <NavContent pathname={pathname} profile={profile} counts={counts} onNav={() => setOpen(false)} />
          </div>
          <div className="border-t border-[#ECECEC] px-[14px] py-4">
            <UserMenu profile={profile} />
          </div>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-surface-sidebar border-r border-[#ECECEC] border-r-[0.5px] flex-col min-h-screen">
        <div className="flex-1 px-[14px] py-5">
          <div className="mb-6">
            <Wordmark />
          </div>
          <NavContent pathname={pathname} profile={profile} counts={counts} />
        </div>
        <div className="border-t border-[#ECECEC] border-t-[0.5px] px-[14px] py-4">
          <UserMenu profile={profile} />
        </div>
      </aside>
    </>
  )
}
