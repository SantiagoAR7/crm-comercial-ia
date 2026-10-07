# CRM comercial con automatización e inteligencia de negocio

Plataforma web para gestionar instalaciones, seleccionar audiencias, aprobar campañas telefónicas y analizar resultados comerciales. El proyecto combina un CRM operativo con un panel de Business Intelligence independiente.

## Funcionalidades

- Dashboard con indicadores operativos.
- Gestión y filtrado de instalaciones.
- Creación de campañas con revisión humana obligatoria.
- Selección individual de los contactos incluidos en cada campaña.
- Automatización de llamadas mediante n8n y Retell AI.
- Clasificación de resultados: interesado, no interesado, devolución de llamada, sin respuesta, buzón, fallo y solicitud de no volver a llamar.
- Creación de oportunidades comerciales a partir de resultados positivos.
- IA Comercial para segmentación y recomendaciones explicables.
- Panel BI con métricas financieras, comerciales, operativas y de inventario.
- Autenticación separada para el CRM y para el panel BI.

## Arquitectura

```text
Frontend Next.js
      │
      ▼
API Express ────── Supabase
      │
      ├─────────── SQL Server / ERP
      │
      └─────────── n8n ── Retell AI
```

El navegador nunca recibe credenciales de Supabase, SQL Server, n8n o Retell. Todas las integraciones sensibles se ejecutan exclusivamente desde el backend.

## Tecnologías

- Frontend: Next.js, React, TypeScript y Tailwind CSS.
- Backend: Node.js y Express.
- Datos operativos: Supabase/PostgreSQL.
- Business Intelligence: SQL Server mediante `mssql`.
- Automatización: n8n.
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

El proyecto incluye Dockerfiles y una plantilla de Docker Compose. La configuración real se inyecta desde el servidor mediante variables de entorno y no forma parte del repositorio.
