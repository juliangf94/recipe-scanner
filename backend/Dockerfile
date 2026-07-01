# ─── Stage: base ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ─── Stage: dev ──────────────────────────────────────────────────────────────
FROM base AS dev
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p app/static/uploads/avatars app/static/uploads/recipes
EXPOSE 5000
CMD ["python", "run.py"]

# ─── Stage: production ───────────────────────────────────────────────────────
FROM base AS production
RUN addgroup --gid 1001 appgroup \
 && adduser --uid 1001 --gid 1001 --no-create-home --disabled-password appuser
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=appuser:appgroup . .
RUN mkdir -p app/static/uploads/avatars app/static/uploads/recipes \
 && chown -R appuser:appgroup app/static/uploads
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/docs')" || exit 1
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "run:app"]
