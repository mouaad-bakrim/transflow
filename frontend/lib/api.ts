const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export type Dashboard = {
  demo_mode: boolean;
  companies: number;
  agencies: number;
  active_users: number;
  customers: number;
  users_by_role: { role: string; count: number }[];
  vehicles: {
    total: number;
    available: number;
    on_mission: number;
    maintenance: number;
  };
  missions: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
  };
  finance: { revenue: string; expenses: string; margin: string };
  fuel: { liters: string; cost: string };
  maintenance: { open: number; cost: string };
  documents: { expired: number; expiring_soon: number };
  recent_missions: {
    id: string;
    reference: string;
    mission_date: string;
    origin: string;
    destination: string;
    status: string;
    customer__name: string;
    vehicle__registration: string | null;
  }[];
  upcoming_maintenance: {
    id: string;
    title: string;
    scheduled_date: string;
    status: string;
    vehicle__registration: string;
  }[];
};
export type Company = {
  id: string;
  name: string;
  legal_name: string;
  ice: string;
  tax_id: string;
  trade_register: string;
  active: boolean;
  created_at: string;
};
export type Agency = {
  id: string;
  company: string;
  name: string;
  code: string;
  city: string;
  active: boolean;
  created_at: string;
};
export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  role_label: string;
  company: string | null;
  company_name: string;
  agency: string | null;
  agency_name: string;
  preferred_language: string;
  is_active: boolean;
};
export type Vehicle = {
  id: string;
  company: string;
  company_name: string;
  agency: string | null;
  agency_name: string;
  registration: string;
  vin: string;
  vehicle_type: string;
  vehicle_type_label: string;
  brand: string;
  model: string;
  year: number | null;
  odometer_km: number;
  status: string;
  status_label: string;
  active: boolean;
  created_at: string;
};
export type VehicleDocumentType = {
  id: string;
  company: string;
  name: string;
  requires_expiry: boolean;
  is_mandatory: boolean;
  blocking_for_assignment: boolean;
  default_reminder_days: number;
  active: boolean;
};
export type VehicleDocument = {
  id: string;
  company: string;
  agency: string | null;
  vehicle: string;
  vehicle_registration: string;
  document_type: string;
  document_type_name: string;
  reference_number: string;
  issued_at: string | null;
  expires_at: string | null;
  verification_status: string;
  status: "EXPIRED" | "EXPIRING_SOON" | "VALID" | "NO_EXPIRY";
  is_archived: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type Customer = {
  id: string;
  company: string;
  agency: string | null;
  name: string;
  ice: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
};
export type Mission = {
  id: string;
  company: string;
  agency: string | null;
  reference: string;
  transport_type: string;
  delivery_note_number: string;
  nature: string;
  customer: string;
  customer_name: string;
  mission_date: string;
  origin: string;
  destination: string;
  driver: number | null;
  driver_name: string;
  vehicle: string | null;
  vehicle_registration: string;
  cargo: string;
  planned_distance_km: number;
  transport_price: string;
  expenses: string;
  margin: string;
  status: string;
  status_label: string;
};
export type FuelEntry = {
  id: string;
  company: string;
  agency: string | null;
  vehicle: string;
  vehicle_registration: string;
  mission: string | null;
  date: string;
  quantity_liters: string;
  total_cost: string;
  unit_price: string;
  odometer_km: number;
  station: string;
};
export type Maintenance = {
  id: string;
  company: string;
  agency: string | null;
  vehicle: string;
  vehicle_registration: string;
  title: string;
  kind: string;
  kind_label: string;
  status: string;
  status_label: string;
  scheduled_date: string;
  completed_date: string | null;
  odometer_km: number;
  cost: string;
  notes: string;
};
export type ModuleEntry = {
  id: string;
  company: string;
  agency: string | null;
  agency_name: string;
  section: string;
  section_label: string;
  entry_type: string;
  reference: string;
  title: string;
  event_date: string;
  status: string;
  status_label: string;
  amount: string;
  description: string;
  created_at: string;
};
export type SalesLine = {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  total_excl_tax?: string;
  tax_amount?: string;
};
export type SalesDocument = {
  id: string;
  company: string;
  company_name?: string;
  agency: string | null;
  agency_name?: string;
  customer: string;
  customer_name: string;
  reference: string;
  document_date: string;
  status: string;
  currency: string;
  notes: string;
  lines: SalesLine[];
  total_excl_tax: string;
  tax_total: string;
  total_incl_tax: string;
  quote?: string | null;
  quote_reference?: string;
  order_id?: string;
  order_reference?: string;
  delivery_note_id?: string;
  delivery_note_reference?: string;
  order?: string | null;
  invoiced?: boolean;
  delivery_note_references?: string[];
  delivery_note_ids?: string[];
  invoice_id?: string;
  invoice_reference?: string;
  valid_until?: string | null;
  due_date?: string | null;
};
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

async function message(response: Response) {
  try {
    const body = await response.json();
    return String(
      body.detail ||
        Object.values(body).flat().join(" ") ||
        `Erreur ${response.status}`,
    );
  } catch {
    return `Erreur ${response.status}`;
  }
}

let refreshInFlight: Promise<string> | null = null;
async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) throw new Error("Session expirée");
    const response = await fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) throw new Error("Session expirée");
    const data = (await response.json()) as {
      access: string;
      refresh?: string;
    };
    localStorage.setItem("access_token", data.access);
    if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
    window.dispatchEvent(
      new CustomEvent("auth:token", { detail: data.access }),
    );
    return data.access;
  })()
    .catch((error) => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.dispatchEvent(new Event("auth:expired"));
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error("Identifiants incorrects");
  return response.json() as Promise<{ access: string; refresh: string }>;
}

