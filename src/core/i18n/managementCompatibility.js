import { strings } from './LanguageContext'

const managementAliases = {
  el: {
    eyebrow: 'ΚΕΝΤΡΟ ΔΙΑΧΕΙΡΙΣΗΣ',
    demoModeText: 'Περιβάλλον επίδειξης με απομονωμένα demo δεδομένα. Οι αλλαγές δεν επηρεάζουν πραγματικούς οργανισμούς.',
    productionModeText: 'Κεντρική διαχείριση δεδομένων αναφοράς, πρόσβασης και παραμέτρων λειτουργίας του οργανισμού.',
    organizationCard: 'Στοιχεία οργανισμού που χρησιμοποιούνται σε αναφορές, εκτυπώσεις και στη λειτουργία του νοσοκομείου.',
    usersCard: 'Λογαριασμοί, προσκλήσεις και δικαιώματα πρόσβασης στον οργανισμό.',
    announcementsCard: 'Ανακοινώσεις και ενημερώσεις που εμφανίζονται στους χρήστες του οργανισμού.',
    librariesCard: 'Προστατευμένα λεξιλόγια, τοπικές εγγραφές και περιβαλλοντικά πρωτόκολλα.',
    preventionBundlesDescription: 'Ελεγχόμενο περιεχόμενο πρόληψης για CLABSI, CAUTI, VAP/VAE, SSI και λοιπά bundles.',
    patientDaysCard: 'Περίοδοι και νοσηλευτικές ημέρες που χρησιμοποιούνται ως παρονομαστές στους δείκτες.',
    referencesCard: 'Ελεγχόμενες εξωτερικές πηγές όπως WHO, EUCAST, ΕΟΔΥ και CDC με σαφές πεδίο χρήσης.',
    rolesCard: 'Ρόλοι, δικαιώματα και οργανωτικό scope χρηστών.'
  },
  en: {
    eyebrow: 'MANAGEMENT CENTER',
    demoModeText: 'Isolated demo environment. Changes here do not affect real organizations or production records.',
    productionModeText: 'Central management of reference data, access and operating parameters for the active organization.',
    organizationCard: 'Organization details used in reports, printouts and hospital operations.',
    usersCard: 'Accounts, invitations and access permissions for the organization.',
    announcementsCard: 'Announcements and updates displayed to organization users.',
    librariesCard: 'Protected vocabularies, local entries and environmental protocols.',
    preventionBundlesDescription: 'Governed prevention content for CLABSI, CAUTI, VAP/VAE, SSI and other bundles.',
    patientDaysCard: 'Periods and patient days used as denominators in indicators.',
    referencesCard: 'Governed external sources such as WHO, EUCAST, EODY and CDC with a defined scope.',
    rolesCard: 'Roles, permissions and organizational user scope.'
  }
}

for (const language of ['el', 'en']) {
  strings[language].managementPanel = {
    ...strings[language].managementPanel,
    ...managementAliases[language]
  }
}
