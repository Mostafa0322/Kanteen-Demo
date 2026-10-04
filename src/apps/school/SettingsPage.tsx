import { useState } from 'react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Field, Select } from '@/ui/Form';
import { PageTitle } from '@/ui/Misc';
import { LoadingBlock } from '@/ui/States';
import { useToast } from '@/ui/Toast';

const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR'];

export function SettingsPage() {
  const { t, money } = useI18n();
  const toast = useToast();
  const settings = useApi(() => api.getSettings(), []);
  const [currency, setCurrency] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const value = currency ?? settings.data?.currency ?? 'EGP';

  const save = async () => {
    setPending(true);
    try {
      await api.updateSettings({ currency: value });
      toast({ tone: 'success', title: t('settings.saved') });
      setCurrency(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Card className="max-w-xl">
        <CardHeader title={t('settings.currency')} subtitle={t('settings.currencyHint')} />
        <CardBody className="space-y-4">
          {!settings.data ? (
            <LoadingBlock rows={1} />
          ) : (
            <>
              <Field label={t('settings.currency')} hint={t('settings.preview', { amount: money(1250.5) })}>
                {(id) => (
                  <Select id={id} value={value} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button onClick={save} loading={pending} disabled={value === settings.data.currency}>
                {t('common.save')}
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
