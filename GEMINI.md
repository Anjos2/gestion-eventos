# Diccionario de Datos v11.0 (Denormalizado)

---
## Tablas de Plataforma (SaaS & Facturación)
Estas tablas son gestionadas por el Super-Administrador para controlar el acceso y la facturación de las organizaciones.

### Tabla: `Organizaciones`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador numérico único y secuencial que representa a cada organización (inquilino) en el sistema. | El valor debe ser un entero positivo (`> 0`). | Utilizar `BIGSERIAL` en PostgreSQL para que la asignación sea automática y soporte un gran número de organizaciones. |
| `nombre` | `VARCHAR` | `UNIQUE` | Nombre comercial o legal de la empresa cliente, utilizado para identificarla en toda la aplicación. | La longitud debe ser mayor a 2 caracteres. No puede contener solo espacios en blanco. | Es vital aplicar una restricción `UNIQUE` a nivel de base de datos. Se debe indexar esta columna para optimizar las búsquedas. |
| `created_at` | `TIMESTAMP` | | Sello de tiempo que registra el momento exacto en que la organización fue creada en el sistema. | La fecha registrada no puede ser una fecha futura. | Definir un valor `DEFAULT now()` en la columna para que la base de datos se encargue de poblar este campo automáticamente en cada `INSERT`. |
| 🔑 `estado` | `VARCHAR` | `ENUM` | Controla el ciclo de vida de la organización, permitiendo suspender su acceso a la plataforma. | El valor debe ser `ACTIVA` o `SUSPENDIDA`. `DEFAULT 'ACTIVA'`. | **Control de acceso a nivel de plataforma.** Las políticas RLS deben verificar este estado para conceder o denegar el acceso. |

---
### 🔑 Tabla: `Contadores_Uso`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id_organizacion` | `INTEGER` | PK, FK | La organización a la que pertenece este contador. | Debe ser un ID de `Organizaciones` válido. | Clave primaria para una relación 1 a 1. |
| `conteo_registros_nuevos`| `INTEGER` | `NOT NULL` | **Contador en tiempo real** de los registros creados por la organización desde el último ciclo de facturación. | `DEFAULT 0`. `CHECK (conteo_registros_nuevos >= 0)`. | Este es el número que el Super-Admin utiliza para facturar. |
| `ultimo_reseteo` | `TIMESTAMP` | `NULL` | Fecha y hora del último reinicio del contador, que corresponde al último pago. | `NULL` para organizaciones nuevas. | Se actualiza cada vez que se cierra un ciclo de facturación. |

---
### 🔑 Tabla: `Historial_Facturacion`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único del registro de facturación. | Utilizar `BIGSERIAL`. | - |
| `id_organizacion` | `INTEGER` | FK | Organización que fue facturada. | Debe ser un ID de `Organizaciones` válido. | Permite consultar todo el historial de pagos de un cliente. |
| `registros_facturados`| `INTEGER` | `NOT NULL` | La cantidad de registros que se incluyeron en este ciclo de facturación. | `CHECK (registros_facturados >= 0)`. | Copia el valor de `conteo_registros_nuevos` en el momento del cobro. |
| `fecha_facturacion` | `TIMESTAMP` | `NOT NULL` | Sello de tiempo exacto en que el Super-Admin cerró el ciclo de pago. | `DEFAULT now()`. | Fecha contable del cobro. |
| `facturado_por` | `UUID` | FK (`auth.users(id)`) | El Super-Administrador que registró el pago. | `NULLABLE`. | Auditoría de quién realizó la acción de facturación. |

---
## Tablas de Aplicación (Contabilizadas)
Las inserciones (`INSERT`) en **TODAS** las tablas de esta sección incrementan el `conteo_registros_nuevos` de la organización correspondiente.

### Tabla: `Personal`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador numérico único para cada registro de empleado o miembro del personal. | El valor debe ser un entero positivo (`> 0`). | Clave primaria estándar para mantener la integridad referencial. |
| `supabase_user_id`| `UUID` | FK, `UNIQUE`, `NULL` | Almacena el ID de `auth.users` de Supabase. Es la llave que convierte un registro de personal en un usuario con acceso. | Debe ser un formato UUID válido o `NULL`. | 🛡️ **Vínculo de seguridad crítico.** Implementar como `FOREIGN KEY` a `auth.users(id)`. Debe ser `NULLABLE` y tener un constraint `UNIQUE` para valores no nulos. |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Campo no nulo que asegura que todo miembro del personal pertenezca a una y solo una organización. | Debe ser un ID de organización existente y válido. | **Pilar del multi-tenancy.** 📈 **Contabilizado.** Cada `INSERT` incrementa el contador de uso. |
| `nombre` | `VARCHAR` | `NOT NULL` | Nombre completo del miembro del personal. Se utiliza para visualización en reportes, listas y asignaciones. | La longitud debe ser mayor a 2 caracteres. No puede contener solo espacios en blanco. | - |
| `email` | `VARCHAR` | `UNIQUE`, `NULL` | Correo electrónico del miembro del personal. Es el identificador principal para el inicio de sesión en Supabase. | Si no es `NULL`, debe tener un formato de email válido (ej. `usuario<!-- Import failed: dominio.com`). - Only .md files are supported --> | Debe ser `NULLABLE`. El constraint `UNIQUE` en PostgreSQL se aplicará solo a los valores que no sean nulos, lo cual es el comportamiento deseado. |
| `rol` | `VARCHAR` | `ENUM` | Etiqueta que define el nivel de permisos del usuario (`Administrativo`, `Administrativo de Apoyo`) o la función laboral del empleado (`Operativo`). | El valor debe pertenecer a una lista predefinida (`ADMINISTRATIVO`, `OPERATIVO`, `ADMINISTRATIVO_APOYO`). | Es recomendable usar un tipo `ENUM` de PostgreSQL para restringir los valores a un conjunto predefinido y evitar inconsistencias. |
| `es_activo` | `BOOLEAN` | `NOT NULL` | Indicador booleano que permite la desactivación (soft-delete) de un empleado sin borrar su registro. | El valor debe ser `TRUE` o `FALSE`. | Las consultas operativas siempre deben incluir la cláusula `WHERE es_activo = TRUE` para mostrar solo al personal relevante. |

---
### Tabla: `Contratadores`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único del cliente/contratador. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización a la que pertenece este cliente. | Debe ser un ID de organización existente y válido. | Base para RLS. 📈 **Contabilizado.** Cada `INSERT` incrementa el contador de uso. |
| `tipo_documento` | `VARCHAR` | `ENUM` | Tipo de documento de identificación (`DNI`, `RUC`, `Pasaporte`). | El valor debe pertenecer a una lista predefinida. | Usar un tipo `ENUM` para asegurar la consistencia. |
| `numero_documento`| `VARCHAR` | | Número del documento de identificación. | El formato debe corresponder al `tipo_documento`. | `UNIQUE` compuesto en `(id_organizacion, numero_documento)` para evitar duplicados por organización. |
| `nombre` | `VARCHAR` | `NOT NULL` | Nombre o razón social del cliente. | Longitud > 2 caracteres. | - |
| `es_activo` | `BOOLEAN` | `NOT NULL` | Controla si el registro del cliente está activo. | El valor debe ser `TRUE` o `FALSE`. | - |

---
### Tabla: `Tipos_Contrato`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único del tipo de contrato. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización que define este tipo de contrato. | Debe ser un ID de organización existente y válido. | Una organización no puede usar los tipos de contrato de otra. 📈 **Contabilizado.** Cada `INSERT` incrementa el contador de uso. |
| `nombre` | `VARCHAR` | `NOT NULL` | Nombre del servicio ofrecido (ej. "Evento Corporativo"). | Longitud > 2. Debe ser único por organización. | `UNIQUE` en `(id_organizacion, nombre)`. |
| `ingreso_base` | `DECIMAL` | | Monto fijo de ingreso que genera este tipo de contrato. | El valor debe ser un número positivo (`>= 0.00`). | 💰 Usar `DECIMAL` o `NUMERIC` para datos monetarios. |
| `es_activo` | `BOOLEAN` | `NOT NULL` | Controla si este tipo de contrato se puede seguir utilizando. | El valor debe ser `TRUE` o `FALSE`. | - |

---
### Tabla: `Servicios`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador numérico único para cada tipo de servicio que puede ser ejecutado por el personal. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización que define y ofrece este servicio. | Debe ser un ID de organización existente y válido. | Clave para RLS. 📈 **Contabilizado.** Cada `INSERT` incrementa el contador de uso. |
| `nombre` | `VARCHAR` | `NOT NULL` | Nombre descriptivo del servicio (ej. "Fotografía", "Sonido", "Filmación"). | Longitud > 2. Debe ser único por organización. | `UNIQUE` en `(id_organizacion, nombre)`. |
| `monto_base` | `DECIMAL` | `NOT NULL` | Monto estándar que se paga al personal por la ejecución de este servicio. | El valor debe ser un número positivo (`>= 0.00`). | 💰 **Usar `DECIMAL` o `NUMERIC`**. |
| `es_activo` | `BOOLEAN` | `NOT NULL` | Controla si este servicio puede ser asignado a nuevos eventos. | El valor debe ser `TRUE` o `FALSE`. | Permite "retirar" servicios sin afectar los registros históricos. |

