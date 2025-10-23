# Use official Python image
FROM python:3.12-slim

WORKDIR /app

# Install Node.js and npm (needed for npx to run MCP servers)
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN python --version && node --version && npm --version

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway will dynamically allocate)
EXPOSE ${PORT:-8000}

# Start command (use shell form to support environment variables)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

