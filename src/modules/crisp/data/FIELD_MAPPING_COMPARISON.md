# Crisp API vs Database Field Mapping Comparison

This document compares the field structure between Crisp API response and our database schema.

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
| `active.last` | `activeLast` | `active_last` | number | ⚠️ Stored as string in DB (should be number) |
| `active.now` | `activeNow` | `active_now` | boolean | ✅ Mapped |
| `availability` | `availability` | `availability` | string | ✅ Mapped |
| `created_at` | `createdAtCrisp` | `created_at_crisp` | number | ⚠️ Stored as string in DB (should be number) |
| `is_blocked` | `isBlocked` | `is_blocked` | boolean | ✅ Mapped |
| `mentions` | `mentions` | `mentions` | array | ✅ Mapped (JSON) |
| `meta.nickname` | `metaNickname` | `meta_nickname` | string | ✅ Mapped (flattened) |
| `meta.email` | `metaEmail` | `meta_email` | string | ✅ Mapped (flattened) |
| `meta.phone` | `metaPhone` | `meta_phone` | string | ✅ Mapped (flattened) |
| `meta.avatar` | `metaAvatar` | `meta_avatar` | string | ✅ Mapped (flattened) |
| `meta.ip` | `metaIp` | `meta_ip` | string | ✅ Mapped (flattened) |
| `meta.origin` | `metaOrigin` | `meta_origin` | string | ✅ Mapped (flattened) |
| `meta.segments` | `metaSegments` | `meta_segments` | array | ✅ Mapped (flattened, JSON) |
| `meta.data` | `metaData` | `meta_data` | object | ✅ Mapped (flattened, JSON) |
| `meta.device` | `metaDevice` | `meta_device` | object | ✅ Mapped (flattened, JSON) |
| `meta.connection` | `metaConnection` | `meta_connection` | object | ✅ Mapped (flattened, JSON) |
| `participants` | `participants` | `participants` | array | ✅ Mapped (JSON) |
| `state` | `state` | `state` | string | ✅ Mapped |
| `status` | `status` | `status` | number | ✅ Mapped |
| `unread.operator` | `unreadOperator` | `unread_operator` | number | ✅ Mapped (flattened) |
| `unread.visitor` | `unreadVisitor` | `unread_visitor` | number | ✅ Mapped (flattened) |
| `updated_at` | `updatedAtCrisp` | `updated_at_crisp` | number | ⚠️ Stored as string in DB (should be number) |
| `verifications` | `verifications` | `verifications` | array | ✅ Mapped (JSON) |
| `last_message` | `lastMessage` | `last_message` | string | ✅ Mapped |
| `preview_message.type` | `previewMessageType` | `preview_message_type` | string | ✅ Mapped (flattened) |
| `preview_message.from` | `previewMessageFrom` | `preview_message_from` | string | ✅ Mapped (flattened) |
| `preview_message.excerpt` | `previewMessageExcerpt` | `preview_message_excerpt` | string | ✅ Mapped (flattened) |
| `preview_message.fingerprint` | `previewMessageFingerprint` | `preview_message_fingerprint` | number | ⚠️ Stored as string in DB (should be number) |
| `waiting_since` | `waitingSince` | `waiting_since` | number | ⚠️ Stored as string in DB (should be number) |
| `assigned.user_id` | `assignedUserId` | `assigned_user_id` | string | ✅ Mapped (flattened) |
| `people_id` | `peopleId` | `people_id` | string | ✅ Mapped |
| `compose` | `compose` | `compose` | object | ✅ Mapped (JSON) |
| - | `id` | `id` | number | ✅ Auto-generated (DB only) |
| - | `createdAt` | `created_at` | Date | ✅ Auto-generated (DB only) |
| - | `updatedAt` | `updated_at` | Date | ✅ Auto-generated (DB only) |

---

## Structure Differences

### 1. Active Field

**Crisp API:**
```json
{
  "active": {
    "last": 1769523280257,
    "now": false
  }
}
```

**Database:**
```json
{
  "activeLast": "1769523280257",  // ⚠️ Should be number, not string
  "activeNow": false
}
```

