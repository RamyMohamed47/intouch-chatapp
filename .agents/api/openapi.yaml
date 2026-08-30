
openapi: 3.1.0

info:
  title: InTouch REST API
  version: 1.0.0
  description: |
    REST API for InTouch.

    InTouch is a multi-tenant real-time communication platform inspired by
    Discord, Slack, and WhatsApp.

    This specification documents the HTTP API only.
    Real-time communication is documented separately under Socket.IO.

servers:
  - url: /api/v1
    description: Current host through the API or frontend proxy
  - url: http://localhost:3000/api/v1
    description: Local API development

tags:
  - name: Authentication
  - name: Users
  - name: Organizations
  - name: Memberships
  - name: Categories
  - name: Conversations
  - name: Messages
  - name: Uploads
  - name: Notifications
  - name: Search

security:
  - bearerAuth: []

paths:

  #
  # Authentication
  #

  /auth/register:
    post:
      tags: [Authentication]
      summary: Register a new user
      security: []
      requestBody:
        $ref: "#/components/requestBodies/RegisterRequest"
      responses:
        "201":
          $ref: "#/components/responses/RegistrationPendingResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/login:
    post:
      tags: [Authentication]
      summary: Authenticate user
      description: |
        Password login is protected by independent per-IP and per-account
        attempt limits. The first ten account attempts within fifteen minutes
        are admitted. Further attempts receive a generic 429 response during a
        non-extending fifteen-minute cooldown.
      security: []
      requestBody:
        $ref: "#/components/requestBodies/LoginRequest"
      responses:
        "200":
          $ref: "#/components/responses/LoginResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          description: Valid credentials supplied, but email confirmation is required.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/verify-email:
    post:
      tags: [Authentication]
      summary: Confirm a password account email
      description: Consumes a single-use 24-hour email-confirmation token.
      security: []
      requestBody:
        $ref: "#/components/requestBodies/VerifyEmailRequest"
      responses:
        "204":
          description: Email confirmed
        "400":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/resend-verification:
    post:
      tags: [Authentication]
      summary: Request another email-confirmation message
      description: Always returns the same accepted response for eligible and ineligible addresses.
      security: []
      requestBody:
        $ref: "#/components/requestBodies/EmailRequest"
      responses:
        "202":
          $ref: "#/components/responses/AuthRequestAcceptedResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/forgot-password:
    post:
      tags: [Authentication]
      summary: Request a password-reset message
      description: Always returns the same accepted response and never reveals account existence.
      security: []
      requestBody:
        $ref: "#/components/requestBodies/EmailRequest"
      responses:
        "202":
          $ref: "#/components/responses/AuthRequestAcceptedResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/reset-password:
    post:
      tags: [Authentication]
      summary: Replace a password using a reset token
      description: Consumes a single-use 15-minute token, confirms the email, and revokes all refresh sessions.
      security: []
      requestBody:
        $ref: "#/components/requestBodies/ResetPasswordRequest"
      responses:
        "204":
          description: Password replaced and existing refresh sessions revoked
        "400":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/oauth/google:
    get:
      tags: [Authentication]
      summary: Start Google OAuth authentication
      security: []
      responses:
        "302":
          $ref: "#/components/responses/GoogleOAuthStartRedirect"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/oauth/google/callback:
    get:
      tags: [Authentication]
      summary: Complete Google OAuth authentication
      security: []
      parameters:
        - name: code
          in: query
          required: false
          schema:
            type: string
        - name: state
          in: query
          required: false
          schema:
            type: string
        - name: error
          in: query
          required: false
          schema:
            type: string
      responses:
        "302":
          $ref: "#/components/responses/GoogleOAuthCallbackRedirect"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "500":
          $ref: "#/components/responses/InternalServerError"
        "503":
          $ref: "#/components/responses/ServiceUnavailable"

  /auth/refresh:
    post:
      tags: [Authentication]
      summary: Refresh access token
      security:
        - refreshCookie: []
      parameters:
        - $ref: "#/components/parameters/RefreshCsrfHeader"
      responses:
        "200":
          $ref: "#/components/responses/AccessTokenResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/logout:
    post:
      tags: [Authentication]
      summary: Revoke the current refresh session
      description: |
        Idempotently revokes the refresh session identified by the refresh
        cookie and clears that cookie. No request body is accepted.
      security:
        - refreshCookie: []
      parameters:
        - $ref: "#/components/parameters/RefreshCsrfHeader"
      responses:
        "204":
          description: Session revoked or already absent; refresh cookie cleared
        "403":
          $ref: "#/components/responses/Forbidden"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /auth/me:
    get:
      tags: [Authentication]
      summary: Get current authenticated user
      responses:
        "200":
          $ref: "#/components/responses/UserResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /uploads:
    post:
      tags: [Uploads]
      summary: Create private direct-upload tickets
      description: Reserves quota and returns five-minute, content-type-bound R2 PUT URLs. Objects remain private and must be completed before use.
      requestBody:
        $ref: "#/components/requestBodies/CreateUploadRequest"
      responses:
        "201":
          $ref: "#/components/responses/CreateUploadResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "413":
          $ref: "#/components/responses/PayloadTooLarge"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "503":
          $ref: "#/components/responses/StorageUnavailable"

  /uploads/{uploadId}:
    delete:
      tags: [Uploads]
      summary: Cancel an unclaimed upload
      parameters:
        - $ref: "#/components/parameters/UploadId"
      responses:
        "204":
          description: Upload canceled or already absent
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /uploads/{uploadId}/complete:
    post:
      tags: [Uploads]
      summary: Verify and promote an uploaded object
      description: Verifies object metadata and content signatures before conditionally promoting it to an immutable private key. Repeating a completed request is idempotent.
      parameters:
        - $ref: "#/components/parameters/UploadId"
      responses:
        "200":
          $ref: "#/components/responses/CompleteUploadResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "503":
          $ref: "#/components/responses/StorageUnavailable"

  /assets/{assetId}/access:
    get:
      tags: [Uploads]
      summary: Create an authorized private-asset URL
      description: Returns a ten-minute R2 GET URL. Message assets require current conversation access; avatars and organization logos require authentication.
      parameters:
        - $ref: "#/components/parameters/AssetId"
      responses:
        "200":
          $ref: "#/components/responses/AssetAccessResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "503":
          $ref: "#/components/responses/StorageUnavailable"

  /users/me/avatar:
    put:
      tags: [Users, Uploads]
      summary: Set the caller's uploaded avatar
      requestBody:
        $ref: "#/components/requestBodies/UpdateAvatarRequest"
      responses:
        "200":
          $ref: "#/components/responses/UserResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"
    delete:
      tags: [Users, Uploads]
      summary: Remove the caller's uploaded avatar
      responses:
        "200":
          $ref: "#/components/responses/UserResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /users/me/chat-wallpaper:
    get:
      tags: [Users]
      summary: Get the caller's default chat wallpaper
      description: Returns the built-in InTouch default when no preference has been stored.
      responses:
        "200":
          $ref: "#/components/responses/ChatWallpaperResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
    put:
      tags: [Users]
      summary: Set the caller's default chat wallpaper
      requestBody:
        $ref: "#/components/requestBodies/UpdateChatWallpaperRequest"
      responses:
        "200":
          $ref: "#/components/responses/ChatWallpaperResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  #
  # Organizations
  #

  /organizations:
    get:
      tags: [Organizations]
      summary: List organizations for current user
      responses:
        "200":
          $ref: "#/components/responses/OrganizationListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

    post:
      tags: [Organizations]
      summary: Create organization
      requestBody:
        $ref: "#/components/requestBodies/CreateOrganizationRequest"
      responses:
        "201":
          $ref: "#/components/responses/OrganizationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "409":
          $ref: "#/components/responses/Conflict"

  /organizations/{id}:
    get:
      tags: [Organizations]
      summary: Get organization
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
    patch:
      tags: [Organizations]
      summary: Update organization
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateOrganizationRequest"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

    delete:
      tags: [Organizations]
      summary: Delete organization
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      responses:
        "204":
          description: Organization deleted
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

  /organizations/{id}/logo:
    put:
      tags: [Organizations, Uploads]
      summary: Set an uploaded organization logo
      description: Owner-only. Atomically claims one completed ORGANIZATION_LOGO upload and schedules the previous logo for deletion.
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateOrganizationLogoRequest"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
    delete:
      tags: [Organizations, Uploads]
      summary: Remove the uploaded organization logo
      description: Owner-only. Clears the logo reference and schedules the private asset for deletion.
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
  #
  # Memberships
  #

  /organizations/{id}/invitations:
    post:
      tags: [Memberships]
      summary: Invite a registered user
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      requestBody:
        $ref: "#/components/requestBodies/InviteMemberRequest"
      responses:
        "201":
          $ref: "#/components/responses/InvitationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /organizations/{id}/join:
    post:
      tags: [Memberships]
      summary: Join a public organization
      parameters:
        - $ref: "#/components/parameters/OrganizationResourceId"
      responses:
        "201":
          $ref: "#/components/responses/MembershipResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /invitations:
    get:
      tags: [Memberships]
      summary: List current user's pending invitations
      responses:
        "200":
          $ref: "#/components/responses/InvitationListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /invitations/{invitationId}/accept:
    post:
      tags: [Memberships]
      summary: Accept a pending invitation
      parameters:
        - $ref: "#/components/parameters/InvitationId"
      responses:
        "201":
          $ref: "#/components/responses/MembershipResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /invitations/{invitationId}:
    delete:
      tags: [Memberships]
      summary: Decline a pending invitation
      parameters:
        - $ref: "#/components/parameters/InvitationId"
      responses:
        "204":
          description: Invitation declined
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  #
  # Categories
  #

  /organizations/{organizationId}/categories:
    get:
      tags: [Categories]
      summary: List categories
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      responses:
        "200":
          $ref: "#/components/responses/CategoryListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

    post:
      tags: [Categories]
      summary: Create category
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      requestBody:
        $ref: "#/components/requestBodies/CreateCategoryRequest"
      responses:
        "201":
          $ref: "#/components/responses/CategoryResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "409":
          $ref: "#/components/responses/Conflict"

  /organizations/{organizationId}/categories/{categoryId}:
    patch:
      tags: [Categories]
      summary: Update category
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - $ref: "#/components/parameters/CategoryId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateCategoryRequest"
      responses:
        "200":
          $ref: "#/components/responses/CategoryResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

    delete:
      tags: [Categories]
      summary: Delete category
      description: A category containing channels cannot be deleted.
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - $ref: "#/components/parameters/CategoryId"
      responses:
        "204":
          description: Category deleted
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /organizations/{organizationId}/members:
    get:
      tags: [Memberships]
      summary: List organization members and current presence
      description: Available to every current organization member.
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationMemberListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

  #
  # Search
  #

  /organizations/{organizationId}/search:
    get:
      tags: [Search]
      summary: Search an organization
      description: Searches only messages, channels, and members accessible to the authenticated organization member. ALL returns up to five results per kind; type-specific searches support opaque cursor pagination.
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - name: q
          in: query
          required: true
          schema:
            type: string
            minLength: 2
            maxLength: 100
        - name: type
          in: query
          schema:
            type: string
            enum: [ALL, MESSAGES, CHANNELS, PEOPLE]
            default: ALL
        - name: conversationId
          in: query
          description: Valid only when type is MESSAGES.
          schema:
            type: string
            pattern: "^[a-fA-F0-9]{24}$"
        - name: cursor
          in: query
          description: Provider-specific opaque cursor valid only for a type-specific search with the same filters.
          schema:
            type: string
            maxLength: 4096
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 50
            default: 20
      responses:
        "200":
          $ref: "#/components/responses/SearchResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"
        "503":
          $ref: "#/components/responses/SearchUnavailable"

  #
  # Conversations
  #

  /organizations/{organizationId}/conversations:
    get:
      tags: [Conversations]
      summary: List channel conversations
      description: Returns accessible channels with last-message, unread-count, and caller read-state summaries. Direct messages are listed separately.
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - name: categoryId
          in: query
          schema:
            type: string
            pattern: "^[a-fA-F0-9]{24}$"
      responses:
        "200":
          $ref: "#/components/responses/ConversationListResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

    post:
      tags: [Conversations]
      summary: Create channel conversation
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      requestBody:
        $ref: "#/components/requestBodies/CreateConversationRequest"
      responses:
        "201":
          $ref: "#/components/responses/ConversationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /organizations/{organizationId}/direct-messages:
    get:
      tags: [Conversations]
      summary: List the caller's direct messages in an organization
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - name: before
          in: query
          schema:
            type: string
            maxLength: 512
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 30
      responses:
        "200":
          $ref: "#/components/responses/DirectMessageListResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
    post:
      tags: [Conversations]
      summary: Create or retrieve a one-to-one direct message
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateDirectMessageInput"
      responses:
        "200":
          description: Existing direct message returned
          content:
            application/json:
              schema:
                type: object
                required: [directMessage]
                properties:
                  directMessage:
                    $ref: "#/components/schemas/DirectConversation"
        "201":
          description: Direct message created
          content:
            application/json:
              schema:
                type: object
                required: [directMessage]
                properties:
                  directMessage:
                    $ref: "#/components/schemas/DirectConversation"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /conversations/{conversationId}:
    get:
      tags: [Conversations]
      summary: Get conversation
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      responses:
        "200":
          $ref: "#/components/responses/ConversationResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

    patch:
      tags: [Conversations]
      summary: Update conversation
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateConversationRequest"
      responses:
        "200":
          $ref: "#/components/responses/ConversationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

    delete:
      tags: [Conversations]
      summary: Delete conversation
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      responses:
        "204":
          description: Conversation and dependent records deleted
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

  /conversations/{conversationId}/chat-wallpaper:
    get:
      tags: [Conversations]
      summary: Get the caller's resolved wallpaper for a conversation
      description: Returns the private conversation override when present, otherwise the caller's default.
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      responses:
        "200":
          $ref: "#/components/responses/ChatWallpaperResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
    put:
      tags: [Conversations]
      summary: Set the caller's private conversation wallpaper override
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateChatWallpaperRequest"
      responses:
        "200":
          $ref: "#/components/responses/ChatWallpaperResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"
    delete:
      tags: [Conversations]
      summary: Reset a conversation to the caller's default wallpaper
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      responses:
        "204":
          description: Conversation wallpaper override removed
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /conversations/{conversationId}/participants:
    get:
      tags: [Conversations]
      summary: List private-channel participants
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      responses:
        "200":
          $ref: "#/components/responses/ParticipantListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
    post:
      tags: [Conversations]
      summary: Add a private-channel participant
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      requestBody:
        $ref: "#/components/requestBodies/AddParticipantRequest"
      responses:
        "201":
          $ref: "#/components/responses/ParticipantResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /conversations/{conversationId}/participants/{userId}:
    delete:
      tags: [Conversations]
      summary: Remove a private-channel participant
      parameters:
        - $ref: "#/components/parameters/ConversationId"
        - $ref: "#/components/parameters/UserId"
      responses:
        "204":
          description: Participant removed
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"

  /conversations/{conversationId}/read-receipt:
    put:
      tags: [Messages]
      summary: Advance the caller's conversation read state
      description: The caller's high-water mark is monotonic. Direct-message updates are broadcast; channel read state remains private. Direct-conversation responses also expose the peer's durable high-water mark.
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdateReadReceiptInput"
      responses:
        "200":
          $ref: "#/components/responses/ReadReceiptResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  #
  # Messages
  #

  /conversations/{conversationId}/messages:
    get:
      tags: [Messages]
      summary: Get message history
      parameters:
        - $ref: "#/components/parameters/ConversationId"
        - name: before
          in: query
          schema:
            type: string
            pattern: "^[a-fA-F0-9]{24}$"
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
      responses:
        "200":
          $ref: "#/components/responses/MessageListResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

    post:
      tags: [Messages]
      summary: Create message
      parameters:
        - $ref: "#/components/parameters/ConversationId"
      requestBody:
        $ref: "#/components/requestBodies/CreateMessageRequest"
      responses:
        "201":
          $ref: "#/components/responses/MessageResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /conversations/{conversationId}/messages/{messageId}/context:
    get:
      tags: [Messages]
      summary: Get exact message context
      description: Returns the anchor message with up to twenty messages on each side. Access follows the conversation's current organization membership and channel or direct-message rules.
      parameters:
        - $ref: "#/components/parameters/ConversationId"
        - $ref: "#/components/parameters/MessageId"
      responses:
        "200":
          $ref: "#/components/responses/MessageContextResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /conversations/{conversationId}/messages/{messageId}/readers:
    get:
      tags: [Messages]
      summary: Summarize readers of the caller's channel message
      description: Returns an anonymous total plus at most three safe reader previews. The caller must be the message sender, and direct-message conversations are not supported.
      parameters:
        - $ref: "#/components/parameters/ConversationId"
        - $ref: "#/components/parameters/MessageId"
      responses:
        "200":
          $ref: "#/components/responses/MessageReadReceiptSummaryResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

  /messages/{messageId}:
    patch:
      tags: [Messages]
      summary: Edit message
      parameters:
        - $ref: "#/components/parameters/MessageId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateMessageRequest"
      responses:
        "200":
          $ref: "#/components/responses/MessageResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"

    delete:
      tags: [Messages]
      summary: Delete message
      parameters:
        - $ref: "#/components/parameters/MessageId"
      responses:
        "204":
          description: Message redacted
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /messages/{messageId}/reactions:
    get:
      tags: [Messages]
      summary: Get the caller's personalized reaction state
      parameters:
        - $ref: "#/components/parameters/MessageId"
      responses:
        "200":
          $ref: "#/components/responses/MessageReactionStateResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /messages/{messageId}/reactions/me:
    put:
      tags: [Messages]
      summary: Set or replace the caller's reaction
      description: A user has at most one reaction per message. Repeating the current emoji is idempotent.
      parameters:
        - $ref: "#/components/parameters/MessageId"
      requestBody:
        $ref: "#/components/requestBodies/SetMessageReactionRequest"
      responses:
        "200":
          $ref: "#/components/responses/MessageReactionStateResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "409":
          $ref: "#/components/responses/Conflict"
        "429":
          $ref: "#/components/responses/TooManyRequests"

    delete:
      tags: [Messages]
      summary: Remove the caller's reaction
      description: Removal is idempotent.
      parameters:
        - $ref: "#/components/parameters/MessageId"
      responses:
        "200":
          $ref: "#/components/responses/MessageReactionStateResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /messages/{messageId}/reactions/users:
    get:
      tags: [Messages]
      summary: List users who selected an emoji reaction
      description: Results include only current users who retain access to the conversation.
      parameters:
        - $ref: "#/components/parameters/MessageId"
        - name: emoji
          in: query
          required: true
          description: Exactly one normalized Unicode emoji sequence.
          schema:
            type: string
            minLength: 1
            maxLength: 32
        - name: before
          in: query
          schema:
            type: string
            pattern: "^[a-fA-F0-9]{24}$"
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 30
      responses:
        "200":
          $ref: "#/components/responses/MessageReactionUsersResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"

  /notifications:
    get:
      tags: [Notifications]
      summary: List the caller's notifications
      description: Returns durable in-app notifications ordered by latest activity.
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [ALL, UNREAD]
            default: ALL
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 50
            default: 20
      responses:
        "200":
          $ref: "#/components/responses/NotificationListResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"

  /notifications/read-all:
    put:
      tags: [Notifications]
      summary: Mark every caller notification as read
      responses:
        "204":
          description: All notifications marked read
        "401":
          $ref: "#/components/responses/Unauthorized"
        "429":
          $ref: "#/components/responses/TooManyRequests"

  /notifications/{notificationId}/read:
    put:
      tags: [Notifications]
      summary: Mark one caller notification as read
      parameters:
        - $ref: "#/components/parameters/NotificationId"
      responses:
        "200":
          $ref: "#/components/responses/NotificationResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "404":
          $ref: "#/components/responses/NotFound"
        "429":
          $ref: "#/components/responses/TooManyRequests"

