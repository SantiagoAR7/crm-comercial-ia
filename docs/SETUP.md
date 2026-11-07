# Instalación y configuración

## Requisitos

- Node.js 22.12+ y npm; CI utiliza Node 22.
- Git para el detector de archivos versionados.
- Para usar los módulos: Supabase con los esquemas y credenciales correspondientes.
- Para BI: acceso autorizado al SQL Server/ERP.
- Para integraciones: n8n, Retell o Microsoft 365 según el módulo.

## Verificación sin servicios externos

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm test
npm run check:secrets
npm run build
```

No hacen falta archivos `.env` reales para esas comprobaciones. Las pruebas no arrancan el servidor principal ni ejecutan campañas.

## Configuración de desarrollo

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
npm run hash-password --prefix backend
```

El generador solicita una contraseña y devuelve su hash. No introduzcas contraseñas como argumentos del shell ni guardes secretos en commits. La entrada interactiva actual muestra los caracteres en pantalla: úsala en una terminal privada.

| Grupo | Variables / preparación |
| --- | --- |
| API | `PORT`, `FRONTEND_URL` |
| CRM | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD_HASH`, `CRM_SESSION_SECRET` |
| BI | `BI_ACCESS_*`, `BI_SQL_*`; secreto de sesión CRM |
| Prospección | `PROSPECTING_ACCESS_*`; proveedores utilizados |
| Redes | `SOCIAL_ACCESS_*`, `SOCIAL_SESSION_SECRET`, `SOCIAL_N8N_API_*` |
| Tickets | `TICKETS_ACCESS_*`, `TICKETS_SESSION_SECRET`, `TICKETS_SUPABASE_*`, `TICKETS_INGEST_SECRET`, `TICKETS_REVIEWER_EMAILS` |
| Campañas | `N8N_CAMPAIGN_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `RETELL_API_KEY`, `RETELL_CAMPAIGN_AGENT_ID`, `RETELL_FROM_NUMBER` |

Supabase CRM se crea al importar la aplicación: el servidor completo requiere su URL y clave incluso para abrir otros módulos. Las variables de acceso vacías no crean un usuario de demostración.

Mantén `PROSPECTING_EMAIL_ENABLED=false` y `PROSPECTING_EMAIL_POLL_ENABLED=false` en revisión. No copies credenciales ni destinos de producción para una demo. Los workers de redes también pueden consultar proveedores al arrancar.

## Base de datos: requisito pendiente

Consulta [la guía de Supabase](../supabase/README.md). Las migraciones iniciales `001-004` no están incluidas; `005-010` requieren estructura previa. No ejecutes la secuencia sobre una base vacía esperando obtener un CRM funcional.

Un despliegue nuevo requiere un baseline revisado de estructura, sin datos ni secretos, seguido de migraciones y datos ficticios compatibles. No se genera un esquema aproximado a partir del frontend porque podría alterar restricciones y relaciones reales.

## Arranque con servicios preparados

En dos terminales, desde la raíz:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

Web: `http://localhost:3000`. API: `http://localhost:4000`. `/api/health` indica que la API responde; no prueba la disponibilidad de todas las integraciones.

## Producción

`docker-compose.production.yml` es específico del entorno actual: hosts DAVOFRIO, red externa `dokploy-network`, Traefik y `backend/.env.production`. No es un despliegue portátil ni debe ejecutarse como demo sin adaptar esos requisitos.

Organizar el repositorio no despliega cambios. Antes de actualizar producción, valida en un entorno aislado las credenciales, el secreto del webhook y los flujos de n8n correspondientes.
