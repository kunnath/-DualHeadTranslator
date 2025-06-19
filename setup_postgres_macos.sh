#!/bin/bash

# Helper script for macOS users to set up PostgreSQL

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or not in your PATH."
    echo "Install PostgreSQL using Homebrew with: brew install postgresql@14"
    echo "Or download from: https://www.postgresql.org/download/macosx/"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running."
    echo "Start PostgreSQL with: brew services start postgresql"
    echo "Or if installed manually: pg_ctl -D /usr/local/var/postgres start"
    exit 1
fi

# Create database
echo "Creating translation_memory database..."
createdb -U postgres translation_memory 2>/dev/null || echo "Database already exists or different user required."

# Try with current user if postgres user fails
if [ $? -ne 0 ]; then
    echo "Trying with current user..."
    createdb translation_memory 2>/dev/null
fi

# Update .env file with proper credentials
echo "Updating .env file with PostgreSQL connection details..."
username=$(whoami)

# Get PostgreSQL version
pg_version=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)

# Write to .env
grep -q "PG_USER" .env || echo -e "\n# PostgreSQL Configuration" >> .env
sed -i '' '/PG_USER=/d' .env 2>/dev/null || true
sed -i '' '/PG_PASSWORD=/d' .env 2>/dev/null || true
sed -i '' '/PG_DATABASE=/d' .env 2>/dev/null || true

echo "PG_HOST=localhost" >> .env
echo "PG_PORT=5432" >> .env
echo "PG_DATABASE=translation_memory" >> .env
echo "PG_USER=$username" >> .env
echo "PG_PASSWORD=" >> .env

echo "✅ PostgreSQL setup completed!"
echo "If you encounter connection issues, please check your PostgreSQL user permissions."
echo "🚀 You can now run 'npm start' to start the application."
