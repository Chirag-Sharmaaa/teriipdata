# Deployment status

## Demonstration preview

The current project is a browser-facing TanStack Start frontend and can be explored through the Lovable preview. For local development, use `bun install` and `bun run dev`. This is not an approved environment for real participant data and should not be used to process or store it.

## Production deployment is blocked

The uploaded brief specifies a locally executed Python 3.12+ FastAPI processing service and later deployment on an approved institutional server. Neither that service nor a production deployment configuration is included. A Drive folder, institutional OAuth/service-account credentials, deployment target, retention policy, and centre access policy have not been supplied or approved. No mock integration can replace those requirements.

Before production work, obtain the institution-approved runtime and security/privacy decisions, then implement and independently review the service, authentication, centre isolation, local extraction, Excel handling, Drive integration, secrets management, audit policy, backups, and operational monitoring. Never deploy this demo as though those controls exist.