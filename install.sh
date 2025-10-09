cd model-service \
&& pip install uv \
&& uv pip install -r requirements.txt \
&& uv venv \
&& source .venv/bin/activate \
&& uv sync \
&& cd ../web-kupu \
&& bundle install