---
### Tabla: `Contratos`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador numérico único para cada contrato. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Referencia a la organización que genera y es dueña de este contrato. | Debe ser un ID de organización existente y válido. | Indispensable para RLS. 📈 **Contabilizado.** Cada `INSERT` incrementa el contador de uso. |
| `id_contratador` | `INTEGER` | FK (`Contratadores.id`) | Referencia al cliente final para el cual se realiza el servicio del contrato. | Debe ser un ID de contratador existente y válido. | Asegurar que el `Contratador` pertenezca a la misma `id_organizacion` vía FK compuesta o trigger. |
| `id_personal_administrativo` | `INTEGER`| FK (`Personal.id`) | Miembro del personal que es responsable de la creación y gestión del contrato. | Debe ser un ID de personal existente con rol `Administrativo`. | La FK debe apuntar a un registro de `Personal` con un `rol` administrativo y que pertenezca a la misma organización. |
| `id_tipo_contrato`| `INTEGER` | FK (`Tipos_Contrato.id`) | Clasificación del contrato según un catálogo de servicios predefinido. | Debe ser un ID de tipo de contrato existente y válido. | El `Tipo_Contrato` seleccionado debe p|ertenecer a la misma `id_organizacion`. |
| `fecha_hora_evento`| `TIMESTAMP` | `NOT NULL` | Fecha y hora exactas en que el servicio del contrato debe ser ejecutado. | La fecha debe ser futura al momento de la creación/modificación del contrato. | ⏰ Usar el tipo `TIMESTAMP WITH TIME ZONE (timestamptz)`. |
| `estado` | `VARCHAR` | `ENUM` | Ciclo de vida del contrato (`ACTIVO`, `CANCELADO`, `COMPLETADO`). | Debe pertenecer a la lista predefinida. | Usar un tipo `ENUM` de PostgreSQL. |
| `estado_asignacion` | `VARCHAR` | `ENUM` | Estado operativo que indica si ya se asignó personal y servicios al contrato (`PENDIENTE`, `COMPLETO`). | `DEFAULT 'PENDIENTE'`. El valor debe ser `PENDIENTE` o `COMPLETO`. | Controla la lógica de la UI para saber si se pueden seguir asignando recursos al evento del contrato. |
| `created_at` | `TIMESTAMP` | | Sello de tiempo de la creación del registro. | `DEFAULT now()` | Auditoría. |
| `created_by` | `INTEGER` | FK (`Personal.id`) | Usuario que creó el registro. | Apunta a `Personal.id`. | Auditoría. |
| `updated_at` | `TIMESTAMP` | | Sello de tiempo de la última modificación. | `DEFAULT now()` | Auditoría. |
| `updated_by` | `INTEGER` | FK (`Personal.id`) | Usuario que realizó la última modificación. | Apunta a `Personal.id`. | Auditoría. |

---
### Tabla: `Eventos_Contrato`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único del evento que materializa un contrato. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización a la que pertenece el evento, denormalizada para optimizar. | Debe ser un ID de organización válido. | Clave para RLS y trigger de conteo. 📈 **Contabilizado.** |
| `id_contrato` | `INTEGER` | FK (`Contratos.id`) | Referencia al contrato principal al que pertenece este evento. | Debe ser un ID de contrato existente y válido. | `ON DELETE CASCADE` es útil. |

---
### **Tabla: `Participaciones_Personal`**
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único de la participación. | > 0 | Permite que los servicios se vinculen a una participación única. |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización a la que pertenece la participación, denormalizada para optimizar. | Debe ser un ID de organización válido. | Clave para RLS y trigger de conteo. 📈 **Contabilizado.** |
| `id_evento_contrato` | `INTEGER` | FK (`Eventos_Contrato.id`) | El evento en el que participa el personal. | Debe ser válido. | Parte de un `UNIQUE` compuesto `(id_evento_contrato, id_personal_participante)`. |
| `id_personal_participante`| `INTEGER` | FK (`Personal.id`) | Miembro del personal que participa en el evento. | Debe ser válido. | Clave para agrupar todos los servicios de una persona en un evento. |
| `estado_asistencia`| `VARCHAR` | `ENUM` | Registra la puntualidad del empleado (`ASIGNADO`,`PUNTUAL`, `TARDANZA`, `AUSENTE`). | El valor debe pertenecer a la lista predefinida. | `DEFAULT 'ASIGNADO'`. |
| `hora_llegada` | `TIMESTAMP` | `NULL` | Hora exacta de llegada del empleado. | `NULL` si `estado_asistencia` = `AUSENTE`. | Usar `timestamptz`. |

---
### **Tabla: `Evento_Servicios_Asignados`**
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único de la asignación del servicio. | > 0 | Clave primaria para referenciar este registro en los pagos. |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización dueña del servicio asignado, denormalizada para optimizar. | Debe ser un ID de organización válido. | Clave para RLS y trigger de conteo. 📈 **Contabilizado.** |
| `id_participacion` | `INTEGER` | FK (`Participaciones_Personal.id`) | Referencia a la participación específica (persona + evento) a la que se asigna el servicio. | Debe ser un ID de participación válido. | **Vínculo clave.** Define quién hizo qué. |
| `id_servicio` | `INTEGER` | FK (`Servicios.id`) | Referencia al servicio del catálogo que fue ejecutado. | Debe ser un ID de servicio válido. | `UNIQUE` en `(id_participacion, id_servicio)` para no asignar el mismo servicio dos veces. |
| `monto_pactado` | `DECIMAL` | `NOT NULL` | Monto exacto que se pagará por este servicio. | El valor debe ser un número no negativo (`>= 0.00`). | 💵 **Precio "congelado".** Se copia el `monto_base` del servicio para preservar la integridad histórica. |
| `estado_pago` | `VARCHAR` | `ENUM` | Controla el ciclo de vida del pago (`PENDIENTE`, `EN_LOTE`, `PAGADO`, `ANULADO`). | Debe pertenecer a la lista predefinida. | `DEFAULT 'PENDIENTE'`. `EN_LOTE` es un estado intermedio. |

---
### Tabla: `Lotes_Pago`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PK | Identificador único del lote de pago consolidado. | El valor debe ser un entero positivo (`> 0`). | - |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización que emite este lote de pago. | Debe ser un ID de organización válido. | 📈 **Contabilizado.** |
| `id_personal` | `INTEGER` | FK (`Personal.id`) | Especifica al miembro del personal que recibirá este pago consolidado. | Debe ser un ID de personal existente y válido. | `NOT NULL`. |
| `id_personal_administrativo` | `INTEGER` | FK (`Personal.id`) | Usuario que crea y autoriza el lote de pago. | Debe ser un ID de personal con rol `Administrativo`. | Auditoría de quién autorizó el pago. |
| `monto_total` | `DECIMAL` | `NOT NULL` | Suma total de los montos de todos los servicios incluidos en el lote. | >= 0.00. | Campo desnormalizado para optimizar consultas y reportes de pago. |
| `fecha_pago` | `DATE` | `NOT NULL` | Fecha contable en la que se emitió el pago del lote. | Debe ser una fecha válida en formato `YYYY-MM-DD`. | - |
| `estado` | `VARCHAR` | `ENUM` | Ciclo de vida del lote (`PENDIENTE_APROBACION`, `PAGADO`, `RECLAMADO`, `FALLIDO`). | Debe pertenecer a la lista predefinida. | Un lote `PAGADO` debe ser inmutable. |
| `created_at` | `TIMESTAMP` | | Sello de tiempo de la creación del lote. | `DEFAULT now()` | Auditoría. |
| `created_by` | `INTEGER` | FK (`Personal.id`) | Coincide con `id_personal_administrativo`. | Apunta a `Personal.id`. | Auditoría. |

---
### Tabla: `Detalles_Lote_Pago`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización del lote, denormalizada para optimizar. | Debe ser un ID de organización válido. | Clave para RLS y trigger de conteo. 📈 **Contabilizado.** |
| `id_lote_pago` | `INTEGER` | PK, FK (`Lotes_Pago.id`) | Referencia al lote de pago principal. | Debe ser un ID de lote de pago existente. | `ON DELETE CASCADE`. |
| `id_evento_servicio_asignado`| `INTEGER` | PK, FK (`Evento_Servicios_Asignados.id`) | Referencia al servicio específico que se está pagando. | Debe ser un ID de servicio asignado válido. | ⛓️ **Tabla de unión crucial.** `PRIMARY KEY (id_lote_pago, id_evento_servicio_asignado)` garantiza que un servicio solo se pague una vez. |
| `monto_pagado` | `DECIMAL` | `NOT NULL` | Monto final que se pagó por el servicio, después de aplicar descuentos o anulaciones. | `CHECK (monto_pagado >= 0.00)`. | 🛡️ **Auditoría Clave.** Este es el valor real de la transacción, que puede diferir del `monto_pactado` original. |
| `estado_asistencia_registrado` | `VARCHAR` | `NULLABLE` | Copia del estado de asistencia (`PUNTUAL`, `TARDANZA`, `AUSENTE`) en el momento del pago. | - | Preserva el contexto del pago para auditorías futuras. |
| `descuento_aplicado_pct` | `DECIMAL` | `NULLABLE` | Porcentaje de descuento aplicado en caso de `TARDANZA`. | `CHECK (descuento_aplicado_pct >= 0 AND descuento_aplicado_pct <= 100)`. | Almacena el `%` exacto para total transparencia en el reporte. |
---
## Vistas de Base de Datos (Optimizaciones)

### Vista: `reporte_participacion_flat`
Esta vista se creó para aplanar la estructura de datos compleja relacionada con la participación del personal en los eventos. Simplifica las consultas para los reportes, evitando errores de ordenamiento en relaciones anidadas y mejorando el rendimiento.

