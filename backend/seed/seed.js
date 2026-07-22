require('dotenv').config();
const bcrypt = require('bcrypt');
const { connectDB } = require('../config/db');
const City = require('../models/City');
const User = require('../models/User');
const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Booking = require('../models/Booking');

// This script wipes every core collection unconditionally (see the
// deleteMany calls below) and plants fresh demo accounts — it must never run
// against a real database. NODE_ENV alone isn't a reliable enough guard for a
// script invoked directly with `node`/`ts-node` (nothing sets it by default),
// so this also refuses to run against anything that doesn't look like a local
// MongoDB instance, unless explicitly overridden.
function assertSafeToSeed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] refusing to run with NODE_ENV=production');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || '';
  const looksLocal = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri);
  if (!looksLocal && process.env.SEED_ALLOW_REMOTE !== 'true') {
    console.error(
      `[seed] MONGODB_URI does not look like a local database (${uri.replace(/\/\/.*@/, '//<redacted>@')}). ` +
        'Refusing to wipe it. Set SEED_ALLOW_REMOTE=true to override if this is really intended.'
    );
    process.exit(1);
  }
}


const WEEK_SCHEDULE = {
  mon: { start: '09:00', end: '19:00' },
  tue: { start: '09:00', end: '19:00' },
  wed: { start: '09:00', end: '19:00' },
  thu: { start: '09:00', end: '19:00' },
  fri: { start: '09:00', end: '19:00' },
  sat: { start: '10:00', end: '16:00' },
  sun: { start: '', end: '', dayOff: true },
};

