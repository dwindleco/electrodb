# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ElectroDB is a DynamoDB library designed to simplify working with multiple entities and complex hierarchical relationships in a single DynamoDB table. It provides schema enforcement, query composition, and simplified access patterns for DynamoDB operations.

## Development Commands

### Testing
- `npm test` or `./test.sh` - Run full test suite with Docker DynamoDB setup
- `npm run test:run` - Run core tests (types, init, unit tests)
- `npm run test:unit` - Run unit tests only using Mocha
- `npm run test:types` - Run TypeScript type tests using tsd
- `npm run test:init` - Initialize test data
- `npm run test:init:hard` - Recreate test tables and data
- `npm run test:format` - Check code formatting with Prettier

**Important**: Before running unit tests, ensure the test environment is properly initialized:
1. Start Docker Compose environment: `docker compose up -d`
2. Initialize test tables: `docker compose exec electro npm run test:init:hard`
3. Then run tests: `npm run test:unit`

If tests fail due to environment issues, re-run the initialization steps above.

### DynamoDB Development Environment
- `npm run ddb:start` - Start local DynamoDB via Docker Compose
- `npm run ddb:stop` - Stop Docker Compose services
- `npm run ddb:load` - Load test data into local DynamoDB
- `npm run local:start` - Start DynamoDB and initialize with test data
- `npm run local:fresh` - Start DynamoDB and recreate all test data
- `npm run local:debug` - Start environment and run debug script

### Building and Formatting
- `npm run build` - Build browser bundle using browserify
- `npm run format` - Format code with Prettier
- `npm run coverage:local:html` - Generate HTML coverage reports

### Examples
Multiple example applications demonstrate ElectroDB usage:
- `npm run examples:load:library` - Load library management example
- `npm run examples:load:taskmanager` - Load task manager example  
- `npm run examples:load:versioncontrol` - Load version control example

## Architecture

### Core Modules
- **Entity** (`src/entity.js`) - Main class for defining DynamoDB entities with schema validation and query building
- **Service** (`src/service.js`) - Orchestrates multiple entities for cross-entity operations and collections
- **Schema** (`src/schema.js`) - Schema definition, validation, and attribute processing
- **Client** (`src/client.js`) - DynamoDB client abstraction and parameter building

### Query System
- **Clauses** (`src/clauses.js`) - Query clause building and chaining logic
- **Filters** (`src/filters.js`) - Filter expression composition
- **Where** (`src/where.js`) - Condition expression building
- **Operations** (`src/operations.js`) - DynamoDB operation abstractions

### Validation and Types
- **Validations** (`src/validations.js`) - Input validation and sanitization
- **Types** (`src/types.js`) - Type definitions and constants
- **Errors** (`src/errors.js`) - Custom error classes and error handling

### Key Design Patterns
1. **Single Table Design** - All entities share one DynamoDB table with composite key patterns
2. **Schema-First Approach** - Entities are defined with strict schemas for attributes, indexes, and access patterns
3. **Fluent Query Interface** - Chainable methods for building complex queries and mutations
4. **Collection-Based Queries** - Services enable querying across multiple related entities

### Entry Points
- Main export in `index.js` exposes Entity, Service, transaction helpers, and error classes
- TypeScript definitions in `index.d.ts` provide comprehensive type safety
- Browser bundle built to `playground/bundle.js` for client-side usage

## Development Environment

### Prerequisites
- Node.js with npm
- Docker and Docker Compose for local DynamoDB
- TypeScript for type checking (installed as dev dependency)

### Local DynamoDB Setup
The project uses Docker Compose to run a local DynamoDB instance for development and testing. The `docker-compose.yml` configures DynamoDB Local on port 8000.

**Test Environment Setup**:
1. Ensure Docker Compose is running: `docker compose up -d`
2. Initialize/recreate test tables: `docker compose exec electro npm run test:init:hard`
3. Run tests: `npm run test:unit`

This setup is required before running any tests that interact with DynamoDB.

### Test Structure
Tests are organized in the `test/` directory with:
- `*.spec.*` files for unit tests run by Mocha
- Type definition tests using tsd framework
- Integration tests that require DynamoDB setup

### Code Style
- Uses Prettier for code formatting with configuration in `.prettierrc`
- TypeScript strict mode enabled in `tsconfig.json`
- ESNext target with CommonJS modules