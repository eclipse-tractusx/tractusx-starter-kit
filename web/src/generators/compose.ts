import { stringify } from "yaml";
import { toolboxPin } from "../catalog/releases";
import { registryOf, type Config, type Participant } from "../model/dataspace";
import issueCredentials from "../../../developer-toolbox/scripts/issue_credentials.py?raw";
import exchange from "./assets/exchange.py?raw";
import { registryById } from "../catalog/registries";
import type { Bundle } from "./types";

/**
 * The developer toolbox's dataspace as one Docker Compose file. Every value
 * below is the one the toolbox's Helm render (Umbrella 26.03.00, the
 * decentralized-IdentityHub profile) gives the same pod; only the hostnames of
 * Kubernetes services became compose service names. The ingress hosts the
 * participants' DIDs and callbacks name (provider.local, provider-dsp.local, ...)
 * are aliases of one nginx gateway that routes them as the ingresses do.
 */

export const IMAGES = {
  connector: "tractusx/edc-runtime-memory:0.12.0",
  identityhub: "tractusx/identityhub-memory:0.4.0-SNAPSHOT",
  issuerservice: "tractusx/issuerservice-memory:0.4.0-SNAPSHOT",
  bdrs: "tractusx/bdrs-server-memory:0.6.0",
  dtr: "tractusx/sldt-digital-twin-registry:0.11.0",
  basyxDtr: "eclipsebasyx/digitaltwinregistry-go:1.1.5",
  basyxConfiguration: "eclipsebasyx/basyxconfigurationservice-go:1.1.5",
  postgres: "postgres:15-alpine",
  /** Eclipse BaSyx Go needs PostgreSQL 16 or later. */
  basyxPostgres: "postgres:17-alpine",
  gateway: "nginx:1.27-alpine",
  echo: "traefik/whoami:v1.10",
  curl: "curlimages/curl:8.11.1",
  python: "python:3.12-alpine",
};

/** Where a participant's registry listens: both serve the AAS API under /api/v3. */
function dtrUpstream(config: Config, participant: Participant): string {
  return registryOf(config, participant) === "basyx" ? `${participant.name}-dtr:5004` : `${participant.name}-dtr:4243`;
}

const ISSUER_BPN = "BPNL000000000003";
const ISSUER_HOST = "issuerservice.local";
const ISSUER_DID = `did:web:${ISSUER_HOST}:${ISSUER_BPN}`;
const BDRS_HOST = "bdrs-server.tx.test";
const BDRS_API_KEY = "TEST";
const API_KEY = "password";
const IDENTITY_API_KEY = "sup3r$3cr3t";
const DSP_VERSION = "2025-1";
const GATEWAY_PORT = "${GATEWAY_PORT:-8080}";

const CREDENTIALS = [
  { id: "membershipCredential-id", type: "MembershipCredential", mappings: [["member_of", "credentialSubject.memberOf"]] },
  { id: "bpnCredential-id", type: "BpnCredential", mappings: [["bpn", "credentialSubject.bpn"]] },
  { id: "usagePurposeCredential-id", type: "UsagePurposeCredential", mappings: [] },
  {
    id: "dataExchangeGovernanceCredential-id",
    type: "DataExchangeGovernanceCredential",
    mappings: [
      ["group_name", "credentialSubject.group"],
      ["use_case", "credentialSubject.useCase"],
      ["contract_template", "credentialSubject.contractTemplate"],
      ["contract_version", "credentialSubject.contractVersion"],
    ],
  },
] as const;

const CLAIMS = {
  member_of: "Catena-X",
  group_name: "UseCaseFramework",
  use_case: "DataExchangeGovernance",
  contract_template: "https://example.org/temp-1",
  contract_version: "1.0",
};

/** What every name of a participant becomes. */
export function hostsOf(name: string) {
  return {
    public: `${name}.local`,
    intranet: `${name}.intranet`,
    dsp: `${name}-dsp.local`,
    management: `${name}-management.local`,
    dtr: `${name}-dtr.local`,
  };
}

export function didOf(participant: Pick<Participant, "name" | "bpn">): string {
  return `did:web:${hostsOf(participant.name).public}:identityhub:${participant.bpn}`;
}

function base64(text: string): string {
  // The DIDs are ASCII; btoa is in browsers and in Node 16+.
  return btoa(text);
}

interface Route {
  path: string;
  upstream: string;
  /** Replace the matched prefix with this path (the ingress rewrite-target). */
  rewrite?: string;
}

