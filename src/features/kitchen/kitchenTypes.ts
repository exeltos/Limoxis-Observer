import type { Database, Tables } from '../../core/supabase/database.types'

// The shape the kitchen screens keep (kitchenService translates it to and from the
// kitchen_* rows of database.types, column by column: COLUMNS in kitchenService).
//
// One entry reaches the screens three ways: read from the database (fromRow: every
// column, '' for an empty text, date or number, null for an empty yes/no), from the demo
// (kitchenDemoData) or as a form draft (new… in kitchenModel). A field every one of them
// carries is required; a field only some carry is optional. The pure functions read the
// state as `KitchenStateInput` (any part of it, rows with only what they read).

// --- Values ---------------------------------------------------------------------------------

// A number as typed in a form ('' when empty, "86,5") or as read (a number, '' when empty).
export type KitchenNumber = number | string
// In / out of the critical limits; null when nothing was measured (or the limit is off).
export type KitchenStatus = 'in' | 'out' | null
// A label in Greek and English: [el, en].
export type KitchenLabel = readonly string[]
// An option of a vocabulary (meal, diet, storage …) and of a select field.
export interface KitchenOption { value: string, label: KitchenLabel, tone?: string }
export interface KitchenSelectOption { value: string, label: string }
// Where an entry came from: 'app', 'demo' or 'filemaker' (the imported history).
export type KitchenSource = string

// Who recorded an entry and who signed it off (HACCP principle 6).
export interface KitchenRecorded { recordedByEmployeeId?: string, recordedByName?: string | null }
export interface KitchenSignOff { verifiedAt?: string | null, verifiedByName?: string | null, verifiedByEmployeeId?: string | null, reopenReason?: string | null }
// What every row carries: its id ('' in a new draft; a uuid, or the demo's id, once saved).
export interface KitchenSaved { id: string, createdAt?: string, updatedAt?: string }

// --- Configuration --------------------------------------------------------------------------

export interface KitchenSettings {
  expiryWarningDays: KitchenNumber
  haccpReviewMonths: KitchenNumber
  haccpLastReviewOn: string
  haccpDocumentId: string
  haccpTeam: string
  recallDrillMonths: KitchenNumber
  notes: string
  id?: string
  createdAt?: string
  updatedAt?: string
}

// A critical limit as the defaults give it.
export interface KitchenLimitDefault { limitKey: string, label: KitchenLabel, minValue: number | null, maxValue: number | null, withinMinutes: number | null }
// A limit resolved for a screen (the organization's row over the default).
export interface KitchenLimit extends KitchenLimitDefault { active: boolean, id?: string, unit?: string, notes?: string, createdAt?: string, updatedAt?: string }
// A limit as saved (the organization's row, the demo's or a form's: numbers may be typed text).
export interface KitchenLimitRow { id?: string, createdAt?: string, updatedAt?: string, limitKey?: string, label?: string | KitchenLabel, minValue?: KitchenNumber | null, maxValue?: KitchenNumber | null, withinMinutes?: KitchenNumber | null, unit?: string, active?: boolean | null, notes?: string }
// What the in / out check reads of a limit.
export interface KitchenLimitCheck { limitKey?: string, label?: string | KitchenLabel, minValue?: number | null, maxValue?: number | null, withinMinutes?: number | null, active?: boolean | null }

// A step of the HACCP plan.
export interface KitchenHaccpStep extends KitchenSaved {
  position: KitchenNumber
  stepKey: string
  name: string
  hazardBiological: boolean | null
  hazardChemical: boolean | null
  hazardPhysical: boolean | null
  hazardAllergen: boolean | null
  hazards: string
  isCcp: boolean | null
  controlMeasure: string
  limitKey: string
  monitoring: string
  frequency: string
  correctiveAction: string
  verification: string
  records: string
  responsible: string
  active: boolean | null
}

// A product of the catalogue.
export interface KitchenProduct extends KitchenSaved {
  name: string
  category: string
  storage: string
  unit: string
  supplierId: string
  supplierCode: string
  lowStockQuantity: KitchenNumber
  active: boolean | null
  notes: string
  source?: KitchenSource
}

// A menu of a weekday (1 Monday … 7 Sunday; '' while unset in the form).
export interface KitchenMenu extends KitchenSaved { name: string, weekday: KitchenNumber, menuText: string, active: boolean | null, notes: string, source?: KitchenSource }

