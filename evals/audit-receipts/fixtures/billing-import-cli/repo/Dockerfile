FROM python:3.12-slim

ARG WEBHOOK_TOKEN
ARG GIT_SHA=unknown

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    USAGEBILL_DB=/data/usagebill.db \
    USAGEBILL_PLANS=/app/config/plans.json \
    USAGEBILL_WEBHOOK_TOKEN=${WEBHOOK_TOKEN}

LABEL org.opencontainers.image.revision=${GIT_SHA}

WORKDIR /app
COPY pyproject.toml README.md ./
COPY usagebill ./usagebill
COPY config ./config

VOLUME ["/data"]
ENTRYPOINT ["python", "-m", "usagebill"]
CMD ["--help"]