/** The ingresses of the Helm render, as host -> routes. */
export function gatewayRoutes(config: Config): Map<string, Route[]> {
  const routes = new Map<string, Route[]>();
  routes.set(BDRS_HOST, [
    { path: "/api/directory", upstream: "bdrs:8082" },
    { path: "/api/management", upstream: "bdrs:8081" },
  ]);
  routes.set(ISSUER_HOST, [
    { path: "/", upstream: "issuerservice:8083" },
    { path: "/api/identity", upstream: "issuerservice:8087" },
    { path: "/api/issuance", upstream: "issuerservice:8082" },
    { path: "/api/admin", upstream: "issuerservice:8086" },
    { path: "/statuslist", upstream: "issuerservice:8088" },
    { path: "/api/sts", upstream: "issuerservice:8085" },
  ]);
  for (const participant of config.participants) {
    const hosts = hostsOf(participant.name);
    const ih = `${participant.name}-identityhub`;
    const cp = `${participant.name}-controlplane`;
    const dp = `${participant.name}-dataplane`;
    const publicRoutes: Route[] = [
      { path: "/identityhub/", upstream: `${ih}:8084` },
      { path: "/identityhub/api/credentials", upstream: `${ih}:8083` },
      { path: "/identityhub/api/sts", upstream: `${ih}:8087` },
    ];
    const intranet: Route[] = [{ path: "/identityhub/api/identity", upstream: `${ih}:8082` }];
    if (participant.connector) {
      publicRoutes.push({ path: "/api/public", upstream: `${cp}:8086` });
      publicRoutes.push({ path: "/dataplane/api/public", upstream: `${dp}:8081` });
      intranet.push({ path: "/dataplane/proxy", upstream: `${dp}:8186` });
      routes.set(hosts.dsp, [{ path: "/api/v1/dsp", upstream: `${cp}:8084` }]);
      routes.set(hosts.management, [
        { path: "/catalog", upstream: `${cp}:8085` },
        { path: "/control", upstream: `${cp}:8083` },
        { path: "/management", upstream: `${cp}:8081` },
      ]);
    }
    routes.set(hosts.public, publicRoutes);
    routes.set(hosts.intranet, intranet);
    if (participant.connector && participant.dtr) {
      routes.set(hosts.dtr, [{ path: "/semantics/registry/", upstream: dtrUpstream(config, participant), rewrite: "/" }]);
    }
  }
  return routes;
}

/**
 * The Eclipse BaSyx Go registry, as the Umbrella's digital-twin-basyx-bundle runs it:
 * its own PostgreSQL, the BaSyx Configuration Service creating the schema once,
 * and ABAC off. Its context path is /api/v3, the Eclipse Tractus-X registry's, so
 * clients and EDC assets need no change. The image is distroless and brings its
 * own health check.
 */
const limit = (memory: string) => ({ mem_limit: memory });

function basyxRegistry(name: string): Record<string, unknown> {
  const database = {
    POSTGRES_HOST: `${name}-dtr-db`,
    POSTGRES_PORT: "5432",
    POSTGRES_USER: "user",
    POSTGRES_PASSWORD: API_KEY,
    POSTGRES_DBNAME: "dtr",
  };
  return {
    [`${name}-dtr-db`]: {
      image: IMAGES.basyxPostgres,
      environment: { POSTGRES_DB: "dtr", POSTGRES_USER: "user", POSTGRES_PASSWORD: API_KEY },
      networks: ["dataspace"],
      healthcheck: { test: ["CMD-SHELL", "pg_isready -U user -d dtr"], interval: "5s", timeout: "5s", retries: 30 },
      ...limit("256m"),
    },
    [`${name}-dtr-schema`]: {
      image: IMAGES.basyxConfiguration,
      environment: database,
      networks: ["dataspace"],
      depends_on: { [`${name}-dtr-db`]: { condition: "service_healthy" } },
      restart: "on-failure",
      ...limit("128m"),
    },
    [`${name}-dtr`]: {
      image: IMAGES.basyxDtr,
      environment: {
        ...database,
        SERVER_PORT: "5004",
        SERVER_CONTEXTPATH: "/api/v3",
        SERVER_STRICTVERIFICATION: "off",
        ABAC_ENABLED: "false",
        GENERAL_SUPPORTSSINGULARSUPPLEMENTALSEMANTICID: "true",
      },
      networks: ["dataspace"],
      depends_on: { [`${name}-dtr-schema`]: { condition: "service_completed_successfully" } },
      ...limit("128m"),
    },
  };
}