components:

  securitySchemes:

    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

    refreshCookie:
      type: apiKey
      in: cookie
      name: __Secure-intouch_refresh

    googleOAuthStateCookie:
      type: apiKey
      in: cookie
      name: __Secure-intouch_google_oauth_state

  parameters:

    OrganizationResourceId:
      name: id
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    RefreshCsrfHeader:
      name: X-CSRF-Protection
      in: header
      required: true
      schema:
        type: string
        const: "1"

    OrganizationId:
      name: organizationId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    InvitationId:
      name: invitationId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    ConversationId:
      name: conversationId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    CategoryId:
      name: categoryId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    UserId:
      name: userId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    MemberId:
      name: memberId
      in: path
      required: true
      schema:
        type: string

    MessageId:
      name: messageId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    NotificationId:
      name: notificationId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    UploadId:
      name: uploadId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

    AssetId:
      name: assetId
      in: path
      required: true
      schema:
        type: string
        pattern: "^[a-fA-F0-9]{24}$"

  requestBodies:

    RegisterRequest:
      description: Defined by shared Zod contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/RegisterInput"

    LoginRequest:
      description: Defined by shared Zod contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/LoginInput"

    VerifyEmailRequest:
      description: Defined by the shared email-confirmation contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/VerifyEmailInput"

    EmailRequest:
      description: Normalized email request used for generic mail actions.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AuthEmailInput"

    ResetPasswordRequest:
      description: Defined by the shared password-reset contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ResetPasswordInput"

    CreateOrganizationRequest:
      description: Defined by shared Zod contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/CreateOrganizationInput"

    UpdateOrganizationRequest:
      description: Defined by shared Zod contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateOrganizationInput"

    UpdateOrganizationLogoRequest:
      description: Claim one completed organization-logo upload.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateOrganizationLogoInput"

    InviteMemberRequest:
      description: Defined by shared Zod contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/InviteMemberInput"

    CreateCategoryRequest:
      description: Defined by the shared category contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/CreateCategoryInput"

    UpdateCategoryRequest:
      description: Defined by the shared category contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateCategoryInput"

    CreateConversationRequest:
      description: Defined by the shared conversation contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/CreateConversationInput"

    UpdateConversationRequest:
      description: Defined by the shared conversation contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateConversationInput"

    UpdateChatWallpaperRequest:
      description: Set a bundled wallpaper preset and readability dimming.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateChatWallpaperInput"

    AddParticipantRequest:
      description: Defined by the shared conversation contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AddParticipantInput"

    CreateMessageRequest:
      description: Defined by the shared message contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/CreateMessageInput"

    UpdateMessageRequest:
      description: Defined by the shared message contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateMessageInput"

    CreateUploadRequest:
      description: Strict avatar or message-attachment upload intent.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/CreateUploadInput"

    UpdateAvatarRequest:
      description: Claim one completed avatar upload.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/UpdateAvatarInput"

    SetMessageReactionRequest:
      description: Defined by the shared message-reaction contract.
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/SetMessageReactionInput"

  responses:

    RegistrationPendingResponse:
      description: Account created pending email confirmation; no session is issued.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/RegistrationPendingPayload"

    AuthRequestAcceptedResponse:
      description: Request accepted without revealing whether an eligible account exists.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AuthRequestAcceptedPayload"

    AuthResponse:
      description: Authentication completed and refresh cookie set.
      headers:
        Set-Cookie:
          schema:
            type: string
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AuthPayload"

    AccessTokenResponse:
      description: Access token refreshed and refresh cookie rotated.
      headers:
        Set-Cookie:
          schema:
            type: string
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/AccessTokenPayload"

    GoogleOAuthStartRedirect:
      description: OAuth state cookie set and browser redirected to Google.
      headers:
        Location:
          required: true
          schema:
            type: string
            format: uri
        Set-Cookie:
          required: true
          schema:
            type: string

    GoogleOAuthCallbackRedirect:
      description: |
        Browser redirected to the configured frontend callback with
        googleAuth=success or googleAuth=failed. Successful authentication also
        sets the InTouch refresh cookie. No access or refresh token is placed in
        the redirect URL.
      headers:
        Location:
          required: true
          schema:
            type: string
            format: uri
        Set-Cookie:
          required: true
          schema:
            type: string

    UserResponse:
      description: User returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [user]
            properties:
              user:
                $ref: "#/components/schemas/PublicUser"

    CreateUploadResponse:
      description: Private direct-upload tickets issued successfully.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [uploadTickets]
            properties:
              uploadTickets:
                type: array
                minItems: 1
                maxItems: 5
                items:
                  $ref: "#/components/schemas/UploadTicket"

    CompleteUploadResponse:
      description: Upload verified and promoted successfully.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [upload]
            properties:
              upload:
                $ref: "#/components/schemas/CompletedUpload"

    AssetAccessResponse:
      description: Short-lived authorized asset URL.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [accessUrl, expiresAt]
            properties:
              accessUrl:
                type: string
                format: uri
              expiresAt:
                type: string
                format: date-time

    LoginResponse:
      $ref: "#/components/responses/AuthResponse"

    OrganizationResponse:
      description: Organization returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [organization]
            properties:
              organization:
                $ref: "#/components/schemas/PublicOrganization"

    OrganizationListResponse:
      description: List of organizations.
      content:
        application/json:
          schema:
            type: object
            required: [organizations]
            properties:
              organizations:
                type: array
                items:
                  $ref: "#/components/schemas/PublicOrganization"

    MembershipResponse:
      description: Membership returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [membership]
            properties:
              membership:
                $ref: "#/components/schemas/Membership"

    InvitationResponse:
      description: Invitation returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [invitation]
            properties:
              invitation:
                $ref: "#/components/schemas/Invitation"

    InvitationListResponse:
      description: List of pending invitations.
      content:
        application/json:
          schema:
            type: object
            required: [invitations]
            properties:
              invitations:
                type: array
                items:
                  $ref: "#/components/schemas/Invitation"

    NotificationResponse:
      description: Notification returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [notification]
            properties:
              notification:
                $ref: "#/components/schemas/Notification"

    NotificationListResponse:
      description: Paginated notification history and unread total.
      content:
        application/json:
          schema:
            type: object
            required: [notifications, nextCursor, unreadCount]
            properties:
              notifications:
                type: array
                items:
                  $ref: "#/components/schemas/Notification"
              nextCursor:
                type: [string, "null"]
              unreadCount:
                type: integer
                minimum: 0

    CategoryResponse:
      description: Category returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [category]
            properties:
              category:
                $ref: "#/components/schemas/Category"

    CategoryListResponse:
      description: Ordered category list.
      content:
        application/json:
          schema:
            type: object
            required: [categories]
            properties:
              categories:
                type: array
                items:
                  $ref: "#/components/schemas/Category"

    ConversationResponse:
      description: Conversation returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [conversation]
            properties:
              conversation:
                $ref: "#/components/schemas/Conversation"

    ChatWallpaperResponse:
      description: The caller's resolved private chat wallpaper preference.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [wallpaper]
            properties:
              wallpaper:
                $ref: "#/components/schemas/ChatWallpaper"

    ConversationListResponse:
      description: Accessible conversation list.
      content:
        application/json:
          schema:
            type: object
            required: [conversations]
            properties:
              conversations:
                type: array
                items:
                  $ref: "#/components/schemas/Conversation"

    DirectMessageListResponse:
      description: Cursor-paginated direct-message list.
      content:
        application/json:
          schema:
            type: object
            required: [directMessages, nextCursor]
            properties:
              directMessages:
                type: array
                items:
                  $ref: "#/components/schemas/DirectConversation"
              nextCursor:
                oneOf:
                  - type: string
                  - type: "null"

    ReadReceiptResponse:
      description: Current monotonic conversation read state.
      content:
        application/json:
          schema:
            type: object
            required: [readReceipt]
            properties:
              readReceipt:
                $ref: "#/components/schemas/ReadReceipt"

    MessageReadReceiptSummaryResponse:
      description: Sender-only channel read-receipt summary.
      content:
        application/json:
          schema:
            type: object
            required: [readReceiptSummary]
            properties:
              readReceiptSummary:
                $ref: "#/components/schemas/MessageReadReceiptSummary"

    OrganizationMemberListResponse:
      description: Organization member list.
      content:
        application/json:
          schema:
            type: object
            required: [members]
            properties:
              members:
                type: array
                items:
                  $ref: "#/components/schemas/OrganizationMember"

    ParticipantResponse:
      description: Conversation participant returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [participant]
            properties:
              participant:
                $ref: "#/components/schemas/ConversationParticipant"

    ParticipantListResponse:
      description: Private-channel participant list.
      content:
        application/json:
          schema:
            type: object
            required: [participants]
            properties:
              participants:
                type: array
                items:
                  $ref: "#/components/schemas/ConversationParticipantView"

    MessageResponse:
      description: Message returned successfully.
      content:
        application/json:
          schema:
            type: object
            required: [message]
            properties:
              message:
                $ref: "#/components/schemas/Message"

    MessageListResponse:
      description: Cursor-paginated message history, newest first.
      content:
        application/json:
          schema:
            type: object
            required: [messages, nextCursor]
            properties:
              messages:
                type: array
                items:
                  $ref: "#/components/schemas/Message"
              nextCursor:
                oneOf:
                  - type: string
                  - type: "null"

    MessageContextResponse:
      description: Exact message context returned successfully.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/MessageContext"

    SearchResponse:
      description: Authorization-filtered organization search results.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/OrganizationSearchResponse"

    MessageReactionStateResponse:
      description: Authoritative personalized reaction state for one message.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: false
            required: [reactionState]
            properties:
              reactionState:
                $ref: "#/components/schemas/MessageReactionState"

    MessageReactionUsersResponse:
      description: Cursor-paginated users for one emoji reaction.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/MessageReactionUsers"

    ValidationError:
      description: Validation failed.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    Unauthorized:
      description: Authentication required.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    Forbidden:
      description: Permission denied.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    NotFound:
      description: Resource not found.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    Conflict:
      description: Resource conflict.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    PayloadTooLarge:
      description: An uploaded file descriptor exceeds the 25 MB per-file limit.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    TooManyRequests:
      description: A request limit was exceeded.
      headers:
        Retry-After:
          description: Seconds until the authenticated action may be retried. Authentication limits may omit this header.
          schema:
            type: integer
            minimum: 1
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    InternalServerError:
      description: Unexpected server error.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    ServiceUnavailable:
      description: An upstream authentication provider is unavailable.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    SearchUnavailable:
      description: The configured search provider or its indexes are unavailable.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

    StorageUnavailable:
      description: Private object storage is temporarily unavailable.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"

  schemas:

    UpdateChatWallpaperInput:
      type: object
      additionalProperties: false
      required: [wallpaperId, dimming]
      properties:
        wallpaperId:
          $ref: "#/components/schemas/ChatWallpaperId"
        dimming:
          type: integer
          minimum: 0
          maximum: 80

    ChatWallpaperId:
      type: string
      enum:
        - NONE
        - INTOUCH_DOODLE
        - DOODLE_ORBIT
        - DOODLE_CHAT
        - DOODLE_NIGHT
        - ABSTRACT_AURORA
        - ABSTRACT_SUNSET
        - ABSTRACT_OCEAN
        - ABSTRACT_PAPER
        - SCENERY_COAST
        - SCENERY_MOUNTAINS
        - SCENERY_FOREST
        - SCENERY_CITY_LIGHTS

    ChatWallpaper:
      type: object
      additionalProperties: false
      required: [wallpaperId, dimming, source]
      properties:
        wallpaperId:
          $ref: "#/components/schemas/ChatWallpaperId"
        dimming:
          type: integer
          minimum: 0
          maximum: 80
        source:
          type: string
          enum: [DEFAULT, CONVERSATION]

    CreateCategoryInput:
      type: object
      additionalProperties: false
      required: [name]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"

    UpdateCategoryInput:
      type: object
      additionalProperties: false
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"
        position:
          type: integer
          minimum: 0

    Category:
      type: object
      required: [id, organizationId, name, position, createdAt, updatedAt]
      properties:
        id:
          type: string
        organizationId:
          type: string
        name:
          type: string
        position:
          type: integer
          minimum: 0
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateConversationInput:
      type: object
      additionalProperties: false
      required: [categoryId, name]
      properties:
        categoryId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"
        visibility:
          type: string
          enum: [PUBLIC, PRIVATE]
          default: PUBLIC

    UpdateConversationInput:
      type: object
      additionalProperties: false
      minProperties: 1
      properties:
        categoryId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"
        visibility:
          type: string
          enum: [PUBLIC, PRIVATE]
        position:
          type: integer
          minimum: 0

    CreateDirectMessageInput:
      type: object
      additionalProperties: false
      required: [recipientUserId]
      properties:
        recipientUserId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"

    UpdateReadReceiptInput:
      type: object
      additionalProperties: false
      required: [messageId]
      properties:
        messageId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"

    Conversation:
      oneOf:
        - $ref: "#/components/schemas/ChannelConversation"
        - $ref: "#/components/schemas/DirectConversation"
      discriminator:
        propertyName: type

    ChannelConversation:
      type: object
      required:
        [id, organizationId, categoryId, name, type, visibility, position, createdAt, updatedAt]
      properties:
        id:
          type: string
        organizationId:
          type: string
        categoryId:
          type: string
        name:
          type: string
        type:
          type: string
          const: CHANNEL
        visibility:
          type: string
          enum: [PUBLIC, PRIVATE]
        position:
          type: integer
          minimum: 0
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        lastMessage:
          oneOf:
            - $ref: "#/components/schemas/MessageCore"
            - type: "null"
        unreadCount:
          type: integer
          minimum: 0
        readReceipt:
          oneOf:
            - $ref: "#/components/schemas/ReadReceipt"
            - type: "null"

    DirectConversation:
      type: object
      required:
        [id, organizationId, type, peer, lastMessage, unreadCount, readReceipt, peerReadReceipt, createdAt, updatedAt]
      properties:
        id:
          type: string
        organizationId:
          type: string
        type:
          type: string
          const: DIRECT
        peer:
          $ref: "#/components/schemas/PeerUser"
        lastMessage:
          oneOf:
            - $ref: "#/components/schemas/MessageCore"
            - type: "null"
        unreadCount:
          type: integer
          minimum: 0
        readReceipt:
          oneOf:
            - $ref: "#/components/schemas/ReadReceipt"
            - type: "null"
        peerReadReceipt:
          description: The direct-message peer's durable high-water read state.
          oneOf:
            - $ref: "#/components/schemas/ReadReceipt"
            - type: "null"
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    AddParticipantInput:
      type: object
      additionalProperties: false
      required: [userId]
      properties:
        userId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"

    ConversationParticipant:
      type: object
      required:
        [id, organizationId, conversationId, userId, addedByUserId, joinedAt]
      properties:
        id:
          type: string
        organizationId:
          type: string
        conversationId:
          type: string
        userId:
          type: string
        addedByUserId:
          type: string
        joinedAt:
          type: string
          format: date-time

    ConversationParticipantView:
      allOf:
        - $ref: "#/components/schemas/ConversationParticipant"
        - type: object
          required: [user]
          properties:
            user:
              $ref: "#/components/schemas/ParticipantUser"

    ParticipantUser:
      type: object
      required: [id, username, displayName, avatarAssetId]
      properties:
        id:
          type: string
        username:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
          format: uri
        avatarAssetId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"

    MemberUser:
      type: object
      required: [id, username, displayName, avatarAssetId, status, lastSeenAt]
      properties:
        id:
          type: string
        username:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
          format: uri
        avatarAssetId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"
        status:
          type: string
          enum: [ONLINE, OFFLINE]
        lastSeenAt:
          oneOf:
            - type: string
              format: date-time
            - type: "null"

    PeerUser:
      type: object
      required: [id, username, displayName, avatarAssetId]
      properties:
        id:
          type: string
        username:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
          format: uri
        avatarAssetId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"

    OrganizationMember:
      type: object
      required: [membershipId, role, joinedAt, user]
      properties:
        membershipId:
          type: string
        role:
          type: string
          enum: [OWNER, MEMBER]
        joinedAt:
          type: string
          format: date-time
        user:
          $ref: "#/components/schemas/MemberUser"

    UploadFileDescriptor:
      type: object
      additionalProperties: false
      required: [fileName, contentType, size]
      properties:
        fileName:
          type: string
          minLength: 1
          maxLength: 255
        contentType:
          type: string
          minLength: 1
          maxLength: 127
        size:
          type: integer
          minimum: 1
          maximum: 26214400

    SquareImageUploadFileDescriptor:
      type: object
      additionalProperties: false
      required: [fileName, contentType, size]
      properties:
        fileName:
          type: string
          minLength: 1
          maxLength: 255
        contentType:
          type: string
          enum: [image/jpeg, image/png, image/webp]
        size:
          type: integer
          minimum: 1
          maximum: 5242880

    CreateUploadInput:
      oneOf:
        - type: object
          additionalProperties: false
          required: [purpose, files]
          properties:
            purpose:
              type: string
              const: AVATAR
            files:
              type: array
              minItems: 1
              maxItems: 1
              items:
                $ref: "#/components/schemas/SquareImageUploadFileDescriptor"
        - type: object
          additionalProperties: false
          required: [purpose, files]
          properties:
            purpose:
              type: string
              const: ORGANIZATION_LOGO
            files:
              type: array
              minItems: 1
              maxItems: 1
              items:
                $ref: "#/components/schemas/SquareImageUploadFileDescriptor"
        - type: object
          additionalProperties: false
          required: [purpose, conversationId, files]
          properties:
            purpose:
              type: string
              const: MESSAGE_ATTACHMENT
            conversationId:
              type: string
              pattern: "^[a-fA-F0-9]{24}$"
            files:
              type: array
              minItems: 1
              maxItems: 5
              items:
                $ref: "#/components/schemas/UploadFileDescriptor"
      discriminator:
        propertyName: purpose

    UpdateAvatarInput:
      type: object
      additionalProperties: false
      required: [uploadId]
      properties:
        uploadId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"

    UpdateOrganizationLogoInput:
      type: object
      additionalProperties: false
      required: [uploadId]
      properties:
        uploadId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"

    CreateMessageInput:
      type: object
      additionalProperties: false
      anyOf:
        - required: [content]
        - required: [uploadIds]
      properties:
        content:
          type: string
          minLength: 1
          maxLength: 4000
          pattern: ".*\\S.*"
        uploadIds:
          type: array
          minItems: 1
          maxItems: 5
          uniqueItems: true
          items:
            type: string
            pattern: "^[a-fA-F0-9]{24}$"

    UpdateMessageInput:
      type: object
      additionalProperties: false
      required: [content]
      properties:
        content:
          oneOf:
            - type: string
              minLength: 1
              maxLength: 4000
              pattern: ".*\\S.*"
            - type: "null"

    Attachment:
      type: object
      additionalProperties: false
      required: [id, fileName, contentType, size, kind, createdAt]
      properties:
        id:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        fileName:
          type: string
        contentType:
          type: string
        size:
          type: integer
          minimum: 1
        kind:
          type: string
          enum: [IMAGE, FILE]
        createdAt:
          type: string
          format: date-time

    UploadTicket:
      type: object
      additionalProperties: false
      required: [uploadId, uploadUrl, headers, expiresAt]
      properties:
        uploadId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        uploadUrl:
          type: string
          format: uri
        headers:
          type: object
          additionalProperties:
            type: string
        expiresAt:
          type: string
          format: date-time

    CompletedUpload:
      type: object
      additionalProperties: false
      required: [id, uploadId, fileName, contentType, size, kind, createdAt]
      properties:
        id:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        uploadId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        fileName:
          type: string
        contentType:
          type: string
        size:
          type: integer
          minimum: 1
        kind:
          type: string
          enum: [IMAGE, FILE]
        createdAt:
          type: string
          format: date-time

    SetMessageReactionInput:
      type: object
      additionalProperties: false
      required: [emoji]
      properties:
        emoji:
          type: string
          minLength: 1
          maxLength: 32
          description: Exactly one NFC-normalized Unicode emoji sequence. Composed and skin-tone variants are distinct.

    MessageCore:
      type: object
      required:
        [id, conversationId, senderId, content, messageType, editedAt, deletedAt, createdAt, updatedAt, attachments]
      properties:
        id:
          type: string
        conversationId:
          type: string
        senderId:
          type: string
        content:
          oneOf:
            - type: string
            - type: "null"
        messageType:
          type: string
          enum: [TEXT, ATTACHMENT]
        editedAt:
          oneOf:
            - type: string
              format: date-time
            - type: "null"
        deletedAt:
          oneOf:
            - type: string
              format: date-time
            - type: "null"
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        attachments:
          type: array
          maxItems: 5
          items:
            $ref: "#/components/schemas/Attachment"

    MessageReactionSummary:
      type: object
      additionalProperties: false
      required: [emoji, count]
      properties:
        emoji:
          type: string
          minLength: 1
        count:
          type: integer
          minimum: 1

    MessageReactionState:
      type: object
      additionalProperties: false
      required: [messageId, reactions, currentUserReaction]
      properties:
        messageId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        reactions:
          type: array
          description: Sorted by descending count and then emoji.
          items:
            $ref: "#/components/schemas/MessageReactionSummary"
        currentUserReaction:
          oneOf:
            - type: string
            - type: "null"

    MessageReactionUsers:
      type: object
      additionalProperties: false
      required: [messageId, emoji, total, users, nextCursor]
      properties:
        messageId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        emoji:
          type: string
          minLength: 1
        total:
          type: integer
          minimum: 0
        users:
          type: array
          items:
            $ref: "#/components/schemas/ParticipantUser"
        nextCursor:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"

    Message:
      allOf:
        - $ref: "#/components/schemas/MessageCore"
        - type: object
          required: [reactions, currentUserReaction]
          properties:
            reactions:
              type: array
              items:
                $ref: "#/components/schemas/MessageReactionSummary"
            currentUserReaction:
              oneOf:
                - type: string
                - type: "null"

    MessageContext:
      type: object
      additionalProperties: false
      required: [anchorMessageId, messages, hasEarlier, hasLater]
      properties:
        anchorMessageId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        messages:
          type: array
          description: Chronological context containing the anchor and up to twenty messages on each side.
          items:
            $ref: "#/components/schemas/Message"
        hasEarlier:
          type: boolean
        hasLater:
          type: boolean

    SearchHighlightSegment:
      type: object
      additionalProperties: false
      required: [text, matched]
      properties:
        text:
          type: string
        matched:
          type: boolean

    SearchConversationContext:
      type: object
      additionalProperties: false
      required: [id, type, label]
      properties:
        id:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        type:
          type: string
          enum: [CHANNEL, DIRECT]
        label:
          type: string

    MessageSearchResult:
      type: object
      additionalProperties: false
      required: [kind, id, conversation, sender, snippet, createdAt]
      properties:
        kind:
          type: string
          const: MESSAGE
        id:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        conversation:
          $ref: "#/components/schemas/SearchConversationContext"
        sender:
          $ref: "#/components/schemas/ParticipantUser"
        snippet:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/SearchHighlightSegment"
        createdAt:
          type: string
          format: date-time

    ChannelSearchResult:
      type: object
      additionalProperties: false
      required: [kind, id, categoryId, name, visibility]
      properties:
        kind:
          type: string
          const: CHANNEL
        id:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        categoryId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        name:
          type: string
        visibility:
          type: string
          enum: [PUBLIC, PRIVATE]

    PersonSearchResult:
      type: object
      additionalProperties: false
      required: [kind, membershipId, role, user, directConversationId]
      properties:
        kind:
          type: string
          const: PERSON
        membershipId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        role:
          type: string
          enum: [OWNER, MEMBER]
        user:
          $ref: "#/components/schemas/MemberUser"
        directConversationId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"

    OrganizationSearchResult:
      oneOf:
        - $ref: "#/components/schemas/MessageSearchResult"
        - $ref: "#/components/schemas/ChannelSearchResult"
        - $ref: "#/components/schemas/PersonSearchResult"
      discriminator:
        propertyName: kind

    OrganizationSearchResponse:
      type: object
      additionalProperties: false
      required: [query, type, results, nextCursor]
      properties:
        query:
          type: string
        type:
          type: string
          enum: [ALL, MESSAGES, CHANNELS, PEOPLE]
        results:
          type: array
          items:
            $ref: "#/components/schemas/OrganizationSearchResult"
        nextCursor:
          oneOf:
            - type: string
            - type: "null"

    ReadReceipt:
      type: object
      required: [id, conversationId, userId, lastReadMessageId, lastReadAt]
      properties:
        id:
          type: string
        conversationId:
          type: string
        userId:
          type: string
        lastReadMessageId:
          type: string
        lastReadAt:
          type: string
          format: date-time

    MessageReadReceiptSummary:
      type: object
      additionalProperties: false
      required: [messageId, readByCount, readers]
      properties:
        messageId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        readByCount:
          type: integer
          minimum: 0
        readers:
          type: array
          maxItems: 3
          items:
            $ref: "#/components/schemas/ParticipantUser"

    InviteMemberInput:
      type: object
      additionalProperties: false
      required: [email]
      properties:
        email:
          type: string
          format: email

    Membership:
      type: object
      required: [id, userId, organizationId, role, joinedAt]
      properties:
        id:
          type: string
        userId:
          type: string
        organizationId:
          type: string
        role:
          type: string
          enum: [OWNER, MEMBER]
        joinedAt:
          type: string
          format: date-time

    InvitationOrganizationSummary:
      type: object
      required: [id, name, slug, logoAssetId, visibility]
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        logoAssetId:
          type: [string, "null"]
          pattern: "^[a-fA-F0-9]{24}$"
        visibility:
          type: string
          enum: [PRIVATE, PUBLIC]

    Invitation:
      type: object
      required:
        - id
        - organizationId
        - invitedUserId
        - invitedByUserId
        - expiresAt
        - createdAt
        - organization
      properties:
        id:
          type: string
        organizationId:
          type: string
        invitedUserId:
          type: string
        invitedByUserId:
          type: string
        expiresAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
        organization:
          $ref: "#/components/schemas/InvitationOrganizationSummary"

    NotificationOrganizationSummary:
      type: object
      additionalProperties: false
      required: [id, name, logoAssetId]
      properties:
        id:
          type: string
        name:
          type: string
        logoAssetId:
          type: [string, "null"]
          pattern: "^[a-fA-F0-9]{24}$"

    NotificationBase:
      type: object
      required: [id, actor, organization, readAt, createdAt, lastActivityAt]
      properties:
        id:
          type: string
        actor:
          $ref: "#/components/schemas/PublicUserSummary"
        organization:
          $ref: "#/components/schemas/NotificationOrganizationSummary"
        readAt:
          type: [string, "null"]
          format: date-time
        createdAt:
          type: string
          format: date-time
        lastActivityAt:
          type: string
          format: date-time

    Notification:
      oneOf:
        - $ref: "#/components/schemas/InvitationReceivedNotification"
        - $ref: "#/components/schemas/InvitationAcceptedNotification"
        - $ref: "#/components/schemas/DirectMessageNotification"
        - $ref: "#/components/schemas/MessageReactionNotification"
      discriminator:
        propertyName: type

    InvitationReceivedNotification:
      allOf:
        - $ref: "#/components/schemas/NotificationBase"
        - type: object
          required: [type, invitationId]
          properties:
            type:
              type: string
              const: ORGANIZATION_INVITATION_RECEIVED
            invitationId:
              type: string

    InvitationAcceptedNotification:
      allOf:
        - $ref: "#/components/schemas/NotificationBase"
        - type: object
          required: [type]
          properties:
            type:
              type: string
              const: ORGANIZATION_INVITATION_ACCEPTED

    DirectMessageNotification:
      allOf:
        - $ref: "#/components/schemas/NotificationBase"
        - type: object
          required: [type, conversationId, latestMessageId, messageCount]
          properties:
            type:
              type: string
              const: DIRECT_MESSAGE_RECEIVED
            conversationId:
              type: string
            latestMessageId:
              type: string
            messageCount:
              type: integer
              minimum: 1

    MessageReactionNotification:
      allOf:
        - $ref: "#/components/schemas/NotificationBase"
        - type: object
          required: [type, conversationId, conversationType, messageId, emoji]
          properties:
            type:
              type: string
              const: MESSAGE_REACTION_RECEIVED
            conversationId:
              type: string
            conversationType:
              type: string
              enum: [CHANNEL, DIRECT]
            messageId:
              type: string
            emoji:
              type: string

    CreateOrganizationInput:
      type: object
      additionalProperties: false
      required: [name]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"
        logoUploadId:
          type: string
          pattern: "^[a-fA-F0-9]{24}$"
        visibility:
          type: string
          enum: [PRIVATE, PUBLIC]
          default: PRIVATE

    UpdateOrganizationInput:
      type: object
      additionalProperties: false
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          pattern: ".*\\S.*"
        visibility:
          type: string
          enum: [PRIVATE, PUBLIC]

    PublicOrganization:
      type: object
      required:
        [id, name, slug, logoAssetId, visibility, currentUserRole, createdAt, updatedAt]
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        logoAssetId:
          type: [string, "null"]
          pattern: "^[a-fA-F0-9]{24}$"
        visibility:
          type: string
          enum: [PRIVATE, PUBLIC]
        currentUserRole:
          oneOf:
            - type: string
              enum: [OWNER, MEMBER]
            - type: "null"
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    RegisterInput:
      type: object
      additionalProperties: false
      required: [username, displayName, email, password]
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 30
          pattern: "^[a-zA-Z0-9_]+$"
        displayName:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
          maxLength: 72
          writeOnly: true

    LoginInput:
      type: object
      additionalProperties: false
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
          maxLength: 72
          writeOnly: true

    AuthActionToken:
      type: string
      minLength: 43
      maxLength: 256
      pattern: "^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$"
      writeOnly: true

    VerifyEmailInput:
      type: object
      additionalProperties: false
      required: [token]
      properties:
        token:
          $ref: "#/components/schemas/AuthActionToken"

    AuthEmailInput:
      type: object
      additionalProperties: false
      required: [email]
      properties:
        email:
          type: string
          format: email

    ResetPasswordInput:
      type: object
      additionalProperties: false
      required: [token, password]
      properties:
        token:
          $ref: "#/components/schemas/AuthActionToken"
        password:
          type: string
          minLength: 8
          maxLength: 72
          writeOnly: true

    PublicUserSummary:
      type: object
      additionalProperties: false
      required: [id, username, displayName, avatarAssetId]
      properties:
        id:
          type: string
        username:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
          format: uri
        avatarAssetId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"

    PublicUser:
      type: object
      required: [id, username, displayName, avatarAssetId, email, createdAt, updatedAt]
      properties:
        id:
          type: string
        username:
          type: string
        displayName:
          type: string
        email:
          type: string
          format: email
        avatarUrl:
          type: string
          format: uri
        avatarAssetId:
          oneOf:
            - type: string
              pattern: "^[a-fA-F0-9]{24}$"
            - type: "null"
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    AuthPayload:
      type: object
      required: [user, accessToken]
      properties:
        user:
          $ref: "#/components/schemas/PublicUser"
        accessToken:
          type: string

    RegistrationPendingPayload:
      type: object
      additionalProperties: false
      required: [email, verificationRequired]
      properties:
        email:
          type: string
          format: email
        verificationRequired:
          type: boolean
          const: true

    AuthRequestAcceptedPayload:
      type: object
      additionalProperties: false
      required: [accepted]
      properties:
        accepted:
          type: boolean
          const: true

    AccessTokenPayload:
      type: object
      required: [accessToken]
      properties:
        accessToken:
          type: string

    ErrorResponse:
      type: object
      additionalProperties: false
      required: [success, error]
      properties:
        success:
          type: boolean
          const: false
        error:
          type: object
          additionalProperties: false
          required: [code, message]
          properties:
            code:
              type: string
              enum:
                - VALIDATION_ERROR
                - UNAUTHORIZED
                - FORBIDDEN
                - NOT_FOUND
                - CONFLICT
                - TOO_MANY_REQUESTS
                - SERVICE_UNAVAILABLE
                - SEARCH_UNAVAILABLE
                - STORAGE_UNAVAILABLE
                - EMAIL_VERIFICATION_REQUIRED
                - INVALID_OR_EXPIRED_TOKEN
                - INTERNAL_SERVER_ERROR
            message:
              type: string
