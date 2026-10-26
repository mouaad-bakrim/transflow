"use client";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import {
  Agency,
  Company,
  listModuleEntries,
  ModuleEntry,
  saveModuleEntry,
  User,
} from "@/lib/api";
type View =
  | "planning"
  | "telematics"
  | "finance"
  | "subcontracting"
  | "hr"
  | "reporting";
const config: Record<
  View,
  { section: string; title: string; subtitle: string; types: string[] }
> = {
  planning: {
    section: "PLANNING",
    title: "Planning & transport",
    subtitle: "Affectations, étapes, livraisons et documents de transport",
    types: [
      "Affectation",
      "Étape / livraison",
      "Tournée récurrente",
      "Document BL / POD / CMR",
    ],
  },
  telematics: {
    section: "TELEMATICS",
    title: "OBC / Télématique",
    subtitle: "Imports et rapports provenant de sources réelles",
    types: [
      "Import CSV / Excel",
      "Rapport mouvements",
      "Rapport sécurité",
      "Incident GPS",
      "Rapport conducteur",
    ],
  },
  finance: {
    section: "FINANCE",
    title: "Commercial & Finance",
    subtitle: "Devis, commandes, factures, dépenses et règlements",
    types: [
      "Devis",
      "Bon de commande",
      "Facture",
      "Avoir",
      "Paiement",
      "Relance",
      "Dépense",
      "Mouvement caisse / banque",
    ],
  },
  subcontracting: {
    section: "SUBCONTRACTING",
    title: "Sous-traitance",
    subtitle: "Sous-traitants, opérations, factures et règlements",
    types: [
      "Sous-traitant",
      "Véhicule sous-traitant",
      "Opération sous-traitée",
      "Facture fournisseur",
      "Règlement",
    ],
  },
  hr: {
    section: "HR",
    title: "Ressources humaines",
    subtitle: "Événements RH, pointage et éléments variables",
    types: [
      "Employé / conducteur",
      "Pointage",
      "Contrat",
      "Congé / absence",
      "Avance",
      "Prime / retenue",
      "Paie",
      "Paiement employé",
      "Alerte RH",
    ],
  },
  reporting: {
    section: "REPORTING",
    title: "Analyse & Reporting",
    subtitle: "Rapports fondés sur les données disponibles",
    types: [
      "Rapport exploitation",
      "Rapport carburant",
      "Rapport maintenance",
      "Rapport financier",
      "Rapport RH",
      "Export comptable",
      "Export PDF / XLSX / CSV",
    ],
  },
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export default function ModuleRegistryPage({
  token,
  view,
  companies,
  agencies,
  me,
}: {
  token: string;
  view: View;
  companies: Company[];
  agencies: Agency[];
  me: User;
}) {
  const cfg = config[view],
    company = me.company || companies[0]?.id || "";
  const [rows, setRows] = useState<ModuleEntry[]>([]),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<ModuleEntry | null | "new">(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    listModuleEntries(token, cfg.section)
      .then((x) => setRows(x.results))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, cfg.section]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter((r) =>
      `${r.reference} ${r.title} ${r.entry_type}`.toLowerCase().includes(q),
    );
  }, [rows, query]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      current = editing !== "new" ? editing : null;
    try {
      const saved = await saveModuleEntry(
        token,
        {
          company: String(f.get("company") || company),
          agency: String(f.get("agency")) || null,
          section: cfg.section,
          entry_type: String(f.get("entry_type")),
          reference: String(f.get("reference")),
          title: String(f.get("title")),
          event_date: String(f.get("event_date")),
          status: String(f.get("status")),
          amount: String(f.get("amount") || 0),
          description: String(f.get("description")),
        },
        current?.id,
      );
      setRows((x) =>
        current ? x.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...x],
      );
      setEditing(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="eyebrow">Module opérationnel</div>
          <h1>{cfg.title}</h1>
          <p className="muted">{cfg.subtitle}</p>
        </div>
        <button className="primary" onClick={() => setEditing("new")}>
          <Plus />
          Créer
        </button>
      </div>
      {view === "telematics" && (
        <div className="infoBanner">
          Aucune position GPS n’est générée : seuls les imports et rapports
          réellement fournis sont enregistrés.
        </div>
      )}
      <div className="toolbar">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par référence, type ou libellé…"
        />
      </div>
      {error && !editing && <div className="error fleetError">{error}</div>}
      {loading ? (
        <div className="loading">Chargement…</div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Type</th>
                <th>Libellé</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.reference}</b>
                    <small>{r.agency_name || "Toutes agences"}</small>
                  </td>
                  <td>{r.entry_type}</td>
                  <td>
                    <b>{r.title}</b>
                    <small>{r.description || "—"}</small>
                  </td>
                  <td>{r.event_date}</td>
                  <td>{Number(r.amount).toLocaleString("fr-MA")} MAD</td>
                  <td>
                    <span
                      className={`status ${r.status === "COMPLETED" ? "on" : r.status === "CANCELLED" ? "off" : "pending"}`}
                    >
                      {r.status_label}
                    </span>
                  </td>
                  <td>
                    <button className="edit" onClick={() => setEditing(r)}>
                      <Pencil />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="emptyCell">
                    Aucun enregistrement. Utilisez « Créer » pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="overlay">
          <section className="modal">
            <header>
              <div>
                <span className="eyebrow">{cfg.title}</span>
                <h2>
                  {editing === "new"
                    ? "Nouvel enregistrement"
                    : "Modifier l’enregistrement"}
                </h2>
              </div>
              <button className="icon" onClick={() => setEditing(null)}>
                <X />
              </button>
            </header>
            <form className="modalForm" onSubmit={submit}>
              <div className="formGrid">
                {me.role === "SUPERADMIN" && (
                  <Field label="Société *">
                    <select
                      name="company"
                      defaultValue={
                        editing === "new" ? company : editing.company
                      }
                      required
                    >
                      {companies.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Agence">
                  <select
                    name="agency"
                    defaultValue={editing === "new" ? "" : editing.agency || ""}
                  >
                    <option value="">Toutes / aucune</option>
                    {agencies.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type *">
                  <select
                    name="entry_type"
                    defaultValue={
                      editing === "new" ? cfg.types[0] : editing.entry_type
                    }
                  >
                    {cfg.types.map((t) => (
                      <option value={t} key={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Référence *">
                  <input
                    name="reference"
                    defaultValue={editing === "new" ? "" : editing.reference}
                    required
                  />
                </Field>
                <Field label="Libellé *">
                  <input
                    name="title"
                    defaultValue={editing === "new" ? "" : editing.title}
                    required
                  />
                </Field>
                <Field label="Date *">
                  <input
                    type="date"
                    name="event_date"
                    defaultValue={
                      editing === "new"
                        ? new Date().toISOString().slice(0, 10)
                        : editing.event_date
                    }
                    required
                  />
                </Field>
                <Field label="Statut">
                  <select
                    name="status"
                    defaultValue={editing === "new" ? "DRAFT" : editing.status}
                  >
                    <option value="DRAFT">Brouillon</option>
                    <option value="PLANNED">Planifié</option>
                    <option value="IN_PROGRESS">En cours</option>
                    <option value="COMPLETED">Terminé</option>
                    <option value="CANCELLED">Annulé</option>
                  </select>
                </Field>
                <Field label="Montant MAD">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="amount"
                    defaultValue={editing === "new" ? "0" : editing.amount}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    name="description"
                    defaultValue={editing === "new" ? "" : editing.description}
                  />
                </Field>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="formActions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  Annuler
                </button>
                <button className="primary">Enregistrer</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
