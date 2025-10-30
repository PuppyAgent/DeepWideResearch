FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV HOST=0.0.0.0
ENV PAYMENTS_PORT=8100

EXPOSE 8100

CMD ["uvicorn", "payments.server:app", "--host", "0.0.0.0", "--port", "8100", "--log-level", "info"]

