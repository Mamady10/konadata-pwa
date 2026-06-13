'use client';

import { Suspense } from 'react';
import { ForgotPasswordPageContent } from '@/components/auth/forgot-password-content';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement…</div>}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