// A kitchen supplier (from the quality office's suppliers).
export interface KitchenSupplier { id: string, name: string, category: string | null, status: string | null }

// --- Receipts and stock ---------------------------------------------------------------------

// A received product line: one batch.
export interface KitchenReceiptItem extends KitchenSaved {
  productId: string
  productName: string
  batchCode: string
  expiryOn: string
  quantity: KitchenNumber
  unit: string
  storage: string
  temperature: KitchenNumber
  accepted: boolean | null
  rejectionReason: string
  notes: string
  receiptId?: string
  position?: KitchenNumber
  lotLabel?: string
  temperatureText?: string
  temperatureUnparsed?: boolean | null
  temperatureStatus?: KitchenStatus
}

// The five checks of a receipt ('compliant' / 'noncompliant').
export interface KitchenReceiptChecks { temperatureCheck: string, packagingCheck: string, expiryCheck: string, vehicleCheck: string, codingCheck: string }
export type KitchenReceiptCheck = keyof KitchenReceiptChecks
export type KitchenReceiptResult = 'accepted' | 'accepted_with_remarks' | 'rejected' | 'pending'

// A receipt with its products.
export interface KitchenReceipt extends KitchenSaved, KitchenReceiptChecks {
  code: string
  supplierId: string
  supplierName: string
  receivedOn: string
  receivedTime: string
  orderReference: string
  receiverName: string
  temperatureClass: string
  measuredTemperature: KitchenNumber
  accepted: boolean | null
  status: string
  qualityNotes: string
  correctiveAction: string
  source: KitchenSource
  items: KitchenReceiptItem[]
  receiverEmployeeId?: string
  measuredTemperatureText?: string
  temperatureUnparsed?: boolean | null
  // Marked by the database (the demo marks them in withStatuses).
  temperatureStatus?: KitchenStatus
  limitStatus?: KitchenStatus
  result?: KitchenReceiptResult | null
}

// What a batch used and wrote off over its whole life (kitchen_batch_balances), by receipt item id.
export interface KitchenBatchBalance { used: number, uses: number, writtenOff: number }
export type KitchenBatchBalanceRow = Database['public']['Functions']['kitchen_batch_balances']['Returns'][number]

// A received batch with what was used, written off and what remains (stockRows).
export interface KitchenStockRow {
  receiptItemId: string
  receiptId: string
  receiptCode?: string
  receivedOn: string
  supplierId?: string
  supplierName: string
  productId?: string
  productName?: string
  category: string
  storage: string
  batchCode: string
  lotLabel: string
  expiryOn: string
  unit: string
  received: number
  used: number
  writtenOff: number
  remaining: number
  uses: number
  inStock: boolean
  expired: boolean
  expiring: boolean
  daysLeft: number | null
  overused: boolean
  low: boolean
}
// What the batch checks read of a stock row (a screen's row may carry only some of it).
export type KitchenBatch = Partial<KitchenStockRow>
// The FIFO order reads the receipt day, the expiry and the receipt code.
export interface KitchenFifoRow { receivedOn?: string, expiryOn?: string, receiptCode?: string }
// A write-off starts from a batch of the stock (or a receipt line).
export interface KitchenWriteoffSource { receiptItemId?: string, id?: string, remaining: number, expired?: boolean }

// A write-off (απόσυρση / απόρριψη) of a batch.
export interface KitchenWriteoff extends KitchenSaved, KitchenRecorded { receiptItemId: string, writtenOffOn: string, quantity: KitchenNumber, reason: string, notes: string }

// --- Production days and their records ------------------------------------------------------

// A meal of a day's plan.
export interface KitchenMeal extends KitchenSaved { meal: string, diet: string, dish: string, portions: KitchenNumber, notes: string, productionId?: string, position?: KitchenNumber }

// A production day.
export interface KitchenProduction extends KitchenSaved, KitchenRecorded, KitchenSignOff {
  productionDate: string
  menuId: string
  menuText: string
  notes: string
  disinfectionVegetables: boolean | null
  disinfectionFruit: boolean | null
  disinfectionAgent: string
  disinfectionConcentrationPpm: KitchenNumber
  disinfectionMinutes: KitchenNumber
  disinfectionNotes: string
  meals: KitchenMeal[]
  source: KitchenSource
  verificationNotes?: string | null
}

