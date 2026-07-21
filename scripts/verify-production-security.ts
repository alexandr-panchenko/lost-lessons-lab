import { z } from "zod";

const productionOrigin = z.url().parse(process.env.PRODUCTION_URL);
const redirect = await fetch(new URL("/judge", productionOrigin), {
  redirect: "manual",
});
if (redirect.status !== 302)
  throw new Error("Production security audit could not create a judge room");
if (redirect.headers.get("cache-control") !== "no-store")
  throw new Error("Judge redirect is cacheable");
if (redirect.headers.has("cf-mitigated"))
  throw new Error("Judge route returned a Cloudflare challenge");

const location = redirect.headers.get("location");
if (location === null) throw new Error("Judge redirect has no room location");
const roomUrl = new URL(location, productionOrigin);
const capability = new URLSearchParams(roomUrl.hash.slice(1)).get("token");
if (capability === null || capability.length < 32)
  throw new Error("Judge redirect has no capability fragment");
roomUrl.hash = "";

const roomResponse = await fetch(roomUrl);
if (!roomResponse.ok) throw new Error("Room document is unavailable");
const requiredHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;
for (const [name, expected] of Object.entries(requiredHeaders)) {
  if (!roomResponse.headers.get(name)?.includes(expected))
    throw new Error(`Room document is missing ${name}`);
}
if (roomResponse.headers.has("cf-mitigated"))
  throw new Error("Room document returned a Cloudflare challenge");

const html = await roomResponse.text();
if (html.includes(capability))
  throw new Error("Room capability was reflected into HTML");
if (/captcha|sign[ -]?up|api key required/iu.test(html))
  throw new Error("Room shell contains a blocked access gate");
const entryPath = html.match(/<script[^>]+src="([^"]+)"/u)?.[1];
if (entryPath === undefined) throw new Error("Room shell has no client entry");

const entryUrl = new URL(entryPath, productionOrigin);
const entryResponse = await fetch(entryUrl);
if (!entryResponse.ok) throw new Error("Client entry is unavailable");
const entry = await entryResponse.text();
for (const marker of [
  "CLOUDFLARE_API_TOKEN",
  "OPENAI_API_KEY",
  "ROOM_TOKEN_PEPPER",
  capability,
]) {
  if (entry.includes(marker))
    throw new Error("Client entry contains server-only material");
}
if (entry.includes("sourceMappingURL"))
  throw new Error("Client entry advertises a source map");
const sourceMapResponse = await fetch(`${entryUrl.toString()}.map`);
if (sourceMapResponse.ok) {
  const sourceMapBody = await sourceMapResponse.text();
  const contentType = sourceMapResponse.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/json") ||
    /^\s*\{\s*"version"\s*:\s*3\b/u.test(sourceMapBody)
  ) {
    throw new Error("Client source map is public");
  }
}

const unauthorizedMedia = await fetch(
  new URL("/api/rooms/rm_invalid/media/md_invalid", productionOrigin),
);
if (![401, 404].includes(unauthorizedMedia.status))
  throw new Error("Unauthenticated media probe was not denied");

console.info(
  JSON.stringify({
    accessGate: "absent",
    capabilityReflection: "absent",
    challenge: "absent",
    clientSecrets: "absent",
    privateMediaProbe: "denied",
    protectedHeaders: "passed",
    publicSourceMap: "absent",
    status: "production-security-passed",
  }),
);
