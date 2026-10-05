-- Los préstamos entre miembros ahora mueven las cuentas personales:
-- quien presta ve salir la plata y quien recibe la ve entrar (y al pagar, al revés).
-- Corrige los préstamos y pagos que ya existían.

-- préstamo: sale de quien presta (acreedor)
insert into personal_entries (household_id, event_id, member_id, amount_cents, category, description, occurred_on)
select d.household_id, d.event_id, d.creditor_id, -d.amount_cents, 'prestamo', 'Le presté: ' || d.description, d.occurred_on
from debts d
where not exists (
  select 1 from personal_entries pe
  where pe.event_id = d.event_id and pe.member_id = d.creditor_id and pe.category = 'prestamo'
);

-- préstamo: entra a quien lo recibe (deudor)
insert into personal_entries (household_id, event_id, member_id, amount_cents, category, description, occurred_on)
select d.household_id, d.event_id, d.debtor_id, d.amount_cents, 'prestamo', 'Me prestaron: ' || d.description, d.occurred_on
from debts d
where not exists (
  select 1 from personal_entries pe
  where pe.event_id = d.event_id and pe.member_id = d.debtor_id and pe.category = 'prestamo'
);

-- pagos de préstamos (en member_ledger el pago se guarda al revés: creditor = quien pagó)
insert into personal_entries (household_id, event_id, member_id, amount_cents, category, description, occurred_on)
select ml.household_id, ml.event_id, ml.creditor_id, -ml.amount_cents, 'prestamo', 'Pagué préstamo: ' || d.description, ml.occurred_on
from member_ledger ml join debts d on d.id = ml.debt_id
where ml.kind = 'debt_payment'
  and not exists (
    select 1 from personal_entries pe
    where pe.event_id = ml.event_id and pe.member_id = ml.creditor_id and pe.category = 'prestamo'
  );

insert into personal_entries (household_id, event_id, member_id, amount_cents, category, description, occurred_on)
select ml.household_id, ml.event_id, ml.debtor_id, ml.amount_cents, 'prestamo', 'Me pagaron préstamo: ' || d.description, ml.occurred_on
from member_ledger ml join debts d on d.id = ml.debt_id
where ml.kind = 'debt_payment'
  and not exists (
    select 1 from personal_entries pe
    where pe.event_id = ml.event_id and pe.member_id = ml.debtor_id and pe.category = 'prestamo'
  );
