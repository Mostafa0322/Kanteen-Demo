/**
 * Deterministic seed data. Dates are generated relative to "now" so the demo
 * always has three weeks of history ending today.
 */
import type {
  Allergen,
  AppNotification,
  AuditEntry,
  Bracelet,
  Category,
  Database,
  MenuItem,
  Parent,
  PaymentMethod,
  School,
  Student,
  Transaction,
  Vendor,
} from './types';
import { addDays, dayKey, isSchoolDay, startOfDay } from './dates';
import { blockReasonsFor, round2 } from './engine';

export const DB_VERSION = 3;

/* ---------- PRNG ---------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- static reference data ---------- */

export const SCHOOLS: School[] = [
  { id: 'sch_nile', shortCode: 'NV', name: 'Nile Valley International School', nameAr: 'مدرسة وادي النيل الدولية' },
  { id: 'sch_heights', shortCode: 'CH', name: 'Cairo Heights Academy', nameAr: 'أكاديمية مرتفعات القاهرة' },
];

export const VENDORS: Vendor[] = [
  { id: 'ven_nile_main', schoolId: 'sch_nile', name: 'Main Canteen', nameAr: 'المقصف الرئيسي' },
  { id: 'ven_nile_kiosk', schoolId: 'sch_nile', name: 'Snack Kiosk', nameAr: 'كشك الوجبات الخفيفة' },
  { id: 'ven_heights_main', schoolId: 'sch_heights', name: 'Main Canteen', nameAr: 'المقصف الرئيسي' },
  { id: 'ven_heights_juice', schoolId: 'sch_heights', name: 'Juice Bar', nameAr: 'ركن العصائر' },
];

type MenuSeed = [id: string, name: string, nameAr: string, price: number, category: Category, allergens: Allergen[], emoji: string];

const MENU_SEED: MenuSeed[] = [
  ['itm_koshari', 'Koshari Bowl', 'طبق كشري', 45, 'meals', ['gluten'], '🍲'],
  ['itm_rice_chicken', 'Grilled Chicken & Rice', 'فراخ مشوية بالأرز', 80, 'meals', [], '🍗'],
  ['itm_bechamel', 'Pasta Béchamel', 'مكرونة بشاميل', 60, 'meals', ['gluten', 'dairy', 'eggs'], '🍝'],
  ['itm_pizza', 'Cheese Pizza Slice', 'شريحة بيتزا بالجبن', 55, 'meals', ['gluten', 'dairy'], '🍕'],
  ['itm_burger', 'Beef Burger', 'برجر لحم', 85, 'meals', ['gluten', 'dairy', 'sesame'], '🍔'],
  ['itm_shawarma', 'Chicken Shawarma Wrap', 'ساندويتش شاورما فراخ', 70, 'sandwiches', ['gluten', 'sesame'], '🌯'],
  ['itm_taameya', "Ta'ameya Sandwich", 'ساندويتش طعمية', 20, 'sandwiches', ['gluten', 'sesame'], '🥙'],
  ['itm_foul', 'Foul Sandwich', 'ساندويتش فول', 18, 'sandwiches', ['gluten'], '🫓'],
  ['itm_tuna', 'Tuna Sandwich', 'ساندويتش تونة', 40, 'sandwiches', ['gluten', 'fish', 'eggs'], '🥪'],
  ['itm_halloumi', 'Halloumi Croissant', 'كرواسون حلومي', 35, 'sandwiches', ['gluten', 'dairy', 'eggs'], '🥐'],
  ['itm_chips', 'Potato Chips', 'شيبسي', 15, 'snacks', [], '🥔'],
  ['itm_pb_cookie', 'Peanut Butter Cookie', 'كوكيز زبدة الفول السوداني', 20, 'snacks', ['nuts', 'gluten', 'eggs'], '🍪'],
  ['itm_mixed_nuts', 'Mixed Nuts Pack', 'مكسرات مشكلة', 35, 'snacks', ['nuts'], '🥜'],
  ['itm_hummus', 'Hummus & Veggie Sticks', 'حمص مع خضار', 30, 'snacks', ['sesame'], '🥕'],
  ['itm_granola', 'Granola Bar', 'جرانولا بار', 25, 'snacks', ['nuts', 'gluten', 'soy'], '🍫'],
  ['itm_basbousa', 'Basbousa with Almonds', 'بسبوسة باللوز', 25, 'desserts', ['nuts', 'gluten', 'dairy'], '🍰'],
  ['itm_roz_laban', 'Rice Pudding', 'رز باللبن', 25, 'desserts', ['dairy'], '🍮'],
  ['itm_brownie', 'Chocolate Brownie', 'براوني شوكولاتة', 30, 'desserts', ['gluten', 'dairy', 'eggs', 'soy'], '🟫'],
  ['itm_yogurt', 'Fruit Yogurt', 'زبادي بالفواكه', 20, 'desserts', ['dairy'], '🥛'],
  ['itm_water', 'Mineral Water', 'مياه معدنية', 10, 'drinks', [], '💧'],
  ['itm_orange', 'Fresh Orange Juice', 'عصير برتقال فريش', 25, 'drinks', [], '🍊'],
  ['itm_mango', 'Mango Juice', 'عصير مانجو', 25, 'drinks', [], '🥭'],
  ['itm_choc_milk', 'Chocolate Milk', 'حليب بالشوكولاتة', 20, 'drinks', ['dairy'], '🧋'],
  ['itm_karkade', 'Iced Hibiscus', 'كركديه مثلج', 15, 'drinks', [], '🌺'],
  ['itm_banana', 'Banana', 'موز', 8, 'fruit', [], '🍌'],
  ['itm_fruit_cup', 'Fresh Fruit Cup', 'كوب فواكه طازجة', 30, 'fruit', [], '🍓'],
];

