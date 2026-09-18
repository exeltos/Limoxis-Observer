-- Govern admission lifecycle separately from patient identity edits.
alter table public.patient_admissions drop constraint if exists patient_admissions_status_check;
alter table public.patient_admissions add constraint patient_admissions_status_check check (status in ('active','discharged','transferred'));

create or replace function public.close_patient_admission(p_organization_id uuid,p_patient_id uuid,p_admission_id uuid,p_discharge_date date,p_reason text default null)
returns public.patient_admissions language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_admission public.patient_admissions%rowtype;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 select * into v_admission from public.patient_admissions where id=p_admission_id and patient_id=p_patient_id and organization_id=p_organization_id for update;
 if v_admission.id is null then raise exception 'admission not found'; end if;
 if v_admission.status<>'active' then raise exception 'only an active admission can be discharged'; end if;
 if p_discharge_date is null or p_discharge_date<v_admission.admission_date then raise exception 'valid discharge date is required'; end if;
 if not public.current_user_can_patient_capability(p_organization_id,v_admission.department_id,'edit_patient') then raise exception 'not authorized to discharge admission'; end if;
 update public.patient_admissions set status='discharged',discharge_date=p_discharge_date,notes=case when nullif(trim(p_reason),'') is null then notes else concat_ws(E'\n',notes,'Discharge: '||trim(p_reason)) end,updated_at=now() where id=p_admission_id returning * into v_admission;
 update public.patients set department_id=v_admission.department_id,admission_date=v_admission.admission_date,discharge_date=p_discharge_date,status='discharged',updated_at=now() where id=p_patient_id and organization_id=p_organization_id;
 insert into public.system_audit_log(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_actor,'patient.admission_discharged','patient_admission',p_admission_id::text,jsonb_build_object('organization_id',p_organization_id,'patient_id',p_patient_id,'discharge_date',p_discharge_date,'reason',nullif(trim(p_reason),'')));
 return v_admission;
end $$;

create or replace function public.transfer_patient_admission(p_organization_id uuid,p_patient_id uuid,p_admission_id uuid,p_to_department_id uuid,p_transfer_date date,p_reason text default null)
returns public.patient_admissions language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_from public.patient_admissions%rowtype; v_to public.patient_admissions%rowtype;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 select * into v_from from public.patient_admissions where id=p_admission_id and patient_id=p_patient_id and organization_id=p_organization_id for update;
 if v_from.id is null then raise exception 'admission not found'; end if;
 if v_from.status<>'active' then raise exception 'only an active admission can be transferred'; end if;
 if p_to_department_id is null or p_to_department_id=v_from.department_id then raise exception 'new department is required'; end if;
 if p_transfer_date is null or p_transfer_date<v_from.admission_date then raise exception 'valid transfer date is required'; end if;
 if not exists(select 1 from public.departments where id=p_to_department_id and organization_id=p_organization_id and is_active=true) then raise exception 'target department is not active in this organization'; end if;
 if not public.current_user_can_patient_capability(p_organization_id,v_from.department_id,'edit_patient') then raise exception 'not authorized to transfer admission'; end if;
 update public.patient_admissions set status='transferred',discharge_date=p_transfer_date,notes=case when nullif(trim(p_reason),'') is null then notes else concat_ws(E'\n',notes,'Transfer: '||trim(p_reason)) end,updated_at=now() where id=p_admission_id;
 insert into public.patient_admissions(organization_id,patient_id,department_id,admission_date,status,notes,created_by) values(p_organization_id,p_patient_id,p_to_department_id,p_transfer_date,'active',nullif(trim(p_reason),''),v_actor) returning * into v_to;
 update public.patients set department_id=p_to_department_id,admission_date=p_transfer_date,discharge_date=null,status='active',updated_at=now() where id=p_patient_id and organization_id=p_organization_id;
 insert into public.system_audit_log(actor_user_id,event_type,entity_type,entity_id,metadata) values(v_actor,'patient.admission_transferred','patient_admission',p_admission_id::text,jsonb_build_object('organization_id',p_organization_id,'patient_id',p_patient_id,'from_department_id',v_from.department_id,'to_department_id',p_to_department_id,'transfer_date',p_transfer_date,'new_admission_id',v_to.id,'reason',nullif(trim(p_reason),'')));
 return v_to;
end $$;

revoke all on function public.close_patient_admission(uuid,uuid,uuid,date,text) from public;
revoke all on function public.transfer_patient_admission(uuid,uuid,uuid,uuid,date,text) from public;
grant execute on function public.close_patient_admission(uuid,uuid,uuid,date,text) to authenticated;
grant execute on function public.transfer_patient_admission(uuid,uuid,uuid,uuid,date,text) to authenticated;
