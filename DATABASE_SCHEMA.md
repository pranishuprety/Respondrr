# Database Schema Documentation

## Overview
This document outlines the database schema for the healthcare management system.

---

## Tables

### patient_doctor_links
Links between patients and doctors with relationship status tracking.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('patient_doctor_links_id_seq'::regclass) |
| patient_id | uuid | NO | - |
| doctor_id | uuid | NO | - |
| status | text | NO | 'requested'::text |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| ended_at | timestamp with time zone | YES | NULL |

**Primary Key:** id  
**Foreign Keys:** patient_id (references profiles.id), doctor_id (references profiles.id)  
**Unique Index:** patient_doctor_links_unique (patient_id, doctor_id) - prevents duplicate pairs  
**Check Constraint:** status IN ('requested', 'active', 'ended', 'blocked')  
**Status Values:**
  - 'requested' - pending doctor approval
  - 'active' - doctor approved, active connection
  - 'ended' - connection has ended
  - 'blocked' - connection is blocked

---

### profiles
User profile information for both patients and doctors.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | - |
| full_name | text | NO | - |
| phone | text | YES | NULL |
| address | text | YES | NULL |
| country | text | YES | NULL |
| role | user_role | NO | 'patient'::user_role |
| license_number | text | YES | NULL |
| certification | text | YES | NULL |
| is_verified | boolean | YES | false |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |

**Primary Key:** id  
**Foreign Key:** Linked to auth.users.id

---

### auth.users
Authentication and user account information (Supabase/Auth schema).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| instance_id | uuid | YES | NULL |
| id | uuid | NO | - |
| aud | character varying | YES | NULL |
| role | character varying | YES | NULL |
| email | character varying | YES | NULL |
| encrypted_password | character varying | YES | NULL |
| email_confirmed_at | timestamp with time zone | YES | NULL |
| invited_at | timestamp with time zone | YES | NULL |
| confirmation_token | character varying | YES | NULL |
| confirmation_sent_at | timestamp with time zone | YES | NULL |
| recovery_token | character varying | YES | NULL |
| recovery_sent_at | timestamp with time zone | YES | NULL |
| email_change_token_new | character varying | YES | NULL |
| email_change | character varying | YES | NULL |
| email_change_sent_at | timestamp with time zone | YES | NULL |
| last_sign_in_at | timestamp with time zone | YES | NULL |
| raw_app_meta_data | jsonb | YES | NULL |
| raw_user_meta_data | jsonb | YES | NULL |
| is_super_admin | boolean | YES | NULL |
| created_at | timestamp with time zone | YES | NULL |
| updated_at | timestamp with time zone | YES | NULL |
| phone | text | YES | NULL::character varying |
| phone_confirmed_at | timestamp with time zone | YES | NULL |
| phone_change | text | YES | ''::character varying |
| phone_change_token | character varying | YES | ''::character varying |
| phone_change_sent_at | timestamp with time zone | YES | NULL |
| confirmed_at | timestamp with time zone | YES | NULL |
| email_change_token_current | character varying | YES | ''::character varying |
| email_change_confirm_status | smallint | YES | 0 |
| banned_until | timestamp with time zone | YES | NULL |
| reauthentication_token | character varying | YES | ''::character varying |
| reauthentication_sent_at | timestamp with time zone | YES | NULL |
| is_sso_user | boolean | NO | false |
| deleted_at | timestamp with time zone | YES | NULL |
| is_anonymous | boolean | NO | false |

**Primary Key:** id

---

### health_aggregated
Aggregated health metrics data for users.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('health_aggregated_id_seq'::regclass) |
| metric_name | text | NO | - |
| timestamp | timestamp with time zone | NO | - |
| value | double precision | NO | - |
| units | text | YES | NULL |
| email | text | NO | - |

**Primary Key:** id

---

### health_realtime
Real-time health metrics data for users.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('health_realtime_id_seq'::regclass) |
| metric_name | text | NO | - |
| timestamp | timestamp with time zone | NO | - |
| value | double precision | NO | - |
| source | text | YES | NULL |
| email | text | NO | - |

**Primary Key:** id

---