/* ---------- names ---------- */

const BOYS: [string, string][] = [
  ['Omar', 'عمر'], ['Youssef', 'يوسف'], ['Adam', 'آدم'], ['Ali', 'علي'], ['Mohamed', 'محمد'], ['Ahmed', 'أحمد'],
  ['Karim', 'كريم'], ['Hamza', 'حمزة'], ['Malek', 'مالك'], ['Ziad', 'زياد'], ['Seif', 'سيف'], ['Mostafa', 'مصطفى'],
  ['Hassan', 'حسن'], ['Yassin', 'ياسين'], ['Tarek', 'طارق'], ['Khaled', 'خالد'], ['Ibrahim', 'إبراهيم'], ['Marwan', 'مروان'],
];
const GIRLS: [string, string][] = [
  ['Laila', 'ليلى'], ['Hana', 'هنا'], ['Malak', 'ملك'], ['Farida', 'فريدة'], ['Jana', 'جنى'], ['Salma', 'سلمى'],
  ['Mariam', 'مريم'], ['Nour', 'نور'], ['Habiba', 'حبيبة'], ['Lina', 'لينا'], ['Rania', 'رانيا'], ['Yasmin', 'ياسمين'],
  ['Dalia', 'داليا'], ['Sara', 'سارة'], ['Aya', 'آية'], ['Reem', 'ريم'], ['Judy', 'جودي'], ['Talia', 'تاليا'],
];
const FAMILIES: [string, string][] = [
  ['Hassan', 'حسن'], ['Adel', 'عادل'], ['Samir', 'سمير'], ['Mansour', 'منصور'], ['El-Sayed', 'السيد'], ['Farouk', 'فاروق'],
  ['Naguib', 'نجيب'], ['Shawky', 'شوقي'], ['Abdelaziz', 'عبد العزيز'], ['Fahmy', 'فهمي'], ['Hegazy', 'حجازي'], ['Ramadan', 'رمضان'],
  ['Saleh', 'صالح'], ['Zaki', 'زكي'], ['Mahmoud', 'محمود'], ['Ezzat', 'عزت'], ['Helmy', 'حلمي'], ['Kamel', 'كامل'],
];

const AVATAR_COLORS = ['#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#be185d', '#4d7c0f', '#b45309', '#4338ca'];

/* ---------- demo personas ---------- */

export const DEMO_PARENT_ID = 'par_mona';
export const DEMO_STUDENT_ID = 'stu_omar';
export const DEMO_VENDOR_ID = 'ven_nile_main';
export const DEMO_PASSWORD_HINT = 'any password';

interface FixedStudent {
  id: string;
  first: [string, string];
  family: [string, string];
  schoolId: string;
  grade: number;
  parentId: string;
  allergies?: Allergen[];
  dailyLimit?: number | null;
}

