'use client';

import { Button } from '@/components/ui/button';
import { Mail, Phone } from 'lucide-react';

export type AuthMethod = 'phone' | 'email';

interface Props {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
}

export function AuthMethodToggle({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <Button
        type="button"
        variant={value === 'phone' ? 'default' : 'outline'}
        className={value === 'phone' ? 'bg-[#2563EB]' : ''}
        onClick={() => onChange('phone')}
      >
        <Phone className="h-4 w-4 mr-1" />
        WhatsApp
      </Button>
      <Button
        type="button"
        variant={value === 'email' ? 'default' : 'outline'}
        className={value === 'email' ? 'bg-[#2563EB]' : ''}
        onClick={() => onChange('email')}
      >
        <Mail className="h-4 w-4 mr-1" />
        Email
      </Button>
    </div>
  );
}
