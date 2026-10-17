import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { PageHeader, Card, Label, DnaStrip } from '../components/ui';
import { ENZYMES } from '../lib/bio/enzymes';
import type { DictKey } from '../i18n/dict';

const TOOLS: { to: string; name: DictKey; desc: DictKey; glyph: string; tags: string[] }[] = [
  { to: '/tools/toolkit',     name: 'tool.toolkit.name', desc: 'tool.toolkit.desc', glyph: 'ATG', tags: ['ORF', 'GC%', 'Tm', 'translate'] },
  { to: '/tools/gel',         name: 'tool.gel.name',     desc: 'tool.gel.desc',     glyph: '≡',   tags: ['EcoRI', 'BamHI', 'HinfI', `+${ENZYMES.length - 3}`] }
];

export default function ToolsHub() {
  const { t } = useLang();
  return (
    <>
      <PageHeader index="05 / TOOLS" title={t('tools.title')} lead={t('tools.lead')}>
        <span className="chip chip-on">🔒 {t('tools.local')}</span>
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-2">
        {TOOLS.map((tool, i) => (
          <Link key={tool.to} to={tool.to} className="rise block" style={{ animationDelay: `${i * 70}ms` }}>
            <Card hover className="p-6 h-full">
              <div className="flex items-start gap-5">
                <span className="num text-2xl text-accent shrink-0 w-12">{tool.glyph}</span>
                <div className="min-w-0">
                  <Label>{String(i + 1).padStart(2, '0')}</Label>
                  <h2 className="mt-1 text-xl">{t(tool.name)}</h2>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink2">{t(tool.desc)}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tool.tags.map(tag => <span key={tag} className="chip">{tag}</span>)}
                  </div>
                </div>
              </div>
              <DnaStrip seed={tool.to} count={40} className="mt-6 opacity-50" />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