const FIXED_STUDENTS: FixedStudent[] = [
  { id: 'stu_omar', first: ['Omar', 'عمر'], family: ['Hassan', 'حسن'], schoolId: 'sch_nile', grade: 5, parentId: 'par_mona', dailyLimit: null },
  { id: 'stu_laila', first: ['Laila', 'ليلى'], family: ['Hassan', 'حسن'], schoolId: 'sch_nile', grade: 2, parentId: 'par_mona', allergies: ['dairy'], dailyLimit: 60 },
  { id: 'stu_youssef', first: ['Youssef', 'يوسف'], family: ['Adel', 'عادل'], schoolId: 'sch_nile', grade: 8, parentId: 'par_karim', dailyLimit: 120 },
  { id: 'stu_hana', first: ['Hana', 'هنا'], family: ['Samir', 'سمير'], schoolId: 'sch_heights', grade: 4, parentId: 'par_nour', allergies: ['gluten'], dailyLimit: 80 },
  { id: 'stu_adam', first: ['Adam', 'آدم'], family: ['Samir', 'سمير'], schoolId: 'sch_heights', grade: 9, parentId: 'par_nour', dailyLimit: null },
];

const PARENTS: Parent[] = [
  { id: 'par_mona', name: 'Mona Hassan', nameAr: 'منى حسن', email: 'mona@demo.kanteen', phone: '+20 100 555 0101', childIds: ['stu_omar', 'stu_laila'] },
  { id: 'par_karim', name: 'Karim Adel', nameAr: 'كريم عادل', email: 'karim@demo.kanteen', phone: '+20 111 555 0202', childIds: ['stu_youssef'] },
  { id: 'par_nour', name: 'Nour Samir', nameAr: 'نور سمير', email: 'nour@demo.kanteen', phone: '+20 122 555 0303', childIds: ['stu_hana', 'stu_adam'] },
];

/* ---------- generator ---------- */

