# GitHub Repository Description

Use this text in your GitHub repository description:

---

**Chat Bot POC - NestJS application for chat bot data migration with Crisp API integration**

A NestJS-based proof of concept for chat bot data migration and management, featuring PostgreSQL database integration and Crisp API connectivity.

## Quick Setup

1. Clone and install: `npm install`
2. Create `.env` file with required environment variables (see below)
3. Run: `npm run start:dev`

## Required Environment Variables

```env
# Server
PORT=4000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# Crisp API
CRISP_IDENTIFIER=your_identifier
CRISP_KEY=your_api_key
CRISP_TIER=plugin
```

## Tech Stack

- NestJS | TypeORM | PostgreSQL | Crisp API | TypeScript

---