// A raw material used on a day (from a batch, or without one: receiptItemId '').
export interface KitchenUsage extends KitchenSaved, KitchenRecorded {
  productionId: string
  receiptItemId: string
  productId: string
  productName: string
  lotLabel: string
  dishName: string
  usedOn: string
  quantity: KitchenNumber
  unit: string
  notes: string
  source: KitchenSource
}

// The heat parameters of a dish: core, chilling (with its minutes), reheating, frying.
// A value that could not be read as a number (FileMaker history) is kept as its text.
export interface KitchenThermal extends KitchenSaved, KitchenRecorded {
  productionId: string
  processDate: string
  processTime: string
  dishName: string
  cookingTemp: KitchenNumber
  chillTemp: KitchenNumber
  chillMinutes: KitchenNumber
  reheatTemp: KitchenNumber
  fryingTemp: KitchenNumber
  correctiveAction: string
  notes: string
  source: KitchenSource
  productId?: string
  cookingText?: string
  chillText?: string
  reheatText?: string
  fryingText?: string
  temperatureUnparsed?: boolean | null
  cookingStatus?: KitchenStatus
  chillStatus?: KitchenStatus
  reheatStatus?: KitchenStatus
  fryingStatus?: KitchenStatus
  limitStatus?: KitchenStatus
}

// Pureeing / sieving with its visual and blade checks.
export interface KitchenPureeing extends KitchenSaved, KitchenRecorded {
  productionId: string
  pureedOn: string
  method: string
  productName: string
  visualCheck: boolean | null
  bladeCheck: boolean | null
  correctiveAction: string
  notes: string
  source: KitchenSource
  limitStatus?: KitchenStatus
}

// A defrost: start and end as timestamps ('' while it runs), with their temperatures.
export interface KitchenDefrost extends KitchenSaved, KitchenRecorded, KitchenSignOff {
  receiptItemId: string
  productId: string
  productName: string
  quantity: KitchenNumber
  unit: string
  method: string
  startedAt: string
  startTemp: KitchenNumber
  endedAt: string
  endTemp: KitchenNumber
  correctiveAction: string
  notes: string
  source: KitchenSource
  productionId?: string
  startText?: string
  endText?: string
  temperatureUnparsed?: boolean | null
  limitStatus?: KitchenStatus
}
// The defrost form: the day and time of the start and of the end (defrostEntry makes the timestamps).
export interface KitchenDefrostDraft extends Omit<KitchenDefrost, 'startedAt' | 'endedAt'> { startDay: string, startTime: string, endDay: string, endTime: string, startedAt?: string, endedAt?: string }

// What a production day holds (dayRecords), with the out-of-limits count.
export interface KitchenDayRecords<S extends KitchenStateInput = KitchenState> {
  usage: KitchenRows<S, 'usage'>[]
  thermal: KitchenRows<S, 'thermal'>[]
  pureeing: KitchenRows<S, 'pureeing'>[]
  defrosting: KitchenRows<S, 'defrosting'>[]
  receipts: KitchenRows<S, 'receipts'>[]
  outOfLimits: number
  total: number
}

// An entry of a production day or of the defrost list (saveEntry): what any of the four carries.
export type KitchenDayEntry = Partial<KitchenUsage & KitchenThermal & KitchenPureeing & KitchenDefrost>

// --- Recall drills --------------------------------------------------------------------------

