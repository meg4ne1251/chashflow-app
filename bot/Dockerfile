FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r bot && useradd -r -g bot bot

# Install dependencies as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY bot.py .

# Change ownership
RUN chown -R bot:bot /app

# Switch to non-root user
USER bot

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import os, sys; sys.exit(0 if os.path.exists('/app/.heartbeat') else 1)"

CMD ["python", "-u", "bot.py"]
