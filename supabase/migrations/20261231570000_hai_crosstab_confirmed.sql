-- ΛΣΦΥ: ένας ορισμός παντού (ιδιοκτήτης 16/11/2026). Η Σύνοψη μετρά μόνο τις επιβεβαιωμένες (haiConfirmed), ενώ οι πίνακες
-- «ΛΣΦΥ ανά τμήμα» (haiByDepartment, και η στήλη ΛΣΦΥ των Τμημάτων) και «Μικροοργανισμοί ανά τύπο ΛΣΦΥ» μετρούσαν και τις
-- πιθανές/ύποπτες. Τώρα μετρούν μόνο τις επιβεβαιωμένες (case_status = 'confirmed'), όπως ορίζουν ECDC και ΕΟΔΥ.
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_crosstab_metrics(uuid,date,date,uuid)'::regprocedure);
  v_dept text := 'from hai left join dept d on d.id = hai.department_id group by 1, 2) x)';
  v_org text := 'from hai join org on org.surveillance_case_id = hai.surveillance_case_id group by 1, 2) x)';
begin
  if position($q$hai.case_status = 'confirmed'$q$ in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_dept in v_def) = 0 or position(v_org in v_def) = 0 then raise exception 'analysis_crosstab_metrics: anchors not found'; end if;
  v_def := replace(v_def, v_dept, replace(v_dept, ' group by', $q$ where hai.case_status = 'confirmed' group by$q$));
  v_def := replace(v_def, v_org, replace(v_org, ' group by', $q$ where hai.case_status = 'confirmed' group by$q$));
  execute v_def;
end
$patch$;
