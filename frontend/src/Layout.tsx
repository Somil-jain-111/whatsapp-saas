import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ContactRound,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  Menu,
  MessageCircleMore,
  PanelLeftClose,
  PlugZap,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SquareTerminal,
  Workflow,
  Shapes,
  UsersRound,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, clearSession, isPlatformAdmin, readSession, saveSession } from "./api";
import { matchesNavigationSearch } from "./navigation-search";

const customerNavigation = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Engage",
    items: [
      { to: "/contacts", label: "Contacts", icon: ContactRound },
      { to: "/contacts/audiences", label: "Tags & segments", icon: UsersRound },
      { to: "/messages", label: "Messages", icon: MessageCircleMore },
      { to: "/inbox", label: "Shared inbox", icon: MessageCircleMore },
      { to: "/inbox/team", label: "Team inbox", icon: UsersRound },
      { to: "/inbox/tools", label: "Replies & labels", icon: Shapes },
      { to: "/messages/bulk", label: "Bulk messaging", icon: UsersRound },
      { to: "/campaigns", label: "Campaigns", icon: Send },
    ],
  },
  {
    label: "Automation",
    items: [
      { to: "/automations", label: "Automation dashboard", icon: Workflow },
      { to: "/automations/workflows", label: "Workflows", icon: Shapes },
      {
        to: "/automations/chatbot",
        label: "Chatbot rules",
        icon: MessageCircleMore,
      },
      {
        to: "/automations/executions",
        label: "Execution logs",
        icon: Activity,
      },
      {
        to: "/automations/analytics",
        label: "Automation analytics",
        icon: BarChart3,
      },
      {
        to: "/automations/simulator",
        label: "Test & simulator",
        icon: SquareTerminal,
      },
    ],
  },
  {
    label: "WhatsApp",
    items: [
      { to: "/integrations", label: "Connections", icon: PlugZap },
      { to: "/accounts", label: "Accounts & numbers", icon: MessageCircleMore },
      { to: "/templates", label: "Templates", icon: Shapes },
      { to: "/integrations/diagnostics", label: "Diagnostics", icon: Activity },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/inbox/analytics", label: "Inbox analytics", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/billing", label: "Billing & usage", icon: CreditCard },
      { to: "/usage", label: "Usage quotas", icon: Activity },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/workspace", label: "Team & access", icon: UsersRound },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/inbox/settings", label: "Inbox settings", icon: Settings },
      { to: "/developer", label: "Developer portal", icon: SquareTerminal },
      {
        to: "/enterprise/security",
        label: "Enterprise security",
        icon: ShieldCheck,
      },
      { to: "/enterprise/sso", label: "Single sign-on", icon: ShieldCheck },
      {
        to: "/enterprise/privacy",
        label: "Privacy requests",
        icon: ContactRound,
      },
      { to: "/enterprise/retention", label: "Data retention", icon: Activity },
      {
        to: "/enterprise/organization",
        label: "Data residency",
        icon: PlugZap,
      },
    ],
  },
];

