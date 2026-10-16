"""Modelo de datos de aSIIstente (SQLAlchemy 2.0).

Reemplaza las carpetas empresa/<RUT>/rcv_*.csv del proyecto original por
tablas: así se pueden comparar estados entre consultas y generar alertas.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (BigInteger, Boolean, DateTime, ForeignKey, Index,
                        Integer, String, Text, UniqueConstraint, create_engine)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import (DeclarativeBase, Mapped, mapped_column,
                            relationship, sessionmaker)

from .config import config


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    nombre: Mapped[str] = mapped_column(String(200), default="")
    plan: Mapped[str] = mapped_column(String(30), default="gratis")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    acepto_terminos: Mapped[bool] = mapped_column(Boolean, default=False)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    es_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    recibir_correos: Mapped[bool] = mapped_column(Boolean, default=True)

    empresas: Mapped[list["Empresa"]] = relationship(back_populates="usuario",
                                                     cascade="all, delete-orphan")


class Empresa(Base):
    """Un RUT monitoreado. La clave tributaria se guarda cifrada."""
    __tablename__ = "empresas"
    __table_args__ = (UniqueConstraint("usuario_id", "rut", name="uq_usuario_rut"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id",
                                                             ondelete="CASCADE"))
    rut: Mapped[str] = mapped_column(String(12), index=True)      # 77218696-7
    razon_social: Mapped[str] = mapped_column(String(300), default="")
    clave_cifrada: Mapped[str] = mapped_column(Text)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    # última consulta exitosa por documento y último error, para el panel
    ultima_rcv: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultima_tgr: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultima_f29: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_error: Mapped[str | None] = mapped_column(Text)
    ultimo_error_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    credencial_invalida: Mapped[bool] = mapped_column(Boolean, default=False)

    # programación elegida por el usuario (dentro de lo que permite su plan)
    frecuencia_rcv_min: Mapped[int | None] = mapped_column(Integer)   # None = defecto del plan
    solo_horario_habil: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_tgr_f29: Mapped[bool] = mapped_column(Boolean, default=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="empresas")


class RcvDocumento(Base):
    """Una fila del RCV (una factura/boleta/nota). Clave natural compuesta."""
    __tablename__ = "rcv_documentos"
    __table_args__ = (
        UniqueConstraint("empresa_id", "periodo", "operacion", "tipo_doc",
                         "folio", "rut_contraparte", name="uq_rcv_doc"),
        Index("ix_rcv_empresa_periodo", "empresa_id", "periodo", "operacion"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"))
    periodo: Mapped[str] = mapped_column(String(6))          # 202609
    operacion: Mapped[str] = mapped_column(String(6))        # COMPRA / VENTA
    estado_contab: Mapped[str] = mapped_column(String(12))   # REGISTRO, PENDIENTE, NO_INCLUIR, RECLAMADO
    tipo_doc: Mapped[str] = mapped_column(String(4))         # 33, 34, 61...
    folio: Mapped[str] = mapped_column(String(20))
    rut_contraparte: Mapped[str] = mapped_column(String(12))
    razon_social: Mapped[str] = mapped_column(String(300), default="")
    fecha_emision: Mapped[str | None] = mapped_column(String(10))
    fecha_recepcion: Mapped[str | None] = mapped_column(String(20))
    fecha_acuse: Mapped[str | None] = mapped_column(String(20))
    monto_exento: Mapped[int] = mapped_column(BigInteger, default=0)
    monto_neto: Mapped[int] = mapped_column(BigInteger, default=0)
    monto_iva: Mapped[int] = mapped_column(BigInteger, default=0)
    monto_total: Mapped[int] = mapped_column(BigInteger, default=0)
    fila: Mapped[dict] = mapped_column(JSONB, default=dict)   # todas las columnas originales
    visto_primera_vez: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    visto_ultima_vez: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class RcvDescarga(Base):
    """CSV crudo tal como lo entrega el SII, para descarga del usuario."""
    __tablename__ = "rcv_descargas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas.id",
                                                                    ondelete="CASCADE"))
    periodo: Mapped[str] = mapped_column(String(6))
    operacion: Mapped[str] = mapped_column(String(6))
    estado_contab: Mapped[str] = mapped_column(String(12))
    archivo: Mapped[str] = mapped_column(String(500))        # ruta relativa a DATOS_DIR
    n_docs: Mapped[int] = mapped_column(Integer, default=0)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class TgrCertificado(Base):
    __tablename__ = "tgr_certificados"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"), index=True)
    fecha_emision: Mapped[str] = mapped_column(String(10), default="")
    total_morosa: Mapped[int] = mapped_column(BigInteger, default=0)
    total_no_vencida: Mapped[int] = mapped_column(BigInteger, default=0)
    n_giros: Mapped[int] = mapped_column(Integer, default=0)
    lineas: Mapped[list] = mapped_column(JSONB, default=list)
    pdf: Mapped[str] = mapped_column(String(500), default="")
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class F29Estado(Base):
    __tablename__ = "f29_estados"
    __table_args__ = (UniqueConstraint("empresa_id", "periodo", name="uq_f29_periodo"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"), index=True)
    periodo: Mapped[str] = mapped_column(String(6))
    estado: Mapped[str] = mapped_column(String(20))          # declarado / no_declarado / observado / sin_periodo
    folio: Mapped[str | None] = mapped_column(String(20))
    cod_int: Mapped[str | None] = mapped_column(String(20))
    pdf: Mapped[str | None] = mapped_column(String(500))
    actualizado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class Trabajo(Base):
    """Cola de trabajos visible al usuario (la cola real es Redis/RQ)."""
    __tablename__ = "trabajos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          default=uuid.uuid4)
    tipo: Mapped[str] = mapped_column(String(30))            # rcv, tgr, f29, demo_rcv
    estado: Mapped[str] = mapped_column(String(15), default="pendiente")  # pendiente, corriendo, ok, error
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id",
                                                                    ondelete="SET NULL"))
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas.id",
                                                                    ondelete="CASCADE"))
    rut: Mapped[str] = mapped_column(String(12), default="")
    parametros: Mapped[dict] = mapped_column(JSONB, default=dict)   # nunca credenciales
    resultado: Mapped[dict] = mapped_column(JSONB, default=dict)
    archivo: Mapped[str | None] = mapped_column(String(500))
    error: Mapped[str | None] = mapped_column(Text)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, index=True)
    iniciado: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terminado: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_origen: Mapped[str | None] = mapped_column(String(64))


class Alerta(Base):
    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(40))   # factura_reclamada, deuda_tgr_subio, f29_no_declarado, ...
    titulo: Mapped[str] = mapped_column(String(300))
    detalle: Mapped[dict] = mapped_column(JSONB, default=dict)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    enviada_correo: Mapped[bool] = mapped_column(Boolean, default=False)
    leida: Mapped[bool] = mapped_column(Boolean, default=False)


class ConsultaLog(Base):
    """Registro de actividad: el usuario ve cada consulta hecha con su RUT."""
    __tablename__ = "consultas_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas.id",
                                                                    ondelete="CASCADE"), index=True)
    rut: Mapped[str] = mapped_column(String(12), index=True)
    tipo: Mapped[str] = mapped_column(String(30))
    ok: Mapped[bool] = mapped_column(Boolean)
    mensaje: Mapped[str] = mapped_column(Text, default="")
    duracion_ms: Mapped[int] = mapped_column(Integer, default=0)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, index=True)


class F29Gestion(Base):
    """Seguimiento de períodos F29 no declarados u observados (la tabla de tu Excel).

    monto            : base estimada desde el RCV (IVA compras del período), o ingresada
    monto_multa      : monto con multa/reajuste/interés según el SII (extraído o manual)
    fuente_multa     : 'sii' | 'manual' | None
    """
    __tablename__ = "f29_gestion"
    __table_args__ = (UniqueConstraint("empresa_id", "periodo", name="uq_f29_gestion"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"), index=True)
    periodo: Mapped[str] = mapped_column(String(6))
    monto: Mapped[int | None] = mapped_column(BigInteger)
    monto_multa: Mapped[int | None] = mapped_column(BigInteger)
    fuente_multa: Mapped[str | None] = mapped_column(String(10))
    estado: Mapped[str] = mapped_column(String(20), default="Abierta")   # Abierta / Cerrada
    prioridad: Mapped[str] = mapped_column(String(10), default="Alta")   # Alta / Media / Baja
    accion: Mapped[str] = mapped_column(String(120), default="Calcular y Declarar")
    fecha_compromiso: Mapped[str | None] = mapped_column(String(10))
    fecha_cierre: Mapped[str | None] = mapped_column(String(10))
    comentario: Mapped[str] = mapped_column(Text, default="")
    actualizado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class ReportePlantilla(Base):
    """Plantilla de reporte del usuario: qué bloques, qué columnas, qué período."""
    __tablename__ = "reporte_plantillas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id",
                                                             ondelete="CASCADE"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    actualizado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class ReporteGenerado(Base):
    __tablename__ = "reportes_generados"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id",
                                                             ondelete="CASCADE"), index=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas.id",
                                                             ondelete="CASCADE"), index=True)
    plantilla_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reporte_plantillas.id",
                                                                      ondelete="SET NULL"))
    nombre: Mapped[str] = mapped_column(String(200), default="")
    config: Mapped[dict] = mapped_column(JSONB, default=dict)     # copia de la plantilla usada
    desde: Mapped[str] = mapped_column(String(6), default="")
    hasta: Mapped[str] = mapped_column(String(6), default="")
    estado: Mapped[str] = mapped_column(String(15), default="pendiente")
    pdf: Mapped[str | None] = mapped_column(String(500))
    error: Mapped[str | None] = mapped_column(Text)
    resumen: Mapped[dict] = mapped_column(JSONB, default=dict)   # totales para mostrar en la lista
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, index=True)
    terminado: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------
# Sesión de base de datos
# ---------------------------------------------------------------------------

_engine = None
_Session = None


_engine_pid: int | None = None


def engine():
    """Motor de SQLAlchemy. Si el proceso hizo fork (RQ lanza un hijo por
    trabajo), las conexiones heredadas del padre se descartan sin cerrarlas:
    compartirlas produce "prepared statement _pg3_N already exists"."""
    global _engine, _engine_pid
    pid = os.getpid()
    if _engine is None:
        _engine = create_engine(config().database_url, pool_pre_ping=True,
                                pool_size=5, max_overflow=10,
                                connect_args={"prepare_threshold": None})
        _engine_pid = pid
    elif _engine_pid != pid:
        _engine.dispose(close=False)
        _engine_pid = pid
    return _engine


def sesion_factory():
    global _Session
    if _Session is None:
        _Session = sessionmaker(bind=engine(), expire_on_commit=False)
    return _Session


# Columnas agregadas después del primer despliegue: create_all no altera tablas
# existentes, así que se añaden aquí de forma idempotente.
_MIGRACIONES = (
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS frecuencia_rcv_min INTEGER",
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS solo_horario_habil BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS auto_tgr_f29 BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_admin BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recibir_correos BOOLEAN NOT NULL DEFAULT TRUE",
)


def crear_tablas() -> None:
    from sqlalchemy import text
    e = engine()
    Base.metadata.create_all(e)
    with e.begin() as con:
        for sql in _MIGRACIONES:
            con.execute(text(sql))
