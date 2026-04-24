'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'
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
  muted?: boolean
}

function NavItem({ href, label, count, active, onClick, muted }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center justify-between px-[10px] py-[6px] rounded-[5px] transition-colors
        ${active
          ? 'bg-white border border-[#ECECEC] text-navy font-medium'
          : muted
            ? 'text-ink-400 hover:bg-surface-hover hover:text-ink-700'
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

function SectionDivider() {
  return <div className="my-1.5 border-t border-[#F0F0F0]" />
}

function NavSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-[10px] py-[5px] text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium hover:text-ink-700 transition-colors"
      >
        {title}
        <ChevronDown
          size={11}
          className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <nav className="flex flex-col gap-0.5 mt-0.5">
          {children}
        </nav>
      )}
    </div>
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
  const hasScoreAccess = (profile as Profile & { acceso_score?: boolean }).acceso_score === true || isAdmin

  const [ticketsOpen, setTicketsOpen] = useState(true)
  const [scoreOpen, setScoreOpen] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      {/* Dashboard — siempre visible */}
      <NavItem
        href="/dashboard"
        label="Dashboard"
        active={pathname === '/dashboard'}
        onClick={onNav}
      />

      {/* ── Mesa de tickets ── */}
      <NavSection
        title="Mesa de tickets"
        open={ticketsOpen}
        onToggle={() => setTicketsOpen(v => !v)}
      >
        <NavItem
          href="/tickets/mios"
          label="Mis tickets"
          count={counts?.mios}
          active={pathname === '/tickets/mios'}
          onClick={onNav}
        />
        {isResponsable && (
          <NavItem
            href="/tickets/asignados"
            label="Asignados a mí"
            count={counts?.asignados}
            active={pathname === '/tickets/asignados'}
            onClick={onNav}
          />
        )}
        {isAdmin && (
          <>
            <SectionDivider />
            <NavItem
              href="/admin/catalogo"
              label="Catálogo"
              active={pathname.startsWith('/admin/catalogo')}
              onClick={onNav}
              muted
            />
            <NavItem
              href="/admin/areas"
              label="Áreas"
              active={pathname.startsWith('/admin/areas')}
              onClick={onNav}
              muted
            />
          </>
        )}
      </NavSection>

      {/* ── Score Crediticio ── */}
      {hasScoreAccess && (
        <NavSection
          title="Score Crediticio"
          open={scoreOpen}
          onToggle={() => setScoreOpen(v => !v)}
        >
          <NavItem
            href="/score/acreditados"
            label="Acreditados"
            active={pathname === '/score/acreditados'}
            onClick={onNav}
          />
          <NavItem
            href="/score/acreditados/nuevo"
            label="Nuevo registro"
            active={pathname === '/score/acreditados/nuevo'}
            onClick={onNav}
          />
          {isAdmin && (
            <>
              <SectionDivider />
              <NavItem
                href="/admin/score/metricas"
                label="Métricas de score"
                active={pathname.startsWith('/admin/score/metricas')}
                onClick={onNav}
                muted
              />
            </>
          )}
        </NavSection>
      )}

      {/* ── Administración global ── */}
      {isAdmin && (
        <div className="mt-1">
          <p className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium px-[10px] mb-1">
            Administración
          </p>
          <nav className="flex flex-col gap-0.5">
            <NavItem
              href="/admin/usuarios"
              label="Usuarios"
              active={pathname.startsWith('/admin/usuarios')}
              onClick={onNav}
            />
            <NavItem
              href="/admin/metricas"
              label="Métricas"
              active={pathname.startsWith('/admin/metricas')}
              onClick={onNav}
            />
          </nav>
        </div>
      )}
    </div>
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