const adminNavigation = [
  {
    label: "Platform administration",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/admin/customers", label: "Customers", icon: UsersRound },
      {
        to: "/operations?group=Platform+admin",
        match: "/operations",
        label: "API operations",
        icon: SquareTerminal,
      },
      { to: "/admin/integrations", label: "Meta monitor", icon: ShieldCheck },
      { to: "/admin/billing", label: "Billing operations", icon: CreditCard },
      { to: "/admin/api", label: "Public API security", icon: ShieldCheck },
      { to: "/admin/inbox", label: "Inbox health", icon: MessageCircleMore },
      { to: "/admin/automations", label: "Automation health", icon: Workflow },
      { to: "/admin/platform", label: "Platform health", icon: Activity },
      {
        to: "/admin/incidents",
        label: "Security incidents",
        icon: ShieldCheck,
      },
      { to: "/admin/privacy", label: "Privacy operations", icon: ContactRound },
      { to: "/admin/recovery", label: "Backup recovery", icon: FileBarChart },
    ],
  },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const session = readSession();
  const isAdmin = isPlatformAdmin(session);
  const navigation = isAdmin ? adminNavigation : customerNavigation;
  const items = navigation.flatMap((group) => group.items);
  const searchResults = navigation
    .flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label })),
    )
    .filter((item) =>
      matchesNavigationSearch(searchQuery, item.label, item.group),
    );
  const current =
    items.find(
      (item) => ("match" in item ? item.match : item.to) === location.pathname,
    ) ??
    items
      .filter((item) => {
        const path = "match" in item ? item.match : item.to;
        return path !== "/" && location.pathname.startsWith(`${path}/`);
      })
      .sort((a, b) => b.to.length - a.to.length)[0];

  useEffect(() => {
    if (!isAdmin)
      void api("/analytics/journey-events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "PAGE_VIEW",
          path: location.pathname,
        }),
      }).catch(() => undefined);
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const openSearchResult = (to: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(to);
  };

  const disconnect = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* Clear unusable local credentials even when the API is unavailable. */
    }
    clearSession();
    navigate(session?.mode === "PLATFORM_ADMIN" ? "/admin/login" : "/login");
  };

  return (
    <div className={`app-shell ${compact ? "sidebar-compact" : ""}`}>
      {searchOpen && (
        <div
          className="workspace-search-overlay"
          onMouseDown={() => setSearchOpen(false)}
        >
          <section
            className="workspace-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search workspace"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label>
              <Search />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchResults[0])
                    openSearchResult(searchResults[0].to);
                }}
                placeholder="Search pages"
              />
              <kbd>Esc</kbd>
            </label>
            <div className="workspace-search-results">
              {searchResults.map(({ to, label, icon: Icon, group }) => (
                <button key={to} onClick={() => openSearchResult(to)}>
                  <Icon />
                  <span>
                    <strong>{label}</strong>
                    <small>{group}</small>
                  </span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <p>No matching pages found.</p>
              )}
            </div>
          </section>
        </div>
      )}
      {mobileOpen && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <NavLink
            className="brand"
            to="/"
            onClick={() => setMobileOpen(false)}
          >
            <span className="brand-mark">
              <MessageCircleMore />
            </span>
            <span className="brand-copy">
              <strong>Relay</strong>
              <small>WhatsApp OS</small>
            </span>
          </NavLink>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-avatar">{isAdmin ? "PA" : "WA"}</span>
          <span>
            <strong>{isAdmin ? "Platform console" : "Workspace"}</strong>
            <small>
              {isAdmin
                ? "Super administrator"
                : (session?.organizationId.slice(0, 13) ?? "Not connected")}
            </small>
          </span>
          {!isAdmin && (session?.organizations?.length ?? 0) > 1 ? (
            <select
              aria-label="Switch workspace"
              value={session?.organizationId}
              onChange={(event) => {
                if (!session) return;
                saveSession({ ...session, organizationId: event.target.value });
                navigate("/");
                window.location.reload();
              }}
            >
              {session?.organizations?.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name ?? organization.id}
                </option>
              ))}
            </select>
          ) : (
            <ChevronDown />
          )}
        </div>

        <nav aria-label="Primary navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="api-health">
            <span />
            <div>
              <strong>API connected</strong>
              <small>Development</small>
            </div>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCompact((value) => !value)}
          >
            <PanelLeftClose />
            <span>Collapse menu</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>Relay</span>
            <b>/</b>
            <strong>{current?.label ?? "Workspace"}</strong>
          </div>
          <button
            className="search-button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search workspace"
          >
            <Search />
            <span>Search workspace</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Activity">
              <Activity />
            </button>
            <button
              className="icon-button has-alert"
              aria-label="Notifications"
            >
              <Bell />
            </button>
            <button
              className="user-menu"
              onClick={() => void disconnect()}
              title="Sign out"
            >
              <span>
                {session?.user?.fullName?.slice(0, 2).toUpperCase() ?? "TA"}
              </span>
              <div>
                <strong>
                  {session?.user?.fullName ??
                    (session?.mode === "PLATFORM_ADMIN"
                      ? "Platform admin"
                      : "Team admin")}
                </strong>
                <small>Sign out</small>
              </div>
              <ChevronDown />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