/** Routes on localhost, for your own tools: /<participant>/management/... and so on. */
export function localRoutes(config: Config): { path: string; upstream: string; target: string; label: string }[] {
  const routes: { path: string; upstream: string; target: string; label: string }[] = [];
  for (const participant of config.participants) {
    const name = participant.name;
    if (participant.connector) {
      routes.push({ path: `/${name}/management/`, upstream: `${name}-controlplane:8081`, target: "/management/", label: `${name} management API` });
      routes.push({ path: `/${name}/public/`, upstream: `${name}-dataplane:8081`, target: "/dataplane/api/public/", label: `${name} data plane (public API)` });
    }
    routes.push({ path: `/${name}/identity/`, upstream: `${name}-identityhub:8082`, target: "/identityhub/api/identity/", label: `${name} IdentityHub identity API` });
    if (participant.connector && participant.dtr) {
      routes.push({ path: `/${name}/dtr/`, upstream: dtrUpstream(config, participant), target: "/", label: `${name} Digital Twin Registry` });
    }
  }
  routes.push({ path: "/issuer/", upstream: "issuerservice:8086", target: "/api/admin/", label: "IssuerService admin API" });
  routes.push({ path: "/bdrs/", upstream: "bdrs:8082", target: "/api/directory/", label: "BPN-DID directory" });
  if (config.standIns.echo) routes.push({ path: "/echo/", upstream: "echo:80", target: "/", label: "Echo backend" });
  return routes;
}

function nginxConf(config: Config): string {
  const servers: string[] = [];
  for (const [host, routes] of gatewayRoutes(config)) {
    const locations = [...routes]
      .sort((a, b) => b.path.length - a.path.length)
      .map((route) => proxyLocation(route.path, route.upstream, route.rewrite ?? null));
    servers.push(`  server {
    listen 80;
    server_name ${host};
${locations.join("\n")}
  }`);
  }
  const local = localRoutes(config).map((route) => proxyLocation(route.path, route.upstream, route.target));
  servers.push(`  # localhost:${"$"}{GATEWAY_PORT}: the APIs under one prefix per participant.
  server {
    listen 80 default_server;
    server_name localhost;
    location = / {
      default_type text/plain;
      return 200 "Eclipse Tractus-X dataspace gateway. ./info.sh lists the URLs.\\n";
    }
${local.join("\n")}
  }`);
  return `# Generated by the Eclipse Tractus-X Starter Kit configurator.
# SPDX-License-Identifier: Apache-2.0
#
# The dataspace's ingress: every host a DID, a callback or a token URL names is
# an alias of this gateway on the compose network, routed as the Helm
# ingresses route it.
worker_processes 1;
events { worker_connections 1024; }
http {
  resolver 127.0.0.11 valid=10s ipv6=off;
  client_max_body_size 32m;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_read_timeout 300s;
  access_log off;
${servers.join("\n\n")}
}
`;
}

/** A location that proxies `path` to `upstream`, replacing the prefix with `target` when given. */
function proxyLocation(path: string, upstream: string, target: string | null): string {
  const variable = `upstream_${upstream.replace(/[^a-zA-Z0-9]/g, "_")}`;
  if (target === null) {
    // The path is passed on as it is, as an ingress passes it.
    return `    location ^~ ${path} {
      set $${variable} ${upstream};
      proxy_pass http://$${variable};
    }`;
  }
  // With a variable in proxy_pass nginx does not replace the prefix itself.
  const prefix = path.replace(/\/$/, "");
  return `    location ^~ ${path} {
      set $${variable} ${upstream};
      rewrite ^${prefix}/(.*)$ ${target}$1 break;
      proxy_pass http://$${variable};
    }`;
}

type Service = Record<string, unknown>;

const JAVA = "-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1";

function health(url: string, start = "60s"): Service {
  return {
    test: ["CMD-SHELL", `wget -q -O /dev/null ${url} || exit 1`],
    interval: "5s",
    timeout: "5s",
    retries: 60,
    start_period: start,
  };
}

