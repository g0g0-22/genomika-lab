import { useState } from 'react';
import { useLang } from '../i18n';
import { post, ApiError } from '../lib/api';
import { PageHeader, Card, Label, Field, Notice, DnaStrip } from '../components/ui';

export default function Contact() {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [reference, setReference] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('sending');
    setErrors({});
    try {
      const result = await post<{ reference: string }>('/messages', form);
      setReference(result.reference);
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, String(v)])));
      } else {
        setErrors({ form: t('common.error') });
      }
      setState('idle');
    }
  };

  return (
    <>
      <PageHeader index="10 / CONTACT" title={t('con.title')} lead={t('con.lead')} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <Card className="p-6 md:p-8">
          {state === 'done' ? (
            <div className="rise">
              <Notice kind="ok">
                {t('con.sent')}
                <span className="block mt-2 label">{t('car.reference')}: <span className="text-accent">{reference}</span></span>
              </Notice>
              <button className="btn mt-5" onClick={() => { setState('idle'); setForm({ name: '', email: '', subject: '', body: '' }); }}>
                {t('common.reset')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
              <Field label={t('common.name')} required error={errors.name && t('common.error')}>
                <input className="input" value={form.name} onChange={set('name')} required minLength={2} />
              </Field>
              <Field label={t('common.email')} required error={errors.email && t('common.error')}>
                <input className="input" type="email" value={form.email} onChange={set('email')} required />
              </Field>
              <div className="md:col-span-2">
                <Field label={t('con.subject')} required error={errors.subject && t('common.error')}>
                  <input className="input" value={form.subject} onChange={set('subject')} required minLength={3} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field
                  label={t('con.message')}
                  required
                  hint={`${form.body.length} ${t('common.chars')} · min 20`}
                  error={errors.body && t('common.error')}
                >
                  <textarea className="input" rows={7} value={form.body} onChange={set('body')} required minLength={20} maxLength={4000} />
                </Field>
              </div>
              {errors.form && <div className="md:col-span-2"><Notice kind="error">{errors.form}</Notice></div>}
              <div className="md:col-span-2">
                <button className="btn btn-primary" disabled={state === 'sending'}>{t('con.send')} →</button>
              </div>
            </form>
          )}
        </Card>

        <aside className="space-y-5">
          <Card className="p-5">
            <Label>{t('con.address')}</Label>
            <address className="mt-2.5 not-italic text-[13.5px] leading-relaxed text-ink2">
              {lang === 'mk' ? 'ГеномикаЛаб' : 'GenomikaLab'}<br />
              {lang === 'mk' ? 'ул. Руѓер Бошковиќ бр. 16' : 'Rugjer Boshkovikj 16'}<br />
              1000 {lang === 'mk' ? 'Скопје' : 'Skopje'}<br />
              {lang === 'mk' ? 'Северна Македонија' : 'North Macedonia'}
            </address>
            <DnaStrip seed="contact" count={34} className="mt-5 opacity-40" />
          </Card>

          <Card className="p-5">
            <Label>{t('con.hours')}</Label>
            <p className="mt-2 num text-[13px] text-ink2">{t('con.hoursval')}</p>
          </Card>

          <Card className="p-5 space-y-2">
            <a href="mailto:info@genomika.mk" className="block text-[13px] text-ink2 hover:text-accent link-underline">
              info@genomika.mk
            </a>
            <a href="tel:+38923000000" className="block num text-[13px] text-ink2 hover:text-accent link-underline">
              +389 2 3000 000
            </a>
          </Card>
        </aside>
      </div>
    </>
  );
}