| Columna | Tipo de Dato | Descripción Detallada |
| :--- | :--- | :--- |
| `id_personal_participante` | `INTEGER` | ID del miembro del personal que participa. |
| `estado_asistencia` | `VARCHAR` | El estado de asistencia registrado (`PUNTUAL`, `TARDANZA`, etc.). |
| `id_contrato` | `INTEGER` | ID del contrato al que pertenece el evento. |
| `fecha_hora_evento` | `TIMESTAMP` | Fecha y hora del evento del contrato. |
| `id_organizacion` | `INTEGER` | ID de la organización a la que pertenece el registro. |
| `tipo_contrato_nombre` | `VARCHAR` | Nombre del tipo de contrato. |
| `servicio_nombre` | `VARCHAR` | Nombre del servicio realizado. |
| `monto_pactado` | `DECIMAL` | Monto que se acordó pagar por el servicio. |

---
## Modelo de Plataforma y Flujo de Trabajo (v2.0 - Autoservicio)

Este sistema está diseñado como una plataforma **SaaS (Software as a Service) multi-inquilino** con un modelo de autoservicio.

1.  **Registro y Creación de Organización (Autoservicio):**
    *   Cualquier usuario puede registrarse en la plataforma proporcionando su nombre, email, contraseña y el nombre de la nueva organización que desea crear.
    *   El sistema crea la `Organización`, el usuario en `auth.users`, y un registro de `Personal` asociado con el rol de `ADMINISTRATIVO`, todo en una única transacción segura a través de una Edge Function.
    *   Automáticamente, se crea un contador de uso (`Contadores_Uso`) para la nueva organización.

2.  **Roles y Administración:**
    *   **Super-Administrador:** Propietario de la plataforma con acceso a un panel global para supervisar todas las organizaciones, gestionar su estado (`ACTIVA`/`SUSPENDIDA`) y manejar los ciclos de facturación.
    *   **Administrador de Organización:** El usuario que crea la organización. Tiene control total sobre su propio inquilino: puede invitar y gestionar `Personal` con rol `OPERATIVO`, definir catálogos (`Tipos_Contrato`, `Servicios`), registrar `Contratos` y liquidar pagos. No tiene visibilidad de otras organizaciones.
    *   **Personal Operativo:** Usuarios invitados por un Administrador. Su acceso está limitado a las funciones operativas que se definan (ej. ver sus eventos asignados).

3.  **Facturación por Consumo:**
    *   El modelo de negocio se basa en "pago por consumo". El sistema contabiliza cada nuevo registro que una `Organización` crea en las tablas marcadas como "Contabilizadas".
    *   El Super-Administrador monitorea este consumo y puede cerrar ciclos de facturación, lo que reinicia el contador de la organización y archiva la transacción.

---

## Historias de Usuario v11.0 (Modelo de Autoservicio)

---

## 🔑 Épica 0: Administración de la Plataforma (SaaS)

*   **HU-00A: Acceso del Super-Administrador**
    *   **Como** Super-Administrador de la plataforma
    *   **Quiero** tener un método de inicio de sesión seguro y diferenciado
    *   **Para** acceder al panel de control global de la plataforma.

*   **HU-00B: Gestión de Organizaciones Cliente**
    *   **Como** Super-Administrador
    *   **Quiero** ver una lista de todas las `Organizaciones` registradas, su estado (`ACTIVA` / `SUSPENDIDA`) y su `conteo_registros_nuevos` no facturados.
    *   **También quiero** poder cambiar el estado de una organización para suspender o reactivar su acceso a la plataforma.
    *   **Para** administrar el ciclo de vida de mis clientes y monitorizar su consumo para la facturación.

*   **HU-00C: Gestión del Ciclo de Facturación**
    *   **Como** Super-Administrador
    *   **Quiero** poder seleccionar una organización y ejecutar una acción para "Cerrar Ciclo de Pago".
    *   **Para** que el sistema guarde un registro permanente en el `Historial_Facturacion` con la cantidad de registros que estoy cobrando y, acto seguido, reinicie a cero el `conteo_registros_nuevos` de esa organización para el siguiente período.

---

## Épica 1: Gestión de Acceso y Autenticación (Actualizada)

*   **HU-01A: Registro de Nuevos Usuarios y Organizaciones (Autoservicio)**
    *   **Como** un visitante no registrado
    *   **Quiero** poder ir a una página de "Registro" e ingresar mi nombre, el nombre de mi organización, mi email y una contraseña.
    *   **Para** crear una nueva cuenta de organización y convertirme en su primer usuario Administrador.

*   **HU-01B: Inicio de Sesión de Usuario**
    *   **Como** un usuario registrado
    *   **Quiero** ingresar al sistema proporcionando mi correo electrónico y contraseña
    *   **Para** acceder a las funcionalidades correspondientes a mi rol, siempre y cuando mi organización se encuentre `ACTIVA`.

---

## Épica 2: Gestión de Recursos de la Organización

*   **HU-02: Gestión del Personal (Actualizada)**
    *   **Como** usuario Administrador
    *   **Quiero** poder crear un nuevo registro de `Personal`, asignarle un nombre y el rol de `OPERATIVO`.
    *   **También quiero** poder cambiar el estado de un personal existente a `es_activo = false` (dar de baja).
    *   **Para** mantener un registro actualizado del personal (no administrativo) que labora en mi organización.
* **HU-03: Gestión de Contratadores (Clientes)**
    * **Como** usuario Administrador
    * **Quiero** poder registrar un nuevo `Contratador` con su tipo y número de documento, y nombre.
    * **También quiero** poder buscar un contratador existente y cambiar su estado entre `activo` e `inactivo`.
    * **Para** gestionar la cartera de clientes de mi organización.

* **HU-04: Gestión de Catálogo de Tipos de Contrato**
    * **Como** usuario Administrador
    * **Quiero** poder crear y nombrar un nuevo `TipoContrato` y especificar su `ingreso_base` (el monto que la organización cobra).
    * **También quiero** poder desactivar (`es_activo = false`) un tipo de contrato para que no pueda ser usado en nuevos contratos.
    * **Para** definir y gestionar la oferta comercial de la organización.

* **HU-05: Gestión de Catálogo de Servicios**
    * **Como** usuario Administrador
    * **Quiero** poder crear y nombrar un nuevo `Servicio` y especificar su `monto_base` (el pago estándar para el personal).
    * **También quiero** poder desactivar un servicio para que no pueda ser asignado en futuros eventos.
    * **Para** definir las tareas remuneradas que el personal puede ejecutar.

---

## Épica 3: Flujo de Trabajo de Contratos y Eventos

* **HU-06: Registro de un Contrato (Actualizada)**
    * **Como** usuario Administrador
    * **Quiero** registrar un nuevo `Contrato`, seleccionando un `Contratador` activo, un `TipoContrato` activo, y especificando la `fecha_hora_evento`.
    * **Para** que el sistema contabilice esta nueva creación (y todas las demás), incrementando el `conteo_registros_nuevos` de mi organización, y guarde el acuerdo digital donde mi usuario (`id_personal_administrativo`) quede como responsable.

* **HU-07: Asignación de Personal a un Evento**
    * **Como** usuario Administrador
    * **Quiero**, dentro de la vista de un `EventoContrato`, poder asignar a uno o varios miembros del `Personal` (con rol `Operativo` y activos).
    * **Para** crear un registro de `ParticipacionPersonal` por cada uno, con un estado inicial de asistencia "ASIGNADO".

* **HU-08: Asignación de Servicios a un Participante**
    * **Como** usuario Administrador
    * **Quiero**, para un personal que ya participa en un evento, poder asignarle uno o más `Servicios` de mi catálogo.
    * **Para** crear un registro en `EventoServicioAsignado` por cada servicio, "congelando" el `monto_pactado` en ese momento.

* **HU-09: Registro de Asistencia del Personal**
    * **Como** usuario Administrador
    * **Quiero**, en la vista del evento, poder actualizar el `estado_asistencia` de cada participante a "PUNTUAL", "TARDANZA" o "AUSENTE".
    * **Si** marco "PUNTUAL" o "TARDANZA", quiero poder registrar la `hora_llegada`.
    * **Para** llevar un control del desempeño del personal en cada evento.

---

## Épica 4: Módulo de Pagos

* **HU-10: Visualización de Pagos Pendientes**
    * **Como** usuario Administrador
    * **Quiero** tener una vista que me muestre todos los `EventoServicioAsignado` con `estado_pago = 'PENDIENTE'`, agrupados por cada miembro del `Personal`.
    * **Para** identificar rápidamente todas las deudas con el personal.

* **HU-11: Creación y Liquidación de Lotes de Pago**
    * **Como** usuario Administrador
    * **Quiero** poder seleccionar a un miembro del personal, ver todos sus pagos pendientes, elegir cuáles incluir y agruparlos para crear un `LotePago`.
    * **Al** confirmar el lote, el sistema debe calcular el `monto_total`, registrar la `fecha_pago` y cambiar el `estado_pago` de los servicios incluidos a "PAGADO".
    * **Para** liquidar las deudas con el personal de forma ordenada y transaccional.

---

## Épica 5: Reportes y Analítica

* **HU-12: Reporte de Pagos Históricos por Personal**
    * **Como** usuario Administrador
    * **Quiero** poder seleccionar un miembro del `Personal` y un rango de fechas.
    * **Para** ver un reporte detallado de todos los `Lotes_Pago` que ha recibido en ese período, incluyendo los servicios que contenía cada lote.