export async function api<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const request = (access: string) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}`,
        ...options.headers,
      },
      cache: "no-store",
    });
  let response = await request(token);
  if (response.status === 401 && typeof window !== "undefined") {
    response = await request(await refreshAccessToken());
  }
  if (!response.ok) throw new Error(await message(response));
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function apiBlob(path: string, token: string): Promise<Blob> {
  const request = (access: string) =>
    fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
  let response = await request(token);
  if (response.status === 401 && typeof window !== "undefined") {
    response = await request(await refreshAccessToken());
  }
  if (!response.ok) throw new Error(await message(response));
  return response.blob();
}

export const getDashboard = (token: string) =>
  api<Dashboard>("/dashboard/", token);
export const getMe = (token: string) => api<User>("/auth/me/", token);
export const updateMe = (token: string, values: Partial<User>) =>
  api<User>("/auth/me/", token, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
export const listCompanies = (token: string) =>
  api<Page<Company>>("/companies/?page_size=100", token);
export const listAgencies = (token: string) =>
  api<Page<Agency>>("/agencies/?page_size=100", token);
export const listUsers = (token: string) =>
  api<Page<User>>("/users/?page_size=100", token);
export const saveCompany = (
  token: string,
  values: Partial<Company>,
  id?: string,
) =>
  api<Company>(`/companies/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
export const saveAgency = (
  token: string,
  values: Partial<Agency>,
  id?: string,
) =>
  api<Agency>(`/agencies/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
export const saveUser = (
  token: string,
  values: Partial<User> & { password?: string },
  id?: number,
) =>
  api<User>(`/users/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
export const listVehicles = (token: string) =>
  api<Page<Vehicle>>("/vehicles/?page_size=100", token);
export const listVehicleDocuments = (token: string) =>
  api<Page<VehicleDocument>>("/vehicle-documents/?page_size=100", token);
export const listVehicleDocumentTypes = (token: string) =>
  api<Page<VehicleDocumentType>>(
    "/vehicle-document-types/?page_size=100",
    token,
  );
export const saveVehicle = (
  token: string,
  values: Partial<Vehicle>,
  id?: string,
) =>
  api<Vehicle>(`/vehicles/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
export const saveVehicleDocument = (
  token: string,
  values: Partial<VehicleDocument>,
  id?: string,
) =>
  api<VehicleDocument>(`/vehicle-documents/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
export const saveVehicleDocumentType = (
  token: string,
  values: Partial<VehicleDocumentType>,
  id?: string,
) =>
  api<VehicleDocumentType>(
    `/vehicle-document-types/${id ? `${id}/` : ""}`,
    token,
    { method: id ? "PATCH" : "POST", body: JSON.stringify(values) },
  );
export const listCustomers = (token: string) =>
  api<Page<Customer>>("/customers/?page_size=100", token);
export const listMissions = (token: string) =>
  api<Page<Mission>>("/missions/?page_size=100", token);
export const listFuelEntries = (token: string) =>
  api<Page<FuelEntry>>("/fuel-entries/?page_size=100", token);
export const listMaintenance = (token: string) =>
  api<Page<Maintenance>>("/maintenance/?page_size=100", token);
export const saveCustomer = (token: string, v: Partial<Customer>) =>
  api<Customer>("/customers/", token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const saveMission = (token: string, v: Partial<Mission>) =>
  api<Mission>("/missions/", token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const saveFuelEntry = (token: string, v: Partial<FuelEntry>) =>
  api<FuelEntry>("/fuel-entries/", token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const saveMaintenance = (token: string, v: Partial<Maintenance>) =>
  api<Maintenance>("/maintenance/", token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const listModuleEntries = (token: string, section: string) =>
  api<Page<ModuleEntry>>(
    `/module-entries/?page_size=100&section=${encodeURIComponent(section)}`,
    token,
  );
export const saveModuleEntry = (
  token: string,
  v: Partial<ModuleEntry>,
  id?: string,
) =>
  api<ModuleEntry>(`/module-entries/${id ? `${id}/` : ""}`, token, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(v),
  });
export const listSalesDocuments = (token: string, path: string) =>
  api<Page<SalesDocument>>(`/${path}/?page_size=100`, token);
export const downloadSalesDocumentPdf = (
  token: string,
  path: string,
  id: string,
) => apiBlob(`/${path}/${id}/pdf/`, token);
export const saveSalesDocument = (
  token: string,
  path: string,
  v: Partial<SalesDocument>,
) =>
  api<SalesDocument>(`/${path}/`, token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const convertQuoteToOrder = (
  token: string,
  id: string,
  v: { document_date: string },
) =>
  api<SalesDocument>(`/quotes/${id}/convert_to_order/`, token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const convertOrderToDelivery = (
  token: string,
  id: string,
  v: { document_date: string },
) =>
  api<SalesDocument>(`/sales-orders/${id}/convert_to_delivery/`, token, {
    method: "POST",
    body: JSON.stringify(v),
  });
export const invoiceDeliveries = (
  token: string,
  v: {
    delivery_note_ids: string[];
    document_date: string;
    due_date?: string;
  },
) =>
  api<SalesDocument>("/invoices/from-deliveries/", token, {
    method: "POST",
    body: JSON.stringify(v),
  });
