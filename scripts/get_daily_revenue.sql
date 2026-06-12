-- SQL script for get_daily_revenue RPC
-- Run this via: prisma db execute --file scripts/get_daily_revenue.sql

CREATE OR REPLACE FUNCTION get_daily_revenue(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_branch_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  "date" DATE,
  department TEXT,
  doctor_name TEXT,
  payer_type TEXT,
  billed_amount NUMERIC,
  collected_amount NUMERIC,
  invoice_count BIGINT
) AS $$
BEGIN
  -- Add a statement_timeout of 30 seconds
  SET LOCAL statement_timeout = '30s';

  RETURN QUERY
  SELECT 
    DATE(i.created_at) as "date",
    COALESCE(u.department, u.specialty, 'Unknown') as department,
    COALESCE(u.name, 'Unknown') as doctor_name,
    COALESCE(i.billing_patient_type, 'cash') as payer_type,
    COALESCE(SUM(i.total_amount), 0) as billed_amount,
    COALESCE(SUM(p.amount), 0) as collected_amount,
    COUNT(DISTINCT i.id) as invoice_count
  FROM invoices i
  LEFT JOIN "users" u ON i.doctor_id = u.id
  LEFT JOIN payments p ON p.invoice_id = i.id
  WHERE i."organizationId" = p_org_id
    AND i.status != 'cancelled'
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
    AND (p_department_id IS NULL OR u.department = p_department_id::text OR u.specialty = p_department_id::text)
  GROUP BY 
    DATE(i.created_at),
    COALESCE(u.department, u.specialty, 'Unknown'),
    u.name,
    i.billing_patient_type
  ORDER BY 1 DESC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- CREATE INDEX CONCURRENTLY ON invoices("organizationId", created_at) WHERE status != 'cancelled';