* **HU-13: Reporte de Participación por Personal**
    * **Como** usuario Administrador
    * **Quiero** poder seleccionar un miembro del `Personal` y un rango de fechas.
    * **Para** ver un listado de todos los `Contratos` en los que ha participado, los servicios que ha realizado y su historial de asistencia (`PUNTUAL`, `TARDANZA`, `AUSENTE`).

* **HU-14: Reporte de Rentabilidad por Tipo de Contrato**
    * **Como** usuario Administrador
    * **Quiero** poder seleccionar uno o varios `TiposContrato` y un rango de fechas.
    * **Para** que el sistema me muestre un reporte que calcule:
        1.  **Ingreso Total:** Suma de `ingreso_base` de todos los contratos de ese tipo.
        2.  **Costo Total:** Suma de `monto_pactado` de todos los servicios pagados al personal en esos contratos.
        3.  **Ingreso Neto:** (Ingreso Total - Costo Total).

* **HU-15: Exportación de Reportes a Excel**
    * **Como** usuario Administrador
    * **Quiero** que cada uno de los reportes (Pagos Históricos, Participación por Personal y Rentabilidad) tenga una opción visible para "Exportar a Excel".
    * **Para** poder descargar los datos del reporte en un formato de hoja de cálculo que pueda guardar, imprimir o analizar fuera de la aplicación.

---

# Decisiones Arquitectónicas y Especificaciones Técnicas (v1.0)

## 1. Stack Tecnológico General
El stack se eligió para maximizar la productividad del desarrollador, la escalabilidad y la seguridad, aprovechando un ecosistema moderno y bien integrado.
*   **Frontend:** **Next.js** con App Router (React).
*   **Backend & Base de Datos:** **Supabase** (PostgreSQL gestionado, Autenticación, Edge Functions).
*   **Estilos:** **Tailwind CSS**.
*   **Despliegue:** **Vercel** para el frontend y **Supabase Cloud** para el backend.

---
# Bitácora de Implementación (v1.0)

Esta sección documenta las funcionalidades implementadas y las decisiones técnicas clave tomadas durante el desarrollo.

### 1. **Autenticación y Registro de Autoservicio (HU-01A, HU-01B)**
*   **Funcionalidad:** Se ha implementado un flujo completo de registro e inicio de sesión.
    *   Una página de bienvenida (`/`) dirige a los usuarios a las páginas de registro o inicio de sesión.
    *   La página de registro (`/auth/register`) permite a un nuevo usuario crear una `Organización` y su propia cuenta de `Administrador`.
    *   La página de inicio de sesión (`/auth/login`) autentica a los usuarios existentes.
    *   El layout del dashboard (`/dashboard`) está protegido y solo es accesible para usuarios autenticados.
*   **Decisiones de Implementación:**
    *   **Esquema de Base de Datos:** Se ejecutó una migración inicial para crear todas las tablas del proyecto según el diccionario de datos.
    *   **Lógica de Registro Transaccional:** La creación de la `Organización`, el usuario en `auth.users` y el registro de `Personal` se encapsuló en una única **Supabase Edge Function (`sign-up`)**. Esto garantiza la atomicidad de la operación: si un paso falla, los pasos anteriores se revierten para evitar datos inconsistentes.
    *   **Contadores de Uso Automatizados:** Se implementó un **trigger de PostgreSQL (`on_organizacion_created`)** que se dispara después de crear una nueva `Organización`. Este trigger inserta automáticamente la fila correspondiente en la tabla `Contadores_Uso`, inicializando el contador de consumo en cero.
    *   **Manejo de CORS:** Se configuraron las cabeceras CORS directamente en la Edge Function `sign-up` para permitir las solicitudes desde el dominio de la aplicación frontend (`localhost` en desarrollo), resolviendo los errores de seguridad del navegador.
    *   **Invocación de Funciones Segura:** Se reemplazó el uso de `fetch` genérico por `supabase.functions.invoke()` en el frontend. Este método gestiona automáticamente la autenticación (adjuntando la `anon key`) y la URL correcta, simplificando el código y mejorando la seguridad.

### 2. **Gestión de Personal (HU-02)**
*   **Funcionalidad:** Se ha implementado la página de gestión de personal en `/dashboard/personal`.
    *   Los administradores pueden ver una lista de todo el personal perteneciente a su organización.
    *   Un formulario permite a los administradores añadir nuevos miembros de personal con el rol de `OPERATIVO`.
*   **Decisiones de Implementación:**
    *   **Aislamiento de Datos (Multi-tenancy):** Las consultas a la base de datos se diseñaron para ser seguras a nivel de inquilino. La página primero identifica la `id_organizacion` del administrador autenticado y luego filtra la lista de personal para mostrar únicamente los registros que pertenecen a esa organización.
    *   **Actualización de UI en Tiempo Real:** Después de añadir un nuevo miembro de personal, el estado local de React se actualiza inmediatamente, mostrando el nuevo registro en la tabla sin necesidad de recargar la página, lo que proporciona una experiencia de usuario fluida.

### 3. **Rediseño de la Interfaz de Usuario (UI/UX)**
*   **Funcionalidad:** Se ha rediseñado completamente la interfaz de la aplicación para ofrecer una experiencia de usuario moderna, atractiva y coherente.
    *   Se implementó un **tema oscuro** (`dark mode`) en toda la aplicación para reducir la fatiga visual y mejorar la estética.
    *   Se actualizó la **página de inicio (`/`)** con un diseño más impactante y profesional.
    *   Se rediseñaron las **páginas de autenticación (`/auth/login` y `/auth/register`)** con un estilo moderno, formularios claros y mejor retroalimentación para el usuario.
    *   El **Dashboard (`/dashboard`)** ahora presenta un layout profesional con una barra lateral (`Sidebar`) con iconos, una cabecera (`Header`) con un menú de usuario y tarjetas de estadísticas (`StatCard`) para una visualización rápida de la información clave.
    *   La página de **Gestión de Personal (`/dashboard/personal`)** fue rediseñada, mejorando la presentación de la tabla de datos y el formulario para añadir nuevo personal, todo integrado con el nuevo tema oscuro.
*   **Decisiones de Implementación:**
    *   **Habilitación del Modo Oscuro:** Se configuró Tailwind CSS para usar la estrategia de clase (`darkMode: 'class'`) y se aplicó la clase `dark` al elemento `<html>` en el layout principal para activar el tema oscuro de forma global.
    *   **Componentización:** Se refactorizaron las páginas para usar componentes reutilizables (ej. `AddPersonalForm`, `PersonalTable`, `StatCard`), mejorando la legibilidad y el mantenimiento del código.
    *   **Estilos con Tailwind CSS:** Se utilizaron clases de Tailwind CSS para implementar el diseño, asegurando consistencia en colores, espaciado, tipografía y sombras en toda la aplicación.
    *   **Manejo de Estado de UI:** Se mejoró el manejo del estado en los componentes de React para ofrecer una experiencia más fluida, incluyendo estados de carga (`loading`) y retroalimentación de errores.
    *   **Corrección de Errores:** Se solucionó un error en la consulta de la página de personal que impedía ordenar los registros correctamente.

### 4. **Gestión de Contratadores (HU-03)**
*   **Funcionalidad:** Se ha implementado la página de gestión de contratadores en `/dashboard/contratadores`.
    *   Los administradores pueden ver una lista de todos los contratadores de su organización.
    *   Un formulario permite añadir nuevos contratadores, especificando su nombre, tipo y número de documento.
    *   Se ha añadido la funcionalidad para activar o desactivar un contratador, cambiando su estado `es_activo`.
*   **Decisiones de Implementación:**
    *   **Componentes Reutilizables:** Se crearon componentes para el formulario (`AddContratadorForm`) y la tabla (`ContratadoresTable`), siguiendo el patrón de diseño de la página de personal.
    *   **Lógica de Negocio:** Las funciones para crear y actualizar contratadores se implementaron de forma segura, asegurando que cada operación esté vinculada a la organización del administrador.
    *   **Consistencia de la Interfaz:** La página sigue el mismo diseño de tema oscuro y la misma estructura que las demás secciones de la aplicación.

### 5. **Gestión de Catálogos (Tipos de Contrato y Servicios) (HU-04, HU-05)**
*   **Funcionalidad:** Se implementaron las páginas de gestión para `Tipos de Contrato` (`/dashboard/tipos-contrato`) y `Servicios` (`/dashboard/servicios`).
    *   Ambas páginas permiten a los administradores listar, crear, activar y desactivar los respectivos registros de su organización.
*   **Decisiones de Implementación:**
    *   **Reutilización de Código:** Se adaptó la estructura y lógica de la página de "Contratadores" para acelerar el desarrollo y mantener una experiencia de usuario coherente en todos los módulos de gestión de catálogos.
    *   **Mejora de Iconografía:** Se instaló la librería `react-icons` y se actualizaron los íconos de la barra de navegación lateral (`Sidebar`) para reemplazar los emojis por íconos vectoriales (Fi-icons), mejorando la estética profesional de la aplicación.

### 6. **Registro de Contratos y Creación de Eventos (HU-06)**
*   **Funcionalidad:** Se implementó la página de `Gestión de Contratos` (`/dashboard/contratos`).
    *   Permite a los administradores registrar un nuevo contrato seleccionando un cliente y un tipo de contrato de listas desplegables pobladas con datos activos.
    *   Al crear un contrato, el sistema ahora también crea automáticamente un registro vinculado en la tabla `Eventos_Contrato`.
