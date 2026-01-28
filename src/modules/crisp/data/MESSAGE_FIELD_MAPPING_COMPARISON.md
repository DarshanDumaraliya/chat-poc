# Crisp API vs Database Field Mapping Comparison - Messages

This document compares the field structure between Crisp API message response and our database schema.

## Overview

- **Crisp API Format**: Nested object structure (snake_case)
- **Database Format**: Flattened structure (camelCase)
- **Database Column Names**: snake_case (PostgreSQL)

---

## Field Mapping Table

| Crisp API Field | Database Field | Database Column | Type | Notes |
|----------------|----------------|-----------------|------|-------|
| `session_id` | `sessionId` | `session_id` | string | ✅ Mapped |
| `website_id` | `websiteId` | `website_id` | string | ✅ Mapped |
| `fingerprint` | `fingerprint` | `fingerprint` | number | ⚠️ Stored as string in DB (should be number) |
| `type` | `type` | `type` | string | ✅ Mapped |
| `from` | `from` | `from` | string | ✅ Mapped |
| `origin` | `origin` | `origin` | string | ✅ Mapped |
| `content` | `content` | `content` | string | ✅ Mapped |
| `user.user_id` | `userId` | `user_id` | string | ✅ Mapped (flattened) |
| `user.nickname` | `userNickname` | `user_nickname` | string | ✅ Mapped (flattened) |
| `preview` | `preview` | `preview` | array | ✅ Mapped (JSON) |
| `mentions` | `mentions` | `mentions` | array | ✅ Mapped (JSON) |
| `read` | `read` | `read` | string | ✅ Mapped |
| `delivered` | `delivered` | `delivered` | string | ✅ Mapped |
| `stamped` | `stamped` | `stamped` | boolean | ✅ Mapped |
| `timestamp` | `timestamp` | `timestamp` | number | ⚠️ Stored as string in DB (should be number) |
| - | `id` | `id` | number | ✅ Auto-generated (DB only) |
| - | `createdAt` | `created_at` | Date | ✅ Auto-generated (DB only) |
| - | `updatedAt` | `updated_at` | Date | ✅ Auto-generated (DB only) |

---

## Structure Differences

### 1. User Field

**Crisp API:**
```json
{
  "user": {
    "user_id": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",
    "nickname": "Webhook1"
  }
}
```

**Database:**
```json
{
  "userId": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",
  "userNickname": "Webhook1"
}
```

**Status**: ✅ Correctly flattened

---

### 2. Fingerprint Field

**Crisp API:**
```json
{
  "fingerprint": 176951563342210
}
```

**Database:**
```json
{
  "fingerprint": "176951563342210"  // ⚠️ Should be number, not string
}
```

**Issue**: `fingerprint` is stored as string in database but should be number (bigint).

---

### 3. Timestamp Field

**Crisp API:**
```json
{
  "timestamp": 1769515634602
}
```

**Database:**
```json
{
  "timestamp": "1769515634602"  // ⚠️ Should be number, not string
}
```

**Issue**: `timestamp` is stored as string in database but should be number (bigint).

---

## Complete Message Example Comparison

### Crisp API Response Example:
```json
{
  "session_id": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",
  "website_id": "1a87e1c9-8180-4b52-9d59-22e3dc39330b",
  "fingerprint": 176951563342210,
  "type": "text",
  "from": "user",
  "origin": "chat",
  "content": "Hello",
  "user": {
    "user_id": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",
    "nickname": "Webhook1"
  },
  "preview": [],
  "mentions": [],
  "read": "email",
  "delivered": "email",
  "stamped": true,
  "timestamp": 1769515634602
}
```

### Database Response Example:
```json
{
  "id": 1017,
  "fingerprint": "176951563342210",  // ⚠️ String instead of number
  "sessionId": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",
  "websiteId": "1a87e1c9-8180-4b52-9d59-22e3dc39330b",
  "type": "text",
  "from": "user",
  "origin": "chat",
  "content": "Hello",
  "userId": "session_db84a0cd-7b7c-43f2-9591-2eb40f95d138",  // ✅ Flattened
  "userNickname": "Webhook1",  // ✅ Flattened
  "preview": [],
  "mentions": [],
  "read": "email",
  "delivered": "email",
  "stamped": true,
  "timestamp": "1769515634602",  // ⚠️ String instead of number
  "createdAt": "2026-01-27T08:21:04.869Z",  // ✅ DB only
  "updatedAt": "2026-01-27T23:42:38.634Z"   // ✅ DB only
}
```

