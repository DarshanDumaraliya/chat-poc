# Crisp-Basedash Tool

A NestJS-based proof of concept application for chat bot data migration and management, integrating with Crisp API and PostgreSQL database.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn** package manager
- **PostgreSQL** database (v12 or higher)
- **Crisp API** credentials (identifier and key)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crisp-basedash-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory and add the following variables:
   
   ```env
   # Server Configuration
   PORT=4000
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=your_db_username
   DB_PASSWORD=your_db_password
   DB_NAME=your_database_name
   DB_SSL=false
   DB_SSL_REJECT_UNAUTHORIZED=true
   
   # Crisp API Configuration (Required for RTM)
   CRISP_IDENTIFIER=your_crisp_identifier
   CRISP_KEY=your_crisp_api_key
   CRISP_TIER=plugin
   ```
   
   > **Note:** The `.env` file is already included in `.gitignore` and will not be committed to the repository.

4. **Database Setup**
   
   Make sure your PostgreSQL database is running and accessible with the credentials provided in your `.env` file.
   
   The application uses TypeORM with `synchronize: false` by default. For development, you can enable auto-synchronization in `src/database/databaseConfig.ts`:
   ```typescript
   synchronize: true, // Only for development!
   ```

## 🏃 Running the Application

### Development Mode
```bash
npm run start:dev
```

The application will start in watch mode, automatically reloading on file changes.

### Production Mode
```bash
# Build the application first
npm run build

# Then run the production build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

The server will start on the port specified in your `.env` file (default: 4000). You should see:
- `Database connection successfully connected` - when the database connection is established
- `[CrispRtmService] Crisp RTM connected successfully` - when RTM connection is established
- `Server is running on port <PORT>` - when the server is ready

## 📁 Project Structure

```
crisp-basedash-tool/
├── src/
│   ├── database/                    # Database configuration
│   │   └── databaseConfig.ts
│   ├── modules/                     # Feature modules
│   │   └── crisp/                   # Crisp integration module
│   │       ├── controllers/
│   │       │   ├── crisp.controller.ts        # API endpoints for Crisp API
│   │       │   └── crisp-db.controller.ts     # API endpoints for database queries
│   │       ├── services/
│   │       │   ├── crisp.service.ts           # Crisp API service
│   │       │   └── crisp-rtm.service.ts        # RTM WebSocket service
│   │       ├── entities/
│   │       │   ├── conversation.entity.ts     # Conversation entity
│   │       │   └── conversation-message.entity.ts  # Message entity
│   │       └── crisp.module.ts
│   ├── interface/                    # TypeScript interfaces
│   ├── interceptor/                  # HTTP interceptors
│   ├── app.module.ts                 # Root application module
│   ├── app.controller.ts             # Root controller
│   ├── app.service.ts                 # Root service
│   └── main.ts                       # Application entry point
├── docs/                             # Documentation
│   └── RTM_IMPLEMENTATION.md         # RTM implementation details
├── test/                             # E2E tests
├── .env                              # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```