function connectorEnv(participant: Participant, index: number, plane: "controlplane" | "dataplane") {
  const hosts = hostsOf(participant.name);
  const did = didOf(participant);
  const alias = `${participant.name}-secret`;
  const common: Record<string, string> = {
    EDC_PARTICIPANT_CONTEXT_ID: `00000000-0000-0000-0000-${String(4 + index).padStart(12, "0")}`,
    EDC_IAM_ISSUER_ID: did,
    TRACTUSX_EDC_PARTICIPANT_BPN: participant.bpn,
    EDC_IAM_STS_OAUTH_TOKEN_URL: `http://${hosts.public}/identityhub/api/sts/token`,
    EDC_IAM_STS_OAUTH_CLIENT_ID: did,
    EDC_IAM_STS_OAUTH_CLIENT_SECRET_ALIAS: alias,
    "EDC_IAM_TRUSTED-ISSUER_0-ISSUER_ID": ISSUER_DID,
    EDC_IAM_DID_WEB_USE_HTTPS: "false",
    EDC_IAM_CREDENTIAL_REVOCATION_MIMETYPE: "application/json",
    TX_EDC_IAM_IATP_BDRS_SERVER_URL: `http://${BDRS_HOST}/api/directory`,
    TX_EDC_IAM_IATP_BDRS_CACHE_VALIDITY: "600",
    TX_EDC_IAM_IATP_CREDENTIALSERVICE_URL: `http://${hosts.public}/identityhub/api/credentials/v1/participants/${did}`,
    TX_EDC_DCP_CACHE_ENABLED: "true",
    TX_EDC_DCP_CACHE_VALIDITY_SECONDS: "86400",
    TX_EDC_DID_SERVICE_SELF_REGISTRATION_ENABLED: "false",
    TX_EDC_DID_SERVICE_SELF_DEREGISTRATION_ENABLED: "false",
    TX_EDC_DPF_CONSUMER_PROXY_AUTH_APIKEY: API_KEY,
    TX_EDC_DATAPLANE_TOKEN_EXPIRY: "300",
    TX_EDC_DATAPLANE_TOKEN_EXPIRY_TOLERANCE: "10",
    EDC_DSP_CALLBACK_ADDRESS: `http://${hosts.dsp}/api/v1/dsp`,
    EDC_OAUTH_PROVIDER_AUDIENCE: "idsc:IDS_CONNECTORS_ALL",
    EDC_OAUTH_ENDPOINT_AUDIENCE: `http://${hosts.dsp}/api/v1/dsp`,
    EDC_POLICY_VALIDATION_ENABLED: "true",
    EDC_CATALOG_CACHE_EXECUTION_ENABLED: "false",
    EDC_TRANSFER_PROXY_TOKEN_SIGNER_PRIVATEKEY_ALIAS: "tokenSignerPrivateKey",
    EDC_TRANSFER_PROXY_TOKEN_VERIFIER_PUBLICKEY_ALIAS: "tokenSignerPublicKey",
    // edc-runtime-memory has an in-process vault, seeded once from this string.
    TX_EDC_VAULT_SECRETS: `tokenSignerPrivateKey:\${TOKEN_SIGNER_PRIVATE_KEY:?run ./up.sh};tokenSignerPublicKey:\${TOKEN_SIGNER_PUBLIC_KEY:?run ./up.sh};${alias}:${participant.name}`,
    JAVA_TOOL_OPTIONS: JAVA,
  };
  if (plane === "controlplane") {
    return {
      ...common,
      EDC_PARTICIPANT_ID: did,
      EDC_RUNTIME_ID: `${participant.name}-controlplane`,
      WEB_HTTP_PORT: "8080",
      WEB_HTTP_PATH: "/api",
      WEB_HTTP_MANAGEMENT_PORT: "8081",
      WEB_HTTP_MANAGEMENT_PATH: "/management",
      WEB_HTTP_MANAGEMENT_AUTH_TYPE: "tokenbased",
      WEB_HTTP_MANAGEMENT_AUTH_KEY: API_KEY,
      WEB_HTTP_CONTROL_PORT: "8083",
      WEB_HTTP_CONTROL_PATH: "/control",
      WEB_HTTP_PROTOCOL_PORT: "8084",
      WEB_HTTP_PROTOCOL_PATH: "/api/v1/dsp",
      WEB_HTTP_CATALOG_PORT: "8085",
      WEB_HTTP_CATALOG_PATH: "/catalog",
      WEB_HTTP_CATALOG_AUTH_TYPE: "tokenbased",
      WEB_HTTP_CATALOG_AUTH_KEY: API_KEY,
      WEB_HTTP_PUBLIC_PORT: "8086",
      WEB_HTTP_PUBLIC_PATH: "/api/public",
      EDC_CONTROL_ENDPOINT: `http://${participant.name}-controlplane:8083/control`,
      EDC_DATAPLANE_API_PUBLIC_BASEURL: `http://${hosts.public}/api/public`,
      TX_EDC_DATAPLANE_TOKEN_REFRESH_ENDPOINT: `http://${hosts.public}/api/public/token`,
    };
  }
  return {
    ...common,
    EDC_PARTICIPANT_ID: participant.bpn,
    EDC_RUNTIME_ID: `${participant.name}-dataplane`,
    WEB_HTTP_PORT: "8080",
    WEB_HTTP_PATH: "/dataplane/api",
    WEB_HTTP_CONTROL_PORT: "8084",
    WEB_HTTP_CONTROL_PATH: "/dataplane/api/control",
    WEB_HTTP_PUBLIC_PORT: "8081",
    WEB_HTTP_PUBLIC_PATH: "/dataplane/api/public",
    EDC_CONTROL_ENDPOINT: `http://${participant.name}-dataplane:8084/dataplane/api/control`,
    EDC_DPF_SELECTOR_URL: `http://${participant.name}-controlplane:8083/control/v1/dataplanes`,
    EDC_DATAPLANE_API_PUBLIC_BASEURL: `http://${hosts.public}/dataplane/api/public`,
    TX_EDC_DATAPLANE_TOKEN_REFRESH_ENDPOINT: `http://${hosts.public}/dataplane/api/public/token`,
  };
}

