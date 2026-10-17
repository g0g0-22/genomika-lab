import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { NotFound } from './components/ui';

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
import Gel from './pages/tools/Gel';

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
        <Route path="tools/gel" element={<Gel />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
