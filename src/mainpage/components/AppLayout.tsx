import { Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/admin/users': 'System Management',
  '/clients': 'Clients',
  '/crm': 'CRM',
  '/calendar': 'Calendar',
  '/reports': 'Reports',
  '/payments-budget': 'Payments & Budget',
  '/project-management': 'Project Management',
  '/invoices': 'Invoices',
  '/media': 'Media',
}

/** The signed-in shell: sidebar on the left, header on top, the page below. */
export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div
      className={`min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out ${sidebarCollapsed ? 'lg:grid-cols-[64px_1fr]' : 'lg:grid-cols-[var(--spacing-sidebar)_1fr]'}`}
    >
      <aside className="sticky top-0 hidden h-dvh overflow-hidden border-r border-line-strong lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-30 lg:hidden ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-scrim backdrop-blur-(--scrim-blur) transition-opacity duration-(--duration-enter) ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!menuOpen}
          className={`absolute inset-y-0 left-0 w-drawer max-w-[85vw] border-r border-line-strong shadow-lift transition-transform duration-(--duration-drawer) ease-out-expo ${menuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1px)]'}`}
        >
          <Sidebar onClose={() => setMenuOpen(false)} />
        </div>
      </div>

      {/* Tablet and up the shell is exactly one screen tall: the window never scrolls; content scrolls inside <main>. */}
      <div className="flex min-h-dvh min-w-0 flex-col bg-canvas sm:h-dvh">
        <Header title={TITLES[pathname] ?? 'Infynix OS'} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col sm:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
