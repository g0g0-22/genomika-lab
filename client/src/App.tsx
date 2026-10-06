import { Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import { useLang } from './i18n';

import Home from './pages/Home';
import Research from './pages/Research';
import GroupDetail from './pages/GroupDetail';
import Team from './pages/Team';
import PersonDetail from './pages/PersonDetail';
import Publications from './pages/Publications';
import Datasets from './pages/Datasets';
import News from './pages/News';
import Events from './pages/Events';
import Facilities from './pages/Facilities';
import Careers from './pages/Careers';
import Contact from './pages/Contact';
import Metrics from './pages/Metrics';
import Login from './pages/Login';
import Admin from './pages/admin/Admin';

import ToolsHub from './pages/Tools';
import Toolkit from './pages/tools/Toolkit';
import Alignment from './pages/tools/Alignment';
import Gel from './pages/tools/Gel';
import Phylogeny from './pages/tools/Phylogeny';
import Composition from './pages/tools/Composition';

function NotFound() {
  const { t } = useLang();
  return (
    <div className="py-24 text-center">
      <p className="num text-accent text-6xl">404</p>
      <h1 className="mt-6 text-3xl">{t('err.404.title')}</h1>
      <p className="mt-3 text-muted max-w-md mx-auto">{t('err.404.body')}</p>
      <Link to="/" className="btn btn-primary mt-8">{t('err.404.home')}</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="research" element={<Research />} />
        <Route path="research/:slug" element={<GroupDetail />} />
        <Route path="team" element={<Team />} />
        <Route path="team/:slug" element={<PersonDetail />} />
        <Route path="publications" element={<Publications />} />
        <Route path="datasets" element={<Datasets />} />
        <Route path="news" element={<News />} />
        <Route path="events" element={<Events />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="careers" element={<Careers />} />
        <Route path="contact" element={<Contact />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="login" element={<Login />} />
        <Route path="admin" element={<Admin />} />

        <Route path="tools" element={<ToolsHub />} />
        <Route path="tools/toolkit" element={<Toolkit />} />
        <Route path="tools/alignment" element={<Alignment />} />
        <Route path="tools/gel" element={<Gel />} />
        <Route path="tools/phylogeny" element={<Phylogeny />} />
        <Route path="tools/composition" element={<Composition />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