// A batch of a drill with its mass balance.
export interface KitchenRecallBatch {
  receiptItemId: string
  receiptId: string
  receiptCode?: string
  receivedOn: string
  supplierName: string
  productId?: string
  productName?: string
  batchCode: string
  expiryOn: string
  unit: string
  received: number
  used: number
  writtenOff: number
  remaining: number
  inStock: number
  counted: boolean
  accounted: number
  percent: number | null
}
// A meal that served a traced dish.
export interface KitchenRecallMeal { id?: string, meal?: string, diet?: string, dish?: string, portions: number }
// Forward: a use of a traced batch.
export interface KitchenRecallUse { id?: string, receiptItemId: string, productName?: string, batchCode: string, usedOn: string, productionId: string, dishName: string, quantity: number, unit: string, meals: KitchenRecallMeal[] }
export interface KitchenRecallWriteoff { id?: string, receiptItemId: string, productName?: string, writtenOffOn?: string, quantity: number, reason?: string, notes: string }
// Backward: another raw material of the same dishes.
export interface KitchenRecallBackward { id?: string, dishName?: string, usedOn?: string, productName?: string, batchCode: string, supplierName: string, receiptCode: string, receiptItemId: string, quantity: number, unit: string, traced: boolean }
// The mass balance and what was affected.
export interface KitchenRecallTotals {
  unit: string
  received: number
  used: number
  inStock: number
  writtenOff: number
  accounted: number
  percent: number | null
  balanced: boolean
  affectedDays: number
  affectedMeals: number
  affectedPortions: number
}
// The whole trace of a drill.
export interface KitchenRecallTrace extends KitchenRecallTotals {
  batches: KitchenRecallBatch[]
  uses: KitchenRecallUse[]
  writeoffs: KitchenRecallWriteoff[]
  backward: KitchenRecallBackward[]
  untraced: number
}
// The shelf counts of a drill (receiptItemId → quantity as typed).
export type KitchenStockCounts = Record<string, KitchenNumber | null | undefined>
// The trace kept with a saved drill (trace_snapshot): the trace and the counts.
export interface KitchenTraceSnapshot extends KitchenRecallTrace { stockCounts?: KitchenStockCounts }

// What a saved drill keeps of its trace (drillFindings).
export interface KitchenRecallFindings {
  elapsedMinutes: number | null
  receivedQuantity: number
  usedQuantity: number
  stockQuantity: number
  writtenOffQuantity: number
  quantityUnit: string
  accountedPercent: number | ''
  batchesCount: number
  affectedDays: number
  affectedMeals: number
  affectedPortions: number
  tracedWithinTarget: boolean | null
  traceSnapshot: KitchenTraceSnapshot
}

// A recall drill (Άσκηση ανάκλησης).
export interface KitchenRecallDrill extends KitchenSaved {
  code: string
  drillDate: string
  startedAt: string
  finishedAt: string
  scenario: string
  triggerText: string
  receiptItemId: string
  productId: string
  productName: string
  dishName: string
  targetMinutes: KitchenNumber
  stockCounts: KitchenStockCounts
  notified: string
  actions: string
  result: string
  lessons: string
  conductedByName: string
  conductedByEmployeeId: string
  status: string
  notes: string
  // The findings (drillFindings; columns of the saved drill).
  elapsedMinutes?: KitchenNumber | null
  receivedQuantity?: KitchenNumber
  usedQuantity?: KitchenNumber
  stockQuantity?: KitchenNumber
  writtenOffQuantity?: KitchenNumber
  quantityUnit?: string
  accountedPercent?: KitchenNumber | null
  batchesCount?: KitchenNumber
  affectedDays?: KitchenNumber
  affectedMeals?: KitchenNumber
  affectedPortions?: KitchenNumber
  tracedWithinTarget?: boolean | null
  traceSnapshot?: KitchenTraceSnapshot | null
}

// --- The state of the screens ---------------------------------------------------------------

// Everything the kitchen screens read: the configuration, the day records of the window,
// the balances of every batch, and (in the cloud) where the window starts.
export interface KitchenState {
  settings: KitchenSettings | null
  limits: KitchenLimitRow[]
  steps: KitchenHaccpStep[]
  products: KitchenProduct[]
  menus: KitchenMenu[]
  receipts: KitchenReceipt[]
  writeoffs: KitchenWriteoff[]
  productions: KitchenProduction[]
  usage: KitchenUsage[]
  thermal: KitchenThermal[]
  pureeing: KitchenPureeing[]
  defrosting: KitchenDefrost[]
  suppliers: KitchenSupplier[]
  recallDrills: KitchenRecallDrill[]
  balances?: Record<string, KitchenBatchBalance>
  since?: string | null
  outOfLimitsTotal?: number | null
}
// The lists of the state.
export type KitchenListKey = 'limits' | 'steps' | 'products' | 'menus' | 'receipts' | 'writeoffs' | 'productions' | 'usage' | 'thermal' | 'pureeing' | 'defrosting' | 'suppliers' | 'recallDrills'
// The lists the demo keeps each table's rows in.
export type KitchenTableList = Exclude<KitchenListKey, 'limits' | 'suppliers'>

