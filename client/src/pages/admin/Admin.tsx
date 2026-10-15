import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { useFetch } from '../../lib/useFetch';
import { post, put, del, ApiError } from '../../lib/api';
import { PageHeader, Card, Label, Loading, ErrorBox, Empty, Toggle, Field, Notice, Stat } from '../../components/ui';

type Overview = {
  counts: Record<string, number>;
  recentApplications: { id: number; name: string; email: string; motivation: string; cv_filename: string | null; cv_size: number | null; status: string; created_at: string; position_en: string; position_mk: string }[];
  messages: { id: number; name: string; email: string; subject: string; body: string; handled: number; created_at: string }[];
  upcomingBookings: { id: number; user_name: string; date: string; start_hour: number; end_hour: number; purpose: string; instrument_en: string; instrument_mk: string }[];
  rsvps: { id: number; name: string; email: string; created_at: string; event_en: string; event_mk: string }[];
};

type Pub = { id: number; title: string; authors: string; venue: string; year: number; type: string; doi: string; citations: number; open_access: number; keywords: string; group_id: number | null };
type NewsRow = { id: number; slug: string; date: string; tag: string; title_mk: string; title_en: string; excerpt_mk: string; excerpt_en: string; body_mk: string; body_en: string };
type PersonRow = { id: number; slug: string; name_mk: string; name_en: string; role_mk: string; role_en: string; seniority: string; email: string; joined_year: number };

const TABS = ['overview', 'publications', 'news', 'people', 'inbox'] as const;

/**
 * Every administrative write goes through here. Previously they were bare
 * `await`s inside onClick handlers: a rejected request left the handler before
 * its state updates ran, so a failed save looked exactly like nothing
 * happening at all.
 */
