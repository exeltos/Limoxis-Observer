-- The four supplier evaluation templates in every Demo organization (products,
-- services / subcontractors, kitchen, laboratory), the same as the browser demo
-- (src/features/quality/resources/supplierTemplates.js, TEMPLATE_PRESETS).
-- Idempotent: a template already there by name is left as it is.

with presets(name, categories, criteria) as (
  values
    ('Προμηθευτής Προϊόντων', array['products','medical_devices','consumables','pharmaceuticals'],
      '[["Ποιότητα προϊόντων",0.2],["Συνέπεια στους χρόνους παράδοσης",0.2],["Συμμόρφωση με τις προδιαγραφές της παραγγελίας",0.2],["Πιστοποιητικά και τεκμηρίωση (CE, ISO, δηλώσεις συμμόρφωσης)",0.15],["Εξυπηρέτηση και διαχείριση παραπόνων",0.15],["Τιμή και όροι πληρωμής",0.1]]'::jsonb),
    ('Προμηθευτής Υπηρεσιών/Υπεργολάβος', array['services','maintenance','cleaning','laundry','waste','it','certification_body'],
      '[["Ποιότητα παρεχόμενων υπηρεσιών",0.2],["Τήρηση χρονοδιαγράμματος και ανταπόκριση",0.2],["Επάρκεια και εκπαίδευση προσωπικού",0.2],["Συμμόρφωση με νομοθεσία, ασφάλεια και τεκμηρίωση",0.15],["Επικοινωνία και αναφορές",0.15],["Κόστος",0.1]]'::jsonb),
    ('Προμηθευτής Κουζίνας', array['kitchen'],
      '[["Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών",0.12],["Ασφάλεια τροφίμων (HACCP / ISO 22000, άδειες)",0.16],["Θερμοκρασία και συνθήκες μεταφοράς",0.14],["Υγιεινή οχήματος και προσωπικού παράδοσης",0.12],["Επισήμανση, ιχνηλασιμότητα και ημερομηνίες λήξης",0.12],["Συνέπεια στους χρόνους παράδοσης",0.12],["Πληρότητα παραγγελίας",0.12],["Τιμή",0.1]]'::jsonb),
    ('Προμηθευτής Εργαστηρίου', array['laboratory'],
      '[["Ποιότητα προϊόντων (αντιδραστήρια, αναλώσιμα)",0.2],["Πιστοποίηση: CE-IVD / ISO 13485, ISO 15189 όπου απαιτείται",0.15],["Ποιοτικός έλεγχος παρτίδας (πιστοποιητικά ανάλυσης, εξωτερικός έλεγχος)",0.15],["Ψυχρή αλυσίδα κατά τη μεταφορά και αποθήκευση",0.15],["Τεχνική και επιστημονική υποστήριξη αναλυτών",0.15],["Συνέπεια στους χρόνους παράδοσης",0.1],["Τιμή και όροι",0.1]]'::jsonb)
),
created as (
  insert into public.quality_supplier_eval_templates (organization_id, name, description, categories, pass_threshold, conditional_threshold, frequency_months, score_scale, source)
  select o.id, p.name, 'Πρότυπο της Demo· επεξεργάσιμο.', p.categories, 70, 50, 12, 5, 'seed'
  from public.organizations o cross join presets p
  where o.is_demo
  on conflict (organization_id, name) do nothing
  returning id, organization_id, name
)
insert into public.quality_supplier_eval_template_criteria (organization_id, template_id, position, label, weight)
select c.organization_id, c.id, (e.ordinality - 1)::smallint, e.value->>0, (e.value->>1)::numeric
from created c
join presets p on p.name = c.name
cross join lateral jsonb_array_elements(p.criteria) with ordinality e;
