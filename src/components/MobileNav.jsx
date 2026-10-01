import { NavLink } from 'react-router-dom'
import { Icon } from './Sidebar'

const sectionsByRole = {
  hr: [
    { title: 'Overview', links: [{ to: '/', label: 'Analytics', icon: 'grid' }] },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Org Chart', icon: 'sitemap' },
        { to: '/certificates', label: 'Certificates', icon: 'award' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Skill Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/succession', label: 'Succession', icon: 'crown' },
        { to: '/audit', label: 'Audit & System Health', icon: 'settings' },
      ],
    },
  ],
  supervisor: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Org Chart', icon: 'sitemap' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Team Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/certificates', label: 'Certificates', icon: 'award' },
        { to: '/succession', label: 'Succession', icon: 'crown' },
      ],
    },
  ],
  management: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    {
      title: 'Operations',
      links: [
        { to: '/orgchart', label: 'Org Chart', icon: 'sitemap' },
        { to: '/succession', label: 'Succession', icon: 'crown' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    { title: 'Monitoring', links: [{ to: '/audit', label: 'Audit & System Health', icon: 'settings' }] },
  ],
  operations_manager: [
    { title: 'Overview', links: [{ to: '/', label: 'Analytics', icon: 'grid' }] },
    {
      title: 'Administration',
      links: [
        { to: '/employees', label: 'Employee Records', icon: 'users' },
        { to: '/orgchart', label: 'Org Chart', icon: 'sitemap' },
        { to: '/certificates', label: 'Certificates', icon: 'award' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Skill Dev', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/succession', label: 'Succession', icon: 'crown' },
        { to: '/audit', label: 'Audit & System Health', icon: 'settings' },
      ],
    },
  ],
  employee: [
    { title: 'Overview', links: [{ to: '/', label: 'Dashboard', icon: 'grid' }] },
    {
      title: 'Operations',
      links: [
        { to: '/orgchart', label: 'Org Chart', icon: 'sitemap' },
        { to: '/performance', label: 'Performance', icon: 'trend' },
        { to: '/competency', label: 'Development', icon: 'award' },
        { to: '/recognition', label: 'Recognition', icon: 'heart' },
      ],
    },
    {
      title: 'Monitoring',
      links: [
        { to: '/learning', label: 'Learning', icon: 'book' },
        { to: '/training', label: 'Training', icon: 'calendar' },
        { to: '/certificates', label: 'My Certificates', icon: 'award' },
      ],
    },
  ],
}

export default function MobileNav({ user, onLogout, open, onClose }) {
  const sections = sectionsByRole[user.role] || sectionsByRole.employee
  const roleLabel =
    {
      hr: 'HR Administrator',
      supervisor: 'Department Head',
      management: 'Senior Management',
      operations_manager: 'Operations Manager',
      employee: 'Employee'
    }[user.role] || user.role

  const initials = user.name
    ? (user.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase()
    : 'HR'

  const close = () => onClose && onClose()

  return (
    <>
      {open && (
        <>
          <div className="mobile-nav-backdrop" onClick={close} />
          <aside className="mobile-nav-drawer">
            <button className="mobile-nav-close" onClick={close} aria-label="Close menu">×</button>
            <div className="sidebar-brand-wrapper">
              <div className="brand">
                <img className="brand-logo-icon" src="/prioritylogo.png" alt="" />
                <div className="brand-text-block">
                  <span className="brand-name">Priority Handling Services, Inc.</span>
                  <span className="brand-badge">WORKFORCE SERVICES</span>
                </div>
              </div>
            </div>

            <div className="nav-list">
              {sections.map((section) => (
                <div key={section.title} className="sidebar-section">
                  <div className="section-title">{section.title}</div>
                  <div className="section-list">
                    {section.links.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={close}
                        className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                      >
                        <span className="nav-icon-wrap"><Icon name={item.icon} size={18} /></span>
                        <span className="label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sidebar-footer">
              <div className="profile-mini profile-rbac">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span className="avatar avatar-lia">{initials}</span>
                )}
                <div className="profile-info">
                  <b>{user.name}</b>
                  <small>{roleLabel}</small>
                </div>
                <span className="role-dot" />
              </div>
              <button
                className="sidebar-signout"
                onClick={() => {
                  close()
                  onLogout()
                }}
              >
                Sign out
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
