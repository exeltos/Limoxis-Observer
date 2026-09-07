import { TrainingProductionPage } from './TrainingProductionPage'

// One canonical Training frontend for every data environment.
// Demo/production differences belong in the service layer, not in separate pages.
export function TrainingPageRoute(){
  return <TrainingProductionPage/>
}