*   **Decisiones de Implementación:**
    *   **Lógica Transaccional en Frontend:** La creación del contrato y del evento se realiza en secuencia. Se incluyó un manejo de error para intentar deshacer la creación del contrato si la del evento falla, evitando datos huérfanos.
    *   **Resolución de Ambigüedad en Consultas:** Se corrigió un error en las consultas de Supabase especificando la clave foránea a usar (`Personal!id_personal_administrativo(nombre)`), ya que existían múltiples relaciones entre `Contratos` y `Personal`, lo que causaba un error de ambigüedad.

### 7. **Asignación de Personal a Eventos (HU-07)**
*   **Funcionalidad:** Se creó la página de detalle de un contrato (`/dashboard/contratos/[id]`), accesible al hacer clic en cualquier contrato de la lista.
    *   En esta página, los administradores pueden ver los detalles del contrato y asignar personal operativo (activo) al evento correspondiente.
*   **Decisiones de Implementación:**
    *   **Rutas Dinámicas:** Se utilizó el App Router de Next.js para crear la página de detalle con una ruta dinámica basada en el ID del contrato.
    *   **Lógica de "Reparación Automática":** Se implementó una mejora clave en la carga de datos. Si la página detecta que un contrato (especialmente uno antiguo) no tiene un evento asociado, lo crea automáticamente en ese momento. Esto asegura la integridad de los datos y evita errores con contratos creados antes de la HU-06.

### 8. **Asignación de Servicios a Participantes (HU-08)**
*   **Funcionalidad:** En la misma página de detalle del contrato (`/dashboard/contratos/[id]`), se añadió la capacidad de gestionar los servicios para cada participante.
    *   Se muestra una lista de los servicios ya asignados a cada miembro del personal.
    *   Un botón "Asignar Servicio" abre un modal que permite seleccionar un servicio del catálogo activo de la organización.
*   **Decisiones de Implementación:**
    *   **Componente Modal Reutilizable:** Se creó un componente `AsignarServicioModal` para manejar la selección y asignación de servicios, mejorando la experiencia de usuario al no requerir una recarga de la página.
    *   **"Congelación" de Precios:** Al asignar un servicio, la lógica copia el `monto_base` del catálogo de `Servicios` y lo guarda en la columna `monto_pactado` de la tabla `Evento_Servicios_Asignados`. Esto asegura que el pago sea el acordado en ese momento, incluso si el precio base del servicio cambia en el futuro.
    *   **Actualización Optimista de la UI:** Después de asignar un servicio, el estado de React se actualiza localmente de forma inmediata para mostrar el nuevo servicio en la lista, proporcionando una respuesta visual instantánea al administrador.
### 9. **Registro de Asistencia y Cierre de Contrato (HU-09)**
*   **Funcionalidad:** Se ha implementado la funcionalidad para gestionar la asistencia del personal y el ciclo de vida final de un contrato en la página de detalle (`/dashboard/contratos/[id]`).
    *   Los administradores pueden ahora cambiar el estado de asistencia de cada participante (`ASIGNADO`, `PUNTUAL`, `TARDANZA`, `AUSENTE`) a través de un menú desplegable.
    *   Al marcar la asistencia como `PUNTUAL` o `TARDANZA`, el sistema registra automáticamente la hora de llegada.
    *   Se ha añadido un botón para "Cerrar Contrato", que cambia su estado a `COMPLETADO`.
    *   Una vez que un contrato está `COMPLETADO`, todos los controles de la página (asignar personal, asignar servicios, cambiar asistencia) se deshabilitan para garantizar que el registro sea inmutable.
    *   Se ha añadido un botón de navegación para "Volver a Contratos", mejorando el flujo de usuario.
*   **Decisiones de Implementación:**
    *   **Manejo de Estado Inmutable:** La lógica de la interfaz de usuario se ha actualizado para deshabilitar los elementos de entrada (`<select>`, `<button>`) basándose en el estado del contrato (`contrato.estado === 'COMPLETADO'`), aplicando estilos visuales para indicar que los controles no están activos.
    *   **Confirmación de Acciones Críticas:** La acción de cerrar un contrato requiere una confirmación del usuario (`window.confirm`) para prevenir cambios accidentales e irreversibles.
    *   **Mejora de la Navegación:** Se utilizó el componente `Link` de Next.js para crear un enlace de "Volver" eficiente que no requiere una recarga completa de la página, mejorando la experiencia de navegación.
    *   **Actualización de UI en Tiempo Real:** Tanto el cambio de estado de asistencia como el cierre del contrato actualizan el estado de React localmente, proporcionando una retroalimentación visual inmediata al administrador sin necesidad de recargar la página.
    *   **Eliminación Segura de Contratos:** Se añadió la capacidad de eliminar un contrato, siempre que no esté en estado `COMPLETADO`. Para prevenir la eliminación accidental, la acción requiere que el usuario escriba la palabra "eliminar" en un cuadro de diálogo de confirmación. La eliminación se propaga en cascada en la base de datos gracias a las restricciones `ON DELETE CASCADE`, asegurando la integridad de los datos.

*   **Mejora de Usabilidad: Confirmación Manual de Asignaciones**
    *   **Funcionalidad:** Se ha añadido un flujo de trabajo para que el administrador confirme explícitamente que ha finalizado la asignación de personal y servicios a un contrato.
        *   La tabla principal de contratos (`/dashboard/contratos`) ahora muestra un indicador visual para los contratos cuyas asignaciones están `PENDIENTE` (fondo amarillo claro), permitiendo al administrador identificar rápidamente qué contratos requieren su atención.
        *   En la página de detalle del contrato (`/dashboard/contratos/[id]`), se ha añadido un botón "Confirmar Asignaciones".
        *   Este botón solo es visible si el estado de asignación del contrato es `PENDIENTE` y el contrato general no está `COMPLETADO`.
        *   Al confirmar, el estado de asignación cambia a `COMPLETO`, y todos los controles para añadir más personal o servicios se deshabilitan, "sellando" la configuración del evento.
    *   **Decisiones de Implementación:**
        *   **Separación de Conceptos:** Se decidió añadir una nueva columna `estado_asignacion` a la tabla `Contratos` en lugar de sobrecargar la columna `estado` existente. Esto mantiene una clara separación entre el ciclo de vida del contrato (negocio) y su estado operativo interno (asignaciones), evitando lógica compleja y confusa.
        *   **Control del Usuario:** Se optó por un botón de confirmación manual en lugar de una detección automática. Este enfoque es más robusto, evita errores de lógica complejos y le da al administrador un control total y explícito sobre el proceso.
        *   **Feedback Visual Claro:** El uso de colores en la tabla principal y la aparición/desaparición contextual del botón de confirmación proporcionan una guía visual intuitiva para el usuario.
        *   **Inmutabilidad Post-Confirmación:** Deshabilitar los controles de asignación después de la confirmación asegura la integridad de los datos y previene cambios accidentales en una etapa posterior del flujo de trabajo.

### 10. **Visualización de Pagos Pendientes con Lógica de Negocio (HU-10)**
*   **Funcionalidad:** Se ha implementado la página de `Pagos Pendientes` (`/dashboard/pagos`), que constituye el primer paso del módulo de liquidación de deudas con el personal.
    *   La página muestra una lista de todo el personal que tiene servicios pendientes de pago, agrupados individualmente.
    *   Solo se consideran los servicios pertenecientes a contratos que ya han sido marcados como `COMPLETADO`.
    *   Se implementaron reglas de negocio clave para el cálculo de los montos a pagar:
        *   **Ausencia:** Si un participante fue marcado como `AUSENTE` en un evento, el monto a pagar por sus servicios en ese evento es automáticamente `0`.
        *   **Tardanza:** Si un participante fue marcado con `TARDANZA`, la UI muestra un campo de entrada que permite al administrador aplicar un descuento en porcentaje. El total a pagar se actualiza dinámicamente.
        *   **Puntual:** Se muestra el monto completo acordado.
    *   Se añadió un enlace directo desde cada servicio listado a su respectiva página de detalle de contrato para facilitar la consulta y verificación.
*   **Decisiones de Implementación:**
    *   **Patrón de Componente de Cliente:** La página se construyó como un componente de cliente (`'use client'`), siguiendo el patrón establecido en el resto de la aplicación para garantizar la coherencia y evitar conflictos de renderizado.
    *   **Consulta de BD Específica:** La consulta a Supabase se optimizó para traer solo los datos necesarios, filtrando por `contrato.estado = 'COMPLETADO'` e incluyendo el `estado_asistencia` del participante, que es crucial para la lógica de negocio.
    *   **Manejo de Estado en la UI:** Se utilizó el estado de React (`useState`) para gestionar los descuentos introducidos por el usuario, permitiendo que los cálculos del total a pagar por persona se realicen y reflejen en la interfaz en tiempo real sin necesidad de recargar la página.
    *   **Usabilidad Mejorada:** Se reemplazaron los simples IDs de contrato por enlaces directos y se añadieron indicadores visuales (colores y texto) para el estado de asistencia, mejorando la claridad y la experiencia del administrador. Se incorporaron columnas adicionales como "Tipo de Contrato" y "Fecha Contrato" (con hora) para dar más contexto, y se corrigió la moneda a Soles (S/) en toda la vista.

