# Bar Buddy

Bar Buddy is a personal home-bar app for tracking ingredients, finding cocktails you can make, and seeing what you are missing.

The application is a React frontend backed by a Spring Boot API and PostgreSQL. Supabase provides user authentication; authorization and application data access stay behind the backend.

## Development status

The application foundation, curated cocktail catalog, backend identity boundary, and browser authentication flow are complete. Users can sign up, sign in, recover a password, sign out, and reach protected application routes. The next planned feature is catalog persistence and import (plan unit 1.2.1).

Bar Buddy is under active development and has not been deployed for public use. See the [development plan](docs/06-plan.md) for release progress and [implementation documentation](docs/05-documentation.md) for verified behavior.

## Start locally

Prerequisites:

- JDK 25
- Node.js 24 and npm 11
- Docker with Docker Compose v2

From the repository root, start PostgreSQL:

```sh
docker compose up -d --wait
```

On first setup, create the ignored local configuration files:

```sh
cd backend
install -m 600 .env.example .env
cd ../frontend
cp .env.example .env
npm ci
cd ..
```

Start the backend and frontend in separate terminals:

```sh
cd backend
./mvnw spring-boot:run
```

```sh
cd frontend
npm run dev
```

Open <http://127.0.0.1:5173>. The default examples start the application with authentication disabled. Add the Supabase settings described in the [local development guide](docs/08-local-development.md#authentication) to exercise signup and login.

Run the main checks with Docker available:

```sh
cd catalog && npm run check
cd ../backend && ./mvnw --batch-mode --no-transfer-progress verify
cd ../frontend && npm run check && npm run api:check
```

The [local development guide](docs/08-local-development.md) covers environment variables, authentication setup, database lifecycle, API generation, and individual commands.

## Project documentation

- [Product definition](docs/01-definition.md)
- [Requirements](docs/02-requirements.md)
- [Technical design](docs/03-design.md)
- [Development guidelines](docs/04-development-guidelines.md)
- [Implemented behavior](docs/05-documentation.md)
- [Development plan](docs/06-plan.md)
- [Development workflow](docs/07-development-workflow.md)
