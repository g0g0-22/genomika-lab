import { useState } from 'react';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { post, ApiError } from '../lib/api';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Toggle, Field, Notice } from '../components/ui';

type Event = {
  id: number; starts_at: string; ends_at: string; location: string;
  speaker: string; affiliation: string; capacity: number; kind: string; rsvp_count: number;
  title_mk: string; title_en: string; description_mk: string; description_en: string;
};

function Rsvp({ event, onDone }: { event: Event; onDone: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await post(`/events/${event.id}/rsvp`, { name, email });
      setState('done');
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? (err.status === 429 ? 'too_many' : err.code) : 'error';
      setError(code);
      setState('idle');
    }
  };

  if (state === 'done') return <Notice kind="ok">{t('ev.rsvpdone')}</Notice>;

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end mt-4 rise">
      <Field label={t('common.name')} required>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required minLength={2} />
      </Field>
      <Field label={t('common.email')} required>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </Field>
      <button className="btn btn-primary" disabled={state === 'sending'}>{t('ev.rsvp')}</button>
      {error && (
        <div className="sm:col-span-3">
          <Notice kind="error">
            {error === 'already_registered' ? t('ev.err.already_registered')
              : error === 'event_full' ? t('ev.err.event_full')
              : error === 'event_past' ? t('ev.err.event_past')
              : error === 'too_many' ? t('err.toomany')
              : t('common.error')}
          </Notice>
        </div>
      )}
    </form>
  );
}

export default function Events() {
  const { t, f, s, lang, formatDate } = useLang();
  const [scope, setScope] = useState('upcoming');
  const [open, setOpen] = useState<number | null>(null);
  const events = useFetch<Event[]>(`/events?scope=${scope}`, [scope]);

  return (
    <>
      <PageHeader index="06 / EVENTS" title={t('ev.title')} lead={t('ev.lead')}>
        <Toggle
          ariaLabel={t('common.filter')}
          value={scope}
          onChange={setScope}
          options={[{ value: 'upcoming', label: t('ev.upcoming') }, { value: 'past', label: t('ev.past') }]}
        />
      </PageHeader>

      {events.loading && <Loading />}
      {events.error && <ErrorBox onRetry={events.reload} />}
      {events.data?.length === 0 && <Empty />}

      <div className="space-y-4">
        {events.data?.map((event, i) => {
          const seats = event.capacity - event.rsvp_count;
          const start = new Date(event.starts_at);
          return (
            <Card key={event.id} className="p-6 rise" style={{ animationDelay: `${i * 55}ms` }}>
              <div className="grid gap-6 md:grid-cols-[86px_minmax(0,1fr)_180px]">
                <div className="text-center md:border-r md:border-line md:pr-4">
                  <div className="num text-4xl leading-none text-accent">{start.getDate()}</div>
                  <div className="label mt-2">{formatDate(event.starts_at, { month: 'short', year: 'numeric' })}</div>
                  <div className="num text-[12px] mt-2 text-muted">
                    {formatDate(event.starts_at, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="chip">{t(`ev.kind.${event.kind}` as any)}</span>
                  <h2 className="mt-2.5 text-xl leading-snug">{f(event, 'title')}</h2>
                  {event.speaker && (
                    <p className="mt-2 text-[13px] text-ink2">
                      <span className="label mr-2">{t('ev.speaker')}</span>
                      {event.speaker}{event.affiliation ? `, ${event.affiliation}` : ''}
                    </p>
                  )}
                  <p className="mt-1.5 text-[13px] text-muted">
                    <span className="label mr-2">{t('ev.location')}</span>{s(event.location)}
                  </p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink2">{f(event, 'description')}</p>
                </div>

                <div className="md:border-l md:border-line md:pl-6 flex flex-col gap-3">
                  {/* Seats only mean something for an event that has not happened yet. */}
                  {scope === 'upcoming' && <div>
                    <Label>{t('ev.seats')}</Label>
                    <div className={`num text-2xl mt-1 ${seats <= 0 ? 'text-danger' : ''}`}>
                      {Math.max(seats, 0)}
                      <span className="text-muted text-sm"> / {event.capacity}</span>
                    </div>
                    <div className="h-1.5 bg-bg3 rounded-[3px] overflow-hidden mt-2">
                      <div className="h-full bg-accent rounded-[3px] transition-[width] duration-700"
                           style={{ width: `${Math.min((event.rsvp_count / event.capacity) * 100, 100)}%` }} />
                    </div>
                  </div>}

                  {scope === 'upcoming' && (
                    <>
                      <button
                        className="btn btn-sm justify-center"
                        disabled={seats <= 0}
                        onClick={() => setOpen(open === event.id ? null : event.id)}
                      >
                        {seats <= 0 ? t('ev.full') : open === event.id ? t('common.close') : t('ev.rsvp')}
                      </button>
                      <a className="btn btn-sm justify-center" href={`/api/events/${event.id}/ics?lang=${lang}`}>
                        {t('ev.ics')}
                      </a>
                    </>
                  )}
                </div>
              </div>

              {open === event.id && scope === 'upcoming' && (
                <Rsvp event={event} onDone={events.reload} />
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
