# Crisp-Basedash Tool

A NestJS-based application for real-time synchronization of Crisp conversations and messages to PostgreSQL database using Crisp RTM (Real-Time Messaging) WebSocket API.

## 🚀 Features

- **Real-Time Sync**: Automatically syncs Crisp conversations and messages to PostgreSQL using RTM WebSocket connections
- **RESTful API**: Built with NestJS for managing conversations and messages
- **PostgreSQL Integration**: TypeORM-based database operations with automatic schema synchronization
- **Idempotent Processing**: Prevents duplicate messages using fingerprint-based deduplication
- **Auto-Reconnect**: Handles connection failures gracefully with automatic reconnection
- **Database Queries**: Query conversations and messages directly from PostgreSQL

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

## 🔌 RTM (Real-Time Messaging) Implementation

The application uses Crisp RTM WebSocket API to receive real-time events. The RTM service automatically:

1. **Connects** to Crisp RTM when the application starts
2. **Listens** for real-time events:
   - `session:request:initiated` - New conversation started
   - `message:send` - Visitor message sent
   - `message:received` - Operator message received
3. **Syncs** all events to PostgreSQL database automatically
4. **Handles** errors and reconnections gracefully

### RTM Events Handled

| Event | Description | Database Action |
|-------|-------------|-----------------|
| `session:request:initiated` | New conversation started | Creates conversation record |
| `message:send` | Visitor message sent | Stores message with `from: 'visitor'` |
| `message:received` | Operator message received | Stores message with `from: 'operator'` |

### RTM Features

- ✅ **Auto-Connect**: Starts automatically on module initialization
- ✅ **Idempotency**: Prevents duplicate messages using `fingerprint` (UNIQUE constraint)
- ✅ **Auto-Create Conversations**: Creates conversation if missing when message arrives
- ✅ **Error Handling**: Graceful error handling with comprehensive logging
- ✅ **Connection Monitoring**: Tracks connection status
- ✅ **Auto-Reconnect**: Can manually reconnect if needed

For detailed RTM implementation documentation, see [docs/RTM_IMPLEMENTATION.md](docs/RTM_IMPLEMENTATION.md).

## 📡 API Endpoints

### Crisp API Endpoints

These endpoints interact with Crisp API and save data to the database:

#### Get All Conversations for a Website
```
GET /crisp/conversations/:websiteId
```

**Description**: Fetches all conversations for a website from Crisp API, automatically paginates through all pages, saves conversations and messages to database.

**Parameters**:
- `websiteId` (path, required): Crisp website ID

**Query Parameters**:
- `page` (optional): Starting page number (ignored - always starts from page 1)

**Response**:
```json
{
  "code": 200,
  "message": "All conversations retrieved, saved, and messages synced successfully...",
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 8,
    "pageParRecord": 150
  }
}
```

#### Get Messages from a Conversation
```
GET /crisp/messages/:websiteId/:sessionId
```

**Description**: Fetches messages from a specific conversation from Crisp API and saves them to database.

**Parameters**:
- `websiteId` (path, required): Crisp website ID
- `sessionId` (path, required): Conversation session ID

**Response**:
```json
{
  "code": 200,
  "message": "Messages retrieved and saved successfully",
  "data": [...]
}
```

### Database Query Endpoints

These endpoints query data directly from PostgreSQL:

#### Get All Conversations from Database
```
GET /crisp-db/conversations
```

**Description**: Retrieves conversations from local PostgreSQL database with pagination.

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Records per page (max: 100)
- `websiteId` (optional): Filter by website ID

**Response**:
```json
{
  "code": 200,
  "message": "Conversations retrieved from database successfully",
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "pageParRecord": 10
  }
}
```

#### Get Messages by Conversation Session ID
```
GET /crisp-db/messages/:sessionId
```

**Description**: Retrieves messages from local PostgreSQL database for a specific conversation.

