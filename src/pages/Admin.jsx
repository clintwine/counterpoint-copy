import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Music, Activity, TrendingUp, Clock, BarChart3, FileMusic, Globe, ArrowUp, ArrowDown, ArrowUpDown, Search, MessageSquare, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function SortIcon({ col, sortKey, dir }) {
  if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 text-amber-400 inline" />
    : <ArrowDown className="w-3 h-3 ml-1 text-amber-400 inline" />;
}

function SortableTh({ col, label, sortKey, sortDir, onSort, className = '' }) {
  return (
    <th
      className={`text-left text-slate-400 font-medium px-4 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      {label}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );
}

export default function Admin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [songs, setSongs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);

  // Users table state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSubFilter, setUserSubFilter] = useState('all');
  const [userSort, setUserSort] = useState({ key: 'created_date', dir: 'desc' });

  // Activity table state
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [activitySort, setActivitySort] = useState({ key: 'updated', dir: 'desc' });

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user?.role === 'admin') loadData();
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async () => {
    try {
      const [usersData, songsData, projectsData, instrumentsData, feedbackData] = await Promise.all([
        base44.entities.User.list('-created_date', 200),
        base44.entities.Song.list('-created_date', 500),
        base44.entities.CounterpointProject.list('-created_date', 500),
        base44.entities.CustomInstrument.list('-created_date', 500),
        base44.entities.Feedback.list('-created_date', 500),
      ]);
      setUsers(usersData);
      setSongs(songsData);
      setProjects(projectsData);
      setInstruments(instrumentsData);
      setFeedbackList(feedbackData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // --- Derived data (always computed, before any early returns) ---
  const projectsPerUser = useMemo(() => {
    const map = {};
    projects.forEach(p => { const e = p.created_by || 'Unknown'; map[e] = (map[e] || 0) + 1; });
    return map;
  }, [projects]);

  const instrumentsPerUser = useMemo(() => {
    const map = {};
    instruments.forEach(i => { const e = i.created_by || 'Unknown'; map[e] = (map[e] || 0) + 1; });
    return map;
  }, [instruments]);

  const lastActivityPerUser = useMemo(() => {
    const map = {};
    [...projects, ...songs].forEach(item => {
      const e = item.created_by;
      if (!e) return;
      const d = item.updated_date || item.created_date;
      if (!map[e] || new Date(d) > new Date(map[e])) map[e] = d;
    });
    return map;
  }, [projects, songs]);

  const now = Date.now();
  const msPerDay = 86400000;

  const buildDayBuckets = (items, dateField) => {
    const buckets = {};
    for (let i = 29; i >= 0; i--) {
      const key = new Date(now - i * msPerDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets[key] = 0;
    }
    items.forEach(item => {
      if (!item[dateField]) return;
      const d = new Date(item[dateField]);
      if (now - d.getTime() > 30 * msPerDay) return;
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (key in buckets) buckets[key]++;
    });
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  };

  const userGrowthData = useMemo(() => buildDayBuckets(users, 'created_date'), [users]);
  const projectActivityData = useMemo(() => buildDayBuckets(projects, 'created_date'), [projects]);

  const topUsers = useMemo(() =>
    Object.entries(projectsPerUser).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([email, count]) => ({ email, count }))
  , [projectsPerUser]);

  const speciesData = useMemo(() =>
    Object.entries(projects.reduce((acc, p) => { const s = p.settings?.species || 'Unknown'; acc[s] = (acc[s] || 0) + 1; return acc; }, {}))
      .sort((a, b) => b[1] - a[1]).map(([species, count]) => ({ species, count }))
  , [projects]);

  const applySort = (arr, key, dir) => {
    return [...arr].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va;
      const da = Date.parse(va), db = Date.parse(vb);
      if (!isNaN(da) && !isNaN(db)) return dir === 'asc' ? da - db : db - da;
      return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  };

  const toggleSort = (current, col, setter) => {
    setter(prev => ({ key: col, dir: prev.key === col && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const usersEnriched = useMemo(() => users.map(u => ({
    ...u,
    projectCount: projectsPerUser[u.email] || 0,
    instrumentCount: instrumentsPerUser[u.email] || 0,
    lastActivity: lastActivityPerUser[u.email] || null,
  })), [users, projectsPerUser, instrumentsPerUser, lastActivityPerUser]);

  const filteredUsers = useMemo(() => {
    const list = usersEnriched.filter(u => {
      const q = userSearch.toLowerCase();
      const matchSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchRole = userRoleFilter === 'all' || (u.role || 'user') === userRoleFilter;
      const matchSub = userSubFilter === 'all' || (u.subscription || 'free') === userSubFilter;
      return matchSearch && matchRole && matchSub;
    });
    return applySort(list, userSort.key, userSort.dir);
  }, [usersEnriched, userSearch, userRoleFilter, userSubFilter, userSort]);

  const allActivity = useMemo(() => [
    ...projects.map(p => ({ type: 'project', name: p.name || 'Untitled', user: p.created_by || '—', created: p.created_date, updated: p.updated_date || p.created_date })),
    ...songs.map(s => ({ type: 'song', name: s.name || 'Untitled', user: s.created_by || '—', created: s.created_date, updated: s.updated_date || s.created_date })),
  ], [projects, songs]);

  const filteredActivity = useMemo(() => {
    const list = allActivity.filter(item => {
      const q = activitySearch.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.user.toLowerCase().includes(q);
      const matchType = activityTypeFilter === 'all' || item.type === activityTypeFilter;
      return matchSearch && matchType;
    });
    return applySort(list, activitySort.key, activitySort.dir);
  }, [allActivity, activitySearch, activityTypeFilter, activitySort]);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1E1E1E]">
      <div className="w-8 h-8 border-4 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );

  if (!currentUser || currentUser.role !== 'admin') return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1E1E1E]">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400">This page is only available to administrators.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1E1E] via-[#232323] to-[#1A1A1A] p-6 text-white">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">Usage analytics & user management</p>
          </div>
          <Badge className="ml-auto bg-amber-500/20 text-amber-400 border-amber-500/30">Admin Only</Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Paid Users', value: users.filter(u => u.subscription === 'paid').length, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Public Songs', value: songs.length, icon: Music, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Projects Saved', value: projects.length, icon: FileMusic, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Custom Instruments', value: instruments.length, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <div className={`text-3xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-slate-800/60 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Overview</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Activity ({allActivity.length})</TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Feedback ({feedbackList.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" /> New Users (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#60a5fa' }} />
                      <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <FileMusic className="w-4 h-4 text-amber-400" /> Projects Created (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={projectActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#f59e0b' }} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {speciesData.length > 0 && (
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-green-400" /> Most Used Counterpoint Species
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {speciesData.map(({ species, count }) => (
                      <div key={species} className="bg-slate-700/50 rounded-lg px-4 py-2 text-center min-w-[80px]">
                        <div className="text-lg font-bold text-green-400">{count}</div>
                        <div className="text-xs text-slate-400 capitalize">{species} Species</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" /> Top Users by Projects Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topUsers.length === 0 && <p className="text-slate-500 text-sm">No data yet.</p>}
                  {topUsers.map(({ email, count }, i) => (
                    <div key={email} className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-5">{i + 1}</span>
                      <div className="flex-1 bg-slate-700/40 rounded-full h-6 overflow-hidden">
                        <div className="h-full bg-purple-500/60 rounded-full flex items-center px-3 transition-all"
                          style={{ width: `${Math.max(10, (count / (topUsers[0]?.count || 1)) * 100)}%` }}>
                          <span className="text-xs text-white truncate">{email}</span>
                        </div>
                      </div>
                      <span className="text-purple-400 text-xs font-bold w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> All Users
                  </CardTitle>
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Search name or email…"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="pl-7 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                    />
                  </div>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="h-8 w-32 bg-slate-700 border-slate-600 text-white text-xs">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="all" className="text-white text-xs">All Roles</SelectItem>
                      <SelectItem value="admin" className="text-white text-xs">Admin</SelectItem>
                      <SelectItem value="user" className="text-white text-xs">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userSubFilter} onValueChange={setUserSubFilter}>
                    <SelectTrigger className="h-8 w-32 bg-slate-700 border-slate-600 text-white text-xs">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="all" className="text-white text-xs">All Plans</SelectItem>
                      <SelectItem value="paid" className="text-white text-xs">Paid</SelectItem>
                      <SelectItem value="free" className="text-white text-xs">Free</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-slate-500 text-xs">{filteredUsers.length} results</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <SortableTh col="full_name" label="User" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="role" label="Role" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="subscription" label="Plan" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="projectCount" label="Projects" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="instrumentCount" label="Instruments" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="lastActivity" label="Last Activity" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                        <SortableTh col="created_date" label="Joined" sortKey={userSort.key} sortDir={userSort.dir} onSort={col => toggleSort(userSort, col, setUserSort)} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{u.full_name || '—'}</div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}>
                              {u.role || 'user'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={u.subscription === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}>
                              {u.subscription === 'paid' ? '✦ Paid' : 'Free'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{u.projectCount}</td>
                          <td className="px-4 py-3 text-slate-300">{u.instrumentCount}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.lastActivity)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.created_date)}</td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users match your filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-400" /> Activity
                  </CardTitle>
                  <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Search name or user…"
                      value={activitySearch}
                      onChange={e => setActivitySearch(e.target.value)}
                      className="pl-7 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                    />
                  </div>
                  <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                    <SelectTrigger className="h-8 w-32 bg-slate-700 border-slate-600 text-white text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="all" className="text-white text-xs">All Types</SelectItem>
                      <SelectItem value="project" className="text-white text-xs">Projects</SelectItem>
                      <SelectItem value="song" className="text-white text-xs">Songs</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-slate-500 text-xs">{filteredActivity.length} results</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <SortableTh col="type" label="Type" sortKey={activitySort.key} sortDir={activitySort.dir} onSort={col => toggleSort(activitySort, col, setActivitySort)} />
                        <SortableTh col="name" label="Name" sortKey={activitySort.key} sortDir={activitySort.dir} onSort={col => toggleSort(activitySort, col, setActivitySort)} />
                        <SortableTh col="user" label="User" sortKey={activitySort.key} sortDir={activitySort.dir} onSort={col => toggleSort(activitySort, col, setActivitySort)} />
                        <SortableTh col="created" label="Created" sortKey={activitySort.key} sortDir={activitySort.dir} onSort={col => toggleSort(activitySort, col, setActivitySort)} />
                        <SortableTh col="updated" label="Last Updated" sortKey={activitySort.key} sortDir={activitySort.dir} onSort={col => toggleSort(activitySort, col, setActivitySort)} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivity.map((item, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3">
                            <Badge className={item.type === 'song' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                              {item.type === 'song' ? '🎵 Song' : '📁 Project'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{item.user}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(item.created)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(item.updated)}</td>
                        </tr>
                      ))}
                      {filteredActivity.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No activity matches your filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="mt-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" /> User Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 font-medium px-4 py-3">User</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Category</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Rating</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Message</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3 whitespace-nowrap">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedbackList.map((fb) => (
                        <tr key={fb.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs">{fb.created_by || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge className={{
                              bug: 'bg-red-500/20 text-red-400 border-red-500/30',
                              feature_request: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                              praise: 'bg-green-500/20 text-green-400 border-green-500/30',
                              general: 'bg-slate-700 text-slate-300 border-slate-600',
                            }[fb.category] || 'bg-slate-700 text-slate-300 border-slate-600'}>
                              {fb.category?.replace('_', ' ') || 'general'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {fb.rating ? (
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} className={`w-3.5 h-3.5 ${s <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                                ))}
                              </div>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-white max-w-md">{fb.message}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(fb.created_date)}</td>
                        </tr>
                      ))}
                      {feedbackList.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No feedback yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}