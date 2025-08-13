import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const { pathname } = useLocation()
  const Tab = ({ to, label }: { to: string; label: string }) => (
    <Link to={to} className={`tab ${pathname === to ? 'active' : ''}`}>{label}</Link>
  )
  return (
    <div className="topbar">
      <div className="nav">
        <div className="brand">CatAttr</div>
        <Tab to="/" label="Welcome" />
        <Tab to="/category-tree" label="Category Tree" />
        <Tab to="/attributes" label="Attributes" />
      </div>
    </div>
  )
}
