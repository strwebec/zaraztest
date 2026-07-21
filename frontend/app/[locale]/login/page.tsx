'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  useLogin,
  useRegisterClient,
  useRegisterBusiness,
  useVerifyRegistrationCode,
  useResendVerificationCode,
  useForgotPassword,
  useResetPassword,
  useCategories,
  useCities,
  useMe,
  ApiError,
} from '@/lib/hooks';
import { roleHomeHref, isRedirectAllowedForRole } from '@/lib/utils/roleHome';
import { setSelectedCity } from '@/lib/utils/city';
import type { Locale } from '@/lib/i18n';

const ERROR_KEY: Record<string, string> = {
  INVALID_CREDENTIALS: 'auth.invalidCredentials',
  EMAIL_TAKEN: 'auth.emailTaken',
  WEAK_PASSWORD: 'auth.weakPassword',
  INVALID_CITY: 'auth.invalidCity',
  TERMS_NOT_ACCEPTED: 'auth.termsNotAccepted',
  INVALID_OR_EXPIRED_CODE: 'auth.invalidOrExpiredCode',
  TOO_MANY_ATTEMPTS: 'auth.tooManyAttempts',
  CATEGORY_ALREADY_EXISTS: 'auth.categoryAlreadyExists',
};

type AccountType = 'client' | 'business';

const OTHER_CITY = 'other-city';

// Where a successful login/registration lands, per role — clients land on the
// public home/catalog (browsing-first), other roles go straight to their
// cabinet (matches roleHomeHref, except CLIENT).
function postAuthHref(locale: Locale, role: string) {
  return role === 'CLIENT' ? `/${locale}` : roleHomeHref(locale, role);
}

