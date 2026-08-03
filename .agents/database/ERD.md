```mermaid
erDiagram

    User {
        ObjectId id
        string username
        string displayName
        string email
        string avatarUrl
        enum status
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
        datetime editedAt
        datetime deletedAt
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

    Message ||--o{ Attachment : has

    User ||--o{ Notification : receives
```

`LoginProvider.providerAccountId` stores the Google `sub` for Google identities.
The pair of `provider` and `providerAccountId` is uniquely indexed across users.

Organization ownership is represented only by an `OWNER` membership. The
organization document does not duplicate ownership with an `ownerId` field.
Memberships are unique by `(organizationId, userId)`, and a partial unique index
on `(organizationId, role)` permits at most one `OWNER` membership per
organization. Organization creation and deletion maintain the required owner
membership in the same MongoDB transaction.

Invitation documents represent pending invitations only. They are unique by
`(organizationId, invitedUserId)`, expire after seven days, and are deleted when
accepted, declined, or when the organization is deleted.

Category names are case-insensitively unique within an organization through the
internal `nameKey`. Channel conversations require a category, use
`type = CHANNEL`, and have case-insensitively unique names within that category.
Both categories and channels use zero-based positions.

Public channels inherit organization membership. Private channels require both
an organization membership and a unique `(conversationId, userId)` participant
record. The organization owner is the initial participant in a private channel.
Participant records are removed when a channel becomes public.

Deleted messages remain as redacted timeline tombstones: `content` is nullable
only when `deletedAt` is set. Messages and conversation participants are removed
transactionally when their channel or organization is deleted.
