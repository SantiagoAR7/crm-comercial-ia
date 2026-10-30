# Portal DAVOFRIO: CRM, automatización e inteligencia de negocio

Plataforma modular para centralizar el CRM comercial, la prospección, el control de publicaciones sociales, la revisión de tickets y facturas y el panel de Business Intelligence. La raíz del sitio funciona como portal de acceso y cada módulo conserva su propia autenticación cuando corresponde.

## Funcionalidades

- Portal de módulos en `/`.
- CRM operativo y dashboard en `/crm`.
- Gestión y filtrado de instalaciones.
- Creación de campañas con revisión humana obligatoria.
- Selección individual de los contactos incluidos en cada campaña.
- Automatización de llamadas mediante n8n y Retell AI.
- Clasificación de resultados: interesado, no interesado, devolución de llamada, sin respuesta, buzón, fallo y solicitud de no volver a llamar.
- Creación de oportunidades comerciales a partir de resultados positivos.
- IA Comercial para segmentación y recomendaciones explicables.
- Prospección IA con verticales, listas, enriquecimiento, generación de ideas para LinkedIn y seguimiento por correo.
- Panel de Redes con sincronización de evidencias de ejecución de n8n, filtros por cuenta/plataforma/formato y enlaces a publicaciones verificadas.
- Revisión de tickets y facturas recibidos desde Telegram, con acceso independiente y estados de aprobación o rechazo.
- Panel BI con métricas financieras, comerciales, operativas y de inventario.
- Autenticación separada para CRM, BI, Prospección, Redes y Facturas.

## Módulos y rutas

| Módulo | Ruta | Acceso |
| --- | --- | --- |
| Portal | `/` | Público; solo presenta los módulos disponibles |
| CRM | `/crm` | Sesión CRM mediante `/login` |
| Prospección IA | `/prospeccion` | Sesión independiente mediante `/prospeccion-login` |
| Redes sociales | `/redes` | Sesión independiente mediante `/redes/login` |
| Business Intelligence | `/bi` | Sesión independiente mediante `/bi-login` |
| Facturas y tickets | `/facturas` | Sesión independiente mediante `/facturas/login` |

Las rutas internas del CRM incluyen instalaciones, contactos, campañas, oportunidades, IA Comercial y configuración.

## Arquitectura

```text
Frontend Next.js
      │
      ▼
API Express ────── Supabase CRM
      │
      ├─────────── SQL Server / ERP
      ├─────────── Supabase Tickets
      ├─────────── Microsoft 365 / Prospeo / OpenAI
      └─────────── n8n ── Retell AI / redes / Telegram
```

El navegador nunca recibe credenciales de Supabase, SQL Server, n8n o Retell. Todas las integraciones sensibles se ejecutan exclusivamente desde el backend.

## Tecnologías

- Frontend: Next.js, React, TypeScript y Tailwind CSS.
- Backend: Node.js y Express.
- Datos operativos: Supabase/PostgreSQL, con proyectos separados para CRM y Tickets.
- Business Intelligence: SQL Server mediante `mssql`.
- Automatización: n8n y Microsoft Graph/SMTP/IMAP para prospección.
- Voz: Retell AI.
- Infraestructura: Docker Compose y proxy inverso.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

npm ci --prefix backend
npm ci --prefix frontend

npm run dev --prefix backend
npm run dev --prefix frontend
```

La aplicación web queda disponible normalmente en `http://localhost:3000` y la API en `http://localhost:4000`.

## Flujo de campaña

1. Crear una campaña y definir sus filtros.
2. Generar la lista de candidatos.
3. Aprobar o excluir cada candidato.
4. Aprobar la campaña.
5. Enviar la ejecución a n8n.
6. Realizar las llamadas mediante Retell AI.
7. Recibir resultados y actualizar oportunidades en el CRM.

Ninguna llamada se realiza sin aprobación humana previa.

## Business Intelligence

El BI utiliza una sesión independiente del CRM:

- Entrada: `/bi-login`
- Panel: `/bi`
- Cookie segura: `bi_session`

El backend consulta el ERP mediante variables de entorno. Los nombres se documentan en `backend/.env.example`; sus valores reales nunca se versionan.

## Prospección IA

Prospección utiliza una sesión independiente y permite organizar búsquedas por vertical, guardar listas, enriquecer contactos y preparar acciones comerciales. Las integraciones con OpenAI, Prospeo y Microsoft 365 se ejecutan en el backend. El envío de correos y el procesamiento del buzón se controlan mediante variables de activación y límites diarios.

## Redes sociales

El módulo `/redes` consulta las ejecuciones guardadas de los cuatro flujos de n8n:

- Alicante y Turismo.
- Psicología Sanitaria.
- El Mundo del Autismo.
- Jessica.

La sincronización es observacional: lee evidencias conservadas por n8n y no ejecuta nodos de generación ni publicación. El panel solo muestra como publicadas las respuestas que contienen identificador y URL verificables de Facebook, Instagram, TikTok o YouTube. Las imágenes y vídeos se referencian mediante URL segura; los binarios no se almacenan en el repositorio.

## Facturas y tickets

El módulo `/facturas` recibe los registros procesados por las automatizaciones de Telegram y permite que usuarios autorizados revisen cada ticket, consulten su evidencia y lo aprueben o rechacen. Sus credenciales, sesión y proyecto de Supabase son independientes de los del CRM para evitar cruces de datos.

## Autenticación

Cada área protegida utiliza una cookie y un perfil de acceso independiente:

- CRM: `crm_session`.
- BI: `bi_session`.
- Prospección: `prospecting_session`.
- Redes: `social_session`.
- Facturas: `tickets_session`.

Redes y Facturas disponen, además, de secretos de firma propios mediante `SOCIAL_SESSION_SECRET` y `TICKETS_SESSION_SECRET`.

## Seguridad

- El repositorio no contiene contraseñas, tokens, claves API ni archivos `.env` reales.
- Las contraseñas se almacenan mediante hashes.
- Las cookies de autenticación son `httpOnly`.
- Los datos temporales y archivos de sesión están excluidos de Git.
- GitHub Actions revisa secretos, dependencias y compilación en cada envío.

Ejecuta las verificaciones locales con:

```bash
npm run check:secrets
npm run audit
npm run build
```

Consulta [SECURITY.md](SECURITY.md) para las reglas de gestión de secretos y datos.

## Estructura

```text
.
├── backend/      # API, autenticación e integraciones
├── frontend/     # CRM y panel BI
├── supabase/     # Migraciones de base de datos
├── docs/         # Documentación funcional
└── scripts/      # Controles de seguridad del repositorio
```

## Despliegue

El proyecto incluye Dockerfiles y `docker-compose.production.yml`. La configuración real se inyecta desde el servidor mediante `backend/.env.production`, que no forma parte del repositorio.

Los servicios de producción son:

- `crm-web`: aplicación Next.js.
- `crm-api`: API Express y procesos de sincronización en segundo plano.
- Red externa: `dokploy-network`, utilizada por el proxy Traefik existente.

El volumen `./data:/app/data` conserva estados operativos que no deben versionarse, incluidos los registros de sincronización de Redes. El despliegue actual admite los hosts configurados en el archivo de producción y enruta `/api` al backend.
