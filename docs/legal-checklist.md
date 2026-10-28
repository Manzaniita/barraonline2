# BARRAONLINE.COM.AR — Checklist Legal, Fiscal y Regulatorio (Argentina)

> [!IMPORTANT]
> Este documento detalla las definiciones jurídicas, fiscales y operativas que deben ser refrendadas por el estudio jurídico y contable de BarraOnline antes de la salida comercial con cobros reales.

## 1. Encuadre Fiscal e Impositivo ante ARCA (ex AFIP) y Rentas Provinciales (ARBA)
- **No intermediación financiera**: En el modelo implementado, el 100% del pago de las bebidas ingresa de forma directa a la cuenta de Mercado Pago de titularidad de cada boliche mediante autorización OAuth 2.0. BarraOnline **no recauda fondos por cuenta y orden de terceros**, evitando caer en regímenes de retención/percepción propios de agrupadores de pago (como SIRTAC / RG AFIP de billeteras).
- **Obligación de facturación al consumidor final**: El establecimiento nocturno (boliche) es el vendedor directo de las bebidas y único sujeto obligado a emitir el comprobante fiscal al consumidor final.
- **Facturación B2B de BarraOnline al Boliche**:
  1. Factura mensual por **Abono SaaS de uso de plataforma** (`subscription_invoices`).
  2. Factura semanal/mensual por **Comisión variable por uso de tecnología** (`settlements`), calculada sobre la base comisionable auditada (`commission_ledger`).

## 2. Normativa de Expendio de Bebidas Alcohólicas (Ley Nacional N° 24.788 y PBA Leyes 11.748 / 14.050)
- **Prohibición a menores de 18 años**:
  - La carta incluye aviso legal visible: *"Beber con moderación. Prohibida su venta a menores de 18 años (Ley 24.788)"*.
  - En los Términos y Condiciones del comprador se establece que la compra digital **no exime de acreditar mayoría de edad (+18) con DNI físico en la barra** si el personal del boliche lo requiere al momento de escanear el QR.
- **Topes horarios de expendio nocturno**:
  - Cada boliche tiene configurado el parámetro `alcohol_cutoff_hour` (por defecto 05:00 AM) conforme a la ordenanza municipal aplicable (Mar del Plata, Pinamar, Villa Gesell, Partido de la Costa).

## 3. Protección de Datos Personales (Ley N° 25.326 — AAIP)
- **Minimización de datos en compra como invitado**: No se exige DNI, domicilio ni creación de cuenta obligatoria para comprar un trago.
- **Roles de tratamiento**:
  - Cada boliche reviste el carácter de *Responsable del Tratamiento* respecto de las operaciones comerciales celebradas en su establecimiento.
  - BarraOnline actúa como *Encargado de Tratamiento tecnológico* (con aislamiento estricto mediante PostgreSQL Row Level Security y cifrado AES-256-GCM) y como *Responsable* respecto de los usuarios que opten voluntariamente por vincular su identidad con Google OAuth.
