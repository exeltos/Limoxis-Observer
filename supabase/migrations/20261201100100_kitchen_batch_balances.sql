-- Kitchen: the screens no longer read every kitchen table in full. Day records
-- (materials used, heat treatments, pureeing, defrosting, production days) are
-- read for a date window; the stock still needs, for every batch, what was used
-- and written off over its whole life. This function adds that up in the
-- database, per received batch (receipt item):
--
-- public.kitchen_batch_balances(org, since)
--     used quantity, number of uses and written-off quantity of each batch, and
--     whether it is still in stock (receipt and item not rejected, something
--     left: the same rule as kitchenModel.stockRows). It returns the batches
--     received on or after `since` (every batch when null) and every batch of
--     an older receipt that still holds stock, so the screens also read those
--     receipts whole.
--
-- SECURITY INVOKER: it reads through the kitchen tables' own row level
-- security, so a caller sees the batches they could select.

create or replace function public.kitchen_batch_balances(p_organization_id uuid, p_since date default null)
returns table (receipt_item_id uuid, receipt_id uuid, used numeric, uses bigint, written_off numeric, in_stock boolean)
language sql stable security invoker set search_path = ''
as $$
  with used as (
    select u.receipt_item_id, coalesce(sum(u.quantity), 0) as used, count(*) as uses
    from public.kitchen_material_usage u
    where u.organization_id = p_organization_id and u.receipt_item_id is not null
    group by u.receipt_item_id
  ), off as (
    select w.receipt_item_id, coalesce(sum(w.quantity), 0) as written_off
    from public.kitchen_stock_writeoffs w
    where w.organization_id = p_organization_id and w.receipt_item_id is not null
    group by w.receipt_item_id
  ), batches as (
    select i.id, i.receipt_id, r.received_on,
           coalesce(u.used, 0) as used, coalesce(u.uses, 0) as uses, coalesce(o.written_off, 0) as written_off,
           coalesce(r.accepted, true) and coalesce(i.accepted, true) as accepted,
           coalesce(i.quantity, 0) - round(coalesce(u.used, 0), 3) - round(coalesce(o.written_off, 0), 3) as remaining
    from public.kitchen_receipt_items i
    join public.kitchen_receipts r on r.id = i.receipt_id
    left join used u on u.receipt_item_id = i.id
    left join off o on o.receipt_item_id = i.id
    where i.organization_id = p_organization_id
  )
  select b.id, b.receipt_id, b.used, b.uses, b.written_off, b.accepted and b.remaining > 0.0005
  from batches b
  -- Every batch of a receipt that still holds stock (or used beyond what was
  -- received: the stock flags it), and every batch received since `since`.
  where p_since is null or b.received_on >= p_since
     or b.receipt_id in (select o.receipt_id from batches o where o.accepted and abs(o.remaining) > 0.0005);
$$;

revoke all on function public.kitchen_batch_balances(uuid, date) from public, anon;
grant execute on function public.kitchen_batch_balances(uuid, date) to authenticated;