### 11. **Creación y Liquidación de Lotes de Pago (HU-11)**
*   **Funcionalidad:** Se ha implementado el flujo completo para la liquidación de pagos en la página `/dashboard/pagos`.
    *   Los administradores ahora pueden seleccionar servicios específicos para pagar usando casillas de verificación (checkboxes) individuales.
    *   Se añadió una opción de "Seleccionar Todo" por cada miembro del personal para agilizar la selección masiva de servicios.
    *   El total a pagar se calcula y actualiza en tiempo real en la interfaz a medida que se seleccionan los servicios.
    *   El botón "Crear Lote de Pago" se activa solo cuando hay al menos un servicio seleccionado y muestra la cantidad de servicios que se incluirán.
    *   Al confirmar la creación del lote, el sistema ejecuta una transacción que:
        1.  Crea un registro en la tabla `Lotes_Pago` con el monto total calculado.
        2.  Crea los registros correspondientes en `Detalles_Lote_Pago` para vincular cada servicio pagado.
        3.  Actualiza el `estado_pago` de los servicios incluidos a `PAGADO`.
    *   La lista de pagos pendientes se actualiza automáticamente después de la liquidación, eliminando los servicios que ya fueron pagados.
*   **Decisiones de Implementación:**
    *   **Manejo de Estado Complejo:** Se utilizó el estado de React (`useState`) para gestionar la selección de servicios (`selectedServices`) por cada miembro del personal, permitiendo una interfaz interactiva y responsiva.
    *   **Lógica Transaccional del Lado del Cliente:** El proceso de creación del lote, los detalles y la actualización de los servicios se maneja como una serie de operaciones asíncronas. Aunque no es una transacción de base de datos atómica nativa, se incluyó manejo de errores en cada paso para alertar al usuario si alguna parte del proceso falla.
    *   **Feedback al Usuario:** Se implementaron estados de carga (`pagando`) para deshabilitar el botón de pago durante el procesamiento y evitar clics duplicados. Se usan alertas de confirmación (`window.confirm`) para acciones críticas e irreversibles, y notificaciones (`alert`) para comunicar el éxito o el fracaso de la operación.
    *   **Mejora de Usabilidad (Filtro):** Se añadió una barra de búsqueda para filtrar al personal por nombre, mejorando drásticamente la usabilidad en organizaciones con una gran cantidad de empleados.
    *   **Corrección de Visualización de Fecha:** Se corrigió un error visual para mostrar la `fecha_hora_evento` del contrato en lugar de la fecha de creación, proporcionando información más relevante al administrador.

### 12. **Reporte de Pagos Históricos por Personal (HU-12)**
*   **Funcionalidad:** Se ha implementado el reporte de pagos históricos, accesible desde una nueva sección "Reportes" en el menú principal.
    *   La página (`/dashboard/reportes/pagos-personal`) permite a los administradores filtrar por miembro del personal y un rango de fechas.
    *   Al generar el reporte, se muestra una lista de todos los lotes de pago emitidos para esa persona en el período seleccionado.
    *   Cada lote de pago detalla los servicios individuales que se incluyeron, el monto exacto que se pagó por cada uno y una columna de "Observaciones" que clarifica el estado de asistencia (`PUNTUAL`, `TARDANZA`, `AUSENTE`) y el descuento aplicado si lo hubo.
*   **Decisiones de Implementación:**
    *   **Navegación Centralizada:** Se creó una página principal de reportes (`/dashboard/reportes`) para servir como un hub central para todos los futuros reportes, mejorando la organización y escalabilidad del módulo.
    *   **Mejora de la Integridad de Datos (Auditoría):** Se tomó la decisión crítica de modificar la estructura de la base de datos para garantizar la precisión contable. Se añadieron las columnas `monto_pagado`, `estado_asistencia_registrado` y `descuento_aplicado_pct` a la tabla `Detalles_Lote_Pago`. Esto asegura que cada transacción de pago se registre con todos los detalles relevantes en el momento exacto de la liquidación, haciendo los reportes históricos 100% fiables e inmunes a cambios futuros en los datos de origen (como el estado de asistencia o los montos base de los servicios).
    *   **Corrección de Errores en Cascada:** La implementación inicial del reporte reveló una discrepancia en los montos. Esto llevó a la refactorización de la lógica de creación de lotes de pago para que almacenara los montos finales calculados y los detalles de asistencia, y posteriormente se actualizó el componente del reporte para que leyera y mostrara esta nueva información precisa.
        *   **Experiencia de Usuario en Reportes:** La interfaz del reporte se diseñó para ser clara y funcional, con filtros fáciles de usar y una presentación de datos que prioriza la legibilidad y la información clave para la auditoría de pagos.

### 13. **Reporte de Participación y Resumen de Asistencia (HU-13)**
*   **Funcionalidad:** Se ha implementado el reporte de participación del personal, accesible desde la página principal de reportes.
    *   La página (`/dashboard/reportes/participacion-personal`) permite filtrar por miembro del personal y un rango de fechas.
    *   Muestra un listado de todos los contratos en los que ha participado el empleado, detallando los servicios específicos que realizó en cada uno.
    *   Se añadió una sección de **resumen de asistencia** en la parte superior del reporte, que muestra un conteo total de las participaciones `PUNTUALES`, con `TARDANZA` y `AUSENTES` para el período seleccionado, ofreciendo una visión rápida del rendimiento.
*   **Decisiones de Implementación:**
    *   **Creación de Vista en BD para Fiabilidad:** Durante la implementación, se encontró un error que impedía ordenar los resultados por la fecha del evento debido a la complejidad de las relaciones. Para solucionarlo de raíz, se creó una **vista de PostgreSQL (`reporte_participacion_flat`)** mediante una migración. Esta vista pre-une las tablas necesarias, simplificando drásticamente la consulta en el frontend, eliminando el error y mejorando el rendimiento.
    *   **Cálculo de Resumen en Frontend:** El resumen de asistencias se calcula dinámicamente en el lado del cliente después de recibir los datos de la consulta, lo que mantiene la lógica de la interfaz contenida en el componente.
    *   **Consistencia de la Interfaz:** Se siguió el diseño y la estructura del reporte de pagos existente para mantener una experiencia de usuario coherente en todo el módulo de reportes.

### 14. **Restauración y Mejora de la Gestión de Pagos**
*   **Funcionalidad:** Se restauró la vista de pagos pendientes y se mejoró la navegación y visualización de los lotes de pago.
    *   La página `/dashboard/pagos` ahora muestra la lista de servicios pendientes de pago, agrupados por personal.
    *   Se creó una nueva pestaña "Gestionar Lotes" (`/dashboard/pagos/gestion`) para visualizar los lotes de pago creados, incluyendo los pendientes de aprobación y los reclamados.
    *   Se actualizó la navegación en `/dashboard/pagos/layout.tsx` para incluir pestañas claras entre "Pagos Pendientes" y "Gestionar Lotes".
*   **Decisiones de Implementación:**
    *   **Clarificación de Navegación:** Se renombró la etiqueta de navegación de "Crear Lote de Pago" a "Pagos Pendientes" en el layout de pagos para mayor claridad.
    *   **Resolución de Ambigüedad en Consultas:** Se corrigió un error de Supabase en `app/dashboard/pagos/gestion/page.tsx` que impedía la correcta visualización de los lotes. El error "Could not embed because more than one relationship was found" se resolvió especificando explícitamente la clave foránea en la consulta (`Personal!Lotes_Pago_id_personal_fkey(id, nombre)`), asegurando que la relación correcta entre `Lotes_Pago` y `Personal` fuera utilizada.

### 15. **Reporte de Rentabilidad con Desglose Detallado (HU-14)**
*   **Funcionalidad:** Se implementó el reporte de rentabilidad, accesible desde `/dashboard/reportes/rentabilidad-contrato`.
    *   Permite a los administradores filtrar por uno o varios `Tipos de Contrato` y un rango de fechas.
    *   Calcula y muestra tarjetas de resumen con **Ingreso Total**, **Costo Total** e **Ingreso Neto** para cada tipo de contrato seleccionado.
    *   Se añadió una funcionalidad de **desglose detallado**: cada tarjeta de resumen tiene un botón para mostrar/ocultar dos tablas con los datos de origen.
        *   **Desglose de Ingresos:** Muestra cada contrato individual que contribuye al ingreso, con el nombre del contratador, la fecha y hora del evento, y un enlace directo a la página de ese contrato.
        *   **Desglose de Costos:** Muestra cada servicio pagado que contribuye al costo, con el nombre del personal que lo realizó, el nombre del servicio, la fecha y hora del evento, y un enlace al contrato correspondiente.
    *   Los datos en las tablas de desglose están ordenados cronológicamente por la fecha del evento para facilitar el análisis.
*   **Decisiones de Implementación:**
    *   **Consultas Enriquecidas:** Se ajustaron las consultas a la base de datos para traer no solo los montos, sino también los datos relacionados necesarios para el desglose (nombres de contratadores, personal, servicios, etc.).
    *   **Agregación en el Frontend:** La lógica para agrupar los datos por tipo de contrato y calcular los totales y el ingreso neto se maneja en el lado del cliente, después de recibir la información de la base de datos.
    *   **UI Interactiva con Estado Local:** Se utilizó el estado de React (`useState`) para gestionar qué tarjeta de desglose está expandida, permitiendo una experiencia de usuario fluida sin recargar la página.

### 16. **Exportación de Reportes a Excel (HU-15)**
*   **Funcionalidad:** Se ha añadido un botón de "Exportar a Excel" en los tres reportes implementados (Pagos por Personal, Participación por Personal y Rentabilidad).
    *   Al hacer clic, se genera y descarga un archivo `.xlsx` con los datos actualmente visibles en el reporte.
    *   Para el reporte de rentabilidad, cada tipo de contrato se exporta a una **hoja de cálculo separada** dentro del mismo archivo, mejorando la organización y el análisis de los datos.
