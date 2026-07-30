export type DeploymentEnvironment = "production" | "preview" | "rc";

export interface DeploymentOrigins {
  production: URL;
  preview: URL;
  rc: URL;
}

export interface OriginEnvironment {
  MODE?: string;
  NODE_ENV?: string;
  PUBLIC_PRODUCTION_ORIGIN?: string;
  PUBLIC_PREVIEW_ORIGIN?: string;
  PUBLIC_RC_ORIGIN?: string;
}

const ORIGIN_KEYS: Record<DeploymentEnvironment, keyof OriginEnvironment> = {
  production: "PUBLIC_PRODUCTION_ORIGIN",
  preview: "PUBLIC_PREVIEW_ORIGIN",
  rc: "PUBLIC_RC_ORIGIN",
};

/** True only for Astro's local development mode, never for previews or production. */
export function isLocalDevelopment(environment: OriginEnvironment): boolean {
  return environment.MODE === "development" && environment.NODE_ENV !== "production";
}

/**
 * Parses an origin-only HTTPS URL. Paths, query strings, and fragments are not
 * deployment origins and are rejected rather than silently normalized away.
 */
export function parseHttpsOrigin(value: string, label = "origin"): URL {
  let url: URL;

  if (!/^https:\/\//i.test(value)) {
    throw new Error(`${label} must be an absolute HTTPS URL.`);
  }
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`${label} must be an origin-only absolute HTTPS URL.`);
  }

  return url;
}

export function originIdentity(url: URL): string {
  return `${url.protocol}//${url.hostname}${url.port === "" ? "" : `:${url.port}`}`;
}

export function createDeploymentOrigins(values: Record<DeploymentEnvironment, string>): DeploymentOrigins {
  const origins = {
    production: parseHttpsOrigin(values.production, "production origin"),
    preview: parseHttpsOrigin(values.preview, "preview origin"),
    rc: parseHttpsOrigin(values.rc, "RC origin"),
  };
  const identities = Object.values(origins).map(originIdentity);

  if (new Set(identities).size !== identities.length) {
    throw new Error("Production, preview, and RC origins must be pairwise distinct.");
  }

  return origins;
}

/**
 * Returns null only when all deployment origins are intentionally omitted in
 * local development. Every other environment requires three distinct origins.
 */
export function parseDeploymentOrigins(environment: OriginEnvironment): DeploymentOrigins | null {
  const values = {
    production: environment[ORIGIN_KEYS.production],
    preview: environment[ORIGIN_KEYS.preview],
    rc: environment[ORIGIN_KEYS.rc],
  };
  const missing = Object.entries(values)
    .filter(([, value]) => value === undefined || value.trim() === "")
    .map(([environmentName]) => environmentName);

  if (missing.length > 0) {
    if (isLocalDevelopment(environment) && missing.length === 3) {
      return null;
    }
    throw new Error(`Missing required deployment origin configuration: ${missing.join(", ")}.`);
  }

  return createDeploymentOrigins(values as Record<DeploymentEnvironment, string>);
}
