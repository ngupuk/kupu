# Use official lightweight Python 3.12 image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Environment settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install uv (fast dependency manager)
RUN pip install --no-cache-dir uv

# Copy dependency file first for caching
COPY requirements.txt .

# Install dependencies into the system environment
RUN uv pip install --system -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the app port
EXPOSE 8003

# Default command to run your server
CMD ["python3", "server.py", "--reload", "--host", "0.0.0.0", "--port", "8003"]
