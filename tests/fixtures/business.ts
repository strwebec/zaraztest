/**
 * Registration form for a new BUSINESS_OWNER only collects: owner name, business
 * name, category, email, phone, password (frontend/app/[locale]/login/page.tsx).
 * There is no address / description / working-hours / Google-Maps-link step at
 * registration — those are configured afterwards on /business-account/settings
 * and /business-account/staff, once the account is already approved. The spec's
 * "fill address, description, hours, maps link" step doesn't correspond to any
 * real form, so this fixture only covers what registration actually asks for.
 */
export function testBusinessRegistration(uniqueSuffix: string) {
  return {
    ownerName: `TEST_Owner_${uniqueSuffix}`,
    businessName: `TEST_Business_${uniqueSuffix}`,
    email: `test_bizowner_${uniqueSuffix}@example.com`,
    phone: '+380991234567',
    password: 'TestBusiness123!',
    // Category select defaults to the first option in the live list; tests select
    // explicitly by visible option text rather than assuming a stable id/slug.
  };
}