async function seed() {
  assertSafeToSeed();
  await connectDB();

  await Promise.all([
    City.deleteMany({}),
    User.deleteMany({}),
    Business.deleteMany({}),
    Service.deleteMany({}),
    Staff.deleteMany({}),
    Booking.deleteMany({}),
  ]);

  const stryi = await City.create({ slug: 'stryi', name: 'Стрий', nameEn: 'Stryi', lat: 49.2597, lng: 23.8586 });

  // Fixed, well-known credential — deliberately NOT randomized: tests/fixtures/users.ts
  // and README.md both hardcode this exact password for local/E2E login. Safe only
  // because assertSafeToSeed() above refuses to run this script against anything but
  // a local database.
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123!', 12);
  await User.create({
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@zaraz.ua',
    passwordHash: superAdminPasswordHash,
    emailVerified: true,
    city: stryi._id,
  });

  const businessSeeds = [
    {
      name: 'Studio Nine',
      category: 'manicure',
      district: 'Центр',
      googleRating: 4.9,
      googleReviewsCount: 214,
      top: true,
      staffName: 'Марія',
      staffRole: 'Майстер манікюру',
      description: 'Студія манікюру в центрі міста. Працюємо з 2019 року, преміальна косметика, стерильні інструменти.',
    },
    {
      name: 'Onyx Nails',
      category: 'manicure',
      district: 'Стрийська',
      googleRating: 4.6,
      googleReviewsCount: 88,
      top: false,
      staffName: 'Софія',
      staffRole: 'Nail-майстер',
      description: 'Затишна nail-студія з авторським дизайном нігтів та турботливим сервісом.',
    },
    {
      name: 'Barber & Co',
      category: 'barber',
      district: 'Приміська',
      googleRating: 4.8,
      googleReviewsCount: 189,
      top: false,
      staffName: 'Роман',
      staffRole: 'Барбер',
      description: 'Класична барбершоп-атмосфера: чоловічі стрижки, гоління небезпечною бритвою, догляд за бородою.',
    },
    {
      name: 'Fade Society',
      category: 'barber',
      district: 'Поділ',
      googleRating: 4.9,
      googleReviewsCount: 301,
      top: true,
      staffName: 'Дмитро',
      staffRole: 'Топ-барбер',
      description: 'Сучасний барбершоп зі спеціалізацією на фейдах та дизайнерських стрижках.',
    },
    {
      name: 'Persona Hair Studio',
      category: 'hairdresser',
      district: 'Центр',
      googleRating: 4.8,
      googleReviewsCount: 176,
      top: false,
      staffName: 'Оксана',
      staffRole: 'Стиліст-перукар',
      description: 'Жіночий та чоловічий перукарський салон: стрижки, фарбування, складні техніки кольору.',
    },
    {
      name: 'Relax Room',
      category: 'massage',
      district: 'Центр',
      googleRating: 5.0,
      googleReviewsCount: 97,
      top: true,
      staffName: 'Ігор',
      staffRole: 'Масажист',
      description: 'Кабінет масажу для відновлення після важкого дня — лікувальний, спортивний та розслабляючий масаж.',
    },
    {
      name: 'Skin Lab',
      category: 'cosmetology',
      district: 'Шевченка',
      googleRating: 4.7,
      googleReviewsCount: 143,
      top: false,
      staffName: 'Анна',
      staffRole: 'Косметолог',
      description: 'Апаратна та естетична косметологія: чистки, пілінги, догляд за проблемною шкірою.',
    },
    {
      name: 'Brow Bar Stryi',
      category: 'brows',
      district: 'Центр',
      googleRating: 4.9,
      googleReviewsCount: 268,
      top: false,
      staffName: 'Христина',
      staffRole: 'Brow-майстер',
      description: 'Спеціалізована студія брів та вій: корекція, ламінування, фарбування хною.',
    },
    {
      name: 'Ink & Needle',
      category: 'tattoo',
      district: 'Поділ',
      googleRating: 4.8,
      googleReviewsCount: 112,
      top: false,
      staffName: 'Максим',
      staffRole: 'Тату-майстер',
      description: 'Тату-студія повного циклу: авторські ескізи, кавер-апи, стерильність за міжнародними стандартами.',
    },
    {
      name: 'Perfect Skin Laser',
      category: 'laser',
      district: 'Шевченка',
      googleRating: 4.7,
      googleReviewsCount: 134,
      top: false,
      staffName: 'Вікторія',
      staffRole: 'Лазерний технік',
      description: 'Лазерна епіляція на сучасному діодному лазері — безболісно і для всіх типів шкіри.',
    },
    {
      name: 'FitZone PT',
      category: 'fitness',
      district: 'Приміська',
      googleRating: 4.9,
      googleReviewsCount: 76,
      top: true,
      staffName: 'Олександр',
      staffRole: 'Персональний тренер',
      description: 'Персональні тренування в невеликих групах або 1-на-1: силові, функціональні, відновлювальні програми.',
    },
    {
      name: 'Aura Spa',
      category: 'spa',
      district: 'Центр',
      googleRating: 4.8,
      googleReviewsCount: 65,
      top: false,
      staffName: 'Лідія',
      staffRole: 'SPA-терапевт',
      description: 'SPA-комплекс для повного перезавантаження: хамам, обгортання, ароматерапія.',
    },
  ];

  const servicesByCategory = {
    manicure: [
      { name: 'Манікюр класичний', durationMinutes: 60, price: 450 },
      { name: 'Манікюр + гель-лак', durationMinutes: 90, price: 650 },
      { name: 'Педикюр апаратний', durationMinutes: 75, price: 700 },
    ],
    barber: [
      { name: 'Чоловіча стрижка', durationMinutes: 45, price: 380 },
      { name: 'Стрижка + борода', durationMinutes: 60, price: 500 },
      { name: 'Гоління небезпечною бритвою', durationMinutes: 30, price: 300 },
    ],
    hairdresser: [
      { name: "Жіноча стрижка", durationMinutes: 60, price: 550 },
      { name: 'Фарбування в один тон', durationMinutes: 120, price: 1400 },
      { name: 'Складне мелірування', durationMinutes: 180, price: 2200 },
    ],
    massage: [
      { name: 'Масаж спини', durationMinutes: 45, price: 900 },
      { name: 'Масаж всього тіла', durationMinutes: 90, price: 1600 },
    ],
    cosmetology: [
      { name: 'Чистка обличчя', durationMinutes: 60, price: 700 },
      { name: 'Пілінг', durationMinutes: 45, price: 850 },
    ],
    brows: [
      { name: 'Корекція брів', durationMinutes: 30, price: 350 },
      { name: 'Ламінування вій', durationMinutes: 60, price: 600 },
    ],
    tattoo: [
      { name: 'Тату до 10 см (ескіз студії)', durationMinutes: 90, price: 1500 },
      { name: 'Тату по індивідуальному ескізу', durationMinutes: 180, price: 3500 },
      { name: 'Консультація і прорахунок', durationMinutes: 30, price: 200 },
    ],
    laser: [
      { name: 'Лазерна епіляція гомілки', durationMinutes: 30, price: 800 },
      { name: 'Лазерна епіляція пахв', durationMinutes: 20, price: 500 },
      { name: 'Лазерна епіляція всього тіла', durationMinutes: 120, price: 3200 },
    ],
    fitness: [
      { name: 'Персональне тренування', durationMinutes: 60, price: 700 },
      { name: 'Пробне тренування + оцінка форми', durationMinutes: 45, price: 350 },
    ],
    spa: [{ name: 'SPA-програма', durationMinutes: 120, price: 1200 }],
  };

  for (const seedData of businessSeeds) {
    const ownerPasswordHash = await bcrypt.hash('BusinessOwner123!', 12);
    const owner = await User.create({
      role: 'BUSINESS_OWNER',
      name: `${seedData.name} Owner`,
      email: `${seedData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
      passwordHash: ownerPasswordHash,
      emailVerified: true,
      city: stryi._id,
    });

    const business = await Business.create({
      owner: owner._id,
      name: seedData.name,
      description: seedData.description,
      category: seedData.category,
      city: stryi._id,
      district: seedData.district,
      address: `м. Стрий, вул. Шевченка, ${Math.floor(Math.random() * 100)}`,
      status: 'ACTIVE',
      agreementAcceptedAt: new Date(),
      googleRating: seedData.googleRating,
      googleReviewsCount: seedData.googleReviewsCount,
      platformRating: seedData.googleRating,
      top: { active: seedData.top, until: seedData.top ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null },
    });

    owner.business = business._id;
    await owner.save();

    const staff = await Staff.create({
      business: business._id,
      name: seedData.staffName,
      role: seedData.staffRole,
      schedule: WEEK_SCHEDULE,
    });

    const serviceDefs = servicesByCategory[seedData.category] || [];
    await Service.insertMany(
      serviceDefs.map((s) => ({
        business: business._id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
        category: seedData.category,
        staff: [staff._id],
      }))
    );
  }

  console.log('[seed] done');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
