FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    EHR_OFFLINE_MODE=true \
    HOST=0.0.0.0 \
    PORT=8000

COPY requirements.txt .

RUN pip install --no-cache-dir fastapi uvicorn pydantic

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