**Issue**: `activeLast` is stored as string in database but should be number.

---

### 2. Unread Field

**Crisp API:**
```json
{
  "unread": {
    "operator": 0,
    "visitor": 2
  }
}
```

**Database:**
```json
{
  "unreadOperator": 0,
  "unreadVisitor": 2
}
```

**Status**: ✅ Correctly flattened

---

### 3. Meta Field

**Crisp API:**
```json
{
  "meta": {
    "nickname": "Webhook1",
    "email": "webhook1@gmail.com",
    "phone": "",
    "avatar": "",
    "ip": "2401:4900:1f3f:72c0::",
    "origin": "chat",
    "segments": [],
    "data": {},
    "device": { ... },
    "connection": { ... }
  }
}
```

**Database:**
```json
{
  "metaNickname": "Webhook1",
  "metaEmail": "webhook1@gmail.com",
  "metaPhone": "",
  "metaAvatar": "",
  "metaIp": "2401:4900:1f3f:72c0::",
  "metaOrigin": "chat",
  "metaSegments": [],
  "metaData": {},
  "metaDevice": { ... },
  "metaConnection": { ... }
}
```

**Status**: ✅ Correctly flattened

---

### 4. Preview Message Field

**Crisp API:**
```json
{
  "preview_message": {
    "type": "text",
    "from": "operator",
    "excerpt": "Very good developer",
    "fingerprint": 176952205247870
  }
}
```

**Database:**
```json
{
  "previewMessageType": "text",
  "previewMessageFrom": "operator",
  "previewMessageExcerpt": "Very good developer",
  "previewMessageFingerprint": "176952205247870"  // ⚠️ Should be number, not string
}
```

**Issue**: `previewMessageFingerprint` is stored as string in database but should be number.

---

### 5. Assigned Field

**Crisp API:**
```json
{
  "assigned": {
    "user_id": "1af31448-27d1-4dbb-a51f-5b23d9cc1898"
  }
}
```

**Database:**
```json
{
  "assignedUserId": "1af31448-27d1-4dbb-a51f-5b23d9cc1898"
}
```

**Status**: ✅ Correctly flattened

---

## Data Type Issues

The following fields are stored as **strings** in the database but should be **numbers**:

1. ❌ `activeLast` - Should be `number`, currently stored as `string`
2. ❌ `createdAtCrisp` - Should be `number`, currently stored as `string`
3. ❌ `updatedAtCrisp` - Should be `number`, currently stored as `string`
4. ❌ `previewMessageFingerprint` - Should be `number`, currently stored as `string`
5. ❌ `waitingSince` - Should be `number`, currently stored as `string`

**Root Cause**: These are likely being serialized as strings during JSON response formatting. The entity definition is correct (type: 'bigint'), but the JSON serialization may be converting them to strings.

---

## Missing Fields Check

### ✅ All Crisp API Fields Are Mapped

All fields from the Crisp API response are present in the database schema.

### ✅ Database-Only Fields

The following fields are database-only (not in Crisp API):
- `id` - Auto-generated primary key
- `createdAt` - Record creation timestamp
- `updatedAt` - Record update timestamp

---

## Summary

### ✅ Correctly Mapped Fields: 28
- All nested structures are properly flattened
- Field names follow camelCase convention in entity
- Database columns use snake_case

### ⚠️ Data Type Issues: 5
- 5 fields stored as strings but should be numbers
- These are timestamp/bigint fields that may be serialized incorrectly

### ✅ Missing Fields: 0
- All Crisp API fields are present in database
- No missing mappings

---

## Recommendations

1. **Fix Data Type Serialization**: Ensure bigint/number fields are serialized as numbers, not strings in API responses
2. **Type Safety**: Verify TypeORM entity types match actual database column types
3. **Validation**: Add validation to ensure numeric fields remain numeric during transformation

---

## Transformation Logic

The transformation from Crisp API to Database format is handled in:
- `src/modules/crisp/services/crisp.service.ts` - `transformConversationData()`
- `src/modules/crisp/services/crisp-rtm.service.ts` - `transformConversationData()`

Both methods correctly flatten nested structures and map field names.
