-- Controls: every value in its own field. The FileMaker import had nowhere to
-- put a control's goal, acceptance criteria and guidance notes, so it wrote
-- them into the definition's instructions (description) as labelled
-- paragraphs; an execution's result text, points checked and notes all went
-- into its notes. They now have their own columns; description keeps what
-- really is instructions and notes keeps the notes. Additive only.

alter table public.control_definitions
  add column if not exists goal text,
  add column if not exists acceptance_criteria text,
  add column if not exists guide_notes text;

alter table public.control_executions
  add column if not exists result_text text,
  add column if not exists checked_points text;

comment on column public.control_definitions.goal is 'What the control is for (FileMaker ControlGoal).';
comment on column public.control_definitions.acceptance_criteria is 'When the result is acceptable (FileMaker ControlAcceptanceCriteria).';
comment on column public.control_definitions.guide_notes is 'Guidance notes for whoever records the control (FileMaker ControlNotes_Guides).';
comment on column public.control_executions.result_text is 'The result as written by the person recording (FileMaker ControlResult).';
comment on column public.control_executions.checked_points is 'The points that were checked (FileMaker ControlPoints).';