*   **Decisiones de Implementación:**
    *   **Librería `xlsx`:** Se instaló la librería `xlsx` para manejar la creación de los archivos de Excel. Esta es una solución robusta y estándar para la manipulación de hojas de cálculo en JavaScript.
    *   **Generación en el Cliente:** Toda la lógica de formateo de datos y generación de archivos se ejecuta directamente en el navegador del usuario (lado del cliente), evitando la necesidad de un backend para esta tarea.
    *   **Formateo de Datos:** Se implementó una lógica específica para cada reporte que transforma los datos desde la estructura de estado de React a un formato de array de objetos compatible con la librería `xlsx`, asegurando que las columnas y filas del Excel sean claras y legibles.


---

# Bitácora de Implementación (v1.2 - Flujo de Aprobación y Registro Robusto)

Esta sección documenta la implementación de un nuevo flujo de trabajo donde el personal debe aprobar los pagos y un sistema de registro de personal rediseñado para ser más seguro y funcional.

### 1. **Modificación del Flujo de Pagos (HU-11 Modificada)**
*   **Funcionalidad:** Se introdujo un flujo de aprobación para los lotes de pago, dando control al personal sobre la confirmación de sus ingresos.
    *   Los lotes de pago ahora se crean con un estado inicial de `PENDIENTE_APROBACION`.
    *   Los servicios incluidos en un lote se marcan como `EN_LOTE` para sacarlos de la lista de pendientes sin marcarlos prematuramente como pagados.
    *   Se creó una nueva página (`/dashboard/mis-pagos`) para que el personal con rol `OPERATIVO` pueda ver sus lotes pendientes.
    *   En esta página, el personal puede "Aceptar" (cambia el estado a `PAGADO`) o "Reclamar" (cambia el estado a `RECLAMADO`) un lote.
*   **Decisiones de Implementación:**
    *   **Ampliación de ENUMs:** Se modificaron los tipos `ENUM` en la base de datos para las columnas `Lotes_Pago.estado` y `Evento_Servicios_Asignados.estado_pago` para reflejar el nuevo ciclo de vida de los pagos.
    *   **Navegación por Roles:** Se actualizó el componente `Sidebar` para detectar el rol del usuario (`ADMINISTRATIVO` vs. `OPERATIVO`) y mostrar un menú de navegación diferente y adecuado para cada uno.

### 2. **Rediseño del Sistema de Registro de Personal (HU-02 Modificada)**
*   **Problema Inicial:** El sistema de invitación por correo electrónico a través de una Edge Function resultó problemático y difícil de depurar, presentando errores recurrentes de permisos y configuración (CORS, variables de entorno, etc.) que impedían su funcionamiento.
*   **Solución Implementada (Pivote Estratégico):** Se abandonó por completo el enfoque de la Edge Function en favor de un sistema de registro más robusto, seguro y controlable, basado en un enlace de invitación y un trigger de base de datos.
*   **Funcionalidad Final:**
    1.  **Generación de Enlace:** En la página de "Gestión de Personal", el administrador ahora hace clic en un botón "Generar Enlace" para el personal no registrado. Esto crea un enlace único y seguro a la página de registro de operativos.
    2.  **URL Parametrizada:** El enlace incluye el `id_organizacion` como un parámetro en la URL (ej. `/auth/register-operative?org_id=123`). El administrador copia y comparte este enlace con el empleado.
    3.  **Registro Dirigido:** El empleado accede a la página de registro, que lee el `id_organizacion` de la URL. Al registrarse, el sistema valida que su email pertenezca a un empleado de esa organización específica.
    4.  **Vinculación por Trigger de Base de Datos:** Se creó una función (`handle_new_user`) y un trigger (`on_auth_user_created`) directamente en la base de datos de Supabase. Este mecanismo se activa automáticamente cada vez que un nuevo usuario se registra con éxito. La función busca el email del nuevo usuario en la tabla `Personal` y vincula de forma atómica y segura el `id` del usuario de `auth` con el registro de `Personal`, resolviendo los problemas de permisos que bloqueaban la implementación anterior.
*   **Decisiones de Implementación Clave:**
    *   **Eliminación de la Edge Function:** Se descartó el uso de `supabase.functions.invoke('invite-user')` para eliminar un punto de fallo complejo y poco transparente.
    *   **Lógica en el Backend (Trigger):** Se movió la responsabilidad crítica de la vinculación de cuentas del frontend (propenso a errores de permisos) al backend de la base de datos. Esta es una práctica recomendada por ser más segura y transaccional.
    *   **Experiencia de Usuario Mejorada:** El flujo para el administrador y el empleado es ahora más claro. El admin comparte un enlace y el empleado se registra en una página diseñada específicamente para él, sin necesidad de manejar tokens de invitación complejos.

### 3. **Corrección de Constraints en Base de Datos**
*   **Problema:** Al crear un lote de pago, la aplicación fallaba con un error de `violates check constraint`. Esto se debía a que la lógica de la aplicación intentaba insertar nuevos estados (ej. `PENDIENTE_APROBACION`) que no estaban permitidos por las reglas (`CHECK`) de la base de datos.
*   **Proceso de Depuración:**
    1.  **Hipótesis Incorrecta (ENUMs):** Inicialmente, se asumió erróneamente que las columnas de estado usaban un tipo de dato `ENUM` de PostgreSQL. Los intentos de modificar un `ENUM` inexistente fallaron, lo que demostró que la hipótesis era incorrecta.
    2.  **Diagnóstico Correcto (Inspección de Esquema):** Se ejecutó una consulta `information_schema` para inspeccionar la estructura real de las tablas. Esta consulta reveló que las columnas de estado eran de tipo `VARCHAR` y estaban restringidas por `CHECK constraints`.
*   **Solución Implementada:**
    *   **Migración de Constraints:** Se ejecutó una migración de base de datos para `DROP` (eliminar) los `CHECK constraints` antiguos y `ADD` (añadir) unos nuevos y actualizados en las tablas `Lotes_Pago` y `Evento_Servicios_Asignados`. Los nuevos constraints ahora incluyen todos los valores de estado requeridos por el nuevo flujo de aprobación (`PENDIENTE_APROBACION`, `EN_LOTE`, etc.), solucionando el error de forma definitiva.

### 4. **Rediseño del Dashboard y Personalización de la Interfaz (Mejora de UX)**
*   **Funcionalidad:** Se ha rediseñado por completo la página principal del dashboard (`/dashboard`) para convertirla en un centro de mando personalizado y accionable, mejorando significativamente la experiencia del usuario administrador.
    *   **Personalización:** El título principal de la aplicación en la barra lateral ahora muestra dinámicamente el **nombre de la organización** del usuario. La etiqueta de navegación "Dashboard" se ha localizado a **"Resumen"** y se ha eliminado el título redundante de la cabecera para una interfaz más limpia y enfocada.
    *   **KPIs Accionables:** Se reemplazaron las métricas anteriores por cuatro nuevas tarjetas de estadísticas que responden a las preguntas clave del día a día y enlazan directamente a las secciones relevantes:
        1.  **Contratos por Confirmar:** Llama a la acción sobre eventos que requieren asignación final.
        2.  **Pagos Pend. Aprobación:** Muestra el estado de los pagos que esperan confirmación del personal.
        3.  **Contratos Completados:** Ofrece una vista rápida de la productividad reciente (últimos 30 días).
        4.  **Próximo Evento:** Informa sobre la tarea más inminente, mostrando detalles del cliente y la fecha.
*   **Decisiones de Implementación:**
    *   **Lógica Centralizada y Optimizada:** Toda la lógica para obtener los KPIs se centralizó en la página `/dashboard/page.tsx`. Se utilizan consultas paralelas (`Promise.all`) para cargar todos los datos de forma eficiente.
    *   **Creación de Vista en BD:** Para solucionar un error de consulta compleja (similar a uno anterior), se creó una nueva vista de base de datos (`dashboard_pagos_pendientes_flat`), demostrando un enfoque robusto y reutilizable para la obtención de datos aplanados.
    *   **Personalización del Sidebar:** Se modificó el componente `app/components/ui/sidebar.tsx` para que, al iniciar sesión, obtenga tanto el rol del usuario como el nombre de su organización, almacenándolos en el estado para personalizar la UI dinámicamente.
    *   **Componente Reutilizable:** Se diseñó un componente `DashboardCard` para las tarjetas de KPI, asegurando la consistencia visual y facilitando la adición de nuevas métricas en el futuro.

---

# Bitácora de Implementación (v1.3 - Módulo de Super-Admin y Roles Avanzados)

Esta sección documenta la implementación del panel de control para el Super-Administrador, la introducción de roles de personal con permisos diferenciados y la refactorización crítica del sistema de registro de usuarios para mejorar su robustez.

### 1. **Implementación del Panel de Super-Administrador (Épica 0)**
*   **Funcionalidad:** Se ha creado una nueva sección (`/super-admin`) dedicada exclusivamente al Super-Administrador de la plataforma.
    *   **Acceso Restringido:** El acceso a esta sección está protegido y solo se permite al usuario cuyo ID coincide con la variable de entorno `NEXT_PUBLIC_SUPER_ADMIN_ID`.
    *   **Gestión de Organizaciones (HU-00B):** La página principal del panel muestra una tabla con todas las organizaciones registradas, su estado (`ACTIVA`/`SUSPENDIDA`) y su consumo de registros actual.
    *   **Acciones de Gestión:** El Super-Administrador puede suspender o reactivar una organización directamente desde la tabla.
    *   **Gestión de Facturación (HU-00C):** Se implementó un botón para "Cerrar Ciclo de Pago". Esta acción crea un registro en `Historial_Facturacion` y reinicia el contador de consumo de la organización a cero.
