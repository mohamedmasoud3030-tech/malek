// Vercel journey tests – run on deployed app.
// All secrets come from environment variables – nothing hardcoded here.
const AK = process.env.VITE_SUPABASE_ANON_KEY || process.env.QA_SUPABASE_ANON_KEY;
const PW = process.env.QA_ADMIN_PASSWORD;
const URL = process.env.VITE_SUPABASE_URL || process.env.QA_SUPABASE_URL || "https://nnggcnpcuomwfuupupwg.supabase.co";
const EMAIL = process.env.QA_ADMIN_EMAIL || "qa-admin@malek.app";

if (!PW) {
  console.error("ERROR: QA_ADMIN_PASSWORD env var is required");
  process.exit(1);
}
if (!AK) {
  console.error("ERROR: VITE_SUPABASE_ANON_KEY or QA_SUPABASE_ANON_KEY env var is required");
  process.exit(1);
}

async function main() {
  console.log("=== Vercel Journey Tests ===\n");
  let passed = 0, failed = 0;
  const ok = (l) => { passed++; console.log(`  ✅ ${l}`); };
  const fail = (l, d = "") => { failed++; console.log(`  ❌ ${l}${d ? ": " + d : ""}`); };

  // 1 – Vercel page loads
  try {
    const vercel = await fetch("https://malek-plus.vercel.app/");
    const html = await vercel.text();
    vercel.status === 200 ? ok("Vercel page loads (" + vercel.status + ")") : fail("Vercel page load", "status " + vercel.status);
  } catch (e) { fail("Vercel page load", e.message); }

  // 2 – Login
  let token = null;
  try {
    const l = await fetch(URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: AK, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PW }),
    });
    if (!l.ok) {
      const body = await l.text();
      fail("Login", `${l.status} ${body.slice(0, 100)}`);
      console.log(`\n=== ${passed}/${passed + failed} passed (${failed} failed) ===`);
      process.exit(1);
    }
    const s = await l.json();
    token = s.access_token;
    ok("Login");
  } catch (e) { fail("Login", e.message); process.exit(1); }

  // 3–10 – Read core tables
  const tables = [
    ["properties", "/rest/v1/properties?select=id,title,status&limit=5"],
    ["units",      "/rest/v1/units?select=id,status&limit=5"],
    ["people",     "/rest/v1/people?select=id,full_name&limit=5"],
    ["contracts",  "/rest/v1/contracts?select=id,start_date,end_date,status&limit=5"],
    ["invoices",   "/rest/v1/invoices?select=id,amount,paid_amount,due_date,status&limit=5"],
    ["payments",   "/rest/v1/payments?select=id,amount,status&limit=5"],
    ["receipts",   "/rest/v1/receipts?select=id,amount,status&limit=5"],
    ["owners",     "/rest/v1/owners?select=id,full_name&limit=5"],
  ];
  for (const [name, path] of tables) {
    try {
      const r = await fetch(URL + path, {
        headers: { apikey: AK, Authorization: "Bearer " + token },
      });
      r.ok ? ok(`${name} readable (${(await r.json()).length} rows)`) : fail(name, String(r.status));
    } catch (e) { fail(name, e.message); }
  }

  // 11 – Session refresh
  try {
    const ref = await fetch(URL + "/auth/v1/user", {
      headers: { apikey: AK, Authorization: "Bearer " + token },
    });
    ref.ok ? ok("Session valid") : fail("Session valid", String(ref.status));
  } catch (e) { fail("Session valid", e.message); }

  // 12 – Logout
  try {
    const lo = await fetch(URL + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: AK, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    });
    (lo.status === 204 || lo.ok) ? ok("Logout (" + lo.status + ")") : fail("Logout", String(lo.status));
  } catch (e) { fail("Logout", e.message); }

  console.log(`\n=== ${passed}/${passed + failed} passed (${failed} failed) ===`);
  if (failed > 0) process.exit(1);
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
