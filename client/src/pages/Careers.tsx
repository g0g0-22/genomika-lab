import { useState } from 'react';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { post, ApiError } from '../lib/api';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Field, Notice, accentVar } from '../components/ui';

type Position = {
  id: number; slug: string; kind: string; deadline: string; is_open: number; accent: string;
  title_mk: string; title_en: string; description_mk: string; description_en: string;
  requirements_mk: string; requirements_en: string;
  group_slug: string; group_name_mk: string; group_name_en: string;
};

const MAX_CV_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

function ApplicationForm({ position }: { position: Position }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [motivation, setMotivation] = useState('');
  const [cv, setCv] = useState<{ name: string; type: string; size: number; data: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [reference, setReference] = useState('');

  const readCv = (file: File | undefined) => {
    if (!file) { setCv(null); return; }
    if (file.size > MAX_CV_BYTES) { setErrors(e => ({ ...e, cv: t('car.err.too_large') })); return; }
    if (file.type && !ALLOWED.includes(file.type)) { setErrors(e => ({ ...e, cv: t('car.err.unsupported_type') })); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setErrors(e => ({ ...e, cv: '' }));
      setCv({ name: file.name, type: file.type, size: file.size, data: String(reader.result) });
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('sending');
    setErrors({});
    try {
      const result = await post<{ reference: string }>(`/positions/${position.slug}/apply`, { name, email, motivation, cv });
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

  if (state === 'done') {
    return (
      <div className="mt-5 rise">
        <Notice kind="ok">
          {t('car.submitted')}
          <span className="block mt-2 label">{t('car.reference')}: <span className="text-accent">{reference}</span></span>
        </Notice>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2 rise">
      <Field label={t('common.name')} required error={errors.name && t('common.error')}>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required minLength={2} />
      </Field>
      <Field label={t('common.email')} required error={errors.email && t('common.error')}>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </Field>

      <div className="md:col-span-2">
        <Field
          label={t('car.motivation')}
          required
          hint={`${motivation.length} ${t('common.chars')} · min 40`}
          error={errors.motivation && t('common.error')}
        >
          <textarea
            className="input"
            rows={5}
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            placeholder={t('car.motivationph')}
            required
            minLength={40}
            maxLength={4000}
          />
        </Field>
      </div>

      <div className="md:col-span-2">
        <Field label={`${t('car.cv')} (${t('common.optional')})`} error={errors.cv || undefined}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => readCv(e.target.files?.[0])}
              className="block text-[12px] text-muted file:btn file:btn-sm file:mr-3"
            />
            <span className="label">{cv ? `${cv.name} · ${(cv.size / 1024).toFixed(0)} KB` : t('car.nofile')}</span>
          </div>
        </Field>
      </div>

      {errors.form && <div className="md:col-span-2"><Notice kind="error">{errors.form}</Notice></div>}

      <div className="md:col-span-2">
        <button className="btn btn-primary" disabled={state === 'sending'}>{t('car.apply')} →</button>
      </div>
    </form>
  );
}

export default function Careers() {
  const { t, f, formatDate } = useLang();
  const [open, setOpen] = useState<number | null>(null);
  const positions = useFetch<Position[]>('/positions');

  return (
    <>
      <PageHeader index="09 / CAREERS" title={t('car.title')} lead={t('car.lead')} />

      {positions.loading && <Loading />}
      {positions.error && <ErrorBox onRetry={positions.reload} />}
      {positions.data?.length === 0 && <Empty />}

      <div className="space-y-5">
        {positions.data?.map((position, i) => {
          const requirements = f(position, 'requirements').split(';').filter(Boolean);
          return (
            <Card key={position.id} className={`p-6 rise ${position.is_open ? '' : 'opacity-60'}`} style={{ animationDelay: `${i * 55}ms` }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${position.is_open ? 'chip-on' : ''}`}>
                  {position.is_open ? t('car.open') : t('car.closed')}
                </span>
                <span className="chip">{t(`car.kind.${position.kind}` as any)}</span>
                {position.group_slug && (
                  <span className="chip" style={{ borderColor: accentVar(position.accent), color: accentVar(position.accent) }}>
                    {f(position, 'group_name')}
                  </span>
                )}
                <span className="label ml-auto">
                  {t('car.deadline')}: <span className="num text-ink2">{formatDate(position.deadline)}</span>
                </span>
              </div>

              <h2 className="mt-3 text-2xl leading-snug">{f(position, 'title')}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink2 max-w-3xl">{f(position, 'description')}</p>

              {requirements.length > 0 && (
                <div className="mt-5">
                  <Label>{t('car.requirements')}</Label>
                  <ul className="mt-2.5 space-y-1.5">
                    {requirements.map(item => (
                      <li key={item} className="flex gap-3 text-[13.5px] text-ink2">
                        <span className="text-accent num shrink-0">—</span>
                        <span>{item.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {position.is_open === 1 && (
                <>
                  <button className="btn btn-primary mt-6" onClick={() => setOpen(open === position.id ? null : position.id)}>
                    {open === position.id ? t('common.close') : t('car.apply')}
                  </button>
                  {open === position.id && <ApplicationForm position={position} />}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