function identityhubEnv(participant: Participant): Record<string, string> {
  const did = didOf(participant);
  return {
    JAVA_TOOL_OPTIONS: JAVA,
    "web.http.port": "8081",
    "web.http.path": "/api",
    "web.http.identity.port": "8082",
    "web.http.identity.path": "/identityhub/api/identity",
    "web.http.identity.auth.alias": IDENTITY_API_KEY,
    "web.http.credentials.port": "8083",
    "web.http.credentials.path": "/identityhub/api/credentials",
    "web.http.did.port": "8084",
    "web.http.did.path": "/identityhub/",
    "web.http.sts.port": "8087",
    "web.http.sts.path": "/identityhub/api/sts",
    "edc.tractusx.ih.participant.configurable.enable": "true",
    "edc.tractusx.ih.participant.configurable.id": did,
    "edc.tractusx.ih.participant.configurable.secret": participant.name,
    "edc.tractusx.ih.participant.configurable.secret.alias": `${participant.name}-secret`,
    "edc.tractusx.ih.participant.configurable.api.key": apiKeyOf(participant),
    "edc.iam.did.web.use.https": "false",
    "edc.iam.credential.revocation.mimetype": "*/*",
    "edc.encryption.strict": "false",
  };
}

function apiKeyOf(participant: Participant): string {
  return `${base64(didOf(participant))}.randomChars`;
}

