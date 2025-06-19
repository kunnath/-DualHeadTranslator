#!/bin/bash

# Script to set up PostgreSQL database for translation memory

echo "🐘 Setting up PostgreSQL database for Translation Memory..."

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
  echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
  exit 1
fi

# Try to create the database if it doesn't exist
echo "Creating database 'translation_memory' if it doesn't exist..."
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'translation_memory'" | grep -q 1 || \
psql -U postgres -c "CREATE DATABASE translation_memory"

if [ $? -eq 0 ]; then
  echo "✅ Database 'translation_memory' is ready."
else
  echo "❌ Failed to create database. Please check PostgreSQL permissions."
  exit 1
fi

echo "✅ PostgreSQL setup completed successfully!"
echo "🚀 You can now run 'npm start' to start the application."