**Parameters**:
- `sessionId` (path, required): Conversation session ID

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Records per page (max: 100)

**Response**:
```json
{
  "code": 200,
  "message": "Messages retrieved from database successfully",
  "data": [...],
  "pagination": {
    "total": 45,
    "page": 1,
    "pageParRecord": 10
  }
}
```

## 🗄️ Database Schema

### Conversations Table

Stores conversation/session data from Crisp.

**Key Fields**:
- `session_id` (unique): Crisp session identifier
- `website_id`: Crisp website identifier
- `status`: Conversation status (0 = active, etc.)
- `state`: Conversation state (active, resolved, etc.)
- `meta_*`: Visitor metadata (nickname, email, phone, etc.)
- `created_at_crisp`: Timestamp from Crisp
- `updated_at_crisp`: Last update timestamp from Crisp

### Conversation Messages Table

Stores individual messages from conversations.

**Key Fields**:
- `fingerprint` (unique): Message identifier for idempotency
- `session_id`: Links to conversation
- `website_id`: Crisp website identifier
- `type`: Message type (text, file, etc.)
- `from`: Message author (visitor, operator)
- `content`: Message content
- `timestamp`: Message timestamp

**Relationships**:
- Many-to-One: Messages belong to a Conversation (via `session_id`)

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL database host | `localhost` |
| `DB_PORT` | PostgreSQL database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DB_NAME` | Database name | `chatbot_db` |
| `CRISP_IDENTIFIER` | Crisp API identifier | `your_identifier` |
| `CRISP_KEY` | Crisp API key | `your_api_key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `DB_SSL` | Enable SSL for database connection | `false` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Reject unauthorized SSL certificates | `true` |
| `CRISP_TIER` | Crisp API tier (plugin, website, account) | `plugin` |

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

## 🛠️ Available Scripts

- `npm run build` - Build the application for production
- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode (watch mode)
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start in production mode
- `npm run lint` - Run ESLint and fix issues
- `npm run format` - Format code using Prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Generate test coverage report
- `npm run test:e2e` - Run end-to-end tests

## 📝 Code Style

This project uses:
- **ESLint** for linting
- **Prettier** for code formatting
- **TypeScript** strict mode

Run the linter:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## 🚢 Deployment

When deploying to production:

1. Set `synchronize: false` in `databaseConfig.ts` (use migrations instead)
2. Set `logging: false` in production
3. Ensure all environment variables are properly configured
4. Build the application: `npm run build`
5. Run migrations if needed
6. Start with: `npm run start:prod`

## 📚 Technologies Used

- **NestJS** - Progressive Node.js framework
- **TypeORM** - ORM for TypeScript and JavaScript
- **PostgreSQL** - Relational database
- **Crisp API** - Customer messaging platform
- **TypeScript** - Typed JavaScript
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🔍 Monitoring & Troubleshooting

### RTM Connection Status

Check logs for RTM connection status:
- `[CrispRtmService] Crisp RTM connected successfully` - Connection established
- `[CrispRtmService] New conversation started: <session_id>` - New conversation detected
- `[CrispRtmService] Synced visitor message: <fingerprint>` - Visitor message synced
- `[CrispRtmService] Synced operator message: <fingerprint>` - Operator message synced

### Common Issues

**RTM Not Connecting**
- Verify `CRISP_IDENTIFIER` and `CRISP_KEY` are set correctly
- Check Crisp API credentials are valid
- Review logs for connection errors

**Messages Not Syncing**
- Check database connection
- Verify conversation exists (auto-created on first message)
- Check logs for sync errors

**Duplicate Messages**
- UNIQUE constraint on `fingerprint` prevents duplicates
- Race conditions are handled gracefully

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and unlicensed.

## 🆘 Support

For issues and questions, please open an issue in the repository.

---

**Note:** This is a proof of concept application. For production use, ensure proper security measures, error handling, and database migrations are in place.