export function generateSeed(now: Date = new Date()): Database {
  const rand = mulberry32(20261004);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const chance = (p: number) => rand() < p;
  let seq = 0;
  const id = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(5, '0')}`;

  const menu: MenuItem[] = MENU_SEED.map(([mid, name, nameAr, price, category, allergens, emoji]) => ({
    id: mid,
    name,
    nameAr,
    price,
    category,
    allergens,
    emoji,
    available: true,
  }));
  // One item out of stock so "availability" is visible from the start.
  menu.find((m) => m.id === 'itm_halloumi')!.available = false;

  /* students + bracelets */
  const students: Student[] = [];
  const bracelets: Bracelet[] = [];
  const perSchool: Record<string, number> = { sch_nile: 34, sch_heights: 26 };
  let braceletSerial = 100200;
  const issueDate = addDays(startOfDay(now), -60).toISOString();

  const newBracelet = (schoolId: string, studentId: string | null): Bracelet => {
    const b: Bracelet = {
      id: `BR-${schoolId === 'sch_nile' ? 'NV' : 'CH'}-${(braceletSerial++).toString()}`,
      schoolId,
      studentId,
      status: studentId ? 'active' : 'unassigned',
      issuedAt: studentId ? issueDate : null,
    };
    bracelets.push(b);
    return b;
  };

  const makeStudent = (s: Omit<Student, 'braceletId' | 'avatarColor' | 'balance'>, withBracelet: boolean): Student => {
    const student: Student = { ...s, braceletId: null, balance: 0, avatarColor: pick(AVATAR_COLORS) };
    if (withBracelet) student.braceletId = newBracelet(s.schoolId, s.id).id;
    students.push(student);
    return student;
  };

  for (const f of FIXED_STUDENTS) {
    makeStudent(
      {
        id: f.id,
        name: `${f.first[0]} ${f.family[0]}`,
        nameAr: `${f.first[1]} ${f.family[1]}`,
        schoolId: f.schoolId,
        grade: f.grade,
        parentId: f.parentId,
        dailyLimit: f.dailyLimit ?? null,
        frozen: false,
        allergies: f.allergies ?? [],
        blockedItemIds: [],
        blockedCategories: [],
        lowBalanceThreshold: 50,
      },
      true,
    );
  }
  // Youssef's parent blocks fizzy/sugary stuff: block desserts category.
  students.find((s) => s.id === 'stu_youssef')!.blockedCategories = ['desserts'];

  const usedNames = new Set(students.map((s) => s.name));
  for (const schoolId of Object.keys(perSchool)) {
    const existing = students.filter((s) => s.schoolId === schoolId).length;
    for (let i = existing; i < perSchool[schoolId]; i++) {
      let first: [string, string];
      let family: [string, string];
      let name: string;
      do {
        first = chance(0.5) ? pick(BOYS) : pick(GIRLS);
        family = pick(FAMILIES);
        name = `${first[0]} ${family[0]}`;
      } while (usedNames.has(name) || first[0] === family[0]);
      usedNames.add(name);
      const allergies: Allergen[] = [];
      if (chance(0.12)) allergies.push(pick(['nuts', 'dairy', 'gluten', 'eggs', 'sesame'] as const));
      // ~4 students start without a bracelet so assignment flow can be shown.
      const withBracelet = !(i % 13 === 7);
      makeStudent(
        {
          id: id('stu'),
          name,
          nameAr: `${first[1]} ${family[1]}`,
          schoolId,
          grade: 1 + Math.floor(rand() * 12),
          parentId: null,
          dailyLimit: chance(0.3) ? pick([75, 100, 150]) : null,
          frozen: false,
          allergies,
          blockedItemIds: [],
          blockedCategories: [],
          lowBalanceThreshold: 50,
        },
        withBracelet,
      );
    }
  }
  // Spare stock of unassigned bracelets per school.
  for (const s of SCHOOLS) for (let i = 0; i < 8; i++) newBracelet(s.id, null);

  /* transactions: simulate day by day */
  const transactions: Transaction[] = [];
  const today = startOfDay(now);
  const firstDay = addDays(today, -21);
  const vendorsBySchool = (schoolId: string) => VENDORS.filter((v) => v.schoolId === schoolId);

  const at = (day: Date, hour: number, minuteSpan = 60) => {
    const d = new Date(day);
    d.setHours(hour, Math.floor(rand() * minuteSpan), Math.floor(rand() * 60), 0);
    return d;
  };

  const topUp = (s: Student, when: Date, amount: number) => {
    s.balance = round2(s.balance + amount);
    const method: PaymentMethod = pick(['card', 'card', 'wallet', 'instapay'] as const);
    transactions.push({
      id: id('tx'),
      type: 'topup',
      status: 'approved',
      studentId: s.id,
      schoolId: s.schoolId,
      amount,
      balanceAfter: s.balance,
      method,
      createdAt: when.toISOString(),
    });
  };

  // Opening balances
  for (const s of students) {
    if (!s.braceletId) continue;
    topUp(s, at(addDays(firstDay, -1), 19, 120), pick([300, 400, 500, 600]));
  }

  const mealPool = menu.filter((m) => m.category === 'meals' || m.category === 'sandwiches');
  const snackPool = menu.filter((m) => m.category !== 'meals' && m.category !== 'sandwiches');

  for (let day = new Date(firstDay); day <= today; day = addDays(day, 1)) {
    if (!isSchoolDay(day)) continue;
    const isToday = dayKey(day) === dayKey(now);

    for (const s of students) {
      if (!s.braceletId) continue;
      // Keep the main demo child clean today so the scripted flow is predictable.
      if (isToday && s.id === DEMO_STUDENT_ID) continue;
      if (!chance(0.82)) continue;

      const vendors = vendorsBySchool(s.schoolId);
      let spent = 0;
      const slots: { hour: number; pool: MenuItem[]; size: number }[] = [];
      if (chance(0.25)) slots.push({ hour: 8, pool: snackPool, size: 1 });
      slots.push({ hour: 10, pool: chance(0.5) ? snackPool : mealPool, size: chance(0.3) ? 2 : 1 });
      if (chance(0.55)) slots.push({ hour: 12, pool: mealPool, size: 1 });
      if (chance(0.2)) slots.push({ hour: 13, pool: snackPool, size: 1 });

      for (const slot of slots) {
        const when = at(day, slot.hour, slot.hour === 12 ? 90 : 50);
        if (isToday && when > now) continue;
        const items: MenuItem[] = [];
        for (let i = 0; i < slot.size; i++) items.push(pick(slot.pool));
        if (slot.pool === mealPool && chance(0.5)) items.push(pick(menu.filter((m) => m.category === 'drinks')));

        const vendorId = slot.hour === 12 ? vendors[0].id : pick(vendors).id;
        const lines = items.map((m) => ({ itemId: m.id, name: m.name, nameAr: m.nameAr, price: m.price, qty: 1 }));
        const total = round2(items.reduce((a, m) => a + m.price, 0));
        const base = { studentId: s.id, schoolId: s.schoolId, vendorId, braceletId: s.braceletId, lines, amount: total, createdAt: when.toISOString() };

        // Check blocks: kids occasionally try a blocked item and get stopped.
        const blocked = items.map((m) => ({ m, r: blockReasonsFor(s, m) })).find((x) => x.r.length > 0);
        if (blocked) {
          if (!chance(0.25)) continue; // usually the kid just picks something else
          const r = blocked.r[0];
          transactions.push({
            ...base,
            id: id('tx'),
            type: 'purchase',
            status: 'blocked',
            reason: r.reason,
            reasonDetail: { itemId: blocked.m.id, allergen: r.allergen, category: r.category },
          });
          continue;
        }
        if (!items.every((m) => m.available)) continue;
        if (s.dailyLimit != null && spent + total > s.dailyLimit) {
          if (chance(0.3)) {
            transactions.push({
              ...base,
              id: id('tx'),
              type: 'purchase',
              status: 'declined',
              reason: 'daily_limit',
              reasonDetail: { limit: s.dailyLimit, spent },
            });
          }
          continue;
        }
        if (s.balance < total) {
          transactions.push({ ...base, id: id('tx'), type: 'purchase', status: 'declined', reason: 'insufficient_balance' });
          continue;
        }
        s.balance = round2(s.balance - total);
        spent += total;
        transactions.push({ ...base, id: id('tx'), type: 'purchase', status: 'approved', balanceAfter: s.balance });
      }

      // Parents top up in the evening when the balance runs low.
      const evening = at(day, 19, 180);
      if (s.balance < 120 && evening < now) topUp(s, evening, pick([200, 300, 400, 500]));
    }
  }

  // Make sure the demo child doesn't start the demo nearly empty.
  const omar = students.find((s) => s.id === DEMO_STUDENT_ID)!;
  if (omar.balance < 80) topUp(omar, at(addDays(today, -1), 20, 60), 100);

  transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* refunds + audit */
  const audit: AuditEntry[] = [];
  const refundable = transactions.filter((t) => t.type === 'purchase' && t.status === 'approved' && t.studentId !== DEMO_STUDENT_ID && t.createdAt < addDays(today, -2).toISOString());
  for (let i = 0; i < 4; i++) {
    const orig = pick(refundable);
    const s = students.find((x) => x.id === orig.studentId)!;
    const line = orig.lines![0];
    const when = new Date(new Date(orig.createdAt).getTime() + 3600_000 * 2);
    const reasonText = pick(['Item was out of stock after payment', 'Double tap at terminal', 'Wrong item served', 'Food quality complaint']);
    const refund: Transaction = {
      id: id('tx'),
      type: 'refund',
      status: 'approved',
      studentId: s.id,
      schoolId: s.schoolId,
      vendorId: orig.vendorId,
      amount: line.price,
      note: `${reasonText} (ref ${orig.id})`,
      createdAt: when.toISOString(),
    };
    s.balance = round2(s.balance + line.price);
    transactions.push(refund);
    audit.push({
      id: id('aud'),
      schoolId: s.schoolId,
      at: when.toISOString(),
      actor: 'Canteen Manager',
      action: 'refund',
      studentId: s.id,
      txId: refund.id,
      amount: line.price,
      detail: reasonText,
    });
  }
  transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* notifications for the demo parents (last 5 days) */
  const notifications: AppNotification[] = [];
  const recentCut = addDays(today, -5).toISOString();
  for (const p of PARENTS) {
    for (const tx of transactions) {
      if (!p.childIds.includes(tx.studentId) || tx.createdAt < recentCut) continue;
      const kind = tx.type === 'topup' ? 'topup' : tx.type === 'refund' ? 'refund' : tx.status === 'blocked' ? 'blocked' : tx.status === 'declined' ? 'declined' : 'purchase';
      notifications.push({
        id: id('ntf'),
        parentId: p.id,
        studentId: tx.studentId,
        kind,
        txId: tx.id,
        amount: tx.amount,
        reason: tx.reason,
        params: tx.lines ? { items: tx.lines.map((l) => l.name).join(', '), itemsAr: tx.lines.map((l) => l.nameAr).join('، ') } : undefined,
        read: true,
        createdAt: tx.createdAt,
      });
    }
  }
  // Leave the last two unread so the bell has something to show.
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const p of PARENTS) notifications.filter((n) => n.parentId === p.id).slice(0, 2).forEach((n) => (n.read = false));

  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    settings: { currency: 'EGP', latencyMs: 250 },
    schools: SCHOOLS,
    vendors: VENDORS,
    menu,
    students,
    bracelets,
    parents: PARENTS.map((p) => ({ ...p, childIds: [...p.childIds] })),
    transactions,
    notifications,
    audit: audit.sort((a, b) => b.at.localeCompare(a.at)),
  };
}
