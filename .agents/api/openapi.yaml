
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
  - url: http://localhost:3000/api/v1
    description: Local Development

tags:
  - name: Authentication
  - name: Users
  - name: Organizations
  - name: Memberships
  - name: Categories
  - name: Conversations
  - name: Messages

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
          $ref: "#/components/responses/UserResponse"
        "400":
          $ref: "#/components/responses/ValidationError"
        "409":
          description: Email already exists

  /auth/login:
    post:
      tags: [Authentication]
      summary: Authenticate user
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

  /auth/refresh:
    post:
      tags: [Authentication]
      summary: Refresh access token
      security: []
      requestBody:
        $ref: "#/components/requestBodies/RefreshTokenRequest"
      responses:
        "200":
          description: Token refreshed

  /auth/logout:
    post:
      tags: [Authentication]
      summary: Logout current user
      responses:
        "204":
          description: Logged out

  /auth/me:
    get:
      tags: [Authentication]
      summary: Get current authenticated user
      responses:
        "200":
          $ref: "#/components/responses/UserResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

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

    post:
      tags: [Organizations]
      summary: Create organization
      requestBody:
        $ref: "#/components/requestBodies/CreateOrganizationRequest"
      responses:
        "201":
          $ref: "#/components/responses/OrganizationResponse"

  /organizations/{organizationId}:
    get:
      tags: [Organizations]
      summary: Get organization
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"

    patch:
      tags: [Organizations]
      summary: Update organization
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      requestBody:
        $ref: "#/components/requestBodies/UpdateOrganizationRequest"
      responses:
        "200":
          $ref: "#/components/responses/OrganizationResponse"

    delete:
      tags: [Organizations]
      summary: Delete organization
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      responses:
        "204":
          description: Organization deleted

  #
  # Memberships
  #

  /organizations/{organizationId}/members:
    get:
      tags: [Memberships]
      summary: List organization members
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      responses:
        "200":
          $ref: "#/components/responses/MembershipListResponse"

    post:
      tags: [Memberships]
      summary: Invite or add member
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
      requestBody:
        $ref: "#/components/requestBodies/AddMemberRequest"
      responses:
        "201":
          $ref: "#/components/responses/MembershipResponse"

  /organizations/{organizationId}/members/{memberId}:
    delete:
      tags: [Memberships]
      summary: Remove member
      parameters:
        - $ref: "#/components/parameters/OrganizationId"
        - $ref: "#/components/parameters/MemberId"
      responses:
        "204":
          description: Member removed

  #
  # Categories
  #

  /organizations/{organizationId}/categories:
    get:
      tags: [Categories]
      summary: List categories

    post:
      tags: [Categories]
      summary: Create category

  /organizations/{organizationId}/categories/{categoryId}:
    patch:
      tags: [Categories]
      summary: Update category

    delete:
      tags: [Categories]
      summary: Delete category

  #
  # Conversations
  #

  /organizations/{organizationId}/conversations:
    get:
      tags: [Conversations]
      summary: List conversations

    post:
      tags: [Conversations]
      summary: Create conversation

  /conversations/{conversationId}:
    get:
      tags: [Conversations]
      summary: Get conversation

    patch:
      tags: [Conversations]
      summary: Update conversation

    delete:
      tags: [Conversations]
      summary: Delete conversation

  #
  # Messages
  #

  /conversations/{conversationId}/messages:
    get:
      tags: [Messages]
      summary: Get message history

    post:
      tags: [Messages]
      summary: Create message

  /messages/{messageId}:
    patch:
      tags: [Messages]
      summary: Edit message

    delete:
      tags: [Messages]
      summary: Delete message

components:

  securitySchemes:

    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:

    OrganizationId:
      name: organizationId
      in: path
      required: true
      schema:
        type: string

    ConversationId:
      name: conversationId
      in: path
      required: true
      schema:
        type: string

    CategoryId:
      name: categoryId
      in: path
      required: true
      schema:
        type: string

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

  requestBodies:

    RegisterRequest:
      description: Defined by shared Zod contract.

    LoginRequest:
      description: Defined by shared Zod contract.

    RefreshTokenRequest:
      description: Defined by shared Zod contract.

    CreateOrganizationRequest:
      description: Defined by shared Zod contract.

    UpdateOrganizationRequest:
      description: Defined by shared Zod contract.

    AddMemberRequest:
      description: Defined by shared Zod contract.

  responses:

    UserResponse:
      description: User returned successfully.

    LoginResponse:
      description: Login completed successfully.

    OrganizationResponse:
      description: Organization returned successfully.

    OrganizationListResponse:
      description: List of organizations.

    MembershipResponse:
      description: Membership returned successfully.

    MembershipListResponse:
      description: List of memberships.

    ValidationError:
      description: Validation failed.

    Unauthorized:
      description: Authentication required.

    Forbidden:
      description: Permission denied.

    NotFound:
      description: Resource not found.

    Conflict:
      description: Resource conflict.

    InternalServerError:
      description: Unexpected server error.