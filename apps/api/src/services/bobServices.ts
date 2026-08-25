export type BobServiceId = "bobdb" | "bobauth" | "bobstorage" | "bobapi" | "bobhs";

export type BobService = {
  id: BobServiceId;
  name: string;
  url: string | null;
  configured: boolean;
  role: string;
};

const definitions: Array<[BobServiceId, string, string, string]> = [
  ["bobdb", "BobDB", "BOBDB_URL", "separate database service used by BobAI and other Bob products"],
  ["bobauth", "BobAuth", "BOBAUTH_URL", "shared authentication service"],
  ["bobstorage", "BobStorage", "BOBSTORAGE_URL", "shared file/object storage service"],
  ["bobapi", "BobAPI", "BOBAPI_URL", "shared API gateway/service surface"],
  ["bobhs", "BobHS", "BOBHS_URL", "hosting/deployment service"],
];

export function listBobServices(): BobService[] {
  return definitions.map(([id, name, envName, role]) => {
    const url = process.env[envName] || null;
    return { id, name, url, configured: Boolean(url), role };
  });
}

export function getBobService(id: BobServiceId) {
  return listBobServices().find((service) => service.id === id) || null;
}
