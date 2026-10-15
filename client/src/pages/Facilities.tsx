import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { useFetch } from '../lib/useFetch';
import { post, del, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Notice, Field } from '../components/ui';

type Instrument = {
  id: number; slug: string; category: string; location: string;
  hourly_rate: number; requires_training: number;
  open_from: number; open_to: number; max_hours: number; status: string;
  name_mk: string; name_en: string; description_mk: string; description_en: string;
};

type Slot = { hour: number; free: boolean; booking: { id: number; user_name: string; purpose: string } | null };
type Availability = { instrument: Instrument; date: string; slots: Slot[] };
type Booking = {
  id: number; date: string; start_hour: number; end_hour: number; purpose: string; status: string;
  instrument_slug: string; instrument_mk: string; instrument_en: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function Facilities() {
  const { t, f, s, formatDate, formatNumber } = useLang();
  const { user } = useAuth();

  const instruments = useFetch<Instrument[]>('/instruments');
  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState<number[]>([]);
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug && instruments.data?.length) setSlug(instruments.data[0].slug);
  }, [instruments.data, slug]);

  const availability = useFetch<Availability>(slug ? `/instruments/${slug}/availability?date=${date}` : null, [slug, date]);
  const mine = useFetch<Booking[]>(user ? '/bookings/mine' : null, [user?.id]);

  useEffect(() => { setHours([]); setMessage(null); }, [slug, date]);

  const instrument = availability.data?.instrument;
  const slots = availability.data?.slots ?? [];

  const cost = instrument ? hours.length * instrument.hourly_rate : 0;
  const range = hours.length ? [Math.min(...hours), Math.max(...hours) + 1] : null;

  /** Clicking a slot extends the selection when the whole span is still free. */
  const pick = (hour: number) => {
    if (!instrument) return;
    setMessage(null);
    if (hours.length === 0) { setHours([hour]); return; }
    const from = Math.min(hour, ...hours);
    const to = Math.max(hour, ...hours);
    const span = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const allFree = span.every(h => slots.find(s => s.hour === h)?.free);
    if (!allFree || span.length > instrument.max_hours) { setHours([hour]); return; }
    setHours(span);
  };

  const confirm = async () => {
    if (!instrument || !range) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await post<{ cost_eur: number }>('/bookings', {
        instrument_slug: instrument.slug,
        date,
        start_hour: range[0],
        end_hour: range[1],
        purpose
      });
      setMessage({ kind: 'ok', text: `${t('fac.booked')} € ${result.cost_eur}` });
      setHours([]);
      setPurpose('');
      availability.reload();
      mine.reload();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'error';
      const known = ['slot_taken', 'exceeds_max_hours', 'outside_opening_hours', 'date_in_past', 'instrument_unavailable'];
      setMessage({ kind: 'error', text: known.includes(code) ? t(`fac.err.${code}` as any) : t('common.error') });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: number) => {
    await del(`/bookings/${id}`);
    mine.reload();
    availability.reload();
  };

  const byCategory = useMemo(() => {
    const map = new Map<string, Instrument[]>();
    for (const item of instruments.data ?? []) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [instruments.data]);

  return (
    <>
      <PageHeader index="08 / FACILITIES" title={t('fac.title')} lead={t('fac.lead')} />

      {instruments.loading && <Loading />}
      {instruments.error && <ErrorBox onRetry={instruments.reload} />}

      <div className="grid gap-8 lg:grid-cols-[290px_minmax(0,1fr)] items-start">
        {/* ---------------------------------------------------- instruments */}
        <aside className="space-y-7 lg:sticky lg:top-28">
          {byCategory.map(([category, list]) => (
            <div key={category}>
              <h2 className="label mb-3">{t(`fac.category.${category}` as any)}</h2>
              <ul className="space-y-2">
                {list.map(item => (
                  <li key={item.id}>
                    <button className="w-full text-left" onClick={() => setSlug(item.slug)} aria-pressed={slug === item.slug}>
                      <Card
                        hover
                        className="p-3.5"
                        style={slug === item.slug ? { borderColor: 'var(--accent)', background: 'var(--ground)' } : undefined}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[13px] leading-snug">{f(item, 'name')}</span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${item.status === 'available' ? 'bg-accent' : 'bg-danger'}`}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="label mt-2">
                          {item.hourly_rate ? `€${item.hourly_rate}${t('fac.perhour')}` : t('fac.free')}
                        </div>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        {/* ------------------------------------------------------ scheduler */}
        <div className="space-y-6 min-w-0">
          {availability.loading && <Loading />}
          {instrument && (
            <>
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-2xl leading-snug">{f(instrument, 'name')}</h2>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink2 max-w-2xl">
                      {f(instrument, 'description')}
                    </p>
                  </div>
                  <span className={`chip ${instrument.status === 'available' ? 'chip-on' : 'text-danger border-danger'}`}>
                    {instrument.status === 'available' ? t('fac.available') : t('fac.maintenance')}
                  </span>
                </div>

                <dl className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-6 pt-5 border-t border-linesoft">
                  {[
                    [t('fac.location'), s(instrument.location)],
                    [t('fac.hours'), `${pad(instrument.open_from)} – ${pad(instrument.open_to)}`],
                    [t('fac.maxhours'), `${instrument.max_hours} ${t('fac.hoursShort')}`],
                    [t('fac.rate'), instrument.hourly_rate ? `€ ${instrument.hourly_rate}${t('fac.perhour')}` : t('fac.free')]
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="label">{label}</dt>
                      <dd className="text-[13px] mt-1 num text-ink2">{value}</dd>
                    </div>
                  ))}
                </dl>
                {instrument.requires_training === 1 && (
                  <p className="label mt-4 text-srose">⚠ {t('fac.training')}</p>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <h3 className="label">{t('common.date')}</h3>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-sm" onClick={() => setDate(todayIso())}>{t('common.today')}</button>
                    <input
                      type="date"
                      className="input max-w-[170px] num"
                      value={date}
                      min={todayIso()}
                      onChange={e => setDate(e.target.value)}
                      aria-label={t('common.date')}
                    />
                  </div>
                </div>

                <p className="text-[13px] text-muted mb-4">{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>

                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))' }}>
                  {slots.map(slot => {
                    const selected = hours.includes(slot.hour);
                    return (
                      <button
                        key={slot.hour}
                        onClick={() => slot.free && pick(slot.hour)}
                        disabled={!slot.free || instrument.status !== 'available'}
                        aria-pressed={selected}
                        title={slot.booking
                          ? `${slot.booking.user_name} — ${slot.booking.purpose ?? ''}`
                          : slot.free ? t('fac.freeslot') : t('fac.taken')}
                        className={`px-2 py-3 rounded-xs border text-center transition-colors ${
                          selected
                            ? 'border-accent bg-accent text-bg'
                            : slot.free
                              ? 'border-line hover:border-accent text-ink2'
                              : 'border-linesoft bg-bg3 text-muted cursor-not-allowed'
                        }`}
                      >
                        <span className="num text-[12px] block">{pad(slot.hour)}</span>
                        <span className="label block mt-1 !text-[8.5px]" style={selected ? { color: 'var(--paper)' } : undefined}>
                          {slot.free ? t('fac.freeslot') : t('fac.taken')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ------------------------------------------------ booking */}
                <div className="mt-6 pt-5 border-t border-linesoft">
                  {!user ? (
                    <Notice>
                      {t('fac.signin')} <Link to="/login" className="text-accent link-underline ml-1">{t('nav.login')} →</Link>
                    </Notice>
                  ) : !range ? (
                    <p className="text-[13px] text-muted">{t('fac.selectslot')}</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] items-end">
                      <Field label={t('fac.purpose')}>
                        <input
                          className="input"
                          value={purpose}
                          onChange={e => setPurpose(e.target.value)}
                          placeholder={t('fac.purposeph')}
                          maxLength={300}
                        />
                      </Field>
                      <div className="flex items-end gap-4">
                        <div>
                          <Label>{t('fac.cost')}</Label>
                          <div className="num text-xl mt-1 text-accent">€ {formatNumber(cost)}</div>
                          <div className="label mt-1">{pad(range[0])} – {pad(range[1])}</div>
                        </div>
                        <button className="btn btn-primary" onClick={confirm} disabled={saving}>
                          {t('fac.confirm')}
                        </button>
                      </div>
                    </div>
                  )}

                  {message && (
                    <div className="mt-4">
                      <Notice kind={message.kind}>{message.text}</Notice>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {user && (
            <Card className="p-6">
              <h3 className="label mb-4">{t('fac.mybookings')}</h3>
              {mine.data?.length === 0 && <p className="text-[13px] text-muted">{t('fac.nobookings')}</p>}
              <ul className="space-y-2.5">
                {mine.data?.filter(b => b.status !== 'cancelled').map(booking => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-4 py-2.5 border-b border-linesoft last:border-0">
                    <span className="num text-[13px] text-accent w-24">{formatDate(booking.date, { day: '2-digit', month: 'short' })}</span>
                    <span className="num text-[13px] w-28">{pad(booking.start_hour)} – {pad(booking.end_hour)}</span>
                    <span className="text-[13px] flex-1 min-w-[160px]">{f(booking, 'instrument')}</span>
                    <span className="text-[12px] text-muted flex-1 min-w-[120px] truncate">{booking.purpose}</span>
                    <button className="btn btn-sm" onClick={() => cancel(booking.id)}>{t('fac.cancel')}</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
