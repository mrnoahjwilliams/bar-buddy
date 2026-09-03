# Bar Buddy

Track a home bar, find makeable cocktails, and see missing ingredients.

Public repository: [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy).

Start with [AGENTS.md](AGENTS.md) for the document map and task-specific reading. Developers follow [Development Workflow](docs/07-development-workflow.md); [Plan](docs/06-plan.md) provides the next work unit and [Documentation](docs/05-documentation.md) records implementation.

## Setup

The local foundation includes a Spring backend, PostgreSQL, and a React development shell. API generation and CI are the next foundation units; authentication and application features begin in Release 1.

### Prerequisites

- JDK 25 (`java -version`; verified with OpenJDK 25.0.2). Set `JAVA_HOME` to that JDK when multiple versions are installed.
- Node.js 24.20.0 and npm 11.19.0, pinned in [.nvmrc](.nvmrc), [.node-version](.node-version), and [package.json](frontend/package.json). With nvm installed, run `nvm install` and `nvm use` from the repository root.
- A running Docker engine with Docker Compose v2 support (`docker info` and `docker compose version`). Verified with Docker Desktop 29.5.3. Testcontainers uses the same engine.
- Internet access for the first Maven/npm install and PostgreSQL image pull. Maven 3.9.16 is downloaded by the committed wrapper; a separate Maven installation is unnecessary.

Commands below use a POSIX shell from the repository root unless a directory change is shown. No Supabase account or production credentials are needed.

### Database

```sh
docker compose up -d --wait
docker compose ps
```

The local PostgreSQL 17.11 database listens on `127.0.0.1:54329`. [compose.yml](compose.yml) and [the backend example](backend/.env.example) contain matching local-only credentials. Its named volume preserves data across stops. Stop it with `docker compose down`; start it again with `docker compose up -d --wait`. Inspect failures with `docker compose logs postgres`.

### Backend

In a separate terminal, create the ignored environment file on first setup:

```sh
cd backend
cp .env.example .env
```

After that one-time setup, start the backend from `backend/` with:

```sh
./mvnw spring-boot:run
```

Spring reads `backend/.env` automatically when started from that directory; no shell export or sourcing step is needed. Use unquoted `KEY=value` lines, as in the example, without `export`. Existing environment variables take precedence over the file. The file remains ignored by Git and is optional when runtime environment variables provide the settings instead.

Check `http://127.0.0.1:8080/actuator/health` with a browser or:

```sh
curl --fail http://127.0.0.1:8080/actuator/health
```

Expect status `UP`. Database details are hidden. Other requests are denied until authentication is implemented. Stop the backend with Ctrl+C. The example binds it to loopback; runtime settings are in [application.yml](backend/src/main/resources/application.yml). Flyway currently creates only its schema-history metadata, and its “No migrations found” warning is expected. There are no application migrations or tables yet.

From `backend/`:

```sh
./mvnw --batch-mode --no-transfer-progress verify
./mvnw spotless:apply
```

`verify` checks Java/POM formatting (Spotless), selected static rules (Checkstyle), compiles and packages the app, runs security tests, and runs the PostgreSQL Testcontainers integration check. Docker is required; database tests fail if Docker is unavailable. They use a disposable container and require neither Compose nor a loaded `.env`. `./mvnw test` runs only the tests without containers and is not the full verification command. The executable package is `backend/target/bar-buddy-0.0.1-SNAPSHOT.jar`.

### Frontend

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

`npm ci` is needed on first setup or when dependencies change. For ordinary restarts, run only `npm run dev` from `frontend/` using the required Node version.

Open `http://127.0.0.1:5173`. The shell needs no environment variables or running API. Stop it with Ctrl+C. It displays the development status and handles unknown URLs with a return link; authenticated navigation comes later.

From `frontend/`:

```sh
npm run check
npm run format
npm run test:watch
npm run preview
```

`check` runs Prettier, ESLint, the Vitest/React Testing Library routing test, TypeScript, and the production build. Individual commands are `format:check`, `lint`, `test`, `typecheck`, and `build`. Build output is in `frontend/dist/`; `preview` serves that output at `http://127.0.0.1:4173` after a successful build. shadcn/ui is configured in [components.json](frontend/components.json); add needed components with `npx --no-install shadcn add <component>`.

### Remaining foundation work

springdoc and Orval dependencies are pinned, but OpenAPI/client generation is not configured yet. Do not add handwritten API clients. [Plan](docs/06-plan.md#014--generated-api-pipeline) owns the remaining API pipeline, executable GitHub checks/protection, and clean-checkout foundation acceptance.
