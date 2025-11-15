#!/bin/bash

# Load environment variables
export $(cat .env | xargs)

# Run database migration/push
echo "Pushing database schema..."
npx prisma db push --accept-data-loss

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Build Next.js application
echo "Building Next.js application..."
npm run build

echo "Build completed successfully!"