export function composeFile(config: Config): Record<string, unknown> {
  const services: Record<string, Service> = {};
  const aliases = [...gatewayRoutes(config).keys()];

  services.gateway = {
    image: IMAGES.gateway,
    volumes: ["./gateway/nginx.conf:/etc/nginx/nginx.conf:ro"],
    ports: [`127.0.0.1:${GATEWAY_PORT}:80`],
    networks: { dataspace: { aliases } },
    healthcheck: { ...health("http://127.0.0.1/", "5s"), retries: 10 },
    ...limit("64m"),
  };
  services.issuerservice = {
    image: IMAGES.issuerservice,
    environment: {
      JAVA_TOOL_OPTIONS: JAVA,
      "web.http.port": "8081",
      "web.http.path": "/api",
      "web.http.sts.port": "8085",
      "web.http.sts.path": "/api/sts",
      "web.http.issuance.port": "8082",
      "web.http.issuance.path": "/api/issuance",
      "web.http.issueradmin.port": "8086",
      "web.http.issueradmin.path": "/api/admin",
      "web.http.identity.port": "8087",
      "web.http.identity.path": "/api/identity",
      "web.http.did.port": "8083",
      "web.http.did.path": "/",
      "web.http.statuslist.port": "8088",
      "web.http.statuslist.path": "/statuslist",
      "edc.issuer.statuslist.signing.key.alias": "alias",
      "edc.statuslist.callback.address": `http://${ISSUER_HOST}/statuslist`,
      "edc.iam.did.web.use.https": "false",
      "edc.iam.accesstoken.jti.validation": "false",
      "edc.iam.credential.revocation.mimetype": "*/*",
      "edc.encryption.strict": "false",
    },
    networks: ["dataspace"],
    healthcheck: health("http://127.0.0.1:8081/api/check/readiness", "30s"),
    ...limit("512m"),
  };
  services.bdrs = {
    image: IMAGES.bdrs,
    command: ["--log-level=INFO"],
    environment: {
      JAVA_TOOL_OPTIONS: JAVA,
      WEB_HTTP_PORT: "8080",
      WEB_HTTP_PATH: "/api",
      WEB_HTTP_MANAGEMENT_PORT: "8081",
      WEB_HTTP_MANAGEMENT_PATH: "/api/management",
      WEB_HTTP_MANAGEMENT_AUTH_TYPE: "tokenbased",
      WEB_HTTP_MANAGEMENT_AUTH_KEY: BDRS_API_KEY,
      WEB_HTTP_DIRECTORY_PORT: "8082",
      WEB_HTTP_DIRECTORY_PATH: "/api/directory",
      EDC_IAM_ISSUER_ID: "required but not really needed",
      "EDC_IAM_TRUSTED-ISSUER_0-ISSUER_ID": ISSUER_DID,
      EDC_IAM_CREDENTIAL_REVOCATION_MIMETYPE: "application/json",
      EDC_IAM_DID_WEB_USE_HTTPS: "false",
    },
    networks: ["dataspace"],
    healthcheck: health("http://127.0.0.1:8080/api/check/readiness", "30s"),
    ...limit("384m"),
  };

  config.participants.forEach((participant, index) => {
    const name = participant.name;
    services[`${name}-identityhub`] = {
      image: IMAGES.identityhub,
      environment: identityhubEnv(participant),
      networks: ["dataspace"],
      healthcheck: health("http://127.0.0.1:8081/api/check/readiness", "30s"),
      ...limit("512m"),
    };
    if (!participant.connector) return;
    services[`${name}-controlplane`] = {
      image: IMAGES.connector,
      command: ["--log-level=INFO"],
      environment: connectorEnv(participant, index, "controlplane"),
      networks: ["dataspace"],
      depends_on: { [`${name}-identityhub`]: { condition: "service_healthy" } },
      healthcheck: health("http://127.0.0.1:8080/api/check/readiness"),
      ...limit("768m"),
    };
    services[`${name}-dataplane`] = {
      image: IMAGES.connector,
      command: ["--log-level=INFO"],
      environment: connectorEnv(participant, index, "dataplane"),
      networks: ["dataspace"],
      depends_on: { [`${name}-controlplane`]: { condition: "service_healthy" } },
      healthcheck: health("http://127.0.0.1:8080/dataplane/api/check/readiness"),
      ...limit("768m"),
    };
    if (!participant.dtr) return;
    if (registryOf(config, participant) === "basyx") {
      Object.assign(services, basyxRegistry(name));
      return;
    }
    services[`${name}-dtr-db`] = {
      image: IMAGES.postgres,
      environment: { POSTGRES_DB: "dtr", POSTGRES_USER: "user", POSTGRES_PASSWORD: API_KEY },
      networks: ["dataspace"],
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U user -d dtr"],
        interval: "5s",
        timeout: "5s",
        retries: 30,
      },
      ...limit("256m"),
    };
    services[`${name}-dtr`] = {
      image: IMAGES.dtr,
      command: ["--spring.profiles.active=local"],
      environment: {
        JAVA_TOOL_OPTIONS: JAVA,
        SPRING_DATASOURCE_DRIVERCLASSNAME: "org.postgresql.Driver",
        SPRING_SQL_INIT_PLATFORM: "pg",
        SPRING_DATASOURCE_URL: `jdbc:postgresql://${name}-dtr-db:5432/dtr`,
        SPRING_DATASOURCE_USERNAME: "user",
        SPRING_DATASOURCE_PASSWORD: API_KEY,
        SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI: "http://registry-keycloak/realms/default-realm",
        REGISTRY_IDM_PUBLIC_CLIENT_ID: "default-client",
        REGISTRY_IDM_OWNING_TENANT_ID: "default-tenant",
        REGISTRY_IDM_INTERNAL_CLIENT_ID: "default-client",
        REGISTRY_IDM_IDENTITY_PROVIDER: "keycloak",
        REGISTRY_EXTERNAL_SUBJECT_ID_WILDCARD_PREFIX: "PUBLIC_READABLE",
        REGISTRY_EXTERNAL_SUBJECT_ID_WILDCARD_ALLOWED_TYPES: "manufacturerPartId,digitalTwinType",
        REGISTRY_USE_GRANULAR_ACCESS_CONTROL: "false",
        REGISTRY_GRANULAR_ACCESS_CONTROL_FETCH_SIZE: "500",
      },
      networks: ["dataspace"],
      depends_on: { [`${name}-dtr-db`]: { condition: "service_healthy" } },
      healthcheck: health("http://127.0.0.1:4243/actuator/health/readiness", "90s"),
      ...limit("768m"),
    };
  });

  if (config.standIns.echo) {
    services.echo = { image: IMAGES.echo, networks: ["dataspace"], ...limit("32m") };
  }

  // One-shot: the BPN directory entries (the Umbrella post-install-bdrs-setup hook).
  const entries = [
    ...config.participants.map((participant) => ({ bpn: participant.bpn, did: didOf(participant) })),
    { bpn: ISSUER_BPN, did: ISSUER_DID },
  ];
  services["bdrs-seed"] = {
    image: IMAGES.curl,
    // Run by up.sh: `up --wait` counts a container that has exited as failed.
    profiles: ["seed"],
    networks: ["dataspace"],
    entrypoint: ["/bin/sh", "-ec"],
    command: [
      entries
        .map(
          (entry) =>
            `curl -fsS -o /dev/null -w "%{http_code} ${entry.bpn}\\n" -H "Content-Type: application/json" -H "x-api-key: ${BDRS_API_KEY}" ` +
            `-d '${JSON.stringify(entry)}' http://bdrs:8081/api/management/bpn-directory || true`,
        )
        .join("\n"),
    ],
    restart: "no",
  };
  // Run by up.sh, with the IssuerService's super-user key: the credentials.
  services.credentials = {
    image: IMAGES.python,
    profiles: ["seed"],
    networks: ["dataspace"],
    working_dir: "/seed",
    volumes: ["./seed:/seed:ro"],
    environment: { SUPER_USER_KEY: "${SUPER_USER_KEY:-}", PIP_DISABLE_PIP_VERSION_CHECK: "1", PIP_ROOT_USER_ACTION: "ignore" },
    entrypoint: ["/bin/sh", "-ec"],
    command: [
      'pip install --quiet --no-cache-dir "httpx==0.28.1" && python -I issue_credentials.py --plan plan.json --issuer-url http://issuerservice.local --super-user-key "$$SUPER_USER_KEY"',
    ],
    restart: "no",
  };

  return {
    name: "tractusx-dataspace",
    services,
    networks: { dataspace: { name: "tractusx-dataspace" } },
  };
}

