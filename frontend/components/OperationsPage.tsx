"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Agency,
  Company,
  Customer,
  FuelEntry,
  listCustomers,
  listFuelEntries,
  listMaintenance,
  listMissions,
  listVehicles,
  Maintenance,
  Mission,
  saveCustomer,
  saveFuelEntry,
  saveMaintenance,
  saveMission,
  User,
  Vehicle,
} from "@/lib/api";
type Mode = "customers" | "missions" | "fuel" | "maintenance";
const titles = {
  customers: "Clients",
  missions: "Missions",
  fuel: "Carburant",
  maintenance: "Maintenance",
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export default function OperationsPage({
  token,
  mode,
  companies,
  agencies,
  users,
  me,
}: {
  token: string;
  mode: Mode;
  companies: Company[];
  agencies: Agency[];
  users: User[];
  me: User;
}) {
  const [rows, setRows] = useState<
      (Customer | Mission | FuelEntry | Maintenance)[]
    >([]),
    [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const company = me.company || companies[0]?.id || "";
  async function load() {
    setLoading(true);
    try {
      const [v, c, data] = await Promise.all([
        listVehicles(token),
        listCustomers(token),
        mode === "customers"
          ? listCustomers(token)
          : mode === "missions"
            ? listMissions(token)
            : mode === "fuel"
              ? listFuelEntries(token)
              : listMaintenance(token),
      ]);
      setVehicles(v.results);
      setCustomers(c.results);
      setRows(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [mode, token]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      let item: Customer | Mission | FuelEntry | Maintenance;
      if (mode === "customers")
        item = await saveCustomer(token, {
          company: String(f.get("company") || company),
          agency: String(f.get("agency")) || null,
          name: String(f.get("name")),
          ice: String(f.get("ice")),
          phone: String(f.get("phone")),
          email: String(f.get("email")),
          address: String(f.get("address")),
          active: true,
        });
      else if (mode === "missions")
        item = await saveMission(token, {
          company: String(f.get("company") || company),
          agency: String(f.get("agency")) || null,
          reference: String(f.get("reference")),
          transport_type: String(f.get("transport_type")),
          delivery_note_number: String(f.get("delivery_note_number")),
          nature: String(f.get("nature")),
          customer: String(f.get("customer")),
          mission_date: String(f.get("date")),
          origin: String(f.get("origin")),
          destination: String(f.get("destination")),
          driver: f.get("driver") ? Number(f.get("driver")) : null,
          vehicle: String(f.get("vehicle")) || null,
          cargo: String(f.get("cargo")),
          planned_distance_km: Number(f.get("distance") || 0),
          transport_price: String(f.get("price")),
          expenses: String(f.get("expenses")),
          status: String(f.get("status")),
        });
      else if (mode === "fuel")
        item = await saveFuelEntry(token, {
          company: String(f.get("company") || company),
          agency: String(f.get("agency")) || null,
          vehicle: String(f.get("vehicle")),
          mission: String(f.get("mission")) || null,
          date: String(f.get("date")),
          quantity_liters: String(f.get("quantity")),
          total_cost: String(f.get("cost")),
          odometer_km: Number(f.get("odometer")),
          station: String(f.get("station")),
        });
      else
        item = await saveMaintenance(token, {
          company: String(f.get("company") || company),
          agency: String(f.get("agency")) || null,
          vehicle: String(f.get("vehicle")),
          title: String(f.get("title")),
          kind: String(f.get("kind")),
          status: String(f.get("status")),
          scheduled_date: String(f.get("date")),
          odometer_km: Number(f.get("odometer") || 0),
          cost: String(f.get("cost")),
          notes: String(f.get("notes")),
        });
      setRows((x) => [item, ...x]);
      if (mode === "customers") setCustomers((x) => [item as Customer, ...x]);
      setOpen(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }
  return (
    <>
      <div className="pageHead">
        <div>
          <div className="eyebrow">Gestion opérationnelle</div>
          <h1>{titles[mode]}</h1>
          <p className="muted">
            {rows.length} enregistrement{rows.length !== 1 ? "s" : ""} dans
            votre périmètre
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus />
          Ajouter
        </button>
      </div>
      {error && !open && <div className="error fleetError">{error}</div>}
      {loading ? (
        <div className="loading">Chargement…</div>
      ) : (
        <Table mode={mode} rows={rows} />
      )}{" "}
      {open && (
        <div className="overlay">
          <section className="modal">
            <header>
              <div>
                <span className="eyebrow">{titles[mode]}</span>
                <h2>Nouvel enregistrement</h2>
              </div>
              <button className="icon" onClick={() => setOpen(false)}>
                <X />
              </button>
            </header>
            <form className="modalForm" onSubmit={submit}>
              <div className="formGrid">
                {me.role === "SUPERADMIN" && (
                  <Field label="Société">
                    <select name="company" required>
                      {companies.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Agence">
                  <select name="agency">
                    <option value="">Aucune</option>
                    {agencies
                      .filter((a) => !company || a.company === company)
                      .map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {mode === "customers" && (
                  <>
                    <Field label="Nom *">
                      <input name="name" required />
                    </Field>
                    <Field label="ICE">
                      <input name="ice" />
                    </Field>
                    <Field label="Téléphone">
                      <input name="phone" />
                    </Field>
                    <Field label="E-mail">
                      <input name="email" type="email" />
                    </Field>
                    <Field label="Adresse">
                      <textarea name="address" />
                    </Field>
                  </>
                )}
                {mode === "missions" && (
                  <>
                    <Field label="Référence *">
                      <input name="reference" required />
                    </Field>
                    <Field label="Type de transport">
                      <select name="transport_type">
                        <option value="GOODS">Marchandises</option>
                        <option value="PERSONNEL">Personnel</option>
                        <option value="TOURISM">Touristique</option>
                        <option value="MIXED">Mixte</option>
                      </select>
                    </Field>
                    <Field label="N° BL">
                      <input name="delivery_note_number" />
                    </Field>
                    <Field label="Nature">
                      <input
                        name="nature"
                        placeholder="Ciment, matériel BTP…"
                      />
                    </Field>
                    <Field label="Client *">
                      <select name="customer" required>
                        {customers.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date *">
                      <input name="date" type="date" required />
                    </Field>
                    <Field label="Départ *">
                      <input name="origin" required />
                    </Field>
                    <Field label="Destination *">
                      <input name="destination" required />
                    </Field>
                    <Field label="Véhicule">
                      <select name="vehicle">
                        <option value="">Non affecté</option>
                        {vehicles.map((v) => (
                          <option value={v.id} key={v.id}>
                            {v.registration}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Conducteur">
                      <select name="driver">
                        <option value="">Non affecté</option>
                        {users
                          .filter((u) => u.role === "DRIVER")
                          .map((u) => (
                            <option value={u.id} key={u.id}>
                              {u.first_name || u.username} {u.last_name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Marchandise">
                      <input name="cargo" />
                    </Field>
                    <Field label="Distance (km)">
                      <input name="distance" type="number" min="0" />
                    </Field>
                    <Field label="Prix transport">
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                      />
                    </Field>
                    <Field label="Dépenses">
                      <input
                        name="expenses"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                      />
                    </Field>
                    <Field label="Statut">
                      <select name="status">
                        <option value="DRAFT">Brouillon</option>
                        <option value="PLANNED">Planifiée</option>
                        <option value="ASSIGNED">Affectée</option>
                        <option value="IN_PROGRESS">En cours</option>
                        <option value="COMPLETED">Terminée</option>
                        <option value="DELIVERED">Livrée</option>
                        <option value="VALIDATED">Validée</option>
                        <option value="INVOICED">Facturée</option>
                      </select>
                    </Field>
                  </>
                )}
                {mode === "fuel" && (
                  <>
                    <VehicleSelect vehicles={vehicles} />
                    <Field label="Mission">
                      <select name="mission">
                        <option value="">Aucune</option>
                        {(rows as FuelEntry[]) && []}
                        {/* missions facultatives via API */}
                      </select>
                    </Field>
                    <Field label="Date *">
                      <input name="date" type="date" required />
                    </Field>
                    <Field label="Quantité (L) *">
                      <input
                        name="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </Field>
                    <Field label="Coût total *">
                      <input
                        name="cost"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                      />
                    </Field>
                    <Field label="Kilométrage *">
                      <input name="odometer" type="number" min="0" required />
                    </Field>
                    <Field label="Station">
                      <input name="station" />
                    </Field>
                  </>
                )}
                {mode === "maintenance" && (
                  <>
                    <VehicleSelect vehicles={vehicles} />
                    <Field label="Intervention *">
                      <input name="title" required />
                    </Field>
                    <Field label="Type">
                      <select name="kind">
                        <option value="PREVENTIVE">Préventive</option>
                        <option value="CORRECTIVE">Corrective</option>
                      </select>
                    </Field>
                    <Field label="Statut">
                      <select name="status">
                        <option value="PLANNED">Planifiée</option>
                        <option value="IN_PROGRESS">En cours</option>
                        <option value="COMPLETED">Terminée</option>
                      </select>
                    </Field>
                    <Field label="Date prévue *">
                      <input name="date" type="date" required />
                    </Field>
                    <Field label="Kilométrage">
                      <input name="odometer" type="number" min="0" />
                    </Field>
                    <Field label="Coût">
                      <input
                        name="cost"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                      />
                    </Field>
                    <Field label="Notes">
                      <textarea name="notes" />
                    </Field>
                  </>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              <div className="formActions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setOpen(false)}
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
function VehicleSelect({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <Field label="Véhicule *">
      <select name="vehicle" required>
        {vehicles.map((v) => (
          <option value={v.id} key={v.id}>
            {v.registration}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Table({
  mode,
  rows,
}: {
  mode: Mode;
  rows: (Customer | Mission | FuelEntry | Maintenance)[];
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {mode === "customers" && (
              <>
                <th>Client</th>
                <th>ICE</th>
                <th>Contact</th>
              </>
            )}
            {mode === "missions" && (
              <>
                <th>Mission</th>
                <th>Trajet</th>
                <th>Affectation</th>
                <th>Montants</th>
              </>
            )}
            {mode === "fuel" && (
              <>
                <th>Date</th>
                <th>Véhicule</th>
                <th>Quantité</th>
                <th>Coût</th>
              </>
            )}
            {mode === "maintenance" && (
              <>
                <th>Intervention</th>
                <th>Véhicule</th>
                <th>Date</th>
                <th>Coût</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {mode === "customers" && (
                <>
                  <td>
                    <b>{(r as Customer).name}</b>
                    <small>{(r as Customer).email}</small>
                  </td>
                  <td>{(r as Customer).ice || "—"}</td>
                  <td>{(r as Customer).phone || "—"}</td>
                </>
              )}
              {mode === "missions" && (
                <>
                  <td>
                    <b>{(r as Mission).reference}</b>
                    <small>
                      {(r as Mission).customer_name} ·{" "}
                      {(r as Mission).status_label}
                    </small>
                  </td>
                  <td>
                    {(r as Mission).origin} → {(r as Mission).destination}
                    <small>{(r as Mission).mission_date}</small>
                  </td>
                  <td>
                    {(r as Mission).vehicle_registration || "Non affecté"}
                    <small>{(r as Mission).driver_name}</small>
                  </td>
                  <td>
                    {Number((r as Mission).transport_price).toLocaleString(
                      "fr-MA",
                    )}{" "}
                    MAD
                    <small>
                      Marge :{" "}
                      {Number((r as Mission).margin).toLocaleString("fr-MA")}{" "}
                      MAD
                    </small>
                  </td>
                </>
              )}
              {mode === "fuel" && (
                <>
                  <td>{(r as FuelEntry).date}</td>
                  <td>
                    <b>{(r as FuelEntry).vehicle_registration}</b>
                  </td>
                  <td>{(r as FuelEntry).quantity_liters} L</td>
                  <td>
                    {Number((r as FuelEntry).total_cost).toLocaleString(
                      "fr-MA",
                    )}{" "}
                    MAD<small>{(r as FuelEntry).unit_price} MAD/L</small>
                  </td>
                </>
              )}
              {mode === "maintenance" && (
                <>
                  <td>
                    <b>{(r as Maintenance).title}</b>
                    <small>
                      {(r as Maintenance).kind_label} ·{" "}
                      {(r as Maintenance).status_label}
                    </small>
                  </td>
                  <td>{(r as Maintenance).vehicle_registration}</td>
                  <td>{(r as Maintenance).scheduled_date}</td>
                  <td>
                    {Number((r as Maintenance).cost).toLocaleString("fr-MA")}{" "}
                    MAD
                  </td>
                </>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="emptyCell" colSpan={5}>
                Aucune donnée enregistrée.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
