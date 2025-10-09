cd model-service \
&& uv venv \
&& source .venv/bin/activate \
&& uv sync \
&& python3 server.py --reload --host 0.0.0.0 --port 8003