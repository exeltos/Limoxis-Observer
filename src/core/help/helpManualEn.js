export const helpManualEn={
 '/':{title:'Dashboard',summary:'Your personal operational view of the day.',audience:'All users with Dashboard access',chapters:[
  ['Orientation','The Dashboard is not identical for every user. It adapts to your role, scope, additional capabilities and current assignments.'],
  ['What needs attention','Start with pending items and notifications. Selecting a task takes you directly to the corresponding operational record.'],
  ['Quick actions','Use only the actions available for your role. If an action is not visible, the related permission has not been granted.']
 ],steps:['Review today’s pending work.','Open the task that requires action.','Return to the Dashboard and continue with the next priority.'],preview:'dashboard'},
 '/my-department':{title:'My department',summary:'Department-level work, obligations and visibility within your own scope.',audience:'Department managers and department users',chapters:[
  ['Department view','Department managers receive a broader operational view. Standard department users see only the information required for their assigned daily work.'],
  ['My pending work','Controls, training, follow-up and other assignments are gathered here so users do not need to search across the whole application.']
 ],steps:['Review personal and department pending work.','Open the assigned task from the list.','Complete or document only the work assigned to your scope.'],preview:'department'},
 '/my-profile':{title:'My record',summary:'Your personal employee record and the information you are allowed to access.',audience:'Employees',chapters:[
  ['Personal details','The record displays work identity, department, position and employment status. Administrative data cannot be freely changed by the employee.'],
  ['Training & certificates','You can review your own training assignments, completions and available certificates.'],
  ['Employee health','Occupational-health information remains separated and is displayed only where explicit authorization exists.']
 ],steps:['Review the information in your record.','Open the section available to your role.','Request administrative corrections from the authorized role when needed.'],preview:'profile'},
 '/patients':{title:'Patients',summary:'Patient registry and entry point to the surveillance record.',audience:'Infection Control and authorized clinical roles',chapters:[
  ['Patient search','Always search before creating a new patient record to reduce the risk of duplicate records.'],
  ['Patient record','The patient record brings together demographics and linked surveillance episodes. Available actions depend on your permission set.'],
  ['New patient','A new patient can be created only by users with Create permission and only with the minimum required information.']
 ],steps:['Search for the patient first.','Open the existing record or create a new one if permitted.','Continue to the linked surveillance episode.'],preview:'registry'},
 '/surveillance':{title:'Surveillance',summary:'Complete infection-surveillance workflow from initial assessment to outcome.',audience:'Infection Control lead/team and authorized clinical roles',chapters:[
  ['Surveillance episode','Each episode is treated as one continuous record. Avoid creating disconnected parallel records for the same episode.'],
  ['Clinical assessment','Record the clinical information required for HAI assessment and the patient’s current clinical picture.'],
  ['Microbiology & AMR','Laboratory data are reused from the Laboratory module. MDR/XDR/PDR assessment is based on available validated microbiology results.'],
  ['Therapy & isolation','Antimicrobial therapy, isolation precautions, dates and reassessments remain within the same episode timeline.'],
  ['Reassessment & outcome','Only authorized roles can close an episode. Completion remains traceable in the record history.']
 ],steps:['Open the active surveillance episode.','Review the timeline and missing information.','Complete the appropriate clinical or laboratory-related section.','Reassess isolation and outcome when required.'],preview:'surveillance'},
 '/laboratory':{title:'Laboratory',summary:'Samples, microbiology, AST and critical results without duplicate data entry.',audience:'Laboratory and authorized users',chapters:[
  ['Laboratory queue','The landing page highlights pending samples, results and critical laboratory work.'],
  ['Sample & result','A sample remains linked to its subject/source and progresses to a result without creating a second disconnected record.'],
  ['AST & resistance','Susceptibility data use the central organism and antimicrobial libraries to support consistent recording.'],
  ['Critical communication','Critical-result communication is documented with time, recipient and responsible user.']
 ],steps:['Open the pending work queue.','Select the relevant sample.','Record or validate the result and AST.','Document critical communication when required.'],preview:'laboratory'},
 '/prevention':{title:'Prevention',summary:'Prevention tools displayed according to role and capability.',audience:'Infection Control and users with the relevant assigned responsibility',chapters:[
  ['Hand hygiene','Record WHO observations using standardized fields and calculated compliance.'],
  ['Prevention bundles','CLABSI, CAUTI, VAP/VAE, SSI and other bundles use versioned criteria with Yes/No/N/A responses.'],
  ['Antiseptics & waste','These workflows are visible only to users with the appropriate operational responsibility.'],
  ['Use of data','Prevention records feed indicators and analytics without unnecessary duplicate entry.']
 ],steps:['Choose the prevention workflow.','Set department and period using the filters.','Record the observation or bundle assessment.','Review the calculated result before saving.'],preview:'prevention'},
 '/controls':{title:'Controls',summary:'Execution of assigned controls with evidence and independent status by department.',audience:'Users with a control assignment or Controls permission',chapters:[
  ['To execute','Shows controls assigned to you or to your permitted organizational scope.'],
  ['Executing a control','Open the task, review the criteria, record the result and attach evidence where required.'],
  ['What executors cannot change','Executors do not change frequency, programme, departments or governance settings for the control.'],
  ['Completion','Each department completes its own obligation. Completing one scope does not close outstanding assignments for other scopes.']
 ],steps:['Open “To execute”.','Select the control.','Complete each criterion and supporting evidence.','Finish only after reviewing the full entry.'],preview:'controls'},
 '/quality':{title:'Quality Center',summary:'Incidents, audits, findings and CAPA within controlled workflows.',audience:'Quality Manager and authorized roles',chapters:[
  ['Incidents','An incident progresses through statuses and an audit trail. It should not simply disappear because a user changes their mind.'],
  ['Findings & CAPA','Findings can be linked to corrective/preventive actions with owners, deadlines and effectiveness follow-up.'],
  ['Audits','Audits and their findings remain linked to follow-up actions and evidence.']
 ],steps:['Open the relevant queue.','Select the incident, audit or finding.','Record the assessment and actions.','Follow CAPA through controlled completion.'],preview:'quality'},
 '/indicators':{title:'Indicators',summary:'Measurable monitoring with explicit numerator, denominator, target and drill-down.',audience:'Infection Control, Quality and authorized management roles',chapters:[
  ['Indicator definition','Every indicator has a definition, unit, numerator, denominator, multiplier, target and direction.'],
  ['Automatic calculation','Where reliable source data exist, the indicator is calculated without duplicate manual entry.'],
  ['Drill-down','Each displayed value should be explainable through the source data that produced it.']
 ],steps:['Choose the reporting period and scope.','Review the value and target.','Open drill-down when investigation is required.'],preview:'indicators'},
 '/training':{title:'Training',summary:'Different workspaces for training administrators and employees.',audience:'Training administrators and employees',chapters:[
  ['For administrators','Create programmes, manage participants and attendance, publish material, assessments, results and certificates.'],
  ['For employees','Employees see their own assigned and completed training and available certificates.'],
  ['Evidence','Attendance, completion and competence are retained as controlled evidence.']
 ],steps:['Open the programme or assignment.','Perform the action available to your role.','Review completion, results and certificates.'],preview:'training'},
 '/committees':{title:'Committees',summary:'Meetings, minutes, decisions and action follow-up.',audience:'Committee Secretariat and authorized members',chapters:[
  ['Membership','Members and committee roles have validity periods and history.'],
  ['Meetings','Meetings include participants, quorum, agenda topics and minutes.'],
  ['Decisions & actions','A decision can create a follow-up action with owner and deadline.']
 ],steps:['Open the committee.','Select a meeting or create one if permitted.','Record topics and decisions.','Follow actions through completion.'],preview:'committees'},
 '/documents':{title:'Documents',summary:'Controlled documents and shared content by role and scope.',audience:'Users with document access',chapters:[
  ['Viewing documents','Standard users see documents shared with them or their department.'],
  ['Management','Creating, publishing and archiving require the relevant permissions.'],
  ['History','Published content should not be silently overwritten. Significant changes retain revision history.']
 ],steps:['Search for the document.','Open the current version.','Use only the actions available to your role.'],preview:'documents'},
 '/employees':{title:'Employees',summary:'Administrative staff registry with strict separation of sensitive health information.',audience:'HR, Hospital Admin and authorized roles',chapters:[
  ['Registry','Search and manage administrative employee information.'],
  ['Department & position','Central libraries are used so values remain consistent across the application.'],
  ['Clinical separation','HR access to administrative staff data does not automatically grant access to occupational-health visits or clinical notes.']
 ],steps:['Search for the employee.','Open the record or create a new one if permitted.','Update only the fields that belong to your role.'],preview:'employees'},
 '/pharmacy':{title:'Pharmacy',summary:'Antimicrobial stewardship, approvals and consumption monitoring.',audience:'Pharmacy, clinical reviewers and Infection Control where authorized',chapters:[
  ['Restricted antimicrobials','Requests and approvals follow a controlled workflow.'],
  ['Consumption','DDD and other measures support stewardship monitoring and indicators.'],
  ['Connection to surveillance','Therapy data are linked to surveillance episodes without duplicate recording.']
 ],steps:['Open the pending request or record.','Review the required information.','Approve or record only when your role has the relevant permission.'],preview:'pharmacy'},
 '/occupational-health':{title:'Occupational Health',summary:'Employee visits, vaccinations and follow-up with strict confidentiality.',audience:'Occupational Physician and explicitly authorized roles',chapters:[
  ['Visits','Occupational-health visits remain within a protected clinical scope.'],
  ['Vaccinations','Record vaccine, dose, lot, dates and follow-up when required.'],
  ['Follow-up','Expiry dates and required follow-up are surfaced as operational pending work.']
 ],steps:['Search for the employee.','Open the protected clinical record.','Record the visit, vaccination or follow-up.'],preview:'occupational'},
 '/lira':{title:'LIRA AI',summary:'Operational intelligence over data the current user is already allowed to access.',audience:'Roles/capabilities with LIRA access',chapters:[
  ['Ask LIRA','Use focused questions for operational search and synthesis.'],
  ['LIRA Briefing','Summarizes relevant pending work and patterns within the permitted scope.'],
  ['Limits','LIRA does not bypass permissions and does not autonomously change clinical or administrative records.']
 ],steps:['Ask a specific operational question.','Review the information and source context.','Open the underlying record before taking a critical action.'],preview:'lira'},
 '/management':{title:'Management Center',summary:'Organization, users, roles, libraries and governed configuration.',audience:'Hospital Admin and explicitly authorized administrators',chapters:[
  ['Organization & users','Manage hospital identity, user accounts and activation.'],
  ['Roles & permissions','Permissions define View/Create/Edit/Complete/Approve/Delete/Export/Assign/Manage and must align with backend enforcement.'],
  ['Libraries','Departments, organisms, antimicrobials and other shared values are managed centrally.'],
  ['Core content','Hospital changes to core definitions use controlled override/hide patterns where required instead of destroying baseline content.']
 ],steps:['Choose the management area.','Find the relevant record.','Review scope and impact before changing it.','Save and verify feedback/audit outcome.'],preview:'management'}
}
