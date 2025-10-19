import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Cliente de Supabase con privilegios de administrador (service role)
// IMPORTANTE: Este cliente bypasea RLS y solo debe usarse en server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación del usuario que hace la petición
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // 2. Obtener datos del body
    const body = await request.json();
    const { nombre, email, rol, id_organizacion } = body;

    // 3. Validaciones básicas
    if (!nombre || !email || !rol || !id_organizacion) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: nombre, email, rol, id_organizacion' },
        { status: 400 }
      );
    }

    // 4. Validar que el rol sea OPERATIVO o ADMINISTRATIVO_APOYO
    if (rol !== 'OPERATIVO' && rol !== 'ADMINISTRATIVO_APOYO') {
      return NextResponse.json(
        { error: 'Este endpoint solo permite crear usuarios OPERATIVO o ADMINISTRATIVO_APOYO' },
        { status: 400 }
      );
    }

    // 5. Verificar que el email no esté ya registrado en Personal
    const { data: existingPersonal, error: checkError } = await supabaseAdmin
      .from('Personal')
      .select('id, email, supabase_user_id')
      .eq('email', email)
      .eq('id_organizacion', id_organizacion)
      .maybeSingle();

    if (checkError) {
      console.error('Error verificando email existente:', checkError);
      return NextResponse.json(
        { error: 'Error al verificar email existente' },
        { status: 500 }
      );
    }

    if (existingPersonal) {
      if (existingPersonal.supabase_user_id) {
        return NextResponse.json(
          { error: 'Este email ya tiene una cuenta de usuario activa' },
          { status: 409 }
        );
      }
      // Si existe pero no tiene supabase_user_id, continuamos para vincularlo
    }

    // 6. Crear usuario en Supabase Auth con email pre-confirmado
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'admin', // Contraseña por defecto
      email_confirm: true, // Pre-confirmar email para evitar verificación
      user_metadata: {
        nombre: nombre,
        rol: rol,
        id_organizacion: id_organizacion
      }
    });

    if (authError) {
      console.error('Error creando usuario en Auth:', authError);
      return NextResponse.json(
        { error: `Error al crear usuario: ${authError.message}` },
        { status: 500 }
      );
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: 'No se pudo crear el usuario en Auth' },
        { status: 500 }
      );
    }

    let personalRecord;

    // 7. Si el registro de Personal ya existe, actualizarlo; si no, crearlo
    if (existingPersonal) {
      // Actualizar registro existente con el nuevo supabase_user_id
      const { data: updatedPersonal, error: updateError } = await supabaseAdmin
        .from('Personal')
        .update({ supabase_user_id: authUser.user.id })
        .eq('id', existingPersonal.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error vinculando usuario con Personal:', updateError);
        // Intentar eliminar el usuario de Auth creado
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json(
          { error: 'Error al vincular usuario con registro de Personal' },
          { status: 500 }
        );
      }

      personalRecord = updatedPersonal;
    } else {
      // 8. Crear nuevo registro en tabla Personal
      const { data: newPersonal, error: insertError } = await supabaseAdmin
        .from('Personal')
        .insert({
          nombre: nombre,
          email: email,
          rol: rol,
          id_organizacion: id_organizacion,
          supabase_user_id: authUser.user.id,
          es_activo: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error insertando en Personal:', insertError);
        // Intentar eliminar el usuario de Auth creado
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json(
          { error: `Error al crear registro de Personal: ${insertError.message}` },
          { status: 500 }
        );
      }

      personalRecord = newPersonal;
    }

    // 9. Retornar éxito con los datos del usuario creado
    return NextResponse.json({
      success: true,
      data: {
        id: personalRecord.id,
        nombre: personalRecord.nombre,
        email: personalRecord.email,
        rol: personalRecord.rol,
        supabase_user_id: personalRecord.supabase_user_id
      },
      credentials: {
        email: email,
        password: 'admin'
      },
      message: 'Usuario creado exitosamente. Credenciales: email y contraseña "admin"'
    });

  } catch (error: any) {
    console.error('Error en create-personal API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
