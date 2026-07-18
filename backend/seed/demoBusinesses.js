// One-off seed for 3 realistic demo businesses spanning different scales/verticals,
// requested for manual testing of the booking flow: a single-master barbershop, a
// multi-service beauty salon, and a multi-specialty clinic with many doctors.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const City = require('../models/City');
const { seedCategories } = require('./categories');

const WEEK_SCHEDULE = {
  mon: { start: '09:00', end: '19:00' },
  tue: { start: '09:00', end: '19:00' },
  wed: { start: '09:00', end: '19:00' },
  thu: { start: '09:00', end: '19:00' },
  fri: { start: '09:00', end: '19:00' },
  sat: { start: '10:00', end: '16:00' },
  sun: { start: '', end: '', dayOff: true },
};

const OWNER_PASSWORD = 'DemoOwner123!';

async function createOwner(email, name, city) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  return User.create({
    role: 'BUSINESS_OWNER',
    name,
    email,
    passwordHash,
    emailVerified: true,
    city: city._id,
    termsAcceptedAt: new Date(),
  });
}

async function createBusiness({ owner, name, category, description, address, district, phone }, city) {
  const existing = await Business.findOne({ name });
  if (existing) return existing;
  const business = await Business.create({
    owner: owner._id,
    name,
    category,
    description,
    address,
    district,
    phone,
    city: city._id,
    status: 'ACTIVE',
    agreementAcceptedAt: new Date(),
    cancellationPolicyHours: 24,
  });
  owner.business = business._id;
  await owner.save();
  return business;
}

