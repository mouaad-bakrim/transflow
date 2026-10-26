"use client";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Route,
  Search,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import {
  Agency,
  Company,
  Dashboard,
  getDashboard,
  getMe,
  listAgencies,
  listCompanies,
  listUsers,
  login,
  saveAgency,
  saveCompany,
  saveUser,
  updateMe,
  User,
} from "@/lib/api";
import FleetPage from "@/components/FleetPage";
import OperationsPage from "@/components/OperationsPage";
import ModuleRegistryPage from "@/components/ModuleRegistryPage";
import CommercialWorkflowPage from "@/components/CommercialWorkflowPage";

type View =
  | "dashboard"
  | "vehicles"
  | "vehicle_documents"
  | "customers"
  | "missions"
  | "fuel"
  | "maintenance"
  | "planning"
  | "telematics"
  | "finance"
  | "subcontracting"
  | "hr"
  | "reporting"
  | "companies"
  | "agencies"
  | "users"
  | "settings";
const roleNames: Record<string, string> = {
  SUPERADMIN: "Superadministrateur",
  COMPANY_ADMIN: "Administrateur société",
  DIRECTOR: "Directeur",
  OPERATIONS: "Exploitation",
  OBC: "Responsable OBC",
  FLEET: "Responsable flotte",
  MAINTENANCE: "Maintenance",
  FUEL: "Carburant",
  HR: "Ressources humaines",
  ACCOUNTANT: "Comptable",
  SALES: "Commercial",
  DRIVER: "Conducteur",
};
const roles = Object.keys(roleNames);

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="modal">
        <header>
          <div>
            <span className="eyebrow">Administration</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Status({ active }: { active: boolean }) {
  return (
    <span className={`status ${active ? "on" : "off"}`}>
      {active ? "Actif" : "Inactif"}
    </span>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null),
    [data, setData] = useState<Dashboard | null>(null),
    [me, setMe] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]),
    [agencies, setAgencies] = useState<Agency[]>([]),
    [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<View>("dashboard"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Company | Agency | User | null | "new">(
      null,
    );
  const isAdmin = me?.role === "SUPERADMIN" || me?.role === "COMPANY_ADMIN";
  const canSeeFleet =
    !!me &&
    [
      "SUPERADMIN",
      "COMPANY_ADMIN",
      "DIRECTOR",
      "OPERATIONS",
      "FLEET",
      "MAINTENANCE",
    ].includes(me.role);

  useEffect(() => {
    const saved = localStorage.getItem("access_token");
    if (saved) {
      setToken(saved);
      load(saved);
    }
    const tokenUpdated = (event: Event) => setToken((event as CustomEvent<string>).detail);
    const sessionExpired = () => logout();
    window.addEventListener("auth:token", tokenUpdated);
    window.addEventListener("auth:expired", sessionExpired);
    return () => {
      window.removeEventListener("auth:token", tokenUpdated);
      window.removeEventListener("auth:expired", sessionExpired);
    };
  }, []);
  async function load(t: string) {
    setLoading(true);
    try {
      const [dashboard, profile] = await Promise.all([
        getDashboard(t),
        getMe(t),
      ]);
      setData(dashboard);
      setMe(profile);
      if (profile.role === "SUPERADMIN" || profile.role === "COMPANY_ADMIN") {
        const [c, a, u] = await Promise.all([
          listCompanies(t),
          listAgencies(t),
          listUsers(t),
        ]);
        setCompanies(c.results);
        setAgencies(a.results);
        setUsers(u.results);
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }
  async function submitLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const auth = await login(
        String(form.get("username")),
        String(form.get("password")),
      );
      localStorage.setItem("access_token", auth.access);
      localStorage.setItem("refresh_token", auth.refresh);
      setToken(auth.access);
      await load(auth.access);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }
  function logout() {
    localStorage.clear();
    setToken(null);
    setData(null);
    setMe(null);
  }
  function go(next: View) {
    setView(next);
    setQuery("");
    setEditing(null);
  }
  function success(text: string) {
    setNotice(text);
    setEditing(null);
    setTimeout(() => setNotice(""), 3000);
  }

  async function submitCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError("");
    const f = new FormData(e.currentTarget),
      current = editing !== "new" ? (editing as Company) : null;
    try {
      const saved = await saveCompany(
        token,
        {
          name: String(f.get("name")),
          legal_name: String(f.get("legal_name")),
          ice: String(f.get("ice")),
          tax_id: String(f.get("tax_id")),
          trade_register: String(f.get("trade_register")),
          active: f.get("active") === "on",
        },
        current?.id,
      );
      setCompanies((x) =>
        current ? x.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...x],
      );
      success(current ? "Société mise à jour." : "Société créée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }
  async function submitAgency(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError("");
    const f = new FormData(e.currentTarget),
      current = editing !== "new" ? (editing as Agency) : null;
    try {
      const saved = await saveAgency(
        token,
        {
          company: String(f.get("company")),
          name: String(f.get("name")),
          code: String(f.get("code")),
          city: String(f.get("city")),
          active: f.get("active") === "on",
        },
        current?.id,
      );
      setAgencies((x) =>
        current ? x.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...x],
      );
      success(current ? "Agence mise à jour." : "Agence créée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }
  async function submitUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError("");
    const f = new FormData(e.currentTarget),
      current = editing !== "new" ? (editing as User) : null;
    const values = {
      username: String(f.get("username")),
      first_name: String(f.get("first_name")),
      last_name: String(f.get("last_name")),
      email: String(f.get("email")),
      phone: String(f.get("phone")),
      role: String(f.get("role")),
      company: f.get("company") ? String(f.get("company")) : null,
      agency: f.get("agency") ? String(f.get("agency")) : null,
      is_active: f.get("is_active") === "on",
      password: String(f.get("password")) || undefined,
    };
    try {
      const saved = await saveUser(token, values, current?.id);
      setUsers((x) =>
        current ? x.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...x],
      );
      success(current ? "Utilisateur mis à jour." : "Utilisateur créé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }
  async function submitProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const saved = await updateMe(token, {
        first_name: String(f.get("first_name")),
        last_name: String(f.get("last_name")),
        email: String(f.get("email")),
        phone: String(f.get("phone")),
        preferred_language: String(f.get("preferred_language")),
      });
      setMe(saved);
      success("Profil enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (view === "companies")
      return companies.filter((x) =>
        `${x.name} ${x.legal_name} ${x.ice}`.toLowerCase().includes(q),
      );
    if (view === "agencies")
      return agencies.filter((x) =>
        `${x.name} ${x.code} ${x.city}`.toLowerCase().includes(q),
      );
    return users.filter((x) =>
      `${x.username} ${x.first_name} ${x.last_name} ${x.email} ${x.role_label}`
        .toLowerCase()
        .includes(q),
    );
  }, [view, query, companies, agencies, users]);

  if (!token)
    return (
      <main className="login">
        <section className="loginCard">
          <div className="brandMark">FT</div>
          <h1>
            FLEETTRANSPORT <span>PRO</span>
          </h1>
          <p>
            Pilotez votre activité transport depuis un seul espace sécurisé.
          </p>
          <form onSubmit={submitLogin}>
            <Field label="Identifiant">
              <input
                name="username"
                autoComplete="username"
                required
                autoFocus
              />
            </Field>
            <Field label="Mot de passe">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <div className="error">{error}</div>}
            <button>Se connecter</button>
          </form>
        </section>
      </main>
    );
  const navGroups = [
    {
      label: "Accueil",
      items: [
        {
          id: "dashboard" as View,
          label: "Tableau de bord",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "Exploitation",
      items: [
        { id: "missions" as View, label: "Missions / Transport", icon: Route },
        {
          id: "planning" as View,
          label: "Planning & affectations",
          icon: Route,
        },
      ],
    },
    {
      label: "Flotte & carburant",
      items: [
        ...(canSeeFleet
          ? [
              { id: "vehicles" as View, label: "Véhicules", icon: Truck },
              {
                id: "vehicle_documents" as View,
                label: "Documents & alertes",
                icon: FileText,
              },
            ]
          : []),
        { id: "fuel" as View, label: "Pleins & carburant", icon: Fuel },
        { id: "maintenance" as View, label: "Maintenance GMAO", icon: Wrench },
      ],
    },
    {
      label: "Gestion",
      items: [
        { id: "customers" as View, label: "Clients", icon: ShoppingBag },
        {
          id: "finance" as View,
          label: "Commercial & Finance",
          icon: ShoppingBag,
        },
        { id: "subcontracting" as View, label: "Sous-traitance", icon: Truck },
        { id: "hr" as View, label: "Ressources humaines", icon: Users },
      ],
    },
    {
      label: "Pilotage",
      items: [
        {
          id: "telematics" as View,
          label: "OBC / Télématique",
          icon: LayoutDashboard,
        },
        {
          id: "reporting" as View,
          label: "Analyse & Reporting",
          icon: FileText,
        },
      ],
    },
    {
      label: "Administration",
      items: [
        ...(isAdmin
          ? [
              { id: "companies" as View, label: "Sociétés", icon: Building2 },
              { id: "agencies" as View, label: "Agences", icon: Warehouse },
              {
                id: "users" as View,
                label: "Utilisateurs & rôles",
                icon: Users,
              },
            ]
          : []),
        { id: "settings" as View, label: "Paramètres", icon: Settings },
      ],
    },
  ].filter((group) => group.items.length);
  const nav = navGroups.flatMap((group) => group.items);
  const adminView =
    view === "companies" || view === "agencies" || view === "users";
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside>
        <div className="asideBrand">
          <b>FT</b>
          <span>
            FLEETTRANSPORT
            <br />
            <small>PRO</small>
          </span>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div className="navGroup" key={group.label}>
              <small className="navTitle">{group.label}</small>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={view === item.id ? "active" : ""}
                  onClick={() => go(item.id)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="asideUser">
          <div>
            {(me?.first_name?.[0] || me?.username?.[0] || "U").toUpperCase()}
          </div>
          <span>
            <b>{me?.first_name || me?.username}</b>
            <small>{me?.role_label}</small>
          </span>
        </div>
      </aside>
      <main className="content">
        <header>
          <button
            className="icon"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Rétracter le menu"
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            FLEETTRANSPORT <ChevronRight />{" "}
            {nav.find((x) => x.id === view)?.label}
          </div>
          <div className="spacer" />
          <button className="logout" onClick={logout}>
            <LogOut /> Déconnexion
          </button>
        </header>
        <section className="page">
          {notice && (
            <div className="toast">
              <CheckCircle2 />
              {notice}
            </div>
          )}
          {view === "dashboard" && (
            <DashboardPage data={data} loading={loading} />
          )}{" "}
          {(view === "vehicles" || view === "vehicle_documents") && me && (
            <FleetPage
              token={token}
              mode={view}
              companies={companies}
              agencies={agencies}
              me={me}
            />
          )}{" "}
          {(view === "customers" ||
            view === "missions" ||
            view === "fuel" ||
            view === "maintenance") &&
            me && (
              <OperationsPage
                token={token}
                mode={view}
                companies={companies}
                agencies={agencies}
                users={users}
                me={me}
              />
            )}{" "}
          {adminView && (
            <>
              <PageHead
                view={view}
                count={filtered.length}
                query={query}
                setQuery={setQuery}
                add={() => {
                  setError("");
                  setEditing("new");
                }}
              />
              <DataTable
                view={view}
                rows={filtered}
                companies={companies}
                edit={(row) => {
                  setError("");
                  setEditing(row);
                }}
              />
            </>
          )}
          {view === "settings" && me && (
            <SettingsPage me={me} onSubmit={submitProfile} error={error} />
          )}
          {view === "finance" && me && (
            <CommercialWorkflowPage
              token={token}
              companies={companies}
              agencies={agencies}
              me={me}
            />
          )}
          {plannedModules[view] && view !== "finance" && me && (
            <ModuleRegistryPage
              token={token}
              view={
                view as
                  | "planning"
                  | "telematics"
                  | "subcontracting"
                  | "hr"
                  | "reporting"
              }
              companies={companies}
              agencies={agencies}
              me={me}
            />
          )}
        </section>
      </main>
      {editing && view === "companies" && (
        <CompanyModal
          company={editing === "new" ? null : (editing as Company)}
          onClose={() => setEditing(null)}
          onSubmit={submitCompany}
          error={error}
        />
      )}{" "}
      {editing && view === "agencies" && (
        <AgencyModal
          agency={editing === "new" ? null : (editing as Agency)}
          companies={companies}
          me={me}
          onClose={() => setEditing(null)}
          onSubmit={submitAgency}
          error={error}
        />
      )}{" "}
      {editing && view === "users" && (
        <UserModal
          user={editing === "new" ? null : (editing as User)}
          companies={companies}
          agencies={agencies}
          me={me}
          onClose={() => setEditing(null)}
          onSubmit={submitUser}
          error={error}
        />
      )}
    </div>
  );
}

const plannedModules: Partial<
  Record<View, { title: string; items: string[] }>
> = {
  planning: {
    title: "Planning & transport",
    items: [
      "Planning et affectations",
      "Trajets, étapes et livraisons",
      "Tournées récurrentes",
      "Suivi des missions",
      "Documents BL / POD / CMR",
    ],
  },
  telematics: {
    title: "OBC / Télématique",
    items: [
      "Carte GPS et positions",
      "Mouvements et arrêts",
      "Temps de conduite",
      "Excès de vitesse",
      "Déconnexions GPS",
      "Événements caméra",
      "Imports et rapports OBC",
    ],
  },
  finance: {
    title: "Commercial & Finance",
    items: [
      "Contrats et tarifs",
      "Devis",
      "Bons de commande",
      "Factures et avoirs",
      "Paiements et relances",
      "Caisse et banque",
      "Dépenses",
      "Rentabilité",
    ],
  },
  subcontracting: {
    title: "Sous-traitance",
    items: [
      "Sous-traitants",
      "Flotte sous-traitante",
      "Opérations sous-traitées",
      "Factures fournisseurs",
      "Règlements et soldes",
    ],
  },
  hr: {
    title: "Ressources humaines",
    items: [
      "Conducteurs et employés",
      "Pointage",
      "Contrats et documents",
      "Congés et absences",
      "Avances",
      "Primes et retenues",
      "Paie",
      "Paiements employés",
      "Alertes RH",
    ],
  },
  reporting: {
    title: "Analyse & Reporting",
    items: [
      "KPI exploitation",
      "KPI OBC et sécurité",
      "Rentabilité véhicules et clients",
      "Carburant et coût/km",
      "Rapports RH",
      "Rapports maintenance",
      "Rapports financiers",
      "Exports comptables PDF / XLSX / CSV",
    ],
  },
};

function DashboardPage({
  data,
  loading,
}: {
  data: Dashboard | null;
  loading: boolean;
}) {
  const money = (value?: string) =>
    `${Number(value || 0).toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD`;
  const cards = [
    {
      label: "Missions totales",
      value: data?.missions.total,
      detail: `${data?.missions.in_progress || 0} en cours`,
      icon: Route,
    },
    {
      label: "Véhicules disponibles",
      value: data?.vehicles.available,
      detail: `${data?.vehicles.total || 0} au parc`,
      icon: Truck,
    },
    {
      label: "Chiffre d’affaires",
      value: money(data?.finance.revenue),
      detail: `Marge ${money(data?.finance.margin)}`,
      icon: ShoppingBag,
    },
    {
      label: "Alertes documents",
      value:
        (data?.documents.expired || 0) + (data?.documents.expiring_soon || 0),
      detail: `${data?.documents.expired || 0} expirés`,
      icon: FileText,
    },
    {
      label: "Carburant",
      value: `${Number(data?.fuel.liters || 0).toLocaleString("fr-MA")} L`,
      detail: money(data?.fuel.cost),
      icon: Fuel,
    },
    {
      label: "Maintenance ouverte",
      value: data?.maintenance.open,
      detail: `Coût ${money(data?.maintenance.cost)}`,
      icon: Wrench,
    },
    {
      label: "Clients actifs",
      value: data?.customers,
      detail: `${data?.agencies || 0} agence(s)`,
      icon: Users,
    },
    {
      label: "Utilisateurs actifs",
      value: data?.active_users,
      detail: `${data?.companies || 0} société(s)`,
      icon: Building2,
    },
  ];
  return (
    <>
      <div className="eyebrow">Centre de contrôle · données réelles</div>
      {data?.demo_mode && (
        <div className="demoBanner">
          MODE DÉMONSTRATION — toutes les données affichées sont fictives
        </div>
      )}
      <h1>Tableau de bord direction</h1>
      <p className="muted">
        Indicateurs calculés à partir des données enregistrées.
      </p>
      <div className="cards dashboardCards">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <article key={label}>
            <div className="cardIcon">
              <Icon />
            </div>
            <div>
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
              <small>{detail}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboardGrid">
        <article className="panel">
          <div>
            <h2>Exploitation</h2>
            <p className="muted">État actuel des missions et de la flotte</p>
          </div>
          <div className="metricRows">
            <div>
              <span>Missions planifiées / affectées</span>
              <b>{data?.missions.planned || 0}</b>
            </div>
            <div>
              <span>Missions en cours</span>
              <b>{data?.missions.in_progress || 0}</b>
            </div>
            <div>
              <span>Missions terminées / validées</span>
              <b>{data?.missions.completed || 0}</b>
            </div>
            <div>
              <span>Véhicules en mission</span>
              <b>{data?.vehicles.on_mission || 0}</b>
            </div>
            <div>
              <span>Véhicules immobilisés / maintenance</span>
              <b>{data?.vehicles.maintenance || 0}</b>
            </div>
          </div>
        </article>
        <article className="panel">
          <h2>Finance opérationnelle</h2>
          <p className="muted">Montants saisis sur les missions</p>
          <div className="moneySummary">
            <div>
              <span>Revenus transport</span>
              <b>{money(data?.finance.revenue)}</b>
            </div>
            <div>
              <span>Dépenses missions</span>
              <b>{money(data?.finance.expenses)}</b>
            </div>
            <div className="margin">
              <span>Marge directe</span>
              <b>{money(data?.finance.margin)}</b>
            </div>
          </div>
          <small className="dataNote">
            Hors facturation comptable : calcul basé uniquement sur les missions
            enregistrées.
          </small>
        </article>
      </div>
      <div className="dashboardGrid lists">
        <article className="panel">
          <h2>Dernières missions</h2>
          <p className="muted">Les cinq missions les plus récentes</p>
          {loading ? (
            <div className="loading">Chargement…</div>
          ) : !data?.recent_missions.length ? (
            <div className="empty">Aucune mission enregistrée.</div>
          ) : (
            <div className="activityList">
              {data.recent_missions.map((m) => (
                <div key={m.id}>
                  <div>
                    <b>{m.reference}</b>
                    <span>
                      {m.origin} → {m.destination}
                    </span>
                  </div>
                  <div>
                    <b>{m.customer__name}</b>
                    <small>
                      {m.mission_date} ·{" "}
                      {m.vehicle__registration || "Non affecté"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="panel">
          <h2>Maintenance à traiter</h2>
          <p className="muted">Interventions ouvertes par date prévue</p>
          {loading ? (
            <div className="loading">Chargement…</div>
          ) : !data?.upcoming_maintenance.length ? (
            <div className="empty">Aucune intervention ouverte.</div>
          ) : (
            <div className="activityList">
              {data.upcoming_maintenance.map((m) => (
                <div key={m.id}>
                  <div>
                    <b>{m.title}</b>
                    <span>{m.vehicle__registration}</span>
                  </div>
                  <div>
                    <b>{m.scheduled_date}</b>
                    <small>{m.status}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </>
  );
}
function PageHead({
  view,
  count,
  query,
  setQuery,
  add,
}: {
  view: View;
  count: number;
  query: string;
  setQuery: (x: string) => void;
  add: () => void;
}) {
  const titles: Partial<Record<View, string>> = {
    companies: "Sociétés",
    agencies: "Agences",
    users: "Utilisateurs",
  };
  const title = titles[view] || "";
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>{title}</h1>
          <p className="muted">
            {count} élément{count !== 1 ? "s" : ""} affiché
            {count !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="primary" onClick={add}>
          <Plus /> Ajouter
        </button>
      </div>
      <div className="toolbar">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Rechercher dans ${title.toLowerCase()}…`}
        />
      </div>
    </>
  );
}
function DataTable({
  view,
  rows,
  companies,
  edit,
}: {
  view: View;
  rows: (Company | Agency | User)[];
  companies: Company[];
  edit: (x: Company | Agency | User) => void;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {view === "companies" && (
              <>
                <th>Société</th>
                <th>ICE</th>
                <th>Identifiant fiscal</th>
              </>
            )}
            {view === "agencies" && (
              <>
                <th>Agence</th>
                <th>Code</th>
                <th>Ville</th>
                <th>Société</th>
              </>
            )}
            {view === "users" && (
              <>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Société / agence</th>
              </>
            )}
            <th>Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {view === "companies" && (
                <>
                  <td>
                    <b>{(row as Company).name}</b>
                    <small>{(row as Company).legal_name || "—"}</small>
                  </td>
                  <td>{(row as Company).ice || "—"}</td>
                  <td>{(row as Company).tax_id || "—"}</td>
                </>
              )}
              {view === "agencies" && (
                <>
                  <td>
                    <b>{(row as Agency).name}</b>
                  </td>
                  <td>{(row as Agency).code}</td>
                  <td>{(row as Agency).city || "—"}</td>
                  <td>
                    {companies.find((c) => c.id === (row as Agency).company)
                      ?.name || "—"}
                  </td>
                </>
              )}
              {view === "users" && (
                <>
                  <td>
                    <b>
                      {(row as User).first_name} {(row as User).last_name}
                    </b>
                    <small>
                      @{(row as User).username} ·{" "}
                      {(row as User).email || "sans e-mail"}
                    </small>
                  </td>
                  <td>{(row as User).role_label}</td>
                  <td>
                    {(row as User).company_name || "Toutes"}
                    <small>{(row as User).agency_name || "—"}</small>
                  </td>
                </>
              )}
              <td>
                <Status
                  active={(row as Company).active ?? (row as User).is_active}
                />
              </td>
              <td>
                <button
                  className="edit"
                  onClick={() => edit(row)}
                  aria-label="Modifier"
                >
                  <Pencil />
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="emptyCell" colSpan={7}>
                Aucun résultat.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CompanyModal({
  company,
  onClose,
  onSubmit,
  error,
}: {
  company: Company | null;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <Modal
      title={company ? "Modifier la société" : "Nouvelle société"}
      onClose={onClose}
    >
      <form className="modalForm" onSubmit={onSubmit}>
        <div className="formGrid">
          <Field label="Nom *">
            <input name="name" defaultValue={company?.name} required />
          </Field>
          <Field label="Raison sociale">
            <input name="legal_name" defaultValue={company?.legal_name} />
          </Field>
          <Field label="ICE">
            <input name="ice" defaultValue={company?.ice} />
          </Field>
          <Field label="Identifiant fiscal">
            <input name="tax_id" defaultValue={company?.tax_id} />
          </Field>
          <Field label="Registre de commerce">
            <input
              name="trade_register"
              defaultValue={company?.trade_register}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={company?.active ?? true}
            />{" "}
            Société active
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <FormActions onClose={onClose} />
      </form>
    </Modal>
  );
}
function AgencyModal({
  agency,
  companies,
  me,
  onClose,
  onSubmit,
  error,
}: {
  agency: Agency | null;
  companies: Company[];
  me: User | null;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <Modal
      title={agency ? "Modifier l’agence" : "Nouvelle agence"}
      onClose={onClose}
    >
      <form className="modalForm" onSubmit={onSubmit}>
        <div className="formGrid">
          <Field label="Nom *">
            <input name="name" defaultValue={agency?.name} required />
          </Field>
          <Field label="Code *">
            <input name="code" defaultValue={agency?.code} required />
          </Field>
          <Field label="Ville">
            <input name="city" defaultValue={agency?.city} />
          </Field>
          <Field label="Société *">
            <select
              name="company"
              defaultValue={agency?.company || me?.company || companies[0]?.id}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              name="active"
              defaultChecked={agency?.active ?? true}
            />{" "}
            Agence active
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <FormActions onClose={onClose} />
      </form>
    </Modal>
  );
}
function UserModal({
  user,
  companies,
  agencies,
  me,
  onClose,
  onSubmit,
  error,
}: {
  user: User | null;
  companies: Company[];
  agencies: Agency[];
  me: User | null;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  const company = user?.company || me?.company || companies[0]?.id;
  return (
    <Modal
      title={user ? "Modifier l’utilisateur" : "Nouvel utilisateur"}
      onClose={onClose}
    >
      <form className="modalForm" onSubmit={onSubmit}>
        <div className="formGrid">
          <Field label="Identifiant *">
            <input name="username" defaultValue={user?.username} required />
          </Field>
          <Field label={user ? "Nouveau mot de passe" : "Mot de passe *"}>
            <input name="password" type="password" required={!user} />
          </Field>
          <Field label="Prénom">
            <input name="first_name" defaultValue={user?.first_name} />
          </Field>
          <Field label="Nom">
            <input name="last_name" defaultValue={user?.last_name} />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" defaultValue={user?.email} />
          </Field>
          <Field label="Téléphone">
            <input name="phone" defaultValue={user?.phone} />
          </Field>
          <Field label="Rôle *">
            <select name="role" defaultValue={user?.role || "DRIVER"}>
              {roles
                .filter((r) => me?.role === "SUPERADMIN" || r !== "SUPERADMIN")
                .map((r) => (
                  <option key={r} value={r}>
                    {roleNames[r]}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Société">
            <select name="company" defaultValue={company || ""}>
              <option value="">Aucune</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agence">
            <select name="agency" defaultValue={user?.agency || ""}>
              <option value="">Aucune</option>
              {agencies
                .filter((a) => !company || a.company === company)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={user?.is_active ?? true}
            />{" "}
            Compte actif
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <FormActions onClose={onClose} />
      </form>
    </Modal>
  );
}
function FormActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="formActions">
      <button type="button" className="secondary" onClick={onClose}>
        Annuler
      </button>
      <button className="primary">Enregistrer</button>
    </div>
  );
}
function SettingsPage({
  me,
  onSubmit,
  error,
}: {
  me: User;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <>
      <div className="eyebrow">Mon compte</div>
      <h1>Paramètres</h1>
      <p className="muted">
        Gérez vos informations personnelles et vos préférences.
      </p>
      <article className="panel settingsPanel">
        <div className="profileHead">
          <div className="avatar">
            {(me.first_name?.[0] || me.username[0]).toUpperCase()}
          </div>
          <div>
            <h2>
              {me.first_name} {me.last_name}
            </h2>
            <p className="muted">
              {me.role_label} · @{me.username}
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="formGrid">
            <Field label="Prénom">
              <input name="first_name" defaultValue={me.first_name} />
            </Field>
            <Field label="Nom">
              <input name="last_name" defaultValue={me.last_name} />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" defaultValue={me.email} />
            </Field>
            <Field label="Téléphone">
              <input name="phone" defaultValue={me.phone} />
            </Field>
            <Field label="Langue">
              <select
                name="preferred_language"
                defaultValue={me.preferred_language}
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </Field>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="formActions">
            <button className="primary">Enregistrer les modifications</button>
          </div>
        </form>
      </article>
    </>
  );
}
