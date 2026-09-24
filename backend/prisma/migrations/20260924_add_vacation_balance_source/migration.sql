-- Origen del saldo: API (BUK ya descuenta vacaciones aprobadas a futuro) o EXCEL
ALTER TABLE "vacation_balances" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'EXCEL';
