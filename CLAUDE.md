# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Lint
```bash
cd functions
yarn build       # Lint + TypeScript compilation
yarn lint        # ESLint check
yarn type-check  # TypeScript type checking only
```

### Test Execution
```bash
cd functions
yarn test        # Run all tests with Jest
```

### Development Server
```bash
cd functions
yarn serve       # Local execution with Firebase Emulator
yarn shell       # Firebase Functions Shell
```

### Deployment
```bash
cd functions
yarn deploy      # Build + Test + Firebase Deploy
```

## Architecture Overview

### Command Pattern-Based Design

This project uses a **Command Pattern**-centered design, implementing each feature as independent Command classes.

#### Basic Structure
```typescript
// Inherit from AbstractCommand
export class YourCommand extends AbstractCommand {
  @NeedAuthentication()                    // Authentication required
  @NeedAdministratorPermission()          // Administrator permission required (when needed)
  @ValidateRequired(['param1', 'param2']) // Required parameter validation
  async execute(request: CallableRequest): Promise<IResult> {
    // Implementation
  }
}
```

### Feature Categories

#### Admin (`src/admin/`)
- **Purpose**: Administrator features
- **Permissions**: `@NeedAdministratorPermission()` decorator required
- **Examples**: Keyboard definition approval/rejection, statistics retrieval

#### Host (`src/host/`)  
- **Purpose**: Public site-related features
- **Permissions**: No authentication required, HTTP Request/Response format
- **Examples**: Sitemap generation, catalog page generation

#### Keyboards (`src/keyboards/`)
- **Purpose**: Keyboard definition, statistics, and build-related features
- **Permissions**: Owner permission check, organization member permission check
- **Examples**: Firmware build task creation, statistics generation

#### Workbench (`src/workbench/`)
- **Purpose**: PayPal payment and order processing
- **Features**: Inheritance from `AbstractPurchaseCommand`, external API integration
- **Examples**: Order creation, payment processing

### Cross-Cutting Concerns with Decorators

Authentication, authorization, and validation are implemented with dedicated decorators:

```typescript
// Decorators defined in src/utils/decorators.ts
@NeedAuthentication()                    // Firebase Auth authentication required
@NeedAdministratorPermission()          // Administrator permission required
@ValidateRequired(['param1', 'param2']) // Required parameter validation
@NeedOrganizationMemberPermission()     // Organization member permission required
```

### Firebase Functions Registration Patterns

#### 1. Callable Functions (Standard Commands)
```typescript
// Add to commandMap in index.ts
const commandMap = {
  yourFunctionName: new YourCommand(db, auth),
};
```

#### 2. HTTP Functions
```typescript
funcMap['yourEndpoint'] = onRequest(async (req, res) => {
  await new YourHttpCommand(db).execute(req, res);
});
```

#### 3. Firestore Triggers
```typescript
funcMap['yourTrigger'] = onDocumentCreated(
  { document: 'collection/{docId}' },
  async (event) => { /* processing */ }
);
```

## New Feature Implementation Guide

### 1. Adding a New Command
1. Create a new file in the appropriate category directory
2. Inherit from `AbstractCommand`
3. Apply necessary decorators
4. Implement the `execute` method
5. Register in `commandMap` in `src/index.ts`

### 2. Permission Check Implementation
- Administrator check: `this.checkUserIsAdministrator(uid)`
- Organization member check: `this.checkUserIsOrganizationMember(uid, orgId)`

### 3. Error Handling
```typescript
// Use the IResult interface from src/utils/types.ts
return {
  success: false,
  errorCode: 'ERROR_CODE',
  errorMessage: 'Error message'
};
```

## Environment Setup

### Required Environment Variables
Create a `.env` file with the following:
```
discord.webhook=<DISCORD_WEBHOOK_URL>
```

### Firebase Secrets
The following secrets are managed in Firebase:
- `DISCORD_WEBHOOK`
- `NOTIFICATION_URL`
- `JWT_SECRET`
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
- `SANDBOX_PAYPAL_CLIENT_ID` / `SANDBOX_PAYPAL_CLIENT_SECRET`

## Test Implementation

- Test Framework: Jest + ts-jest
- Test Files: `*.test.ts`
- Configuration File: `jest.config.js`

Create tests for new Commands:
```typescript
// src/your-category/your-command.test.ts
describe('YourCommand', () => {
  test('should execute successfully', async () => {
    // Test implementation
  });
});
```

## Code Quality

- **ESLint**: Based on Google Style Guide
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **TypeScript**: Strict type checking enabled

Always ensure that all changes pass `yarn build` without build errors before committing.