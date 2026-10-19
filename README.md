# Sistema de Gestión de Proyectos Serfamilia

Repositorio académico del Sistema de Gestión de Proyectos Serfamilia (SGP). En la etapa actual reúne la estructuración, la documentación de elicitación, los requisitos y la arquitectura del proyecto; incorpora además el entorno técnico de desarrollo (API NestJS, SPA Vue 3 y base de datos PostgreSQL).

## Contexto académico

El repositorio se organiza como parte de una entrega universitaria de Ingeniería de Software. Su propósito es mantener los artefactos documentales versionados y permitir que cada unidad de trabajo sea revisada antes de incorporarse a la rama principal.

## Estructura del repositorio

```text
.
├── README.md
├── .gitignore
├── docs/
│   ├── gestion-git-github.md
│   ├── entrevistas/
│   ├── srs/
│   ├── trazabilidad/
│   └── arquitectura/
│       └── adr/
└── modelos/
    └── c4/
```

- `src/backend/`: API REST Core (NestJS 11, TypeORM, Node.js 22).
- `src/frontend/`: SPA (Vue 3, Vite, TypeScript, Pinia, PrimeVue).
- `database/`: DDL de PostgreSQL 16 (`01_schema.sql`) y datos de desarrollo (`02_seed_dev.sql`).
- `scripts/`: preparación de la base de datos local.
- `docs/entorno-desarrollo.md`: guía para levantar el entorno local.
- `docs/gestion-git-github.md`: evidencia del uso de ramas feature, commits semánticos y Pull Requests.
- `docs/entrevistas/`: fuentes de elicitación de requisitos.
- `docs/srs/`: Especificación de Requisitos de Software.
- `docs/trazabilidad/`: artefactos independientes de trazabilidad, cuando estén disponibles.
- `docs/arquitectura/`: documentación de arquitectura de software.
- `docs/arquitectura/adr/`: registros independientes de decisiones arquitectónicas, cuando estén disponibles.
- `modelos/c4/`: fuentes editables de diagramas C4, cuando estén disponibles.

Los directorios preexistentes `models/` y `tests/` se conservan vacíos: el código vive en `src/backend/` y `src/frontend/`, siguiendo la estructura del documento de arquitectura (C3, sección 5.3).

## Puesta en marcha

Pasos completos en [`docs/entorno-desarrollo.md`](docs/entorno-desarrollo.md). Resumen:

```bash
cp .env.example .env
bash scripts/setup-db.sh          # PowerShell: .\scripts\setup-db.ps1
docker compose up -d              # MinIO y Mailpit
cd src/backend && npm install && npm run migration:run && npm run seed:dev && npm run start:dev
cd src/frontend && npm install && npm run dev
```

## Convenciones de trabajo

Las ramas de trabajo siguen la forma `feature/<nombre-feature>` y parten de una versión actualizada de `main`.

Los commits siguen Conventional Commits. Los tipos admitidos son:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `chore:`

Cada rama debe mantener una sola responsabilidad y entrar a `main` mediante un Pull Request. Los Pull Requests se revisan y se integran con merge commit para conservar los commits semánticos individuales. Después de cada integración se actualiza `main` antes de iniciar la siguiente rama.

## Integración Git y GitHub

La incorporación inicial de la estructura y de los artefactos base se realizó mediante cuatro ramas feature, ocho commits semánticos y cuatro Pull Requests integrados con merge commit:

- [PR #1 — Estructura base del repositorio](https://github.com/OddALaCream/Ferrum/pull/1)
- [PR #2 — Entrevista de elicitación](https://github.com/OddALaCream/Ferrum/pull/2)
- [PR #3 — Especificación de requisitos](https://github.com/OddALaCream/Ferrum/pull/3)
- [PR #4 — Arquitectura y modelos C4](https://github.com/OddALaCream/Ferrum/pull/4)

Las ramas se eliminaron únicamente después de completar su integración. El detalle de las responsabilidades, commits, merge commits y flujo aplicado se encuentra en [`docs/gestion-git-github.md`](docs/gestion-git-github.md).
