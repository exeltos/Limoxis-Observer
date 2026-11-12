import { DepartmentMeetingsScreen } from '../quality/meetings/MeetingsSectionScreens'

// The department's own meetings (My department › Meetings): topics, decisions and the training that came up.
export function DepartmentMeetingsPage() {
  return <DepartmentMeetingsScreen home="/my-department/meetings" ownDepartment />
}
