-- The hospital administrator's home («Χρειάζεται απόφαση» and one status row
-- per module) adds the counts of the modules the home did not read yet:
-- expired supplier certificates (of active suppliers, as Analysis counts them),
-- supplier renewals awaiting approval of the e-mail or review of what the
-- supplier sent, the kitchen's out-of-limit checks of the last 30 days and its
-- unverified production days, the open applications and upcoming interviews.
-- Same signature, same SECURITY INVOKER: every count runs under the caller's
-- own RLS, so a role sees only what it may read (a module it cannot read
-- counts 0).

create or replace function public.dashboard_metrics(
  p_organization_id uuid,
  p_department_ids uuid[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      now() as at_now,
      current_date as today,
      date_trunc('day', now() at time zone 'utc') at time zone 'utc' as day_start,
      (current_date - 30)::timestamptz as month_ago,
      current_date + 30 as soon,
      coalesce(cardinality(p_department_ids), 0) > 0 as scoped
  )
  select jsonb_build_object(
    'activeUsers', (select count(*) from public.organization_members m where m.organization_id = p_organization_id and m.status = 'active'),
    'activeDepartments', (select count(*) from public.departments d where d.organization_id = p_organization_id and d.is_active),
    'patientDayPeriods', (select count(*) from public.patient_day_periods x where x.organization_id = p_organization_id),
    'inpatients', (select count(*) from public.patients x, params where x.organization_id = p_organization_id and x.discharge_date is null and (not params.scoped or x.department_id = any(p_department_ids))),
    'activeSurveillance', (select count(*) from public.surveillance_cases x, params where x.organization_id = p_organization_id and x.status = 'active' and (not params.scoped or x.department_id = any(p_department_ids))),
    'isolationReviewsDue', (select count(*) from public.isolation_episodes x, params where x.organization_id = p_organization_id and x.status = 'active' and x.review_due_at <= params.at_now and (not params.scoped or x.department_id = any(p_department_ids))),
    'overdueControls', (select count(*) from public.control_assignments x, params where x.organization_id = p_organization_id and x.next_due_at < params.at_now and x.status not in ('completed', 'cancelled') and (not params.scoped or x.department_id = any(p_department_ids))),
    'pendingSamples', (select count(*) from public.laboratory_samples x, params where x.organization_id = p_organization_id and x.status not in ('completed', 'validated', 'cancelled', 'rejected') and (not params.scoped or x.department_id = any(p_department_ids))),
    'newSamplesToday', (select count(*) from public.laboratory_samples x, params where x.organization_id = p_organization_id and x.created_at >= params.day_start and x.created_at < params.day_start + interval '1 day'),
    'positiveLab', (select count(*) from public.microbiology_results x where x.organization_id = p_organization_id and x.result_status = 'positive'),
    'criticalUncommunicated', (select count(*) from public.microbiology_results x where x.organization_id = p_organization_id and x.is_critical and x.critical_communicated_at is null),
    'recentMdro', (select count(*) from public.microbiology_results x, params where x.organization_id = p_organization_id and x.resistance_class in ('MDR', 'XDR', 'PDR') and x.resulted_at >= params.month_ago),
    'employeesWithoutDepartment', (select count(*) from public.employees x where x.organization_id = p_organization_id and x.employment_status = 'active' and x.department_id is null),
    'activeEmployees', (select count(*) from public.employees x where x.organization_id = p_organization_id and x.employment_status = 'active'),
    'newEmployees30d', (select count(*) from public.employees x, params where x.organization_id = p_organization_id and x.created_at >= params.month_ago),
    'ohVisitsToday', (select count(*) from public.occupational_health_visits x, params where x.organization_id = p_organization_id and x.visit_date = params.today),
    'ohFollowupsDue', (select count(*) from public.occupational_health_visits x, params where x.organization_id = p_organization_id and x.follow_up_date is not null and x.follow_up_date <= params.today and x.status not in ('completed', 'closed', 'cancelled')),
    'vaccinationsDue', (select count(*) from public.employee_vaccinations x, params where x.organization_id = p_organization_id and x.valid_until is not null and x.valid_until >= params.today and x.valid_until <= params.soon),
    'openIncidents', (select count(*) from public.quality_incidents x where x.organization_id = p_organization_id and x.status not in ('closed', 'completed', 'cancelled')),
    'severeOpenIncidents', (select count(*) from public.quality_incidents x where x.organization_id = p_organization_id and x.severity = 'high' and x.status not in ('closed', 'completed', 'cancelled')),
    'overdueCapa', (select count(*) from public.quality_capa_actions x, params where x.organization_id = p_organization_id and x.due_date < params.today and x.status not in ('completed', 'closed', 'cancelled')),
    'pendingApprovals', (select count(*) from public.antimicrobial_therapies x where x.organization_id = p_organization_id and x.approval_status = 'pending'),
    'antimicrobialTherapies', (select count(*) from public.antimicrobial_therapies x where x.organization_id = p_organization_id),
    'administrations', (select count(*) from public.antimicrobial_therapy_administrations x where x.organization_id = p_organization_id and x.status = 'administered'),
    'upcomingMeetings', (select count(*) from public.committee_meetings x, params where x.organization_id = p_organization_id and x.scheduled_at >= params.at_now and x.status <> 'cancelled'),
    'pendingMinutes', (select count(*) from public.committee_meetings x, params where x.organization_id = p_organization_id and x.scheduled_at <= params.at_now and x.finalized_at is null and x.status <> 'cancelled'),
    'openDecisions', (select count(*) from public.committee_decisions x where x.organization_id = p_organization_id and x.status not in ('completed', 'closed', 'cancelled')),
    'expiredCertificates', (select count(*) from public.quality_supplier_certifications c join public.quality_suppliers s on s.id = c.supplier_id and s.organization_id = c.organization_id, params where c.organization_id = p_organization_id and s.status = 'active' and c.expires_on is not null and c.expires_on < params.today),
    'expiringCertificates', (select count(*) from public.quality_supplier_certifications c join public.quality_suppliers s on s.id = c.supplier_id and s.organization_id = c.organization_id, params where c.organization_id = p_organization_id and s.status = 'active' and c.expires_on >= params.today and c.expires_on <= params.soon),
    'supplierRenewalsToApprove', (select count(*) from public.quality_supplier_certificate_requests x where x.organization_id = p_organization_id and x.status = 'proposed'),
    'supplierRenewalsToReview', (select count(*) from public.quality_supplier_certificate_request_items x where x.organization_id = p_organization_id and x.status = 'submitted'),
    'kitchenOutOfLimits30d', (select count(*) from public.kitchen_receipts x, params where x.organization_id = p_organization_id and x.limit_status = 'out' and x.received_on >= params.today - 30)
      + (select count(*) from public.kitchen_thermal_processes x, params where x.organization_id = p_organization_id and x.limit_status = 'out' and x.process_date >= params.today - 30),
    'kitchenUnverifiedDays', (select count(*) from public.kitchen_productions x, params where x.organization_id = p_organization_id and x.verified_at is null and x.production_date < params.today and x.production_date >= params.today - 30),
    'openCandidates', (select count(*) from public.hr_candidates x where x.organization_id = p_organization_id and x.status in ('new', 'screening', 'interview_scheduled', 'interviewed', 'offer')),
    'newCandidates', (select count(*) from public.hr_candidates x where x.organization_id = p_organization_id and x.status = 'new'),
    'upcomingInterviews', (select count(*) from public.hr_interviews x, params where x.organization_id = p_organization_id and x.status = 'scheduled' and x.scheduled_at >= params.at_now)
  )
  from params
$$;

revoke all on function public.dashboard_metrics(uuid, uuid[]) from public, anon;
grant execute on function public.dashboard_metrics(uuid, uuid[]) to authenticated;
