# Crisp RTM (Real-Time Messaging) Implementation

## Overview

Single-file RTM service that syncs real-time Crisp conversations and messages to PostgreSQL using WebSocket connections.

**File:** `src/modules/crisp/services/crisp-rtm.service.ts`

## Quick Setup

### 1. Environment Variables

Add to `.env`:
```env
CRISP_IDENTIFIER=your-identifier
CRISP_KEY=your-key
CRISP_TIER=plugin  # or 'website', 'account'
```

### 2. Auto-Start

The service automatically starts when the NestJS module initializes. No additional configuration needed.

## How It Works

### Event Flow

```
Crisp RTM WebSocket
    ↓
Event: session:request:initiated  →  Create conversation in DB
Event: message:send                →  Store visitor message
Event: message:receive            →  Store operator message
```

### Events Handled

1. **`session:request:initiated`**
   - Triggered when a new conversation starts
   - Creates conversation record in database
   - Stores session_id, website_id, and metadata

2. **`message:send`**
   - Messages sent by visitors
   - Stores message with `from: 'visitor'`
   - Ensures conversation exists

3. **`message:receive`**
   - Messages sent by operators/bots
   - Stores message with `from: 'operator'`
   - Ensures conversation exists

## Features

✅ **Auto-Connect**: Starts on module initialization  
✅ **Idempotency**: Prevents duplicate messages using `fingerprint`  
✅ **Auto-Create Conversations**: Creates conversation if missing  
✅ **Error Handling**: Graceful error handling with logging  
✅ **Connection Monitoring**: Tracks connection status  
✅ **Auto-Reconnect**: Can manually reconnect if needed  

## Database Sync

### Conversations
- Created on `session:request:initiated`
- Stored with: session_id, website_id, timestamps, metadata

### Messages
- Stored on `message:send` and `message:receive`
- Uses `fingerprint` for idempotency (UNIQUE constraint)
- Links to conversation via `session_id`

## Usage Example

```typescript
// Service is automatically injected and started
// No manual code needed - it works automatically!

// Check connection status (optional)
const isConnected = crispRtmService.getConnectionStatus();

// Manually reconnect if needed (optional)
await crispRtmService.reconnect();
```

## Monitoring

Check logs for:
- `[CrispRtmService] Crisp RTM connected successfully`
- `[CrispRtmService] New conversation started: <session_id>`
- `[CrispRtmService] Synced visitor message: <fingerprint>`
- `[CrispRtmService] Synced operator message: <fingerprint>`

## Troubleshooting

### RTM Not Connecting
- Verify `CRISP_IDENTIFIER` and `CRISP_KEY` are set
- Check Crisp API credentials are valid
- Review logs for connection errors

### Messages Not Syncing
- Check database connection
- Verify conversation exists (auto-created on first message)
- Check logs for sync errors

### Duplicate Messages
- UNIQUE constraint on `fingerprint` prevents duplicates
- Race conditions are handled gracefully

## Architecture

The RTM service uses a persistent WebSocket connection to Crisp's RTM API:

```
Application Start
    ↓
CrispRtmService.onModuleInit()
    ↓
Authenticate with Crisp API
    ↓
Connect to RTM WebSocket
    ↓
Register Event Handlers
    ↓
Listen for Real-Time Events
    ↓
Sync to PostgreSQL Database
```

## Benefits of RTM

- **Real-Time**: Instant event delivery via WebSocket
- **Auto-Connect**: Automatically connects on application start
- **Reliable**: Built-in reconnection handling
- **Efficient**: Single persistent connection vs multiple HTTP requests

## File Structure

```
src/modules/crisp/services/
└── crisp-rtm.service.ts    # Single-file RTM implementation
```

All RTM logic is contained in one file for easy review and maintenance.
