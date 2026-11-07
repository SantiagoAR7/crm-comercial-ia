# Arquitectura y decisiones

## Responsabilidades

El frontend Next.js presenta los módulos y consulta la API Express. La API concentra autenticación, validaciones y credenciales de proveedores. Supabase CRM almacena los datos comerciales; Supabase Tickets mantiene el dominio documental separado. El BI consulta SQL Server mediante el backend.

Los procesos de sincronización de redes y correo se inician con el servidor. Una instalación de desarrollo no debe reutilizar configuración de producción: puede consultar proveedores o procesar el buzón. Las pruebas importan routers y servicios aislados, sin iniciar `src/index.js`.

## Acceso

Cada módulo utiliza su propia cookie. El backend verifica firma HMAC, caducidad y área de acceso. Las contraseñas se comparan mediante scrypt. Las cookies son `HttpOnly`, `SameSite=Strict` y llevan `Secure` en producción.

CRM, BI y Prospección comparten el secreto de firma CRM, pero comprueban áreas de acceso diferentes. Redes y Tickets tienen secretos propios. Esto es aislamiento por módulo, no un sistema general de permisos por usuario ni una arquitectura multitenant.

El middleware del frontend comprueba la presencia de cookies para decidir redirecciones. La autorización efectiva de los datos corresponde a la API.

## Campañas

1. Se consultan instalaciones elegibles y se aplican exclusiones.
2. Se preparan candidatos para revisión humana.
3. La aprobación comprueba que los candidatos incluidos están aprobados.
4. La API crea una ejecución y una cola antes de solicitar su procesamiento a n8n.
5. n8n remite resultados mediante un callback autenticado.
6. La API actualiza resultados, reintentos y contadores.

Los callbacks de campañas aceptan `x-cliente-secret` o `x-davofrio-secret`. Si falta `N8N_WEBHOOK_SECRET`, falta la cabecera o no coincide, se rechaza la petición antes de acceder a Supabase.

## Tickets y exportación

El módulo valida importes, fechas y datos revisados antes de aprobar documentos. La entrega conserva checkpoints de archivo y fila de Excel. Las pruebas ejercitan su reanudación con dobles de Microsoft Graph y Supabase. La configuración de destinos de Microsoft 365 sigue siendo específica del entorno y debe sustituirse para otro despliegue.

## Compromisos actuales

- Parte de la lógica está dentro de routers grandes, especialmente campañas y prospección.
- El acceso utiliza perfiles de entorno; no hay gestión central de identidades para todo el portal.
- Algunos procesos guardan estado en archivos de `/app/data`. No se debe asumir que varias réplicas coordinan trabajos entre sí.
- Varias operaciones escriben en varias tablas y llaman a proveedores. Falta ampliar pruebas de concurrencia y fallos parciales antes de afirmar ejecución única de extremo a extremo.
- No se incluyen flujos de n8n ni el esquema completo ERP/CRM. Compilar y pasar pruebas locales no equivale a un despliegue funcional completo.
