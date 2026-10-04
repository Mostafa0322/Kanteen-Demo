/**
 * Domain model for the Kanteen demo. These types are the contract between the
 * UI and the data layer: a real backend would expose the same shapes.
 */

export type ID = string;
export type ISODate = string;

export const ALLERGENS = ['nuts', 'dairy', 'gluten', 'eggs', 'soy', 'sesame', 'fish'] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const CATEGORIES = ['meals', 'sandwiches', 'snacks', 'desserts', 'drinks', 'fruit'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = ['card', 'wallet', 'instapay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface LocalizedName {
  name: string;
  nameAr: string;
}

export interface School extends LocalizedName {
  id: ID;
  shortCode: string;
}

export interface Vendor extends LocalizedName {
  id: ID;
  schoolId: ID;
}

export interface MenuItem extends LocalizedName {
  id: ID;
  price: number;
  category: Category;
  allergens: Allergen[];
  available: boolean;
  emoji: string;
}

export type BraceletStatus = 'active' | 'deactivated' | 'unassigned';

export interface Bracelet {
  id: ID;
  schoolId: ID;
  studentId: ID | null;
  status: BraceletStatus;
  issuedAt: ISODate | null;
  deactivatedAt?: ISODate;
  deactivationReason?: string;
}

export interface StudentControls {
  /** null = no limit */
  dailyLimit: number | null;
  frozen: boolean;
  allergies: Allergen[];
  blockedItemIds: ID[];
  blockedCategories: Category[];
  lowBalanceThreshold: number;
}

export interface Student extends LocalizedName, StudentControls {
  id: ID;
  schoolId: ID;
  grade: number;
  braceletId: ID | null;
  parentId: ID | null;
  balance: number;
  avatarColor: string;
}

export interface Parent extends LocalizedName {
  id: ID;
  email: string;
  phone: string;
  childIds: ID[];
}

/** `order` = a school-shop payment (event ticket, uniform…), separate from canteen purchases. */
export type TxType = 'purchase' | 'topup' | 'refund' | 'transfer' | 'order';
export type TxStatus = 'approved' | 'declined' | 'blocked' | 'failed';

export type DeclineReason =
  | 'insufficient_balance'
  | 'daily_limit'
  | 'blocked_allergy'
  | 'blocked_item'
  | 'blocked_category'
  | 'frozen'
  | 'inactive_bracelet'
  | 'unknown_bracelet'
  | 'item_unavailable'
  | 'payment_failed';

export interface TxLine {
  itemId: ID;
  name: string;
  nameAr: string;
  price: number;
  qty: number;
}

export interface Transaction {
  id: ID;
  type: TxType;
  status: TxStatus;
  studentId: ID;
  schoolId: ID;
  vendorId?: ID;
  braceletId?: ID;
  /** Always positive; direction is implied by type. */
  amount: number;
  balanceAfter?: number;
  lines?: TxLine[];
  reason?: DeclineReason;
  /** Machine-readable detail, e.g. the allergen or item that triggered a block. */
  reasonDetail?: { allergen?: Allergen; itemId?: ID; category?: Category; limit?: number; spent?: number };
  /** `balance` = paid from (or refunded to) the student's Kanteen wallet. */
  method?: PaymentMethod | 'cash_desk' | 'balance';
  note?: string;
  /** Recorded while the terminal was offline and synced later. */
  offline?: boolean;
  syncedAt?: ISODate;
  createdAt: ISODate;
}

export type NotificationKind = 'purchase' | 'blocked' | 'declined' | 'low_balance' | 'topup' | 'refund' | 'frozen' | 'bracelet' | 'order' | 'order_refunded' | 'announcement';

export interface AppNotification {
  id: ID;
  parentId: ID;
  studentId: ID;
  kind: NotificationKind;
  txId?: ID;
  amount?: number;
  reason?: DeclineReason;
  /** Free params for the message template (item name, allergen, etc.) */
  params?: Record<string, string | number>;
  read: boolean;
  createdAt: ISODate;
}

export interface AuditEntry {
  id: ID;
  schoolId: ID;
  at: ISODate;
  actor: string;
  action:
    | 'refund'
    | 'bracelet_replaced'
    | 'bracelet_assigned'
    | 'menu_created'
    | 'menu_updated'
    | 'settings_updated'
    | 'data_reset'
    | 'offering_created'
    | 'offering_updated'
    | 'order_fulfilled'
    | 'order_refunded';
  studentId?: ID;
  txId?: ID;
  amount?: number;
  detail: string;
}

export interface Settings {
  currency: string;
  /** Simulated network latency for API calls (ms). */
  latencyMs: number;
}

/* ---------- School shop: events & store ---------- */

export type OfferingKind = 'event' | 'product';
export const SHOP_CATEGORIES = ['trip', 'event', 'activity', 'uniform', 'books', 'supplies'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];
export type CheckoutMethod = PaymentMethod | 'balance';

export interface Offering extends LocalizedName {
  id: ID;
  schoolId: ID;
  kind: OfferingKind;
  category: ShopCategory;
  description: string;
  descriptionAr: string;
  price: number;
  emoji: string;
  /** Hidden from parents when false. */
  active: boolean;
  /** Eligible grades; empty = every grade. */
  grades: number[];
  /* events */
  eventDate?: ISODate;
  deadline?: ISODate;
  capacity?: number | null;
  /* products */
  sizes?: string[];
  stock?: number | null;
  createdAt: ISODate;
}

export type OrderStatus = 'paid' | 'fulfilled' | 'refunded';

export interface Order {
  id: ID;
  schoolId: ID;
  offeringId: ID;
  kind: OfferingKind;
  /** Snapshot of the offering name at purchase time. */
  name: string;
  nameAr: string;
  parentId: ID | null;
  studentId: ID;
  qty: number;
  size?: string;
  unitPrice: number;
  total: number;
  method: CheckoutMethod;
  status: OrderStatus;
  txId?: ID;
  createdAt: ISODate;
  fulfilledAt?: ISODate;
  refundedAt?: ISODate;
  refundReason?: string;
}

/** An offering plus live availability, as seen by a parent for one child. */
export interface OfferingView extends Offering {
  sold: number;
  remaining: number | null;
  closed: boolean;
  eligible: boolean;
  /** Event: this child already holds a paid registration. */
  registered: boolean;
}

export interface CheckoutRequest {
  offeringId: ID;
  studentId: ID;
  parentId: ID;
  qty: number;
  size?: string;
  method: CheckoutMethod;
  simulateFailure?: boolean;
}

export interface Database {
  version: number;
  seededAt: ISODate;
  /** ms timestamp of the last write; newer snapshots win when tabs sync. */
  updatedAt?: number;
  settings: Settings;
  schools: School[];
  vendors: Vendor[];
  menu: MenuItem[];
  students: Student[];
  bracelets: Bracelet[];
  parents: Parent[];
  transactions: Transaction[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  offerings: Offering[];
  orders: Order[];
}

/* ---------- API input / output shapes ---------- */

export interface CartLine {
  itemId: ID;
  qty: number;
}

export interface ChargeRequest {
  braceletId: ID;
  vendorId: ID;
  lines: CartLine[];
  /** For offline replay: when the tap actually happened. */
  at?: ISODate;
  offline?: boolean;
}

export type ChargeOutcome = 'approved' | 'declined' | 'blocked';

export interface ChargeResult {
  outcome: ChargeOutcome;
  reason?: DeclineReason;
  reasonDetail?: Transaction['reasonDetail'];
  transaction?: Transaction;
  student?: Student;
  total: number;
  balanceAfter?: number;
  spentToday?: number;
}

export interface TopUpRequest {
  studentId: ID;
  amount: number;
  method: PaymentMethod;
  /** Demo switch: force the payment provider to fail. */
  simulateFailure?: boolean;
}

export interface TxFilter {
  schoolId?: ID;
  studentId?: ID;
  vendorId?: ID;
  type?: TxType | 'all';
  status?: TxStatus | 'all' | 'not_approved';
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  query?: string;
  limit?: number;
}

export interface MenuItemView extends MenuItem {
  blocked: boolean;
  blockReasons: { reason: DeclineReason; allergen?: Allergen; category?: Category }[];
}

export interface OverviewStats {
  date: string;
  sales: number;
  salesCount: number;
  topups: number;
  topupCount: number;
  refunds: number;
  activeWallets: number;
  totalStudents: number;
  outstandingBalance: number;
  blockedCount: number;
  declinedCount: number;
  salesByHour: { hour: number; sales: number; count: number }[];
  topItems: { itemId: ID; name: string; nameAr: string; qty: number; revenue: number }[];
  salesVsYesterday: number | null;
}

export interface ClosingReport {
  date: string;
  schoolId: ID;
  byVendor: { vendorId: ID; name: string; nameAr: string; sales: number; count: number }[];
  byCategory: { category: Category; sales: number; qty: number }[];
  grossSales: number;
  refunds: number;
  netSales: number;
  topups: number;
  topupsByMethod: { method: string; amount: number; count: number }[];
  declined: number;
  blocked: number;
  offlineSynced: number;
  /** School-shop payments that day (all methods) and the part paid from wallets. */
  shopSales: number;
  shopFromWallet: number;
  openingFloat: number;
  closingFloat: number;
}

export interface WeeklyReport {
  weeks: { weekStart: string; sales: number; topups: number; refunds: number; blocked: number; declined: number }[];
  blockedByReason: { reason: DeclineReason; count: number }[];
  adoption: { withBracelet: number; activeLast7: number; total: number; parentsLinked: number };
  dailyActive: { date: string; active: number }[];
}
