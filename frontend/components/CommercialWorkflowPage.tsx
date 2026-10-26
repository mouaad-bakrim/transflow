"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  Eye,
  FilePlus2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Agency,
  Company,
  convertOrderToDelivery,
  convertQuoteToOrder,
  Customer,
  downloadSalesDocumentPdf,
  invoiceDeliveries,
  listCustomers,
  listSalesDocuments,
  SalesDocument,
  SalesLine,
  saveSalesDocument,
  User,
} from "@/lib/api";

const tabs = [
  { id: "quotes", label: "Devis" },
  { id: "sales-orders", label: "Bons de commande" },
  { id: "delivery-notes", label: "Bons de livraison" },
  { id: "invoices", label: "Factures" },
] as const;
type Tab = (typeof tabs)[number]["id"];
const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Validé",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  PARTIAL: "Partiel",
};
const blankLine = (): SalesLine => ({
  description: "",
  quantity: "1",
  unit_price: "0",
  tax_rate: "20",
});
const money = (value: string | number, currency = "MAD") =>
  `${Number(value).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export default function CommercialWorkflowPage({
  token,
  companies,
  agencies,
  me,
}: {
  token: string;
  companies: Company[];
  agencies: Agency[];
  me: User;
}) {
  const [tab, setTab] = useState<Tab>("quotes"),
    [rows, setRows] = useState<SalesDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false),
    [detail, setDetail] = useState<SalesDocument | null>(null);
  const [confirmInvoice, setConfirmInvoice] = useState(false),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [processing, setProcessing] = useState(false);
  const [lines, setLines] = useState<SalesLine[]>([blankLine()]);
  const defaultCompany = me.company || companies[0]?.id || "";
  const [formCompany, setFormCompany] = useState(defaultCompany);
  const [formAgency, setFormAgency] = useState(me.agency || "");
  useEffect(() => {
    if (!formCompany && defaultCompany) setFormCompany(defaultCompany);
  }, [defaultCompany, formCompany]);
  const formAgencies = agencies.filter((a) => a.company === formCompany);
  const formCustomers = customers.filter(
    (customer) =>
      customer.company === formCompany &&
      (!formAgency || !customer.agency || customer.agency === formAgency),
  );

  async function load(target: Tab = tab) {
    setLoading(true);
    setError("");
    try {
      const [docs, clients] = await Promise.all([
        listSalesDocuments(token, target),
        listCustomers(token),
      ]);
      setRows(docs.results);
      setCustomers(clients.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setSelected([]);
    setDetail(null);
    load(tab);
  }, [tab, token]);
  const filtered = rows.filter((d) =>
    `${d.reference} ${d.customer_name} ${d.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const eligible = filtered.filter(
    (d) => !d.invoiced && d.status !== "CANCELLED",
  );
  const selectedDocs = rows.filter((d) => selected.includes(d.id));
  const selectedTotals = selectedDocs.reduce(
    (a, d) => ({
      ht: a.ht + Number(d.total_excl_tax),
      tax: a.tax + Number(d.tax_total),
      ttc: a.ttc + Number(d.total_incl_tax),
    }),
    { ht: 0, tax: 0, ttc: 0 },
  );
  const lineTotals = useMemo(
    () =>
      lines.reduce(
        (a, l) => {
          const ht = Number(l.quantity || 0) * Number(l.unit_price || 0);
          return {
            ht: a.ht + ht,
            tax: a.tax + (ht * Number(l.tax_rate || 0)) / 100,
          };
        },
        { ht: 0, tax: 0 },
      ),
    [lines],
  );
  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  }
  function selectDelivery(doc: SalesDocument, checked: boolean) {
    setError("");
    if (!checked)
      return setSelected((value) => value.filter((id) => id !== doc.id));
    const incompatible = selectedDocs.some(
      (x) =>
        x.customer !== doc.customer ||
        x.company !== doc.company ||
        x.currency !== doc.currency,
    );
    if (incompatible)
      return setError(
        "Sélection incompatible : les BL doivent avoir le même client, la même société et la même devise.",
      );
    setSelected((value) => [...value, doc.id]);
  }
  async function createQuote(e: FormEvent<HTMLFormElement>, validate = false) {
    e.preventDefault();
    setProcessing(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const quote = await saveSalesDocument(token, "quotes", {
        company: String(f.get("company") || formCompany),
        agency: String(f.get("agency")) || null,
        customer: String(f.get("customer")),
        document_date: String(f.get("date")),
        valid_until: String(f.get("valid_until")) || null,
        currency: String(f.get("currency") || "MAD"),
        status: "DRAFT",
        notes: String(f.get("notes")),
        lines,
      });
      if (validate) {
        const order = await convertQuoteToOrder(token, quote.id, {
          document_date: quote.document_date,
        });
        setFormOpen(false);
        setTab("sales-orders");
        setDetail(order);
        flash("Devis validé et bon de commande créé.");
      } else {
        setFormOpen(false);
        setLines([blankLine()]);
        await load("quotes");
        flash("Devis enregistré en brouillon.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l’enregistrement");
    } finally {
      setProcessing(false);
    }
  }
  async function convert(doc: SalesDocument) {
    setProcessing(true);
    setError("");
    try {
      if (tab === "quotes") {
        const order = await convertQuoteToOrder(token, doc.id, {
          document_date: doc.document_date,
        });
        setTab("sales-orders");
        setDetail(order);
        flash("Commande créée avec succès.");
      } else if (tab === "sales-orders") {
        const delivery = await convertOrderToDelivery(token, doc.id, {
          document_date: doc.document_date,
        });
        setTab("delivery-notes");
        setDetail(delivery);
        flash("Bon de livraison créé avec succès.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion impossible");
    } finally {
      setProcessing(false);
    }
  }
  async function generateInvoice() {
    setProcessing(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const invoice = await invoiceDeliveries(token, {
        delivery_note_ids: selected,
        document_date: today,
      });
      setConfirmInvoice(false);
      setSelected([]);
      setTab("invoices");
      setDetail(invoice);
      flash("Facture générée avec succès.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Facturation impossible");
    } finally {
      setProcessing(false);
    }
  }
  async function downloadPdf(document: SalesDocument) {
    setProcessing(true);
    setError("");
    try {
      const blob = await downloadSalesDocumentPdf(token, tab, document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${document.reference}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      flash(`PDF ${document.reference} généré.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Génération PDF impossible");
    } finally {
      setProcessing(false);
    }
  }
  function openLinked(target: Tab, id?: string) {
    setTab(target);
    setTimeout(async () => {
      const docs = await listSalesDocuments(token, target);
      setDetail(docs.results.find((x) => x.id === id) || null);
    }, 0);
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <div className="eyebrow">Commercial & Finance</div>
          <h1>Chaîne commerciale</h1>
          <p className="muted">
            Du devis à la facture, sans ressaisie et avec traçabilité complète.
          </p>
        </div>
        {tab === "quotes" && (
          <button
            className="primary"
            onClick={() => {
              setLines([blankLine()]);
              setFormCompany(defaultCompany);
              setFormAgency(me.agency || "");
              setFormOpen(true);
            }}
          >
            <Plus />
            Créer un devis
          </button>
        )}
      </div>
      <div className="workflowSteps">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <b>{i + 1}</b>
            {t.label}
            {i < 3 && <ArrowRight />}
          </button>
        ))}
      </div>
      {error && <div className="error fleetError">{error}</div>}
      {notice && <div className="successNotice">{notice}</div>}
      <div className="commercialToolbar">
        <label className="searchBox">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Rechercher dans ${tabs.find((t) => t.id === tab)?.label.toLowerCase()}…`}
          />
        </label>
        <span>{filtered.length} document(s)</span>
      </div>
      {tab === "delivery-notes" && (
        <div className="selectionBar">
          <div>
            <b>{selected.length} BL sélectionné(s)</b>
            <span>
              HT {money(selectedTotals.ht)} · TVA {money(selectedTotals.tax)} ·
              TTC {money(selectedTotals.ttc)}
            </span>
          </div>
          <button
            className="primary"
            disabled={!selected.length || processing}
            onClick={() => setConfirmInvoice(true)}
          >
            <FilePlus2 />
            Générer la facture
          </button>
        </div>
      )}
      {loading ? (
        <div className="loading">Chargement…</div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                {tab === "delivery-notes" && (
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={
                        eligible.length > 0 &&
                        eligible.every((d) => selected.includes(d.id))
                      }
                      onChange={(e) => {
                        if (!e.target.checked) return setSelected([]);
                        const first = eligible[0];
                        setSelected(
                          eligible
                            .filter(
                              (d) =>
                                d.customer === first?.customer &&
                                d.company === first?.company &&
                                d.currency === first?.currency,
                            )
                            .map((d) => d.id),
                        );
                      }}
                    />
                  </th>
                )}
                <th>Référence</th>
                <th>Client</th>
                <th>Date</th>
                <th>Document d’origine</th>
                <th>HT</th>
                <th>TVA</th>
                <th>TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  {tab === "delivery-notes" && (
                    <td>
                      <input
                        type="checkbox"
                        disabled={d.invoiced || d.status === "CANCELLED"}
                        checked={selected.includes(d.id)}
                        onChange={(e) => selectDelivery(d, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>
                    <b>{d.reference}</b>
                    {d.invoiced && (
                      <small>Facturé · {d.invoice_reference}</small>
                    )}
                  </td>
                  <td>{d.customer_name}</td>
                  <td>{d.document_date}</td>
                  <td>
                    {d.quote_reference ||
                      d.order_reference ||
                      d.delivery_note_references?.join(", ") ||
                      "—"}
                  </td>
                  <td>{money(d.total_excl_tax, d.currency)}</td>
                  <td>{money(d.tax_total, d.currency)}</td>
                  <td>
                    <b>{money(d.total_incl_tax, d.currency)}</b>
                  </td>
                  <td>
                    <span
                      className={`status ${d.status === "CONFIRMED" ? "active" : "pending"}`}
                    >
                      {statusLabels[d.status] || d.status}
                    </span>
                  </td>
                  <td>
                    <div className="rowActions">
                      <button
                        className="icon"
                        title="Consulter"
                        onClick={() => setDetail(d)}
                      >
                        <Eye />
                      </button>
                      {((tab === "quotes" && !d.order_id) ||
                        (tab === "sales-orders" && !d.delivery_note_id)) && (
                        <button
                          disabled={processing}
                          className="secondary"
                          onClick={() => convert(d)}
                        >
                          Valider <ArrowRight />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={10} className="emptyCell">
                    Aucun document.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="overlay">
          <section className="modal commercialModal">
            <header>
              <div>
                <span className="eyebrow">Devis</span>
                <h2>Créer un devis</h2>
              </div>
              <button className="icon" onClick={() => setFormOpen(false)}>
                <X />
              </button>
            </header>
            <form className="modalForm" onSubmit={(e) => createQuote(e, false)}>
              <div className="formGrid">
                {me.role === "SUPERADMIN" && (
                  <label>
                    Société
                    <select
                      name="company"
                      required
                      value={formCompany}
                      onChange={(event) => {
                        setFormCompany(event.target.value);
                        setFormAgency("");
                      }}
                    >
                      {companies.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {me.role === "SUPERADMIN" && (
                  <label>
                    Agence
                    <select
                      name="agency"
                      value={formAgency}
                      onChange={(event) => setFormAgency(event.target.value)}
                    >
                      <option value="">Aucune</option>
                      {formAgencies.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Client *
                  <select name="customer" required>
                    <option value="">Sélectionner…</option>
                    {formCustomers.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Référence
                  <input value="Générée automatiquement" disabled />
                </label>
                <label>
                  Date *
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label>
                  Valable jusqu’au
                  <input name="valid_until" type="date" />
                </label>
                <label>
                  Devise
                  <select name="currency" defaultValue="MAD">
                    <option>MAD</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                </label>
              </div>
              <div className="lineEditor">
                <div className="lineEditorHead">
                  <h3>Prestations de transport</h3>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setLines((v) => [...v, blankLine()])}
                  >
                    <Plus />
                    Ajouter une ligne
                  </button>
                </div>
                {lines.map((line, i) => (
                  <div className="quoteLine" key={i}>
                    <label>
                      Prestation / trajet
                      <input
                        required
                        value={line.description}
                        onChange={(e) =>
                          setLines((v) =>
                            v.map((x, j) =>
                              j === i
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Quantité
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((v) =>
                            v.map((x, j) =>
                              j === i ? { ...x, quantity: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Prix unitaire HT
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) =>
                          setLines((v) =>
                            v.map((x, j) =>
                              j === i
                                ? { ...x, unit_price: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      TVA %
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.tax_rate}
                        onChange={(e) =>
                          setLines((v) =>
                            v.map((x, j) =>
                              j === i ? { ...x, tax_rate: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon danger"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((v) => v.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
              </div>
              <div className="quoteFooter">
                <label>
                  Observations
                  <textarea name="notes" rows={3} />
                </label>
                <div className="totalsBox">
                  <span>
                    Total HT <b>{money(lineTotals.ht)}</b>
                  </span>
                  <span>
                    TVA <b>{money(lineTotals.tax)}</b>
                  </span>
                  <strong>
                    Total TTC {money(lineTotals.ht + lineTotals.tax)}
                  </strong>
                </div>
              </div>
              <div className="formActions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFormOpen(false)}
                >
                  Annuler
                </button>
                <button disabled={processing} className="secondary">
                  {processing ? "Traitement…" : "Enregistrer le brouillon"}
                </button>
                <button
                  disabled={processing}
                  type="submit"
                  className="primary"
                  onClick={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget.form;
                    if (form?.reportValidity())
                      createQuote(
                        {
                          preventDefault: () => {},
                          currentTarget: form,
                        } as unknown as FormEvent<HTMLFormElement>,
                        true,
                      );
                  }}
                >
                  Valider le devis et créer la commande
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detail && (
        <div className="overlay">
          <section className="modal commercialModal documentSheet">
            <header className="documentHeader">
              <div className="documentIdentity">
                <span className="eyebrow">
                  {tabs.find((t) => t.id === tab)?.label}
                </span>
                <h2>{detail.reference}</h2>
              </div>
              <div className="rowActions">
                <button
                  className="secondary pdfButton"
                  disabled={processing}
                  onClick={() => downloadPdf(detail)}
                >
                  <Download />
                  {processing ? "Génération…" : "Télécharger PDF"}
                </button>
                <button className="icon" onClick={() => setDetail(null)}>
                  <X />
                </button>
              </div>
            </header>
            <div className="documentMeta">
              <span>
                Client<b>{detail.customer_name}</b>
              </span>
              <span>
                Date<b>{detail.document_date}</b>
              </span>
              <span>
                Statut<b>{statusLabels[detail.status] || detail.status}</b>
              </span>
              <span>
                Devise<b>{detail.currency}</b>
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Prestation</th>
                  <th>Qté</th>
                  <th>PU HT</th>
                  <th>TVA</th>
                  <th>Total HT</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={l.id || i}>
                    <td>{l.description}</td>
                    <td>{l.quantity}</td>
                    <td>{money(l.unit_price, detail.currency)}</td>
                    <td>{l.tax_rate}%</td>
                    <td>
                      {money(
                        l.total_excl_tax ||
                          Number(l.quantity) * Number(l.unit_price),
                        detail.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="documentBottom">
              <div className="traceLinks">
                <h3>Documents associés</h3>
                {detail.quote && (
                  <button
                    onClick={() =>
                      openLinked("quotes", detail.quote || undefined)
                    }
                  >
                    Devis {detail.quote_reference}
                  </button>
                )}
                {detail.order_id && (
                  <button
                    onClick={() => openLinked("sales-orders", detail.order_id)}
                  >
                    Commande {detail.order_reference}
                  </button>
                )}
                {detail.order && (
                  <button
                    onClick={() =>
                      openLinked("sales-orders", detail.order || undefined)
                    }
                  >
                    Commande {detail.order_reference}
                  </button>
                )}
                {detail.delivery_note_id && (
                  <button
                    onClick={() =>
                      openLinked("delivery-notes", detail.delivery_note_id)
                    }
                  >
                    BL {detail.delivery_note_reference}
                  </button>
                )}
                {detail.invoice_id && (
                  <button
                    onClick={() => openLinked("invoices", detail.invoice_id)}
                  >
                    Facture {detail.invoice_reference}
                  </button>
                )}
                {detail.delivery_note_references?.map((r) => (
                  <span key={r}>BL {r}</span>
                ))}
              </div>
              <div className="totalsBox">
                <span>
                  HT <b>{money(detail.total_excl_tax, detail.currency)}</b>
                </span>
                <span>
                  TVA <b>{money(detail.tax_total, detail.currency)}</b>
                </span>
                <strong>
                  TTC {money(detail.total_incl_tax, detail.currency)}
                </strong>
              </div>
            </div>
            <div className="formActions">
              {tab === "quotes" && !detail.order_id && (
                <button
                  className="primary"
                  disabled={processing}
                  onClick={() => convert(detail)}
                >
                  Valider le devis et créer la commande
                </button>
              )}
              {tab === "sales-orders" && !detail.delivery_note_id && (
                <button
                  className="primary"
                  disabled={processing}
                  onClick={() => convert(detail)}
                >
                  Valider la commande et créer le BL
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {confirmInvoice && (
        <div className="overlay">
          <section className="modal confirmModal">
            <header>
              <div>
                <span className="eyebrow">Facturation</span>
                <h2>Confirmer la facture regroupée</h2>
              </div>
              <button className="icon" onClick={() => setConfirmInvoice(false)}>
                <X />
              </button>
            </header>
            <p>
              {selected.length} bon(s) de livraison seront regroupés dans une
              seule facture.
            </p>
            <div className="invoiceRecap">
              {selectedDocs.map((d) => (
                <div key={d.id}>
                  <span>
                    {d.reference} · {d.customer_name}
                  </span>
                  <b>{money(d.total_incl_tax, d.currency)}</b>
                </div>
              ))}
            </div>
            <div className="totalsBox">
              <span>
                HT <b>{money(selectedTotals.ht)}</b>
              </span>
              <span>
                TVA <b>{money(selectedTotals.tax)}</b>
              </span>
              <strong>TTC {money(selectedTotals.ttc)}</strong>
            </div>
            <div className="formActions">
              <button
                className="secondary"
                onClick={() => setConfirmInvoice(false)}
              >
                Annuler
              </button>
              <button
                className="primary"
                disabled={processing}
                onClick={generateInvoice}
              >
                {processing ? "Génération…" : "Confirmer et générer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
