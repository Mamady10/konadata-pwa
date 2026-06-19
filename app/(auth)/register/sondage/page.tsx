'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { SignupOtpSection, useSignupOtp } from '@/components/auth/signup-otp-section';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { AuthPageBrand } from '@/components/auth/auth-page-brand';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import {
  ACCOUNT_PHONE_FIELD_HINT,
  ACCOUNT_PHONE_FIELD_LABEL,
} from '@/lib/auth/phone-field-copy';
import { completeSurveyOnlyRegistration } from '@/lib/actions/survey-only-registration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  Lock,
  User,
  ClipboardList,
  ArrowRight,
  AlertCircle,
  Building2,
  MapPin,
  Phone,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterSurveyOnlyPage() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [fullName, setFullName] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);
  const signupOtp = useSignupOtp();

  useEffect(() => {
    signupOtp.resetOtp();
  }, [authMethod]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const fd = new FormData(e.currentTarget);
      const password = String(fd.get('password') ?? '');
      const name = String(fd.get('full_name') ?? '').trim();
      const phone = String(fd.get('phone') ?? '').trim();
      const email = String(fd.get('email') ?? '').trim();

      if (signupOtp.step === 'form') {
        const ok = await signupOtp.requestOtp({ method: authMethod, phone, email });
        if (!ok && signupOtp.otpError) setError(signupOtp.otpError);
        return;
      }

      const signup = await signupOtp.completeSignup({
        method: authMethod,
        password,
        fullName: name,
        accountIntent: 'director',
        signupIntent: 'survey_only',
      });
      if ('error' in signup) {
        setError(signup.error);
        return;
      }

      if (authMethod === 'phone') {
        const phoneE164 = normalizeGuineaPhone(String(fd.get('phone') ?? ''));
        if (phoneE164) fd.set('declared_phone', phoneE164);
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) fd.set('email', user.email);
      if (!fd.get('declared_phone')) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user?.id ?? '')
          .maybeSingle();
        if (profile?.phone) fd.set('declared_phone', profile.phone as string);
      }

      const result = await completeSurveyOnlyRegistration(fd);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }

      if ('success' in result && result.success) {
        if (result.ceoNotifyWarning) {
          setInfo(`Sondage créé. Note : ${result.ceoNotifyWarning}`);
        }
        window.location.href = result.redirectTo;
      }
    } catch {
      setError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="mb-6">
          <AuthBackHome />
        </div>
        <AuthPageBrand />

        <Card className="border-0 shadow-card-hover border-l-4 border-l-teal-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <ClipboardList className="h-7 w-7 text-teal-600" />
              Lancer un sondage
            </CardTitle>
            <CardDescription>
              Pour une organisation non encore sur KonaData. Un abonnement par campagne : vous pouvez
              créer plusieurs sondages, chacun doit être payé avant activation. Après le rapport final,
              l&apos;accès à cette campagne se termine 15 jours plus tard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-800">{info}</div>
            )}

            <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Votre compte
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name">Nom complet *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="full_name"
                        name="full_name"
                        className="pl-9"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>
                  {authMethod === 'email' ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="email" name="email" type="email" className="pl-9" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            className="pl-9"
                            minLength={8}
                            required
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="phone">{ACCOUNT_PHONE_FIELD_LABEL} *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="phone" name="phone" type="tel" className="pl-9" required placeholder="6XX XX XX XX" />
                        </div>
                        <p className="text-xs text-muted-foreground">{ACCOUNT_PHONE_FIELD_HINT}</p>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="password_phone">Mot de passe *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="password_phone"
                            name="password"
                            type="password"
                            className="pl-9"
                            minLength={8}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="contact_title">Fonction</Label>
                    <Input id="contact_title" name="contact_title" placeholder="Directeur, chargé d'études…" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heard_from">Comment nous avez-vous connu ?</Label>
                    <Input id="heard_from" name="heard_from" placeholder="Réseaux, partenaire…" />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Votre organisation
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organization">Nom de l&apos;organisation *</Label>
                    <Input id="organization" name="organization" required placeholder="ONG Exemple Guinée" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="declared_city">Ville *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="declared_city" name="declared_city" className="pl-9" required />
                    </div>
                  </div>
                  {authMethod === 'email' && (
                    <div className="space-y-2">
                      <Label htmlFor="declared_phone">{ACCOUNT_PHONE_FIELD_LABEL} *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="declared_phone" name="declared_phone" className="pl-9" required placeholder="6XX XX XX XX" />
                      </div>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_PHONE_FIELD_HINT}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4 border-t pt-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Votre sondage (QCM)
                </h2>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="survey_title">Titre de la campagne *</Label>
                    <Input id="survey_title" name="survey_title" required placeholder="Sondage satisfaction 2026" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="survey_description">Description (optionnel)</Label>
                    <Input id="survey_description" name="survey_description" placeholder="Contexte du sondage…" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="region">Région / zone</Label>
                      <Input id="region" name="region" placeholder="Kindia, Conakry…" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_responses">Personnes cibles *</Label>
                      <Input
                        id="target_responses"
                        name="target_responses"
                        type="number"
                        min={1}
                        required
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="question">Question *</Label>
                    <Input id="question" name="question" required placeholder="Quelle est votre opinion sur… ?" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="option_1">Option 1 *</Label>
                      <Input id="option_1" name="option_1" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="option_2">Option 2 *</Label>
                      <Input id="option_2" name="option_2" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="option_3">Option 3 *</Label>
                      <Input id="option_3" name="option_3" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collection_mode">Mode de collecte</Label>
                    <select
                      id="collection_mode"
                      name="collection_mode"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      defaultValue="mixed"
                    >
                      <option value="mixed">Mixte (lien public + agents)</option>
                      <option value="self_service">Auto-déclaration (lien public)</option>
                      <option value="field_agent">Agents terrain uniquement</option>
                    </select>
                  </div>
                </div>
              </section>

              <SignupOtpSection
                method={authMethod}
                step={signupOtp.step}
                channel={signupOtp.channel}
                onChannelChange={signupOtp.setChannel}
                otpCode={signupOtp.otpCode}
                onOtpCodeChange={signupOtp.setOtpCode}
                maskedContact={signupOtp.maskedContact}
                devCode={signupOtp.devCode}
                error={signupOtp.otpError}
                loading={signupOtp.otpLoading || loading}
                onChangeContact={signupOtp.resetOtp}
              />

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-500 to-[#2563EB] border-0"
                disabled={loading || signupOtp.otpLoading}
              >
                {loading || signupOtp.otpLoading
                  ? 'Traitement…'
                  : signupOtp.step === 'form'
                    ? authMethod === 'phone'
                      ? 'Recevoir le code WhatsApp / SMS'
                      : 'Recevoir le code par email'
                    : 'Créer mon compte et mon sondage'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Besoin de toute la plateforme ONG ?{' '}
              <Link href={LANDING_LINKS.registerOrganization} className="text-primary underline">
                Créer une organisation complète
              </Link>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Déjà inscrit ?{' '}
              <Link href={LANDING_LINKS.login} className="underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
