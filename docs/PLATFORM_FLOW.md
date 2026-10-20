# Ροή πλατφόρμας και πρόοδος υλοποίησης

Ζωντανός χάρτης του Limoxis Observer: ποια ενότητα (module) τροφοδοτεί ποια, ποιος
ρόλος δουλεύει πού, και τι είναι υλοποιημένο, σε εξέλιξη ή προτεινόμενο. Ενημερώνεται
σε κάθε υλοποίηση (άλλαξε την κλάση `done` / `wip` / `next` του κόμβου).

Υπόμνημα: πράσινο = υλοποιημένο · πορτοκαλί = σε εξέλιξη · γκρι διακεκομμένο = προτεινόμενο.

## 1. Modules και ροή δεδομένων

```mermaid
flowchart LR
  classDef done fill:#e3f3ea,stroke:#39785a,color:#173b2a
  classDef wip fill:#fdf1dc,stroke:#956d23,color:#4a360f
  classDef next fill:#f4f6f8,stroke:#8796a5,color:#3a4a5a,stroke-dasharray:4 3

  subgraph SRC[Πηγές]
    FM[FileMaker<br/>συγχρονισμός κάθε λεπτό]:::done
    USERS[Καταχωρίσεις χρηστών]:::done
    SUP_EXT[Προμηθευτής<br/>δημόσια φόρμα]:::done
  end

  subgraph CLIN[Κλινικά]
    PAT[Ασθενείς]:::done
    SURV[Επιτήρηση HAI]:::done
    LAB[Εργαστήριο / AMR]:::done
    PREV[Πρόληψη]:::done
  end

  subgraph OPS[Λειτουργία]
    CTRL[Έλεγχοι]:::done
    KIT[Κουζίνα HACCP]:::done
    RECALL[Άσκηση ανάκλησης]:::done
    SUPP[Προμηθευτές &<br/>πιστοποιητικά]:::done
    RENEW[Ανανέωση πιστοποιητικών<br/>με έγκριση]:::done
  end

  subgraph PEOPLE[Ανθρώπινο δυναμικό]
    EMP[Εργαζόμενοι]:::done
    INT[Συνεντεύξεις HR]:::done
    TRAIN[Εκπαίδευση]:::done
    OH[Ιατρός Εργασίας]:::done
  end

  subgraph GOV[Διακυβέρνηση]
    QUAL[Ποιότητα / CAPA]:::done
    COMM[Επιτροπές]:::done
    DOCS[Έγγραφα]:::done
  end

  subgraph INSIGHT[Εικόνα]
    DASH[Αρχική ανά ρόλο]:::done
    ANA[Ανάλυση]:::done
    EXEC[Πίνακας Διοίκησης<br/>Διευθυντής]:::done
    IND[Δείκτες]:::done
  end

  FM --> PAT & SURV & LAB & CTRL & KIT & EMP & TRAIN & QUAL & COMM & INT
  USERS --> CLIN & OPS & PEOPLE & GOV
  LAB --> SURV
  PAT --> SURV
  KIT --> RECALL
  SUPP --> KIT
  SUPP --> RENEW
  RENEW -- email με σύνδεσμο --> SUP_EXT
  SUP_EXT -- νέο πιστοποιητικό --> SUPP
  INT -- πρόσληψη --> EMP
  EMP --> TRAIN & OH
  CTRL -- εύρημα --> QUAL
  QUAL --> COMM
  CLIN & OPS & PEOPLE & GOV --> ANA --> EXEC
  ANA --> IND
  CLIN & OPS --> DASH
```

## 2. Πρόσβαση: Platform Owner → νοσοκομείο → ρόλος

```mermaid
flowchart TB
  classDef done fill:#e3f3ea,stroke:#39785a,color:#173b2a
  classDef next fill:#f4f6f8,stroke:#8796a5,color:#3a4a5a,stroke-dasharray:4 3
  OWNER[Platform Owner]:::done --> PKG[Πακέτο + modules ανά νοσοκομείο<br/>κλείδωμα / ξεκλείδωμα]:::done
  PKG --> H1[Νοσοκομείο]:::done
  PKG --> DEMO[Demo νοσοκομείο<br/>πρόσβαση εταιρειών με λήξη]:::done
  H1 --> ROLES[Ρόλοι]:::done
  ROLES --> R1[Διαχειριστής] & R2[Διευθυντής<br/>μόνο ανάγνωση]:::done & R3[Υπεύθυνος Λοιμώξεων] & R4[Ποιότητα / Κουζίνα] & R5[HR] & R6[Τμήματα]
  PKG --> DBENF[Κλείδωμα module και στη βάση RLS]:::done
```

## 3. Ροή ανανέωσης πιστοποιητικού προμηθευτή

```mermaid
sequenceDiagram
  participant Q as Ποιότητα / Owner
  participant APP as Limoxis
  participant S as Προμηθευτής
  APP->>Q: Λίστα «Πιστοποιητικά προς ανανέωση» (ληγμένα / λήγουν)
  Q->>APP: Επιλογή + «Έγκριση & αποστολή»
  APP->>S: Email με μοναδικό σύνδεσμο (14 ημέρες, μία χρήση)
  S->>APP: Φόρμα: τύπος, αριθμός, εκδότης, λήξη, αρχείο
  APP->>Q: Προς έλεγχο
  Q->>APP: Αποδοχή → αντικαθιστά το παλιό (κρατά ιστορικό) / Απόρριψη με σχόλιο
```

## 4. Κατάσταση υλοποίησης

| Ενότητα | Κατάσταση | Σημείωση |
|---|---|---|
| Ταχύτητα: ενιαίοι μετρητές αρχικής, καμπανάκι, Έλεγχοι, Επιτήρηση, Ασθενείς, Ανάλυση | Υλοποιημένο | 27 αιτήματα → 1· Ασθενείς 35 αιτήματα → 1 (70 ms) |
| Ρόλος Διευθυντή + Πίνακας Διοίκησης | Υλοποιημένο | φίλτρα, σύγκριση περιόδου, PDF |
| Modules ανά νοσοκομείο (κουζίνα, προμηθευτές, συνεντεύξεις, ανάλυση, διοίκηση) | Υλοποιημένο | στο UI και στη βάση (132 πίνακες)· συγκεντρωτικές αναγνώσεις: μόνο στο UI |
| Άσκηση ανάκλησης κουζίνας | Υλοποιημένο | χρονόμετρο, ιχνηλάτηση, ισοζύγιο, PDF |
| Ανανέωση πιστοποιητικών προμηθευτών | Υλοποιημένο | χρειάζεται SMTP σε παραγωγή· ομαδοποίηση ανά προμηθευτή: προτεινόμενο |
| Συνεντεύξεις HR από FileMaker | Υλοποιημένο | 2 αιτήσεις μεταφέρθηκαν |
| Σύγχρονο login | Υλοποιημένο | |
| Πίνακας οθονών ΕΛ/EN · γεμάτο/άδειο · desktop/tablet | Υλοποιημένο | `npm run screens:matrix` |
| Καθαρισμός διπλών αρχείων FileMaker | Υλοποιημένο | −1,68 GB |
| Μετατροπή σε TypeScript | Προτεινόμενο | σταδιακά ανά φάκελο, νέο session |