function resolveTarget(locale: Locale, role: string, explicitRedirect: string | null) {
  if (explicitRedirect && isRedirectAllowedForRole(explicitRedirect, locale, role)) return explicitRedirect;
  return postAuthHref(locale, role);
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get('redirect');

  const [tab, setTab] = useState<'login' | 'register'>(searchParams.get('tab') === 'register' ? 'register' : 'login');
  const [accountType, setAccountType] = useState<AccountType>(searchParams.get('type') === 'business' ? 'business' : 'client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [citySlug, setCitySlug] = useState('');
  const [cityName, setCityName] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{ email: string } | null>(null);
  const [code, setCode] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [forgotPasswordFlow, setForgotPasswordFlow] = useState<{ step: 'request' | 'reset'; email: string } | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];
  const { data: citiesData } = useCities();
  const cities = citiesData?.cities ?? [];
  const { data: meData } = useMe();

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0].id);
  }, [categories, category]);

  useEffect(() => {
    if (!citySlug && cities.length) setCitySlug(cities[0].slug);
  }, [cities, citySlug]);

  useEffect(() => {
    if (meData?.user) {
      router.replace(resolveTarget(locale, meData.user.role, explicitRedirect));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meData?.user]);

  const loginMutation = useLogin();
  const registerClientMutation = useRegisterClient();
  const registerBusinessMutation = useRegisterBusiness();
  const verifyCodeMutation = useVerifyRegistrationCode();
  const resendCodeMutation = useResendVerificationCode();
  const forgotPasswordMutation = useForgotPassword();
  const resetPasswordMutation = useResetPassword();
  const pending = loginMutation.isPending || registerClientMutation.isPending || registerBusinessMutation.isPending;
  const error = loginMutation.error || registerClientMutation.error || registerBusinessMutation.error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (tab === 'login') {
        const { user } = await loginMutation.mutateAsync({ email, password });
        router.push(resolveTarget(locale, user.role, explicitRedirect));
        return;
      }

      if (accountType === 'client') {
        const res = await registerClientMutation.mutateAsync({
          name,
          email,
          phone,
          password,
          citySlug: citySlug === OTHER_CITY ? undefined : citySlug,
          cityName: citySlug === OTHER_CITY ? cityName : undefined,
          agreeToTerms,
        });
        setSelectedCity(res.city);
        setPendingVerification({ email: res.email });
      } else {
        const res = await registerBusinessMutation.mutateAsync({
          ownerName: name,
          email,
          phone,
          password,
          businessName,
          category,
          customCategoryName: category === 'other' ? customCategoryName : undefined,
          citySlug: citySlug === OTHER_CITY ? undefined : citySlug,
          cityName: citySlug === OTHER_CITY ? cityName : undefined,
          agreeToTerms,
        });
        setSelectedCity(res.city);
        setPendingVerification({ email: res.email });
      }
    } catch (err) {
      if (tab === 'login' && err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setPendingVerification({ email: (err.data?.email as string) || email });
      }
      /* other errors surfaced via mutation.error */
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingVerification) return;
    try {
      const { user } = await verifyCodeMutation.mutateAsync({ email: pendingVerification.email, code });
      router.push(resolveTarget(locale, user.role, explicitRedirect));
    } catch {
      /* error surfaced via verifyCodeMutation.error */
    }
  }

  function handleResendCode() {
    if (!pendingVerification) return;
    resendCodeMutation.mutate(
      { email: pendingVerification.email },
      {
        onSuccess: () => {
          setResendSent(true);
          setTimeout(() => setResendSent(false), 4000);
        },
      }
    );
  }

  function handleSendResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotPasswordFlow) return;
    forgotPasswordMutation.mutate(
      { email: forgotPasswordFlow.email },
      { onSuccess: () => setForgotPasswordFlow({ step: 'reset', email: forgotPasswordFlow.email }) }
    );
  }

  function handleResendResetCode() {
    if (!forgotPasswordFlow) return;
    forgotPasswordMutation.mutate(
      { email: forgotPasswordFlow.email },
      {
        onSuccess: () => {
          setResetCodeSent(true);
          setTimeout(() => setResetCodeSent(false), 4000);
        },
      }
    );
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotPasswordFlow) return;
    try {
      const { user } = await resetPasswordMutation.mutateAsync({
        email: forgotPasswordFlow.email,
        code: resetCode,
        newPassword,
      });
      router.push(resolveTarget(locale, user.role, explicitRedirect));
    } catch {
      /* error surfaced via resetPasswordMutation.error */
    }
  }

  // A raw network failure (fetch rejected) or a response with no parseable error
  // code (status >= 500, or a non-JSON body like Render's gateway-timeout page) both
  // mean the request never reached real app logic — most often because the free-tier
  // backend was asleep and is still waking up. That's worth a distinct, actionable
  // message instead of the flat "something went wrong" shown for a genuine app error.
  const looksLikeColdStart =
    !!error && (!(error instanceof ApiError) || !error.code || error.status >= 500);
  const errorMessage =
    error instanceof ApiError && ERROR_KEY[error.code ?? '']
      ? t(ERROR_KEY[error.code ?? ''])
      : error && !(error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED')
        ? t(looksLikeColdStart ? 'auth.serverWakingUp' : 'auth.genericError')
        : null;

  if (forgotPasswordFlow) {
    const requestError =
      forgotPasswordMutation.error instanceof ApiError && ERROR_KEY[forgotPasswordMutation.error.code ?? '']
        ? t(ERROR_KEY[forgotPasswordMutation.error.code ?? ''])
        : forgotPasswordMutation.error
          ? t('auth.genericError')
          : null;
    const resetError =
      resetPasswordMutation.error instanceof ApiError && ERROR_KEY[resetPasswordMutation.error.code ?? '']
        ? t(ERROR_KEY[resetPasswordMutation.error.code ?? ''])
        : resetPasswordMutation.error
          ? t('auth.genericError')
          : null;

    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-2xl font-bold text-text">{t('auth.forgotPasswordTitle')}</h1>
          <p className="text-sm text-text-muted">
            {forgotPasswordFlow.step === 'request'
              ? t('auth.forgotPasswordHint')
              : t('auth.resetCodeHint', { email: forgotPasswordFlow.email })}
          </p>
        </div>

        {forgotPasswordFlow.step === 'request' ? (
          <form onSubmit={handleSendResetCode} className="flex flex-col gap-3">
            <input
              required
              type="email"
              autoFocus
              value={forgotPasswordFlow.email}
              onChange={(e) => setForgotPasswordFlow({ step: 'request', email: e.target.value })}
              placeholder={t('auth.email') as string}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            {requestError && <p className="text-sm text-danger">{requestError}</p>}
            <button
              type="submit"
              disabled={forgotPasswordMutation.isPending}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {t('auth.sendResetCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            <input
              required
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.verifyCodePlaceholder') as string}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.3em] text-text outline-none focus:border-primary"
            />
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.newPassword') as string}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            {resetError && <p className="text-sm text-danger">{resetError}</p>}
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending || resetCode.length !== 6}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {t('auth.resetPasswordButton')}
            </button>
          </form>
        )}

        <div className="flex flex-col items-center gap-2 text-sm">
          {forgotPasswordFlow.step === 'reset' && (
            <>
              <button
                type="button"
                onClick={handleResendResetCode}
                disabled={forgotPasswordMutation.isPending}
                className="font-semibold text-primary disabled:opacity-60"
              >
                {t('auth.resendCode')}
              </button>
              {resetCodeSent && <span className="text-xs text-success">{t('auth.resendCodeSent')}</span>}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setForgotPasswordFlow(null);
              setResetCode('');
              setNewPassword('');
            }}
            className="text-xs text-text-muted underline"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (pendingVerification) {
    const verifyError =
      verifyCodeMutation.error instanceof ApiError && ERROR_KEY[verifyCodeMutation.error.code ?? '']
        ? t(ERROR_KEY[verifyCodeMutation.error.code ?? ''])
        : verifyCodeMutation.error
          ? t('auth.genericError')
          : null;

    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-2xl font-bold text-text">{t('auth.verifyTitle')}</h1>
          <p className="text-sm text-text-muted">{t('auth.verifyHint', { email: pendingVerification.email })}</p>
        </div>
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
          <input
            required
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('auth.verifyCodePlaceholder') as string}
            className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.3em] text-text outline-none focus:border-primary"
          />
          {verifyError && <p className="text-sm text-danger">{verifyError}</p>}
          <button
            type="submit"
            disabled={verifyCodeMutation.isPending || code.length !== 6}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {t('auth.verifyButton')}
          </button>
        </form>
        <div className="flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCodeMutation.isPending}
            className="font-semibold text-primary disabled:opacity-60"
          >
            {t('auth.resendCode')}
          </button>
          {resendSent && <span className="text-xs text-success">{t('auth.resendCodeSent')}</span>}
          <button
            type="button"
            onClick={() => {
              setPendingVerification(null);
              setCode('');
            }}
            className="text-xs text-text-muted underline"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        <button
          onClick={() => setTab('login')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === 'login' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('auth.loginTab')}
        </button>
        <button
          onClick={() => setTab('register')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === 'register' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('auth.registerTab')}
        </button>
      </div>

      {tab === 'register' && (
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setAccountType('client')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              accountType === 'client' ? 'bg-primary-glow text-text' : 'text-text-muted'
            }`}
          >
            {t('auth.asClient')}
          </button>
          <button
            onClick={() => setAccountType('business')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              accountType === 'business' ? 'bg-primary-glow text-text' : 'text-text-muted'
            }`}
          >
            {t('auth.asBusiness')}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {tab === 'register' && (
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={(accountType === 'business' ? t('auth.ownerName') : t('auth.name')) as string}
            className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
        )}

        {tab === 'register' && (
          <>
            <select
              required
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {i18n.language === 'en' && c.nameEn ? c.nameEn : c.name}
                </option>
              ))}
              <option value={OTHER_CITY}>{t('auth.otherCity')}</option>
            </select>
            {citySlug === OTHER_CITY && (
              <input
                required
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder={t('auth.otherCityPlaceholder') as string}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
              />
            )}
          </>
        )}

        {tab === 'register' && accountType === 'business' && (
          <>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('auth.businessName') as string}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {i18n.language === 'en' ? c.nameEn : c.name}
                </option>
              ))}
              <option value="other">{t('auth.otherCategory')}</option>
            </select>
            {category === 'other' && (
              <input
                required
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder={t('auth.otherCategoryPlaceholder') as string}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
              />
            )}
          </>
        )}

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email') as string}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        {tab === 'register' && (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('auth.phone') as string}
            className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
        )}
        <input
          required
          type="password"
          minLength={tab === 'register' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password') as string}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />

        {tab === 'register' && accountType === 'business' && (
          <p className="text-xs text-text-muted">{t('auth.businessPendingNotice')}</p>
        )}

        {tab === 'register' && (
          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t('auth.agreeToTermsPrefix')}{' '}
              <Link href={`/${locale}/privacy`} target="_blank" className="text-primary underline">
                {t('auth.privacyPolicyLink')}
              </Link>
            </span>
          </label>
        )}

        {errorMessage && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-danger">{errorMessage}</p>
            {tab === 'login' && (
              <button
                type="button"
                onClick={() => setForgotPasswordFlow({ step: 'request', email })}
                className="self-start text-xs font-semibold text-primary underline"
              >
                {t('auth.forgotPassword')}
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || (tab === 'register' && !agreeToTerms)}
          className="mt-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {tab === 'login'
            ? t('auth.loginButton')
            : accountType === 'business'
              ? t('auth.registerBusinessButton')
              : t('auth.registerButton')}
        </button>
      </form>
    </div>
  );
}
