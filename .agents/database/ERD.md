```mermaid
erDiagram

    User {
        ObjectId id
        string username
        string displayName
        string email
        string avatarUrl
        datetime lastSeenAt
        LoginProvider[] loginProviders
        datetime createdAt
        datetime updatedAt
    }

    LoginProvider {
        enum provider
        string providerAccountId
        string passwordHash
        datetime linkedAt
        datetime lastUsedAt
        object metadata
    }

    AuthSession {
        string id
        ObjectId userId
        string tokenHash
        datetime expiresAt
        datetime createdAt
        datetime updatedAt
    }

    Organization {
        ObjectId id
        string name
        string slug
        string logoUrl
        enum visibility
        int mutationVersion
        datetime createdAt
        datetime updatedAt
    }

    Membership {
        ObjectId id
        ObjectId userId
        ObjectId organizationId
        string role
        datetime joinedAt
    }

    Invitation {
        ObjectId id
        ObjectId organizationId
        ObjectId invitedUserId
        ObjectId invitedByUserId
        datetime expiresAt
        datetime createdAt
    }

    Category {
        ObjectId id
        ObjectId organizationId
        string name
        string nameKey
        int position
        datetime createdAt
        datetime updatedAt
    }

    Conversation {
        ObjectId id
        ObjectId organizationId
        ObjectId categoryId
        string name
        string nameKey
        enum type
        enum visibility
        int position
        string directParticipantKey
        ObjectId directParticipantAId
        ObjectId directParticipantBId
        datetime activityAt
        datetime createdAt
        datetime updatedAt
    }

    ConversationParticipant {
        ObjectId id
        ObjectId organizationId
        ObjectId conversationId
        ObjectId userId
        ObjectId addedByUserId
        datetime joinedAt
    }

    Message {
        ObjectId id
        ObjectId conversationId
        ObjectId senderId
        string content
        enum messageType
        datetime createdAt
        datetime updatedAt
        datetime editedAt
        datetime deletedAt
    }

    MessageReaction {
        ObjectId id
        ObjectId conversationId
        ObjectId messageId
        ObjectId userId
        string emoji
        datetime createdAt
        datetime updatedAt
    }

    ConversationReadState {
        ObjectId id
        ObjectId organizationId
        ObjectId conversationId
        ObjectId userId
        ObjectId lastReadMessageId
        datetime lastReadAt
    }

    Attachment {
        ObjectId id
        ObjectId messageId
        string url
        string mimeType
    }

    Notification {
        ObjectId id
        ObjectId userId
        enum type
        boolean isRead
        datetime createdAt
    }

    User ||--o{ Membership : joins
    User ||--o{ LoginProvider : embeds
    User ||--o{ AuthSession : authenticates
    Organization ||--o{ Membership : has
    Organization ||--o{ Invitation : has
    User ||--o{ Invitation : receives
    User ||--o{ Invitation : creates

    Organization ||--o{ Category : contains

    Organization ||--o{ Conversation : owns

    Category ||--o{ Conversation : groups

    Conversation ||--o{ ConversationParticipant : grants_access

    User ||--o{ ConversationParticipant : participates

    Conversation ||--o{ Message : contains

    User ||--o{ Message : sends

    Message ||--o{ MessageReaction : receives

    Conversation ||--o{ MessageReaction : scopes

    User ||--o{ MessageReaction : selects

    Conversation ||--o{ ConversationReadState : tracks_reads

    User ||--o{ ConversationReadState : reads

    Message ||--o{ Attachment : has

    User ||--o{ Notification : receives
```

`LoginProvider.providerAccountId` stores the Google `sub` for Google identities.
The pair of `provider` and `providerAccountId` is uniquely indexed across users.
New users/provider links and their initial `AuthSession` are committed in one
MongoDB transaction.

Organization ownership is represented only by an `OWNER` membership. The
organization document does not duplicate ownership with an `ownerId` field.
Memberships are unique by `(organizationId, userId)`, and a partial unique index
on `(organizationId, role)` permits at most one `OWNER` membership per
organization. Organization creation and deletion maintain the required owner
membership in the same MongoDB transaction.

`Organization.mutationVersion` is internal and is incremented inside
organization-scoped write transactions. Concurrent mutations therefore contend
on one organization document, allowing MongoDB's transaction retry behavior to
serialize ordering and lifecycle changes without exposing the version publicly
or changing `updatedAt`.

Invitation documents represent pending invitations only. They are unique by
`(organizationId, invitedUserId)`, expire after seven days, and are deleted when
accepted, declined, or when the organization is deleted.

Category names are case-insensitively unique within an organization through the
internal `nameKey`. Channel conversations require a category, use
`type = CHANNEL`, and have case-insensitively unique names within that category.
Both categories and channels use zero-based positions.

Direct messages use the same `Conversation` collection with `type = DIRECT`.
Their category, name, name key, visibility, and position fields are absent. A
sorted internal `directParticipantKey` and a partial unique index enforce one DM
per user pair in each organization. Exactly two participant records grant DM
access, in addition to both users requiring current organization membership.
The sorted `directParticipantAId` and `directParticipantBId` fields plus
`activityAt` support participant-specific, database-bounded DM pagination.
Message creation advances `activityAt` in the same transaction as the message.

Public channels inherit organization membership. Private channels require both
an organization membership and a unique `(conversationId, userId)` participant
record. The organization owner is the initial participant in a private channel.
Participant records are removed when a channel becomes public.

`ConversationReadState` is the durable high-water mark for a user's reads in a
conversation. It is unique by `(conversationId, userId)`. Unread counts exclude
the reader's own and deleted messages after `lastReadMessageId`. Organization
and conversation deletion remove read states in the same transaction. Direct
conversation DTOs expose both the caller's state and the peer's state; channel
reader state remains private and is used for that reader's unread count. The
`(conversationId, lastReadMessageId, lastReadAt)` index supports sender-only
channel reader summaries. Those summaries are derived by joining current
organization memberships and, for private channels, current participants; no
separate receipt-detail collection is stored.

Online presence and typing are runtime-only state. `User.lastSeenAt` is the only
persisted presence field and is updated after the user's final socket has been
offline for the disconnect grace period.

Deleted messages remain as redacted timeline tombstones: `content` is nullable
only when `deletedAt` is set. Messages and conversation participants are removed
transactionally when their channel or organization is deleted.

`MessageReaction` stores one normalized Unicode emoji sequence per user and
message. A unique `(messageId, userId)` index enforces the one-reaction rule;
`(conversationId, messageId, emoji)` and `(messageId, emoji, id)` indexes support
summary aggregation, cleanup, and cursor-paginated reactor lists. Personalized
reaction summaries are derived from current memberships and, for private
channels and direct messages, current participant records. Message redaction,
conversation deletion, organization deletion, private-participant removal, and
public-to-private visibility transitions delete reactions that no longer have a
valid lifecycle or authorized owner.

Search does not introduce a persistence entity. Native development search uses
text indexes on `Message.content`, `Conversation.name`, and the weighted
`User.displayName`/`User.username` pair. Production uses three versioned Atlas
Search indexes over the same collections. Message results are filtered to
currently accessible conversation IDs before DTO serialization; people results
are filtered to current organization memberships and never expose email or
provider data. Search cursors are opaque and bound to the provider, normalized
query, result type, and optional conversation filter.
