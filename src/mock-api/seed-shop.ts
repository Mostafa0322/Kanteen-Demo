/**
 * Seed data for the school shop: events (trips, concerts, workshops) and
 * store products (uniforms, books), plus a history of paid orders.
 */
import type { Offering, Order, PaymentMethod, Student, Transaction } from './types';
import { addDays, startOfDay } from './dates';

type EventSeed = [key: string, name: string, nameAr: string, desc: string, descAr: string, emoji: string, category: Offering['category'], price: number, inDays: number, deadlineInDays: number, capacity: number | null, grades: number[]];
type ProductSeed = [key: string, name: string, nameAr: string, desc: string, descAr: string, emoji: string, category: Offering['category'], price: number, sizes: string[], stock: number | null];

const EVENTS: EventSeed[] = [
  ['museum', 'Science Museum Trip', 'رحلة متحف العلوم', 'Full-day trip with lunch and transport included.', 'رحلة يوم كامل تشمل الغداء والمواصلات.', '🔬', 'trip', 350, 10, 6, 60, [4, 5, 6, 7, 8]],
  ['concert', 'Winter Concert Tickets', 'تذاكر الحفل الشتوي', 'Annual music concert in the school theatre. One ticket per student.', 'الحفل الموسيقي السنوي في مسرح المدرسة. تذكرة واحدة لكل طالب.', '🎻', 'event', 100, 20, 17, 200, []],
  ['robotics', 'Robotics Workshop (4 weeks)', 'ورشة الروبوتات (4 أسابيع)', 'After-school sessions every Tuesday. Kits provided.', 'جلسات بعد المدرسة كل ثلاثاء. الأدوات متوفرة.', '🤖', 'activity', 900, 14, 9, 20, [6, 7, 8, 9, 10]],
  ['bookfair', 'Book Fair Entry', 'دخول معرض الكتاب', 'Includes a 100 EGP book voucher.', 'يشمل قسيمة كتب بقيمة 100 جنيه.', '📚', 'event', 150, 2, -1, 120, []],
];

const PRODUCTS: ProductSeed[] = [
  ['polo', 'School Polo Shirt', 'قميص بولو مدرسي', 'Official short-sleeve polo with embroidered logo.', 'قميص بولو رسمي بأكمام قصيرة وشعار مطرز.', '👕', 'uniform', 250, ['XS', 'S', 'M', 'L', 'XL'], 120],
  ['trousers', 'Uniform Trousers', 'بنطلون الزي المدرسي', 'Navy trousers, adjustable waist.', 'بنطلون كحلي بخصر قابل للتعديل.', '👖', 'uniform', 300, ['XS', 'S', 'M', 'L', 'XL'], 80],
  ['pe', 'PE Kit', 'طقم التربية البدنية', 'T-shirt and shorts in house colours.', 'تيشيرت وشورت بألوان الفريق.', '🏃', 'uniform', 400, ['S', 'M', 'L'], 60],
  ['hoodie', 'School Hoodie', 'هودي المدرسة', 'Warm fleece hoodie for winter.', 'هودي صوف دافئ للشتاء.', '🧥', 'uniform', 550, ['S', 'M', 'L', 'XL'], 6],
  ['books', 'Exercise Books Pack', 'مجموعة كراسات', '10 ruled exercise books.', '10 كراسات مسطرة.', '📓', 'books', 120, [], null],
  ['bottle', 'Kanteen Water Bottle', 'زجاجة مياه المدرسة', 'Reusable 500 ml steel bottle.', 'زجاجة ستانلس قابلة لإعادة الاستخدام 500 مل.', '🧴', 'supplies', 90, [], 40],
];

