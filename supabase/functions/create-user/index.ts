import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: "admin" | "technician" | "client" | "developer";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !currentUser) {
      throw new Error("Unauthorized");
    }

    const { data: currentProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (!currentProfile) {
      throw new Error("Profile not found");
    }

    const requestData: CreateUserRequest = await req.json();

    if (
      currentProfile.role !== "developer" &&
      currentProfile.role !== "admin"
    ) {
      throw new Error("Insufficient permissions");
    }

    if (
      currentProfile.role === "admin" &&
      requestData.role === "developer"
    ) {
      throw new Error("Admins cannot create developers");
    }

    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true,
      user_metadata: {
        full_name: requestData.full_name,
        role: requestData.role,
      },
    });

    if (createError) throw createError;

    if (newUser.user) {
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .insert({
          id: newUser.user.id,
          role: requestData.role,
          full_name: requestData.full_name,
          email: requestData.email,
          phone: requestData.phone || null,
          is_active: true,
        });

      if (profileError) throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser.user,
        message: `Usuario ${requestData.full_name} creado exitosamente`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});