async function seedDemoBusinesses() {
  await seedCategories();
  const city = await City.findOne({ slug: 'stryi' });
  if (!city) throw new Error('City "stryi" not found — run the main seed script first.');

  // 1) Barbershop — haircuts only, one master.
  const barberOwner = await createOwner('barbershop@example.com', 'Barbershop Owner', city);
  const barbershop = await createBusiness(
    {
      owner: barberOwner,
      name: 'Стрижка+',
      category: 'barber',
      description: 'Чоловічий барбершоп у центрі. Тільки стрижки та оформлення бороди, один майстер.',
      address: 'вул. Шевченка, 5',
      district: 'Центр',
      phone: '+380671112233',
    },
    city
  );
  let barber = await Staff.findOne({ business: barbershop._id, name: 'Олег' });
  if (!barber) {
    barber = await Staff.create({
      business: barbershop._id,
      name: 'Олег',
      role: 'Барбер',
      bio: '8 років досвіду, чоловічі стрижки та бороди.',
      schedule: WEEK_SCHEDULE,
    });
  }
  const barberServices = [
    { name: 'Чоловіча стрижка', price: 300, durationMinutes: 45 },
    { name: 'Стрижка машинкою', price: 200, durationMinutes: 30 },
    { name: 'Оформлення бороди', price: 200, durationMinutes: 30 },
    { name: 'Стрижка + борода', price: 450, durationMinutes: 60 },
  ];
  for (const s of barberServices) {
    const exists = await Service.findOne({ business: barbershop._id, name: s.name });
    if (!exists) {
      await Service.create({ ...s, business: barbershop._id, category: 'barber', staff: [barber._id] });
    }
  }

  // 2) Beauty salon — 5+ varied services across categories, 2 masters.
  const salonOwner = await createOwner('bellissima@example.com', 'Bellissima Owner', city);
  const salon = await createBusiness(
    {
      owner: salonOwner,
      name: 'Bellissima',
      category: 'manicure',
      description: 'Салон краси повного циклу: манікюр, стрижки, косметологія, брови та масаж.',
      address: 'вул. Незалежності, 21',
      district: 'Центр',
      phone: '+380672223344',
    },
    city
  );
  const salonMasters = [
    { name: 'Марина', role: 'Майстер манікюру та брів', bio: 'Манікюр, брови та вії, 6 років досвіду.' },
    { name: 'Ірина', role: 'Перукар-стиліст, косметолог', bio: 'Стрижки, укладки, косметологічні процедури.' },
  ];
  const salonStaffDocs = [];
  for (const m of salonMasters) {
    let doc = await Staff.findOne({ business: salon._id, name: m.name });
    if (!doc) doc = await Staff.create({ ...m, business: salon._id, schedule: WEEK_SCHEDULE });
    salonStaffDocs.push(doc);
  }
  const [marina, iryna] = salonStaffDocs;
  const salonServices = [
    { name: 'Манікюр класичний', price: 400, durationMinutes: 60, category: 'manicure', staffId: marina._id },
    { name: 'Манікюр + гель-лак', price: 600, durationMinutes: 90, category: 'manicure', staffId: marina._id },
    { name: 'Корекція брів', price: 250, durationMinutes: 30, category: 'brows', staffId: marina._id },
    { name: 'Ламінування вій', price: 500, durationMinutes: 60, category: 'brows', staffId: marina._id },
    { name: 'Жіноча стрижка', price: 500, durationMinutes: 60, category: 'hairdresser', staffId: iryna._id },
    { name: 'Чистка обличчя', price: 700, durationMinutes: 60, category: 'cosmetology', staffId: iryna._id },
    { name: 'Масаж обличчя', price: 450, durationMinutes: 45, category: 'massage', staffId: iryna._id },
  ];
  for (const s of salonServices) {
    const exists = await Service.findOne({ business: salon._id, name: s.name });
    if (!exists) {
      await Service.create({
        name: s.name,
        price: s.price,
        durationMinutes: s.durationMinutes,
        category: s.category,
        business: salon._id,
        staff: [s.staffId],
      });
    }
  }

  // 3) Private clinic — many doctors across specialties, ~1-1.5 services each.
  const clinicOwner = await createOwner('medcenter@example.com', 'MedCenter Owner', city);
  const clinic = await createBusiness(
    {
      owner: clinicOwner,
      name: 'МедЦентр Стрий',
      category: 'therapist',
      description: 'Приватна клініка повного циклу: стоматологія, гінекологія, терапія, огляд зору та інші напрямки.',
      address: 'вул. Грушевського, 40',
      district: 'Центр',
      phone: '+380673334455',
    },
    city
  );
  const doctors = [
    { name: 'Др. Ковальчук Андрій', role: 'Стоматолог', category: 'dentist', services: [
      { name: 'Консультація стоматолога', price: 300, durationMinutes: 30 },
      { name: 'Лікування карієсу', price: 1200, durationMinutes: 60 },
    ] },
    { name: 'Др. Мельник Оксана', role: 'Стоматолог-гігієніст', category: 'dentist', services: [
      { name: 'Професійна чистка зубів', price: 900, durationMinutes: 60 },
    ] },
    { name: 'Др. Бондаренко Наталія', role: 'Гінеколог', category: 'gynecology', services: [
      { name: 'Консультація гінеколога', price: 500, durationMinutes: 30 },
      { name: 'УЗД огляд', price: 400, durationMinutes: 30 },
    ] },
    { name: 'Др. Шевчук Ігор', role: 'Терапевт', category: 'therapist', services: [
      { name: 'Прийом терапевта', price: 350, durationMinutes: 30 },
    ] },
    { name: 'Др. Гнатюк Тетяна', role: 'Сімейний лікар', category: 'therapist', services: [
      { name: 'Загальний огляд', price: 400, durationMinutes: 40 },
    ] },
    { name: 'Др. Романюк Василь', role: 'Офтальмолог', category: 'ophthalmology', services: [
      { name: 'Перевірка зору', price: 350, durationMinutes: 30 },
      { name: 'Підбір окулярів', price: 250, durationMinutes: 20 },
    ] },
    { name: 'Др. Ткачук Марія', role: 'Дерматолог', category: 'dermatology', services: [
      { name: 'Консультація дерматолога', price: 450, durationMinutes: 30 },
    ] },
    { name: 'Др. Савчук Олена', role: 'Кардіолог', category: 'cardiology', services: [
      { name: 'Прийом кардіолога + ЕКГ', price: 600, durationMinutes: 40 },
    ] },
    { name: 'Др. Лисенко Юрій', role: 'Педіатр', category: 'pediatrics', services: [
      { name: 'Прийом педіатра', price: 400, durationMinutes: 30 },
    ] },
    { name: 'Др. Іваницька Софія', role: 'ЛОР', category: 'ent', services: [
      { name: 'Консультація ЛОР', price: 400, durationMinutes: 30 },
      { name: 'Промивання пазух', price: 350, durationMinutes: 20 },
    ] },
    { name: 'Др. Петренко Максим', role: 'Невролог', category: 'neurology', services: [
      { name: 'Консультація невролога', price: 500, durationMinutes: 40 },
    ] },
  ];

  for (const doc of doctors) {
    let staffDoc = await Staff.findOne({ business: clinic._id, name: doc.name });
    if (!staffDoc) {
      staffDoc = await Staff.create({
        business: clinic._id,
        name: doc.name,
        role: doc.role,
        bio: `${doc.role} з багаторічним досвідом прийому пацієнтів.`,
        schedule: WEEK_SCHEDULE,
      });
    }
    for (const s of doc.services) {
      const exists = await Service.findOne({ business: clinic._id, name: s.name });
      if (!exists) {
        await Service.create({
          ...s,
          business: clinic._id,
          category: doc.category,
          staff: [staffDoc._id],
        });
      }
    }
  }

  console.log('Demo businesses ready:');
  console.log('  Barbershop "Стрижка+"  — owner barbershop@example.com /', OWNER_PASSWORD);
  console.log('  Salon "Bellissima"     — owner bellissima@example.com /', OWNER_PASSWORD);
  console.log('  Clinic "МедЦентр Стрий" — owner medcenter@example.com /', OWNER_PASSWORD);
}

module.exports = { seedDemoBusinesses };

if (require.main === module) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(seedDemoBusinesses)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
