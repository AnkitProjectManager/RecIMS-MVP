# RecIMS Backend

Standalone Node.js/Express backend for RecIMS application.

## Features

- SQLite database (no external database required)
- JWT authentication
- RESTful API
- Generic entity CRUD operations
- CORS enabled for frontend

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment (optional):
Edit `.env` file to customize:
- PORT: Server port (default: 3001)
- JWT_SECRET: Secret for JWT tokens
- DATABASE_PATH: SQLite database file path

## Running

### Development (with auto-reload):
```bash
npm run dev
```

### Production:
```bash
npm start
```

The server will start on `http://localhost:3001`

## Default Credentials

- Super Admin: `admin@recims.com` / `admin123`
- Connecticut Metals (PHASE I–III only): `admin@clnenv.com` / `phase3only!`

Override the restricted account via environment variables if needed:

- `CLNENV_USER_EMAIL`
- `CLNENV_USER_PASSWORD`
- `CLNENV_USER_NAME`

**⚠️ Change these in production!**

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/password-reset` - Request password reset

### Entities (Generic CRUD)
- `GET /api/entities/:entityName` - List all entities
- `GET /api/entities/:entityName/:id` - Get entity by ID
- `POST /api/entities/:entityName` - Create new entity
- `PUT /api/entities/:entityName/:id` - Update entity
- `DELETE /api/entities/:entityName/:id` - Delete entity

### Health
- `GET /api/health` - Server health check

## Authentication

All entity endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Database

The backend uses SQLite3 for simplicity:
- No external database server needed
- Data stored in `recims.db` file
- Automatically creates tables on first run
- Creates default tenant and admin user

## Security Notes

For production deployment:
1. Change JWT_SECRET in .env
2. Change default admin password
3. Use HTTPS
4. Add rate limiting
5. Add input validation
6. Consider using PostgreSQL/MySQL instead of SQLite
