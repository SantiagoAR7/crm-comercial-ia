# Seguridad del repositorio

## Secretos

- No versionar `.env`, credenciales SQL, claves SSH, certificados, tokens ni volcados de datos.
- Mantener los secretos únicamente como variables de entorno en el servidor.
- Los archivos `*.example` documentan nombres de variables, pero no contienen credenciales reales.
- Rotar inmediatamente cualquier credencial que llegue a aparecer en un commit.

## Datos de clientes

- No añadir exportaciones SQL, CSV, cookies, grabaciones, transcripciones ni capturas con datos reales.
- Las consultas de BI se ejecutan en el backend y sus credenciales no llegan al navegador.
- Los datos de autenticación se almacenan como hashes y secretos de sesión, nunca como contraseñas en el código.

## Producción

- Las claves de Supabase, SQL Server, n8n, Retell y las sesiones son exclusivas del backend.
- No usar variables `NEXT_PUBLIC_*` para secretos.
- Ejecutar `npm run check:secrets` antes de cada envío.
