-- FOR THE OWNER (SQL Editor): the agent does not run drop (the MCP hangs on it).
-- The supplier certificate request header kept seven columns from its first version; since the
-- items table (20261129100000) each certificate's values live on the item. Checked before writing:
-- all seven are empty (0 of 2 requests), and no function, policy or the app reads them from the request.
alter table public.quality_supplier_certificate_requests
  drop column if exists certificate_type,
  drop column if exists certificate_number,
  drop column if exists issuer,
  drop column if exists issued_on,
  drop column if exists expires_on,
  drop column if exists note,
  drop column if exists attachment_id;