/** The plan issue_credentials.py reads, in the toolbox's format. */
export function seedPlan(config: Config): Record<string, unknown> {
  return {
    issuer: { bpn: ISSUER_BPN, did: ISSUER_DID, url: `http://${ISSUER_HOST}` },
    credential_definitions: CREDENTIALS.map((definition) => ({
      id: definition.id,
      type: definition.type,
      mappings: definition.mappings.map(([input, output]) => ({ input, output, required: true })),
    })),
    participants: config.participants.map((participant) => {
      const did = didOf(participant);
      return {
        name: participant.name,
        bpn: participant.bpn,
        did,
        deployed: true,
        claims: { holder_id: did, holder_identifier: did, bpn: participant.bpn, ...CLAIMS },
        credentials: CREDENTIALS.map((definition) => definition.type),
        x_api_key: apiKeyOf(participant),
        identity_api: `http://${participant.name}-identityhub:8082/identityhub/api/identity/v1alpha`,
      };
    }),
  };
}

const HEADER = `# Generated by the Eclipse Tractus-X Starter Kit configurator.
# SPDX-License-Identifier: Apache-2.0`;

function upScript(): string {
  return `#!/usr/bin/env bash
${HEADER}
#
# Starts the dataspace: a token-signing key on the first run, the containers,
# then the participants' credentials from the IssuerService.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  command -v openssl >/dev/null || { echo "openssl is needed once, to create the token-signing key." >&2; exit 1; }
  mkdir -p .secrets
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out .secrets/signing.key 2>/dev/null
  openssl pkey -in .secrets/signing.key -pubout -out .secrets/signing.pub
  {
    printf 'TOKEN_SIGNER_PRIVATE_KEY="%s"\\n' "$(cat .secrets/signing.key)"
    printf 'TOKEN_SIGNER_PUBLIC_KEY="%s"\\n' "$(cat .secrets/signing.pub)"
  } > .env
  chmod 600 .env .secrets/signing.key
fi

echo "Starting the dataspace (the first start pulls the images)..."
docker compose up -d --wait --wait-timeout 600

echo "Registering the participants in the BPN directory..."
docker compose --profile seed run --rm bdrs-seed

echo "Issuing the participants' credentials..."
key=""
for _ in $(seq 1 30); do
  # The IssuerService prints its one-time super-user key at startup.
  key="$(docker compose logs --no-log-prefix issuerservice 2>/dev/null \\
    | sed -n 's/.*Please take note of the API Key: *\\([A-Za-z0-9+\\/=.]*\\).*/\\1/p' | tail -n 1)"
  [ -n "$key" ] && break
  sleep 2
done
[ -n "$key" ] || { echo "The IssuerService did not print its API key; see docker compose logs issuerservice." >&2; exit 1; }
SUPER_USER_KEY="$key" docker compose --profile seed run --rm credentials

./info.sh
`;
}

function infoScript(config: Config): string {
  const lines = localRoutes(config).map(
    (route) => `printf '  %-36s %s\\n' "${route.label}" "http://localhost:$port${route.path}"`,
  );
  const participants = config.participants.map(
    (participant) =>
      `printf '  %-12s %-18s %s\\n' "${participant.name}" "${participant.bpn}" "${didOf(participant)}"`,
  );
  return `#!/usr/bin/env bash
${HEADER}
set -euo pipefail
cd "$(dirname "$0")"
port="\${GATEWAY_PORT:-8080}"

echo
echo "Participants:"
${participants.join("\n")}
echo
echo 'APIs (management and data plane API key: ${API_KEY}; identity API key: ${IDENTITY_API_KEY}):'
${lines.join("\n")}
echo
echo "From inside the network the DSP addresses are http://<name>-dsp.local/api/v1/dsp/${DSP_VERSION}."
`;
}