function useMutation(onSettled?: () => void) {
  const { t } = useLang();
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  const run = async (action: () => Promise<unknown>, successText: string) => {
    setBusy(true);
    try {
      await action();
      setNotice({ kind: 'ok', text: successText });
      onSettled?.();
      return true;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown';
      setNotice({ kind: 'error', text: `${t('common.error')} — ${code}` });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, notice };
}

export default function Admin() {
  const { t, f, formatDate, formatNumber } = useLang();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<string>('overview');
  const [flash, setFlash] = useState<string | null>(null);

  const overview = useFetch<Overview>(user?.role === 'admin' ? '/admin/overview' : null, [user?.id]);
  const publications = useFetch<{ items: Pub[] }>(user?.role === 'admin' ? '/publications?limit=50' : null, [user?.id, flash]);
  const news = useFetch<NewsRow[]>(user?.role === 'admin' ? '/news' : null, [user?.id, flash]);
  const people = useFetch<PersonRow[]>(user?.role === 'admin' ? '/people' : null, [user?.id, flash]);

  if (!ready) return <Loading />;
  if (!user) {
    return (
      <>
        <PageHeader index="13 / ADMIN" title={t('adm.title')} lead={t('adm.lead')} />
        <Notice>
          {t('adm.onlyadmin')} <Link to="/login" className="text-accent link-underline ml-1">{t('nav.login')} →</Link>
        </Notice>
      </>
    );
  }
  if (user.role !== 'admin') {
    return (
      <>
        <PageHeader index="13 / ADMIN" title={t('adm.title')} lead={t('adm.lead')} />
        <Notice kind="error">{t('adm.onlyadmin')}</Notice>
      </>
    );
  }

  const inbox = useMutation(() => overview.reload());
  const done = (message: string) => { setFlash(`${message} ${Date.now()}`); overview.reload(); };
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  return (
    <>
      <PageHeader index="13 / ADMIN" title={t('adm.title')} lead={t('adm.lead')}>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle
            ariaLabel={t('common.filter')}
            value={tab}
            onChange={setTab}
            options={TABS.map(key => ({ value: key, label: t(`adm.tab.${key}` as any) }))}
          />
          <span className="label">{t('auth.signedas')} <span className="text-accent">{user.email}</span></span>
        </div>
      </PageHeader>

      {flash && <div className="mb-6"><Notice kind="ok">{t('adm.saved')}</Notice></div>}

      {tab === 'overview' && (
        <>
          {overview.loading && <Loading />}
          {overview.error && <ErrorBox onRetry={overview.reload} />}
          {overview.data && (
            <>
              <section className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-line">
                {Object.entries(overview.data.counts).map(([key, value], i) => (
                  <div key={key} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
                    <Stat value={formatNumber(value)} label={key.replace(/_/g, ' ')} />
                  </div>
                ))}
              </section>

              <section className="py-12 grid gap-8 lg:grid-cols-2">
                <Card className="p-6">
                  <h2 className="label mb-4">{t('adm.bookings')}</h2>
                  {overview.data.upcomingBookings.length === 0 && <Empty />}
                  <ul className="space-y-2.5">
                    {overview.data.upcomingBookings.map(booking => (
                      <li key={booking.id} className="flex flex-wrap items-baseline gap-3 py-2 border-b border-linesoft last:border-0">
                        <span className="num text-[12px] text-accent w-20">{formatDate(booking.date, { day: '2-digit', month: 'short' })}</span>
                        <span className="num text-[12px] w-24">{String(booking.start_hour).padStart(2, '0')}:00–{String(booking.end_hour).padStart(2, '0')}:00</span>
                        <span className="text-[13px] flex-1 min-w-[140px] truncate">{f(booking, 'instrument')}</span>
                        <span className="label truncate">{booking.user_name}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-6">
                  <h2 className="label mb-4">{t('adm.rsvps')}</h2>
                  {overview.data.rsvps.length === 0 && <Empty />}
                  <ul className="space-y-2.5">
                    {overview.data.rsvps.map(rsvp => (
                      <li key={rsvp.id} className="flex flex-wrap items-baseline gap-3 py-2 border-b border-linesoft last:border-0">
                        <span className="text-[13px] flex-1 min-w-[140px] truncate">{f(rsvp, 'event')}</span>
                        <span className="label truncate">{rsvp.name}</span>
                        <span className="num text-[11px] text-muted">{rsvp.email}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            </>
          )}
        </>
      )}

      {tab === 'publications' && (
        <PublicationEditor rows={publications.data?.items ?? []} onDone={() => done('pub')} />
      )}

      {tab === 'news' && <NewsEditor rows={news.data ?? []} onDone={() => done('news')} />}

      {tab === 'people' && <PeopleEditor rows={people.data ?? []} onDone={() => done('people')} />}

      {tab === 'inbox' && overview.data && (
        <div className="grid gap-8 lg:grid-cols-2">
          {inbox.notice && (
            <div className="lg:col-span-2"><Notice kind={inbox.notice.kind}>{inbox.notice.text}</Notice></div>
          )}
          <Card className="p-6">
            <h2 className="label mb-4">{t('adm.applications')}</h2>
            {overview.data.recentApplications.length === 0 && (
              <p className="text-[13px] text-muted py-4">{t('adm.noapplications')}</p>
            )}
            <ul className="space-y-4">
              {overview.data.recentApplications.map(application => (
                <li key={application.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip chip-on">{application.status}</span>
                    <span className="label ml-auto">{formatDate(application.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h3 className="mt-2.5 text-[15px]">{application.name}</h3>
                  <p className="num text-[12px] text-muted">{application.email}</p>
                  <p className="label mt-1.5">{f(application, 'position')}</p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink2 line-clamp-3">{application.motivation}</p>
                  {application.cv_filename && (
                    <p className="label mt-2">CV · {Math.round((application.cv_size ?? 0) / 1024)} KB</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {['shortlisted', 'invited', 'rejected'].map(status => (
                      <button
                        key={status}
                        className="btn btn-sm"
                        onClick={() => inbox.run(
                          () => put(`/admin/applications/${application.id}/status`, { status }),
                          t('adm.saved')
                        )}
                        disabled={inbox.busy}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="label mb-4">{t('adm.messages')}</h2>
            {overview.data.messages.length === 0 && (
              <p className="text-[13px] text-muted py-4">{t('adm.nomessages')}</p>
            )}
            <ul className="space-y-4">
              {overview.data.messages.map(message => (
                <li key={message.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${message.handled ? '' : 'chip-on'}`}>
                      {message.handled ? t('adm.handled') : t('adm.unread')}
                    </span>
                    <span className="label ml-auto">{formatDate(message.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h3 className="mt-2.5 text-[15px]">{message.subject}</h3>
                  <p className="num text-[12px] text-muted">{message.name} · {message.email}</p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink2">{message.body}</p>
                  {!message.handled && (
                    <button
                      className="btn btn-sm mt-3"
                      onClick={() => inbox.run(
                        () => put(`/admin/messages/${message.id}/handled`, { handled: true }),
                        t('adm.saved')
                      )}
                      disabled={inbox.busy}
                    >
                      {t('adm.markread')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- EDITORS -- */

const EMPTY_PUB = { title: '', authors: '', venue: '', year: new Date().getFullYear(), type: 'article', doi: '', citations: 0, open_access: 1, keywords: '' };

function PublicationEditor({ rows, onDone }: { rows: Pub[]; onDone: () => void }) {
  const { t } = useLang();
  const [draft, setDraft] = useState<any>(EMPTY_PUB);
  const [editing, setEditing] = useState<number | null>(null);
  const { run, busy, notice } = useMutation(onDone);

  const save = async () => {
    const ok = await run(
      () => (editing ? put(`/admin/publications/${editing}`, draft) : post('/admin/publications', draft)),
      t('adm.saved')
    );
    if (!ok) return;                       // keep the draft so nothing is lost
    setDraft(EMPTY_PUB);
    setEditing(null);
  };

  const remove = (id: number) => {
    if (!confirm(t('adm.confirmdelete'))) return;
    run(() => del(`/admin/publications/${id}`), t('adm.saved'));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div>
        <h2 className="label mb-4">{rows.length} {t('pub.title')}</h2>
        <ul className="space-y-2.5">
          {rows.map(row => (
            <li key={row.id}>
              <Card className="p-4 flex flex-wrap items-baseline gap-4">
                <span className="num text-accent text-[13px] w-10 shrink-0">{row.year}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] leading-snug">{row.title}</h3>
                  <p className="label mt-1 truncate">{row.authors} · {row.venue}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn btn-sm" onClick={() => { setDraft(row); setEditing(row.id); }}>{t('common.edit')}</button>
                  <button className="btn btn-sm" onClick={() => remove(row.id)}>{t('common.delete')}</button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <Card className="p-6 lg:sticky lg:top-28">
        <h2 className="label mb-4">{editing ? t('common.edit') : t('adm.new')}</h2>
        {notice && <div className="mb-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}
        <div className="space-y-4">
          <Field label={t('pub.sort.title')} required>
            <input className="input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label={t('adm.authors')} required hint="Surname I, Surname I">
            <input className="input" value={draft.authors} onChange={e => setDraft({ ...draft, authors: e.target.value })} />
          </Field>
          <Field label={t('adm.venue')} required>
            <input className="input" value={draft.venue} onChange={e => setDraft({ ...draft, venue: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.year')}>
              <input className="input num" type="number" value={draft.year} onChange={e => setDraft({ ...draft, year: Number(e.target.value) })} />
            </Field>
            <Field label={t('pub.sort.citations')}>
              <input className="input num" type="number" value={draft.citations} onChange={e => setDraft({ ...draft, citations: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="DOI">
            <input className="input num" value={draft.doi ?? ''} onChange={e => setDraft({ ...draft, doi: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 justify-center" onClick={save} disabled={busy || !draft.title || !draft.authors || !draft.venue}>
              {t('common.save')}
            </button>
            {editing && (
              <button className="btn" onClick={() => { setDraft(EMPTY_PUB); setEditing(null); }}>{t('common.cancel')}</button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

const EMPTY_NEWS = { title_mk: '', title_en: '', excerpt_mk: '', excerpt_en: '', body_mk: '', body_en: '', tag: 'news', date: new Date().toISOString().slice(0, 10) };

function NewsEditor({ rows, onDone }: { rows: NewsRow[]; onDone: () => void }) {
  const { t, f, formatDate } = useLang();
  const [draft, setDraft] = useState<any>(EMPTY_NEWS);
  const [editing, setEditing] = useState<number | null>(null);
  const { run, busy, notice } = useMutation(onDone);

  const save = async () => {
    const ok = await run(
      () => (editing ? put(`/admin/news/${editing}`, draft) : post('/admin/news', draft)),
      t('adm.saved')
    );
    if (!ok) return;
    setDraft(EMPTY_NEWS);
    setEditing(null);
  };

  const remove = (id: number) => {
    if (!confirm(t('adm.confirmdelete'))) return;
    run(() => del(`/admin/news/${id}`), t('adm.saved'));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div>
        <h2 className="label mb-4">{rows.length} {t('news.title')}</h2>
        <ul className="space-y-2.5">
          {rows.map(row => (
            <li key={row.id}>
              <Card className="p-4 flex flex-wrap items-baseline gap-4">
                <span className="label w-24 shrink-0">{formatDate(row.date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] leading-snug">{f(row, 'title')}</h3>
                  <span className="chip mt-1.5">{row.tag}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn btn-sm" onClick={() => { setDraft(row); setEditing(row.id); }}>{t('common.edit')}</button>
                  <button className="btn btn-sm" onClick={() => remove(row.id)}>{t('common.delete')}</button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <Card className="p-6 lg:sticky lg:top-28">
        <h2 className="label mb-4">{editing ? t('common.edit') : t('adm.new')}</h2>
        {notice && <div className="mb-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}
        <div className="space-y-4">
          <Field label="Наслов (MK)" required>
            <input className="input" lang="mk" value={draft.title_mk} onChange={e => setDraft({ ...draft, title_mk: e.target.value })} />
          </Field>
          <Field label="Title (EN)" required>
            <input className="input" lang="en" value={draft.title_en} onChange={e => setDraft({ ...draft, title_en: e.target.value })} />
          </Field>
          <Field label={`${t('adm.excerpt')} (MK)`}>
            <textarea className="input" rows={2} lang="mk" value={draft.excerpt_mk ?? ''} onChange={e => setDraft({ ...draft, excerpt_mk: e.target.value })} />
          </Field>
          <Field label={`${t('adm.excerpt')} (EN)`}>
            <textarea className="input" rows={2} lang="en" value={draft.excerpt_en ?? ''} onChange={e => setDraft({ ...draft, excerpt_en: e.target.value })} />
          </Field>
          <Field label={`${t('adm.body')} (MK)`}>
            <textarea className="input" rows={3} lang="mk" value={draft.body_mk ?? ''} onChange={e => setDraft({ ...draft, body_mk: e.target.value })} />
          </Field>
          <Field label={`${t('adm.body')} (EN)`}>
            <textarea className="input" rows={3} lang="en" value={draft.body_en ?? ''} onChange={e => setDraft({ ...draft, body_en: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.date')}>
              <input className="input num" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
            </Field>
            <Field label="tag">
              <select className="input" value={draft.tag} onChange={e => setDraft({ ...draft, tag: e.target.value })}>
                {['news', 'publication', 'grant', 'outreach', 'facility', 'award', 'people'].map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 justify-center" onClick={save} disabled={busy || !draft.title_mk || !draft.title_en}>
              {t('common.save')}
            </button>
            {editing && <button className="btn" onClick={() => { setDraft(EMPTY_NEWS); setEditing(null); }}>{t('common.cancel')}</button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

const EMPTY_PERSON = { name_mk: '', name_en: '', role_mk: '', role_en: '', seniority: 'phd', email: '', joined_year: new Date().getFullYear(), hue: 140 };

function PeopleEditor({ rows, onDone }: { rows: PersonRow[]; onDone: () => void }) {
  const { t, f } = useLang();
  const [draft, setDraft] = useState<any>(EMPTY_PERSON);
  const [editing, setEditing] = useState<number | null>(null);
  const { run, busy, notice } = useMutation(onDone);

  const save = async () => {
    const ok = await run(
      () => (editing ? put(`/admin/people/${editing}`, draft) : post('/admin/people', draft)),
      t('adm.saved')
    );
    if (!ok) return;
    setDraft(EMPTY_PERSON);
    setEditing(null);
  };

  const remove = (id: number) => {
    if (!confirm(t('adm.confirmdelete'))) return;
    run(() => del(`/admin/people/${id}`), t('adm.saved'));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div>
        <h2 className="label mb-4">{rows.length} {t('team.title')}</h2>
        <ul className="space-y-2.5">
          {rows.map(row => (
            <li key={row.id}>
              <Card className="p-4 flex flex-wrap items-baseline gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px]">{f(row, 'name')}</h3>
                  <p className="label mt-1">{f(row, 'role')} · {row.seniority}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn btn-sm" onClick={() => { setDraft(row); setEditing(row.id); }}>{t('common.edit')}</button>
                  <button className="btn btn-sm" onClick={() => remove(row.id)}>{t('common.delete')}</button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <Card className="p-6 lg:sticky lg:top-28">
        <h2 className="label mb-4">{editing ? t('common.edit') : t('adm.new')}</h2>
        {notice && <div className="mb-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}
        <div className="space-y-4">
          <Field label="Име (MK)" required>
            <input className="input" lang="mk" value={draft.name_mk} onChange={e => setDraft({ ...draft, name_mk: e.target.value })} />
          </Field>
          <Field label="Name (EN)" required>
            <input className="input" lang="en" value={draft.name_en} onChange={e => setDraft({ ...draft, name_en: e.target.value })} />
          </Field>
          <Field label="Улога (MK)">
            <input className="input" lang="mk" value={draft.role_mk ?? ''} onChange={e => setDraft({ ...draft, role_mk: e.target.value })} />
          </Field>
          <Field label={`${t('adm.role')} (EN)`}>
            <input className="input" lang="en" value={draft.role_en ?? ''} onChange={e => setDraft({ ...draft, role_en: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="seniority">
              <select className="input" value={draft.seniority} onChange={e => setDraft({ ...draft, seniority: e.target.value })}>
                {['faculty', 'postdoc', 'staff', 'phd', 'msc'].map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
            <Field label={t('team.since')}>
              <input className="input num" type="number" value={draft.joined_year} onChange={e => setDraft({ ...draft, joined_year: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label={t('common.email')}>
            <input className="input" type="email" value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 justify-center" onClick={save} disabled={busy || !draft.name_mk || !draft.name_en}>
              {t('common.save')}
            </button>
            {editing && <button className="btn" onClick={() => { setDraft(EMPTY_PERSON); setEditing(null); }}>{t('common.cancel')}</button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
