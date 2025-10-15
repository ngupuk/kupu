FROM node:22-slim AS web
WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm install

COPY web/tsconfig.json web/vite.config.ts ./
COPY web ./

ENV VITE_API_BASE_URL=""
RUN npm run build


FROM python:3.12-slim AS model-service

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:/root/.cargo/bin:$PATH"

WORKDIR /app

COPY model-service/pyproject.toml model-service/uv.lock ./

RUN uv sync

COPY model-service .
COPY --from=web /app/dist ../web/dist
EXPOSE 8003

CMD ["uv", "run", "python3", "server.py", "--production", "--host", "0.0.0.0", "--port", "8003"]