// What the pure functions read of the state: any part of it, rows with their id (a receipt,
// a production day, a heat treatment and a pureeing also with their day) and any other field.
export type KitchenRowInput<T extends { id: string }> = Partial<T> & Pick<T, 'id'>
export interface KitchenReceiptInput extends Partial<Omit<KitchenReceipt, 'items'>> { items?: KitchenRowInput<KitchenReceiptItem>[] }
export interface KitchenProductionInput extends Partial<Omit<KitchenProduction, 'meals'>> { meals?: Partial<KitchenMeal>[] }
export interface KitchenStateInput {
  settings?: Partial<KitchenSettings> | null
  limits?: KitchenLimitRow[]
  steps?: KitchenRowInput<KitchenHaccpStep>[]
  products?: KitchenRowInput<KitchenProduct>[]
  menus?: KitchenRowInput<KitchenMenu>[]
  receipts?: (KitchenReceiptInput & Pick<KitchenReceipt, 'id' | 'receivedOn'>)[]
  writeoffs?: KitchenRowInput<KitchenWriteoff>[]
  productions?: (KitchenProductionInput & Pick<KitchenProduction, 'id' | 'productionDate'>)[]
  usage?: KitchenRowInput<KitchenUsage>[]
  thermal?: (KitchenRowInput<KitchenThermal> & Pick<KitchenThermal, 'processDate'>)[]
  pureeing?: (KitchenRowInput<KitchenPureeing> & Pick<KitchenPureeing, 'pureedOn'>)[]
  defrosting?: KitchenRowInput<KitchenDefrost>[]
  suppliers?: KitchenRowInput<KitchenSupplier>[]
  recallDrills?: KitchenRowInput<KitchenRecallDrill>[]
  balances?: Record<string, KitchenBatchBalance>
  since?: string | null
  outOfLimitsTotal?: number | null
}
// A state whose limits are resolved (withStatuses, loadKitchen): what the documents read.
export interface KitchenResolvedStateInput extends KitchenStateInput { limits?: KitchenLimit[] }
// The forward trace of a batch (traceBatch): the batch, its uses, write-offs and the heat treatments of those days.
export interface KitchenBatchTrace { batch: KitchenBatch | null, uses: Partial<KitchenUsage>[], writeoffs: Partial<KitchenWriteoff>[], thermal: Partial<KitchenThermal>[] }
// A row of a kitchen list on its way to Excel / print (kitchenListExport): any of the lists' rows,
// with what the screens add (a use's batch, a drill's subject, a product's category label).
export type KitchenListRow = Partial<KitchenReceipt & KitchenStockRow & KitchenThermal & KitchenDefrost & KitchenPureeing & KitchenUsage & KitchenRecallDrill & KitchenProduct> & { batch?: KitchenBatch | null, subject?: string, categoryLabel?: string }
// The rows of a list of the state a function was given, as given: a KitchenState gives
// complete rows, a test's state the fields it has.
export type KitchenRows<S extends KitchenStateInput, K extends KitchenListKey> = NonNullable<S[K]>[number]

// --- Database -------------------------------------------------------------------------------

// The kitchen tables the service reads and writes, with the entry each row becomes.
export interface KitchenEntries {
  kitchen_settings: KitchenSettings
  kitchen_limits: KitchenLimitRow
  kitchen_haccp_steps: KitchenHaccpStep
  kitchen_products: KitchenProduct
  kitchen_menus: KitchenMenu
  kitchen_receipts: KitchenReceipt
  kitchen_receipt_items: KitchenReceiptItem
  kitchen_stock_writeoffs: KitchenWriteoff
  kitchen_productions: KitchenProduction
  kitchen_production_meals: KitchenMeal
  kitchen_material_usage: KitchenUsage
  kitchen_thermal_processes: KitchenThermal
  kitchen_pureeing: KitchenPureeing
  kitchen_defrosting: KitchenDefrost
  kitchen_recall_drills: KitchenRecallDrill
}
export type KitchenTable = keyof KitchenEntries
// A row of a kitchen table (database.types).
export type KitchenDbRow<T extends KitchenTable> = Tables<T>
export type KitchenSupplierRow = Pick<Tables<'quality_suppliers'>, 'id' | 'name' | 'category' | 'status'>
