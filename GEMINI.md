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
| `rol` | `VARCHAR` | `ENUM` | Etiqueta que define el nivel de permisos del usuario (`Administrativo`) o la función laboral del empleado (`Operativo`). | El valor debe pertenecer a una lista predefinida (`ADMINISTRATIVO`, `OPERATIVO`). | Es recomendable usar un tipo `ENUM` de PostgreSQL para restringir los valores a un conjunto predefinido y evitar inconsistencias. |
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
| `estado_pago` | `VARCHAR` | `ENUM` | Controla el ciclo de vida del pago (`PENDIENTE`, `PAGADO`, `ANULADO`). | Debe pertenecer a la lista predefinida. | `DEFAULT 'PENDIENTE'`. |

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
| `estado` | `VARCHAR` | `ENUM` | Ciclo de vida del lote (`PROCESANDO`, `COMPLETADO`, `FALLIDO`). | Debe pertenecer a la lista predefinida. | Un lote `COMPLETADO` debe ser inmutable. |
| `created_at` | `TIMESTAMP` | | Sello de tiempo de la creación del lote. | `DEFAULT now()` | Auditoría. |
| `created_by` | `INTEGER` | FK (`Personal.id`) | Coincide con `id_personal_administrativo`. | Apunta a `Personal.id`. | Auditoría. |

---
### Tabla: `Detalles_Lote_Pago`
| Columna | Tipo de Dato | Clave/Constraint | Descripción Detallada | Regla de Negocio | Consideraciones Importantes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id_organizacion` | `INTEGER` | FK (`Organizaciones.id`) | Organización del lote, denormalizada para optimizar. | Debe ser un ID de organización válido. | Clave para RLS y trigger de conteo. 📈 **Contabilizado.** |
| `id_lote_pago` | `INTEGER` | PK, FK (`Lotes_Pago.id`) | Referencia al lote de pago principal. | Debe ser un ID de lote de pago existente. | `ON DELETE CASCADE`. |
| `id_evento_servicio_asignado`| `INTEGER` | PK, FK (`Evento_Servicios_Asignados.id`) | Referencia al servicio específico que se está pagando. | Debe ser un ID de servicio asignado válido. | ⛓️ **Tabla de unión crucial.** `PRIMARY KEY (id_lote_pago, id_evento_servicio_asignado)` garantiza que un servicio solo se pague una vez. |
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
    *   **Lógica Transaccional del Lado del Cliente:** El proceso de creación del lote, los detalles y la actualización de los servicios se maneja como una secuencia de operaciones asíncronas. Aunque no es una transacción de base de datos atómica nativa, se incluyó manejo de errores en cada paso para alertar al usuario si alguna parte del proceso falla.
    *   **Feedback al Usuario:** Se implementaron estados de carga (`pagando`) para deshabilitar el botón de pago durante el procesamiento y evitar clics duplicados. Se usan alertas de confirmación (`window.confirm`) para acciones críticas e irreversibles, y notificaciones (`alert`) para comunicar el éxito o el fracaso de la operación.
    *   **Mejora de Usabilidad (Filtro):** Se añadió una barra de búsqueda para filtrar al personal por nombre, mejorando drásticamente la usabilidad en organizaciones con una gran cantidad de empleados.
    *   **Corrección de Visualización de Fecha:** Se corrigió un error visual para mostrar la `fecha_hora_evento` del contrato en lugar de la fecha de creación, proporcionando información más relevante al administrador.