---

## Data Type Issues

The following fields are stored as **strings** in the database but should be **numbers**:

1. ❌ `fingerprint` - Should be `number` (bigint), currently stored as `string`
2. ❌ `timestamp` - Should be `number` (bigint), currently stored as `string`

**Root Cause**: These are `bigint` fields in PostgreSQL. When serialized to JSON, JavaScript converts them to strings because JSON doesn't natively support bigint values beyond JavaScript's safe integer range.

---

## Missing Fields Check

### ✅ All Crisp API Fields Are Mapped

All fields from the Crisp API message response are present in the database schema.

### ✅ Database-Only Fields

The following fields are database-only (not in Crisp API):
- `id` - Auto-generated primary key
- `createdAt` - Record creation timestamp
- `updatedAt` - Record update timestamp

---

## Field Transformation Summary

### Direct Mappings (No Transformation)
- `session_id` → `sessionId`
- `website_id` → `websiteId`
- `type` → `type`
- `from` → `from`
- `origin` → `origin`
- `content` → `content`
- `preview` → `preview` (array, stored as JSON)
- `mentions` → `mentions` (array, stored as JSON)
- `read` → `read`
- `delivered` → `delivered`
- `stamped` → `stamped`
- `fingerprint` → `fingerprint` (⚠️ type conversion issue)
- `timestamp` → `timestamp` (⚠️ type conversion issue)

### Flattened Mappings
- `user.user_id` → `userId`
- `user.nickname` → `userNickname`

### Database-Only Fields
- `id` - Auto-generated
- `createdAt` - Auto-generated
- `updatedAt` - Auto-generated

---

## Summary

### ✅ Correctly Mapped Fields: 15
- All fields from Crisp API are properly mapped
- Nested `user` object is correctly flattened
- Field names follow camelCase convention in entity
- Database columns use snake_case

### ⚠️ Data Type Issues: 2
- `fingerprint` - stored as string but should be number
- `timestamp` - stored as string but should be number

### ✅ Missing Fields: 0
- All Crisp API fields are present in database
- No missing mappings

---

## Recommendations

1. **Fix Data Type Serialization**: 
   - Ensure `bigint` fields (`fingerprint`, `timestamp`) are serialized as numbers in API responses
   - Consider using a custom JSON serializer for bigint values
   - Or convert to strings explicitly if needed for compatibility

2. **Type Safety**: 
   - Verify TypeORM entity types match actual database column types
   - The entity definition is correct (`type: 'bigint'`), but serialization needs attention

3. **Validation**: 
   - Add validation to ensure numeric fields remain numeric during transformation
   - Consider using `@Transform` decorators from `class-transformer` if needed

---

## Transformation Logic

The transformation from Crisp API to Database format is handled in:
- `src/modules/crisp/services/crisp.service.ts` - `transformMessageData()`
- `src/modules/crisp/services/crisp-rtm.service.ts` - `transformMessageData()`

Both methods correctly flatten the `user` object and map field names.

### Example Transformation:
```typescript
// Crisp API format
{
  user: {
    user_id: "123",
    nickname: "John"
  }
}

// Transformed to Database format
{
  userId: "123",
  userNickname: "John"
}
```

---

## Comparison with Conversation Mapping

| Aspect | Conversations | Messages |
|--------|--------------|----------|
| **Total Fields** | 28 | 15 |
| **Nested Structures** | 5 (active, unread, meta, preview_message, assigned) | 1 (user) |
| **Data Type Issues** | 5 fields | 2 fields |
| **Missing Fields** | 0 | 0 |
| **Flattening Required** | Yes (multiple) | Yes (user object) |

Both follow the same pattern:
- Flatten nested structures
- Convert snake_case to camelCase
- Store JSON fields as JSON in database
- Handle bigint serialization issues
