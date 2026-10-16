-- Se ejecuta una sola vez al crear el volumen de Postgres.
-- Las tablas las crea la API al arrancar (SQLAlchemy create_all).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SET timezone TO 'America/Santiago';