export function generateShop(args: {
  now: Date;
  schoolIds: string[];
  students: Student[];
  rand: () => number;
  id: (prefix: string) => string;
}): { offerings: Offering[]; orders: Order[]; transactions: Transaction[] } {
  const { now, schoolIds, students, rand, id } = args;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const today = startOfDay(now);
  const at = (days: number, hour: number) => {
    const d = addDays(today, days);
    d.setHours(hour, Math.floor(rand() * 60), 0, 0);
    return d.toISOString();
  };

  const offerings: Offering[] = [];
  for (const schoolId of schoolIds) {
    const prefix = schoolId === 'sch_nile' ? 'nv' : 'ch';
    for (const [key, name, nameAr, description, descriptionAr, emoji, category, price, inDays, deadlineInDays, capacity, grades] of EVENTS) {
      offerings.push({
        id: `off_${prefix}_${key}`,
        schoolId,
        kind: 'event',
        category,
        name,
        nameAr,
        description,
        descriptionAr,
        emoji,
        price,
        active: true,
        grades,
        eventDate: at(inDays, 9),
        deadline: (() => {
          const d = addDays(today, deadlineInDays);
          d.setHours(23, 59, 0, 0);
          return d.toISOString();
        })(),
        capacity,
        createdAt: at(-12, 10),
      });
    }
    for (const [key, name, nameAr, description, descriptionAr, emoji, category, price, sizes, stock] of PRODUCTS) {
      offerings.push({ id: `off_${prefix}_${key}`, schoolId, kind: 'product', category, name, nameAr, description, descriptionAr, emoji, price, active: true, grades: [], sizes, stock, createdAt: at(-30, 10) });
    }
  }

  /* past orders, paid by card / mobile wallet / InstaPay (no wallet balance impact) */
  const orders: Order[] = [];
  const transactions: Transaction[] = [];
  const add = (o: Offering, s: Student, qty: number, size: string | undefined, createdAt: string) => {
    const method: PaymentMethod = pick(['card', 'card', 'wallet', 'instapay'] as const);
    const total = o.price * qty;
    const tx: Transaction = { id: id('tx'), type: 'order', status: 'approved', studentId: s.id, schoolId: s.schoolId, amount: total, method, lines: [{ itemId: o.id, name: o.name + (size ? ` (${size})` : ''), nameAr: o.nameAr + (size ? ` (${size})` : ''), price: o.price, qty }], createdAt };
    transactions.push(tx);
    const ageDays = (now.getTime() - new Date(createdAt).getTime()) / 86_400_000;
    orders.push({
      id: id('ord'),
      schoolId: s.schoolId,
      offeringId: o.id,
      kind: o.kind,
      name: o.name,
      nameAr: o.nameAr,
      parentId: s.parentId,
      studentId: s.id,
      qty,
      size,
      unitPrice: o.price,
      total,
      method,
      // Older product orders have usually been picked up already.
      status: o.kind === 'product' && ageDays > 4 && rand() < 0.7 ? 'fulfilled' : 'paid',
      fulfilledAt: undefined,
      txId: tx.id,
      createdAt,
    });
  };

  for (const o of offerings) {
    const pool = students.filter((s) => s.schoolId === o.schoolId && (o.grades.length === 0 || o.grades.includes(s.grade)) && s.id !== 'stu_omar');
    const target =
      o.kind === 'event'
        ? Math.min(pool.length, Math.round((o.capacity ?? 30) * (o.id.endsWith('bookfair') ? 0.4 : 0.15 + rand() * 0.25)))
        : Math.round(4 + rand() * 8);
    const chosen = [...pool].sort(() => rand() - 0.5).slice(0, target);
    for (const s of chosen) {
      const size = o.sizes?.length ? pick(o.sizes) : undefined;
      add(o, s, o.kind === 'event' ? 1 : rand() < 0.2 ? 2 : 1, size, at(-Math.floor(1 + rand() * 12), 18 + Math.floor(rand() * 4)));
    }
  }
  // Leave the hoodie nearly sold out so the "low stock" state is visible.
  for (const o of offerings.filter((x) => x.id.endsWith('hoodie'))) {
    const sold = orders.filter((r) => r.offeringId === o.id).reduce((a, r) => a + r.qty, 0);
    o.stock = sold + 2;
  }
  for (const o of orders) if (o.status === 'fulfilled') o.fulfilledAt = addDays(new Date(o.createdAt), 2).toISOString();

  return { offerings, orders, transactions };
}