function readme(config: Config): string {
  const rows = config.participants
    .map(
      (participant) =>
        `| \`${participant.name}\` | \`${participant.bpn}\` | ${participant.connector ? "yes" : "no"} | ${participant.connector && participant.dtr ? registryById(registryOf(config, participant)).short : "no"} |`,
    )
    .join("\n");
  const connector = config.participants.find((participant) => participant.connector);
  return `# An Eclipse Tractus-X dataspace in Docker Compose

The developer toolbox's dataspace (the decentralized-identity profile of Umbrella
${toolboxPin.umbrellaChart}) as containers: a connector and an IdentityHub wallet per
participant, the IssuerService, the BPN-DID directory (BDRS) and a gateway that
plays the ingress. Every runtime keeps its state in memory: \`./down.sh\` and
\`./up.sh\` start from a clean dataspace.

| Participant | BPN | Connector | Digital Twin Registry |
| --- | --- | --- | --- |
${rows}

## Run it

You need Docker with Compose v2 and about ${Math.round(estimateMemory(config) * 10) / 10} GB of memory for it, and \`openssl\`.

\`\`\`bash
./up.sh      # starts it and issues the credentials; prints the URLs
./info.sh    # the URLs and keys again
./down.sh    # stops it
\`\`\`

The gateway listens on \`localhost:8080\`; \`GATEWAY_PORT=9090 ./up.sh\` moves it.
${
  connector
    ? `
## Try it

\`\`\`bash
python3 exchange.py   # ${connector.name} offers, the next connector negotiates and pulls
\`\`\`

Or call a management API yourself:

\`\`\`bash
curl -s -H "x-api-key: ${API_KEY}" -H "Content-Type: application/json" \\
  -d '{"@context":{"@vocab":"https://w3id.org/edc/v0.0.1/ns/"},"@type":"QuerySpec"}' \\
  http://localhost:8080/${connector.name}/management/v3/assets/request
\`\`\`
`
    : ""
}
## How it is built

- \`docker-compose.yaml\`: the services, with the settings the Umbrella charts give them.
- \`gateway/nginx.conf\`: every host a DID or a callback names (\`<name>.local\`,
  \`<name>-dsp.local\`, \`issuerservice.local\`, ...), routed as the ingresses route it.
- \`seed/\`: what issues the credentials, the developer toolbox's own
  \`issue_credentials.py\` and its plan.

For tests in CI or a Kubernetes deployment closer to production, configure the
developer toolbox or the Umbrella chart instead.
`;
}

export function estimateMemory(config: Config): number {
  const connectors = config.participants.filter((participant) => participant.connector).length;
  const withDtr = config.participants.filter((participant) => participant.connector && participant.dtr);
  const basyx = withDtr.filter((participant) => registryOf(config, participant) === "basyx").length;
  return 0.6 + 0.3 * config.participants.length + 0.8 * connectors + 0.7 * (withDtr.length - basyx) + 0.15 * basyx;
}

/** A first data exchange between the first two connectors, for the README's "Try it". */
function exchangeFile(config: Config) {
  const [provider, consumer] = config.participants.filter((participant) => participant.connector);
  if (!provider || !consumer) return [];
  const defaults = [
    `PROVIDER = os.environ.get("PROVIDER", "${provider.name}")`,
    `CONSUMER = os.environ.get("CONSUMER", "${consumer.name}")`,
    `PROVIDER_DID = os.environ.get("PROVIDER_DID", "${didOf(provider)}")`,
    `BACKEND = os.environ.get("BACKEND", "${config.standIns.echo ? "http://echo/" : "http://gateway/"}")`,
  ].join("\n");
  return [
    {
      path: "exchange.py",
      content: `#!/usr/bin/env python3\n${HEADER}\n${exchange.replace("# @defaults", defaults)}`,
      language: "text" as const,
      summary: `A first data exchange: ${consumer.name} gets data from ${provider.name}.`,
      executable: true,
    },
  ];
}

export function composeBundle(config: Config): Bundle {
  const compose = `${HEADER}
#
# An Eclipse Tractus-X dataspace: ${config.participants.map((participant) => participant.name).join(", ")}.
# Start it with ./up.sh: it creates the token-signing key (.env) first.

${stringify(composeFile(config), { lineWidth: 0 })}`;
  return {
    name: "tractusx-dataspace",
    run: ["./up.sh"],
    files: [
      { path: "README.md", content: readme(config), language: "markdown", summary: "What runs and how to start it." },
      { path: "docker-compose.yaml", content: compose, language: "yaml", summary: "The services, with the Umbrella chart settings." },
      { path: "gateway/nginx.conf", content: nginxConf(config), language: "text", summary: "The ingress: hosts and paths to services." },
      { path: "up.sh", content: upScript(), language: "shell", summary: "Starts the dataspace and issues the credentials.", executable: true },
      { path: "info.sh", content: infoScript(config), language: "shell", summary: "Prints the participants, URLs and keys.", executable: true },
      {
        path: "down.sh",
        content: `#!/usr/bin/env bash\n${HEADER}\nset -euo pipefail\ncd "$(dirname "$0")"\ndocker compose --profile seed down --remove-orphans\n`,
        language: "shell",
        summary: "Stops it and removes the containers.",
        executable: true,
      },
      { path: "seed/plan.json", content: `${JSON.stringify(seedPlan(config), null, 2)}\n`, language: "text", summary: "Who gets which credentials." },
      { path: "seed/issue_credentials.py", content: issueCredentials, language: "text", summary: "The developer toolbox's credential issuance." },
      ...exchangeFile(config),
      { path: ".gitignore", content: ".env\n.secrets/\n", language: "text", summary: "Keeps the generated key out of Git." },
    ],
  };
}