### conversations
Stores conversations between patients and doctors.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('conversations_id_seq'::regclass) |
| patient_id | uuid | NO | - |
| doctor_id | uuid | NO | - |
| created_at | timestamp with time zone | NO | now() |
| last_message_at | timestamp with time zone | YES | NULL |

**Primary Key:** id  
**Foreign Keys:** patient_id (references profiles.id), doctor_id (references profiles.id)  
**Unique Index:** conversations_unique_pair (patient_id, doctor_id) - ensures one conversation per patient-doctor pair

---

### messages
Individual messages within conversations.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('messages_id_seq'::regclass) |
| conversation_id | bigint | NO | - |
| sender_id | uuid | NO | - |
| body | text | YES | NULL |
| message_type | text | NO | 'text' |
| created_at | timestamp with time zone | NO | now() |

**Primary Key:** id  
**Foreign Keys:** conversation_id (references conversations.id), sender_id (references profiles.id)  
**Check Constraint:** message_type in ('text','file','mixed','system')  
**Index:** messages_conversation_created_idx (conversation_id, created_at)

---

### message_attachments
File attachments within messages, stored in Supabase Storage.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | nextval('message_attachments_id_seq'::regclass) |
| message_id | bigint | NO | - |
| bucket | text | NO | 'message-files' |
| object_path | text | NO | - |
| file_name | text | YES | NULL |
| mime_type | text | YES | NULL |
| file_size | bigint | YES | NULL |
| created_at | timestamp with time zone | NO | now() |

**Primary Key:** id  
**Foreign Key:** message_id (references messages.id)  
**Index:** message_attachments_message_idx (message_id)

---

### video_calls
Video call sessions between patients and doctors.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | generated by default as identity |
| conversation_id | bigint | NO | - |
| provider | text | NO | 'daily' |
| room_name | text | NO | - |
| room_url | text | YES | NULL |
| started_by | uuid | NO | - |
| status | text | NO | 'scheduled' |
| scheduled_for | timestamp with time zone | YES | NULL |
| started_at | timestamp with time zone | YES | NULL |
| ended_at | timestamp with time zone | YES | NULL |
| recording_enabled | boolean | NO | false |
| recording_url | text | YES | NULL |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

**Primary Key:** id  
**Foreign Keys:** conversation_id (references conversations.id), started_by (references profiles.id)  
**Check Constraint:** status IN ('scheduled', 'ringing', 'active', 'ended', 'missed', 'canceled', 'failed')  
**Indexes:** 
  - video_calls_conversation_created_idx (conversation_id, created_at desc)
  - video_calls_status_idx (status)  
**Trigger:** update_video_calls_updated_at - automatically updates updated_at timestamp on row modification  
**Status Values:**
  - 'scheduled' - call is scheduled for later
  - 'ringing' - call is ringing/attempting to connect
  - 'active' - call is currently in progress
  - 'ended' - call has ended normally
  - 'missed' - call was not answered
  - 'canceled' - call was canceled before starting
  - 'failed' - call failed to connect

---

## Relationships

```
auth.users (1) ────── (1) profiles
                            │
                            │
                ┌───────────┴───────────┐
                │                       │
        patient_id                 doctor_id
                │                       │
                └───────────┬───────────┘
                            │
            patient_doctor_links (N)
                            
                            │
                ┌───────────┴───────────┐
                │                       │
        patient_id                 doctor_id
                │                       │
                └───────────┬───────────┘
                            │
            conversations (1:1 pair)
                            │
            ┌───────────────┼───────────────┐
            │                               │
       (conversation_id)           (conversation_id)
            │                               │
        messages (N)              video_calls (N)
            │
       (message_id)
            │
    message_attachments (N)
```

- **auth.users → profiles:** One-to-one relationship via profiles.id
- **patient_doctor_links:** Stores many-to-many relationships between patients and doctors
- **conversations:** One unique conversation per patient-doctor pair
- **messages:** Messages belong to a conversation and are sent by a profile
- **message_attachments:** File attachments associated with messages
- **video_calls:** Video call sessions associated with conversations, initiated by a profile
- **health_aggregated & health_realtime:** Associated with users via email field

