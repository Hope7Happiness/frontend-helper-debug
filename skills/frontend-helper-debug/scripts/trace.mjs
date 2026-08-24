#!/usr/bin/env node

const [command, first, second, third] = process.argv.slice(2);
const supported = ["list", "summary", "raw", "name", "delete"];

if (!command || !supported.includes(command)) {
  fail("Usage: trace.mjs <list|summary|raw|name|delete> [trace-id] [name] [base-url]");
}

if (command === "list") {
  const baseUrl = normalizeBaseUrl(first);
  const response = await fetch(`${baseUrl}/__frontend-helper/traces`, { headers: { Accept: "application/json" } });
  const result = await readResponse(response);
  if (!response.ok) fail(`Trace list failed (${response.status}): ${JSON.stringify(result)}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const id = first;
if (!id || !/^fh_[a-z0-9]+_[a-f0-9]{8}$/.test(id)) {
  fail(`Invalid Frontend Helper trace ID: ${id ?? "<missing>"}`);
}

const baseUrl = normalizeBaseUrl(command === "name" ? third : second);
const endpoint = `${baseUrl}/__frontend-helper/traces/${encodeURIComponent(id)}`;

if (command === "delete") {
  const response = await fetch(endpoint, { method: "DELETE" });
  const result = await readResponse(response);
  if (!response.ok) fail(`Delete failed (${response.status}): ${JSON.stringify(result)}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

if (command === "name") {
  if (typeof second !== "string" || second.trim().length > 80) fail("Provide a trace name of 80 characters or fewer");
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: second.trim() }),
  });
  const result = await readResponse(response);
  if (!response.ok) fail(`Rename failed (${response.status}): ${JSON.stringify(result)}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
const trace = await readResponse(response);
if (!response.ok) fail(`Trace lookup failed (${response.status}): ${JSON.stringify(trace)}`);

if (command === "raw") {
  process.stdout.write(`${JSON.stringify(trace, null, 2)}\n`);
  process.exit(0);
}

const summary = {
  id: trace.storage?.id ?? id,
  name: trace.storage?.name ?? null,
  savedAt: trace.storage?.savedAt,
  service: trace.service ?? null,
  session: trace.session,
  timeline: trace.timeline,
  annotations: trace.annotations,
  rrwebEventCount: Array.isArray(trace.rrwebEvents) ? trace.rrwebEvents.length : 0,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function normalizeBaseUrl(value) {
  return (value ?? process.env.FRONTEND_HELPER_URL ?? "http://127.0.0.1:5173").replace(/\/+$/, "");
}

async function readResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { body: text };
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