*   **Decisiones de Implementación:**
    *   **Aislamiento por Ruta:** Se creó un layout y una página específicos en `app/super-admin`, manteniendo el código separado y seguro.
    *   **Lógica de Negocio en Frontend:** Las funciones para cambiar el estado y cerrar el ciclo de facturación se implementaron directamente en el componente de la página, con confirmaciones (`window.confirm`) para las acciones críticas.
    *   **Contador de Registros Automatizado:** Se implementó un sistema de triggers en la base de datos (`incrementar_contador_registros` y triggers asociados) para que el consumo de cada organización se actualice automáticamente con cada `INSERT` en las tablas contabilizadas.

### 2. **Introducción del Rol "Administrador de Apoyo"**
*   **Funcionalidad:** Se ha añadido un nuevo rol de personal con permisos restringidos para delegar tareas administrativas.
    *   **Nuevo Rol en BD:** Se actualizó la tabla `Personal` para aceptar el nuevo rol `ADMINISTRATIVO_APOYO`.
    *   **Creación en UI:** El formulario de creación de personal ahora incluye un selector para que el administrador principal pueda asignar este nuevo rol.
    *   **Acceso Restringido:** Los usuarios con este rol solo pueden ver las secciones de "Resumen", "Contratos", "Pagos" y "Reportes".
*   **Decisiones de Implementación:**
    *   **Modificación de `CHECK Constraint`:** Se realizó una migración de base de datos para actualizar el `CHECK constraint` de la columna `rol` y permitir el nuevo valor.
    *   **Navegación Condicional:** Se actualizó el componente `Sidebar` para que muestre un menú de navegación diferente y limitado para los usuarios con el rol `ADMINISTRATIVO_APOYO`.

### 3. **Refactorización Crítica del Registro de Personal**
*   **Problema:** El sistema de registro de personal, que originalmente dependía de un trigger de base de datos (`on_auth_user_created`), dejó de funcionar de forma intermitente y era imposible de depurar, impidiendo que los nuevos usuarios (tanto `OPERATIVO` como `ADMINISTRATIVO_APOYO`) pudieran vincular sus cuentas.
*   **Solución Implementada (Pivote a Frontend):** Se tomó la decisión estratégica de eliminar por completo el trigger de la base de datos y mover la lógica de vinculación al frontend para obtener mayor control, visibilidad de errores y robustez.
*   **Funcionalidad Final:**
    1.  **Eliminación del Trigger:** Se ejecutó una migración para eliminar la función `handle_new_user` y el trigger `on_auth_user_created` de la base de datos.
    2.  **Lógica en Frontend:** La página de registro de personal (`/auth/register-personal`) ahora se encarga del proceso completo:
        *   Primero, crea el usuario en `auth.users` mediante `supabase.auth.signUp()`.
        *   Si el registro es exitoso, obtiene el ID del nuevo usuario.
        *   Inmediatamente después, ejecuta una llamada `update` a la tabla `Personal` para guardar ese ID en la columna `supabase_user_id`, completando la vinculación de forma explícita.
    3.  **Generalización de la Ruta:** La ruta de registro se renombró de `/auth/register-operative` a `/auth/register-personal` para reflejar que ahora sirve para registrar a cualquier miembro del personal, independientemente de su rol.
*   **Decisiones de Implementación Clave:**
    *   **Priorización de la Robustez:** Se eligió un enfoque de frontend explícito sobre un trigger de backend implícito para garantizar la fiabilidad del flujo de registro, que es crítico para la aplicación.
    *   **Manejo de Errores Mejorado:** Al tener la lógica en el frontend, cualquier error en la vinculación ahora se puede capturar y mostrar al usuario directamente, evitando cuentas en estado inconsistente.

---

# Bitácora de Implementación (v1.4 - Mejoras de UX y Paginación)

Esta versión se centra en mejorar la experiencia de usuario para el rol `OPERATIVO` y en optimizar el rendimiento de la aplicación mediante la introducción de paginación en vistas con alta densidad de datos.

### 1. **Dashboard Personalizado para Operativos (HU-16)**
*   **Funcionalidad:** Se ha rediseñado la página de "Resumen" (`/dashboard`) para que sea sensible al rol del usuario.
    *   **Vista para Administradores:** Los roles `ADMINISTRATIVO` y `ADMINISTRATIVO_APOYO` continúan viendo las tarjetas de KPI orientadas a la gestión (contratos por confirmar, pagos pendientes, etc.).
    *   **Nueva Vista para Operativos:** Cuando un usuario con rol `OPERATIVO` inicia sesión, ahora ve un dashboard personalizado con sus propias métricas de desempeño:
        1.  Total de Asistencias `PUNTUALES`.
        2.  Total de Asistencias con `TARDANZA`.
        3.  Total de `AUSENCIAS`.
*   **Decisiones de Implementación:**
    *   **Lógica Condicional en el Componente:** Se modificó el componente de la página `/dashboard/page.tsx` para que primero detecte el rol del usuario y, en función de este, obtenga y muestre los datos y las tarjetas de estadísticas correspondientes.

### 2. **Nuevo Reporte de "Mis Asistencias" para Operativos (HU-16)**
*   **Funcionalidad:** Se ha creado una nueva sección (`/dashboard/mis-participaciones`) exclusiva para el personal operativo.
    *   La página permite al usuario filtrar sus participaciones en eventos por un rango de fechas.
    *   Muestra un listado detallado de cada evento, incluyendo el tipo de contrato, el servicio específico que realizó, el estado de su asistencia y el monto que se le debía pagar.
*   **Decisiones de Implementación:**
    *   **Reutilización de Vista de BD:** Para optimizar la consulta, el reporte utiliza la vista de base de datos `reporte_participacion_flat` existente, que proporciona los datos ya aplanados y listos para consumir.
    *   **Navegación Actualizada:** Se añadió un enlace "Mis Asistencias" en el `Sidebar` para que los usuarios operativos puedan acceder fácilmente a su nuevo reporte.

### 3. **Implementación de Paginación Reutilizable**
*   **Funcionalidad:** Se ha añadido paginación a la página de "Gestión de Contratos" para mejorar el rendimiento y la usabilidad.
    *   La tabla de contratos ahora muestra los registros en lotes de 10.
    *   Se muestran controles para navegar entre las páginas, junto con un contador del total de registros.
*   **Decisiones de Implementación:**
    *   **Componente `Pagination.tsx` Reutilizable:** Se creó un componente de paginación genérico y reutilizable en `app/components/ui/Pagination.tsx`. Este componente maneja la lógica de la interfaz y emite eventos de cambio de página.
    *   **Carga de Datos Paginada:** La función `fetchContratos` en la página de contratos se modificó para usar el método `.range()` de Supabase, solicitando únicamente los datos de la página actual.
    *   **Manejo de Estado:** Se implementó el estado necesario en la página de contratos para gestionar la página actual y el conteo total de registros, asegurando que la interfaz se actualice correctamente al navegar.
---
# Bitácora de Implementación (v1.5 - Mejoras de UX y Corrección de Errores)

Esta versión se enfoca en pulir la experiencia de usuario, solucionar errores críticos de despliegue y estandarizar la interfaz para una mayor coherencia y profesionalismo.

### 1. **Corrección de Despliegue en Vercel**
*   **Problema:** El despliegue en Vercel fallaba con un error de `useSearchParams() should be wrapped in a suspense boundary` en la página de registro de personal.
*   **Solución:** Se refactorizó la página `/auth/register-personal` para envolver el componente que utiliza `useSearchParams` dentro de un `Suspense boundary` de React. Esto permite que Next.js maneje correctamente la carga asíncrona de los parámetros de la URL, solucionando el error de pre-renderizado y permitiendo un despliegue exitoso.

### 2. **Mejora de Navegación en Contratos**
*   **Funcionalidad:** Se ha mejorado la usabilidad de la tabla de contratos en `/dashboard/contratos`.
    *   Anteriormente, solo el nombre del cliente era un enlace al detalle del contrato.
    *   Ahora, las columnas "Tipo de Contrato" y "Fecha del Evento" también son enlaces, permitiendo un acceso más rápido y flexible a los detalles desde múltiples puntos de la fila.
*   **Decisiones de Implementación:**
    *   Se modificó el componente `ContratosTable` para envolver el contenido de las celdas relevantes con el componente `Link` de Next.js, apuntando a la ruta dinámica del detalle del contrato.

### 3. **Consistencia en la Interfaz de Usuario (UX)**
*   **Problema:** Existía un uso inconsistente de mayúsculas y minúsculas en títulos, etiquetas y botones a lo largo de toda la aplicación, lo que afectaba la coherencia visual.
*   **Solución:** Se realizó una revisión exhaustiva de todas las páginas y componentes de la aplicación, estandarizando la capitalización de los textos para seguir un estilo de "sentence case" (solo la primera letra de la oración en mayúscula) en la mayoría de los elementos de la UI.
    *   **Páginas Afectadas:** `/`, `/auth/login`, `/auth/register`, y todas las páginas dentro de `/dashboard` (Personal, Contratadores, Tipos de Contrato, Servicios, Contratos, Pagos, Reportes, etc.).
    *   **Componentes Afectados:** Se actualizaron los componentes reutilizables como `Sidebar` para reflejar la nueva estandarización en las etiquetas de navegación.
*   **Decisiones de Implementación:**
    *   Se utilizó la herramienta de reemplazo para modificar sistemáticamente los archivos `.tsx` correspondientes, asegurando que todos los textos visibles por el usuario sigan una convención de mayúsculas coherente y profesional.
    *   Se eliminó un enlace obsoleto en la página de registro que apuntaba a un flujo de registro de personal que ya no se utiliza.
