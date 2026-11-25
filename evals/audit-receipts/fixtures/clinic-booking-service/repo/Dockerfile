FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CLINICBOOK_DB=/data/clinicbook.sqlite3 \
    CLINICBOOK_HOST=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin clinicbook \
    && mkdir -p /data \
    && chown clinicbook:clinicbook /data

WORKDIR /app
COPY clinicbook/ clinicbook/
COPY config/ config/
COPY deploy/entrypoint.sh /usr/local/bin/clinicbook-entrypoint

USER clinicbook
VOLUME ["/data"]
EXPOSE 8080

ENTRYPOINT ["clinicbook-entrypoint"]
CMD ["serve"]
