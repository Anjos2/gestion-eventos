import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Definimos las cabeceras CORS para pasar la solicitud pre-vuelo.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lee las variables de entorno de forma segura.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
// Leemos la clave personalizada que configuramos como secreto.
const serviceRoleKey = Deno.env.get('CUSTOM_SERVICE_ROLE_KEY') ?? ''

// Inicializa el cliente de Supabase con las credenciales correctas.
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (req) => {
  // Manejo de la solicitud pre-vuelo CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      throw new Error('El email es requerido en el cuerpo de la solicitud.')
    }

    // Llama a la función de Supabase para invitar al usuario,
    // redirigiéndolo a la página de frontend para establecer su contraseña.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'http://localhost:3000/auth/set-password',
    })

    if (error) {
      console.error('Error al invitar al usuario:', error)
      throw error
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})