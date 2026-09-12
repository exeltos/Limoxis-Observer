create or replace function private.indicator_metric_snapshot(p_organization_id uuid,p_from date,p_to date,p_department_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_scoped boolean; v_daily_count integer:=0; v_patient_days numeric:=0; v_active bigint:=0; v_resistant bigint:=0; v_hh_ok numeric:=0; v_hh_total numeric:=0; v_bundle_ok bigint:=0; v_bundle_total bigint:=0; v_abhr numeric:=0; v_staff bigint:=0; v_vaccinated bigint:=0; v_training_ok bigint:=0; v_training_total bigint:=0; v_incidents bigint:=0; v_mdro bigint:=0;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not (public.current_user_is_platform_owner() or public.current_user_has_capability(p_organization_id,'view_indicators')) then raise exception 'Indicator access denied'; end if;
 select exists(select 1 from public.organization_members om join public.organization_member_scopes oms on oms.membership_id=om.id where om.organization_id=p_organization_id and om.user_id=(select auth.uid()) and om.status='active') into v_scoped;
 if v_scoped and p_department_id is null then raise exception 'Department scope required'; end if;
 if v_scoped and p_department_id is not null and not public.current_user_has_department_scope(p_organization_id,p_department_id) then raise exception 'Department scope denied'; end if;
 select count(*),coalesce(sum(pd.patient_days),0) into v_daily_count,v_patient_days from public.patient_days pd where pd.organization_id=p_organization_id and pd.census_date between p_from and p_to and (p_department_id is null or pd.department_id=p_department_id);
 if v_daily_count=0 then select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start<=p_to and pp.period_end>=p_from and (p_department_id is null or pp.department_id=p_department_id); end if;
 select count(*) into v_active from public.surveillance_cases s where s.organization_id=p_organization_id and s.status='active' and s.started_at::date between p_from and p_to and (p_department_id is null or s.department_id=p_department_id);
 select count(*) into v_resistant from public.surveillance_cases s where s.organization_id=p_organization_id and s.status='active' and s.resistance_status is not null and s.started_at::date between p_from and p_to and (p_department_id is null or s.department_id=p_department_id);
 select coalesce(sum(h.compliant_observations),0),coalesce(sum(h.observations),0) into v_hh_ok,v_hh_total from public.hand_hygiene_sessions h where h.organization_id=p_organization_id and h.status='completed' and h.observation_date between p_from and p_to and (p_department_id is null or h.department_id=p_department_id);
 select count(*) filter(where b.score>=100),count(*) into v_bundle_ok,v_bundle_total from public.prevention_bundle_assessments b where b.organization_id=p_organization_id and b.status='completed' and b.assessment_date between p_from and p_to and (p_department_id is null or b.department_id=p_department_id);
 select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start<=p_to and a.period_end>=p_from and (p_department_id is null or a.department_id=p_department_id);
 select count(*) into v_staff from public.employees e where e.organization_id=p_organization_id and e.employment_status='active' and (p_department_id is null or e.department_id=p_department_id);
 select count(distinct v.employee_id) into v_vaccinated from public.employee_vaccinations v join public.employees e on e.id=v.employee_id where v.organization_id=p_organization_id and v.vaccination_date between p_from and p_to and e.employment_status='active' and (p_department_id is null or e.department_id=p_department_id);
 select count(*) filter(where t.status='completed'),count(*) into v_training_ok,v_training_total from public.employee_training_summary t join public.employees e on e.id=t.employee_id where t.organization_id=p_organization_id and t.training_date between p_from and p_to and (p_department_id is null or e.department_id=p_department_id);
 select count(*) into v_incidents from public.quality_incidents q where q.organization_id=p_organization_id and q.occurred_at::date between p_from and p_to and q.severity='high' and q.status<>'closed' and (p_department_id is null or q.department_id=p_department_id);
 select count(distinct m.id) into v_mdro from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id where m.organization_id=p_organization_id and m.result_status='positive' and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
 return jsonb_build_object('patient_days',v_patient_days,'active_surveillance',v_active,'resistant_active_surveillance',v_resistant,'hh_compliant_actions',v_hh_ok,'hh_opportunities',v_hh_total,'bundle_all_or_none_pass',v_bundle_ok,'bundle_executions',v_bundle_total,'abhr_litres',v_abhr,'active_staff',v_staff,'active_staff_with_vaccination',v_vaccinated,'training_completed',v_training_ok,'training_assignments',v_training_total,'open_high_incidents',v_incidents,'mdro_bsi',v_mdro);
end;$$;
revoke all on function private.indicator_metric_snapshot(uuid,date,date,uuid) from public,anon;
grant execute on function private.indicator_metric_snapshot(uuid,date,date,uuid) to authenticated;
create or replace function public.get_indicator_metric_snapshot(p_organization_id uuid,p_from date,p_to date,p_department_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.indicator_metric_snapshot(p_organization_id,p_from,p_to,p_department_id); $$;
revoke all on function public.get_indicator_metric_snapshot(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_indicator_metric_snapshot(uuid,date,date,uuid) to authenticated;
