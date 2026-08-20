// Vercel journey tests – run on deployed app
const AK = "sb_publishable_JeLckFV2xYl78rei1-Q_EA_WcHif6WW";
const PW = process.env.QA_ADMIN_PASSWORD || "4iUDtXOwWBOtkGik!";
const URL = "https://nnggcnpcuomwfuupupwg.supabase.co";

async function main() {
  console.log("=== Vercel Journey Tests ===\n");

  // 1 – Vercel page loads
  const vercel = await fetch("https://malek-plus.vercel.app/");
  const html = await vercel.text();
  console.log("Vercel page: " + (html.includes("MALEK") ? "✅" : "❌") + " (" + vercel.status + ")");

  // 2 – Login
  const l = await fetch(URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: AK, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-admin@malek.app", password: PW }),
  });
  if (!l.ok) { console.log("❌ Login"); return; }
  const s = await l.json();
  const t = s.access_token;
  console.log("✅ Login");

  // 3 – Read properties
  const r = await fetch(URL + "/rest/v1/properties?select=id,title,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (r.ok) { const d = await r.json(); console.log("✅ Properties: " + d.length); }
  else console.log("❌ Properties: " + r.status);

  // 4 – Read units
  const u = await fetch(URL + "/rest/v1/units?select=id,name,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (u.ok) { const d = await u.json(); console.log("✅ Units: " + d.length); }
  else console.log("❌ Units: " + u.status);

  // 5 – Read people
  const p = await fetch(URL + "/rest/v1/people?select=id,full_name&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (p.ok) { const d = await p.json(); console.log("✅ People: " + d.length); }
  else console.log("❌ People: " + p.status);

  // 6 – Read contracts
  const c = await fetch(URL + "/rest/v1/contracts?select=id,start_date,end_date,rent_amount,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (c.ok) { const d = await c.json(); console.log("✅ Contracts: " + d.length + " items"); }
  else { const e = await c.text(); console.log("❌ Contracts: " + c.status + " " + e.slice(0, 100)); }

  // 7 – Read invoices
  const i = await fetch(URL + "/rest/v1/invoices?select=id,amount,paid_amount,due_date,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (i.ok) { const d = await i.json(); console.log("✅ Invoices: " + d.length); }
  else console.log("❌ Invoices: " + i.status);

  // 8 – Read payments
  const pm = await fetch(URL + "/rest/v1/payments?select=id,amount,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (pm.ok) { const d = await pm.json(); console.log("✅ Payments: " + d.length); }
  else console.log("❌ Payments: " + pm.status);

  // 9 – Read receipts
  const rc = await fetch(URL + "/rest/v1/receipts?select=id,amount,status&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (rc.ok) { const d = await rc.json(); console.log("✅ Receipts: " + d.length); }
  else console.log("❌ Receipts: " + rc.status);

  // 10 – Read vault documents
  const v = await fetch(URL + "/rest/v1/vault_documents?select=id,storage_path&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (v.ok) { const d = await v.json(); console.log("✅ Vault docs: " + d.length); }
  else console.log("❌ Vault docs: " + v.status);

  // 11 – Read owners
  const o = await fetch(URL + "/rest/v1/owners?select=id,full_name&limit=5", {
    headers: { apikey: AK, Authorization: "Bearer " + t },
  });
  if (o.ok) { const d = await o.json(); console.log("✅ Owners: " + d.length); }
  else console.log("❌ Owners: " + o.status);

  // 12 – Logout
  const lo = await fetch(URL + "/auth/v1/logout", {
    method: "POST",
    headers: { apikey: AK, Authorization: "Bearer " + t, "Content-Type": "application/json" },
  });
  console.log("✅ Logout (" + lo.status + ")");

  console.log("\n=== Vercel journeys: done ===");
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });