// Client HTTP vers le backend TWIN_3. L'URL de base vient de VITE_API_URL.

export const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "twin3.token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Les données envoyées sont invalides.",
  401: "Votre session a expiré. Veuillez vous reconnecter.",
  403: "Vous n'avez pas les droits pour effectuer cette action.",
  404: "Élément introuvable.",
  409: "Opération impossible : cet élément est référencé ailleurs ou existe déjà.",
  422: "Les données envoyées sont invalides.",
  500: "Erreur interne du serveur.",
};

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
}

function buildUrl(path: string, query?: Query) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Impossible de joindre le serveur (${API_URL}).`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const payload = (data && typeof data === "object" ? data : {}) as {
      message?: string;
      error?: string;
    };
    const message =
      payload.message ||
      payload.error ||
      (typeof data === "string" && data.length < 300 ? data : "") ||
      DEFAULT_MESSAGES[res.status] ||
      `Erreur ${res.status}`;

    if (res.status === 401 && !path.startsWith("/auth/login")) {
      tokenStore.clear();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/connexion")) {
        window.location.assign("/connexion?expire=1");
      }
    }
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur inattendue est survenue.";
}
