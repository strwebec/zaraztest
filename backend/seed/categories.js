// Master list of platform-approved categories. Seeded idempotently (upsert by
// slug) so re-running never duplicates or wipes categories a business is already
// using. New verticals get added here; a business can also request a brand-new
// one via "Інше" at registration, which lands as PENDING until an admin approves it.
const SEED_CATEGORIES = [
  // Краса та догляд
  { slug: 'manicure', name: 'Манікюр', nameEn: 'Manicure' },
  { slug: 'barber', name: 'Барбер', nameEn: 'Barbershop' },
  { slug: 'hairdresser', name: 'Перукар', nameEn: 'Hairdresser' },
  { slug: 'massage', name: 'Масаж', nameEn: 'Massage' },
  { slug: 'cosmetology', name: 'Косметолог', nameEn: 'Cosmetology' },
  { slug: 'brows', name: 'Брови та вії', nameEn: 'Brows & lashes' },
  { slug: 'tattoo', name: 'Тату', nameEn: 'Tattoo' },
  { slug: 'laser', name: 'Лазерна епіляція', nameEn: 'Laser hair removal' },
  { slug: 'fitness', name: 'Фітнес та тренер', nameEn: 'Fitness & personal training' },
  { slug: 'spa', name: 'SPA', nameEn: 'SPA' },

  // Медицина
  { slug: 'dentist', name: 'Стоматологія', nameEn: 'Dentistry' },
  { slug: 'gynecology', name: 'Гінекологія', nameEn: 'Gynecology' },
  { slug: 'therapist', name: 'Терапевт', nameEn: 'General practitioner' },
  { slug: 'ophthalmology', name: 'Огляд зору', nameEn: 'Ophthalmology' },
  { slug: 'dermatology', name: 'Дерматологія', nameEn: 'Dermatology' },
  { slug: 'cardiology', name: 'Кардіологія', nameEn: 'Cardiology' },
  { slug: 'pediatrics', name: 'Педіатрія', nameEn: 'Pediatrics' },
  { slug: 'ent', name: 'Отоларингологія (ЛОР)', nameEn: 'ENT' },
  { slug: 'neurology', name: 'Невролог', nameEn: 'Neurology' },
  { slug: 'ultrasound', name: 'УЗД-діагностика', nameEn: 'Ultrasound diagnostics' },
  { slug: 'lab-tests', name: 'Лабораторні аналізи', nameEn: 'Lab tests' },

  // Інші сфери
  { slug: 'auto-service', name: 'Автосервіс', nameEn: 'Auto service' },
  { slug: 'detailing', name: 'Детейлінг', nameEn: 'Car detailing' },
  { slug: 'tire-service', name: 'Шиномонтаж', nameEn: 'Tire service' },
  { slug: 'education', name: 'Освіта', nameEn: 'Education' },
  { slug: 'legal', name: 'Юридичні послуги', nameEn: 'Legal services' },
  { slug: 'photography', name: 'Фотограф', nameEn: 'Photography' },
  { slug: 'veterinary', name: 'Ветеринар', nameEn: 'Veterinary' },
];

async function seedCategories() {
  const Category = require('../models/Category');
  for (const cat of SEED_CATEGORIES) {
    await Category.updateOne(
      { slug: cat.slug },
      { $setOnInsert: { ...cat, status: 'ACTIVE' } },
      { upsert: true }
    );
  }
  return SEED_CATEGORIES.length;
}

module.exports = { seedCategories, SEED_CATEGORIES };
