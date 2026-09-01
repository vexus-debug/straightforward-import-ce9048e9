import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = new Set([
  "admin",
  "dentist",
  "associate_dentist",
  "assistant",
  "hygienist",
  "receptionist",
  "accountant",
  "lab_technician",
  "lab_manager",
  "lab_entry_clerk",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing auth token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Caller verification (with caller's JWT)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check caller is admin or lab_manager
    const { data: rolesData } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const callerRoles = (rolesData || []).map((r: any) => r.role);
    if (!callerRoles.includes("admin") && !callerRoles.includes("lab_manager")) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, email, password, fullName, role, ldStaffId, clinicStaffId } = body || {};

    if (action !== "create") {
      return new Response(JSON.stringify({ success: false, error: "Unsupported action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user (auto-confirm)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ success: false, error: createErr?.message || "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const newUserId = created.user.id;

    // Assign role
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role });
    if (roleErr) {
      console.error("role insert error", roleErr);
    }

    // Link to clinic staff record if provided/found by email
    let linkedClinicStaffId = clinicStaffId as string | undefined;
    if (!linkedClinicStaffId) {
      const { data: matchStaff } = await admin.from("staff").select("id").eq("email", email).maybeSingle();
      linkedClinicStaffId = matchStaff?.id;
    }
    if (linkedClinicStaffId) {
      await admin.from("staff").update({ user_id: newUserId }).eq("id", linkedClinicStaffId);
    }

    // Link to lab dashboard staff record if provided
    if (ldStaffId) {
      await admin.from("ld_staff").update({ user_id: newUserId }).eq("id", ldStaffId);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});