import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Music, Activity, TrendingUp, Clock, BarChart3, FileMusic, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

export default function Admin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [songs, setSongs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user?.role === 'admin') {
        loadData();
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async () => {
    try {
      const [usersData, songsData, projectsData, instrumentsData] = await Promise.all([
        base44.entities.User.list('-created_date', 100),
        base44.entities.Song.list('-created_date', 200),
        base44.entities.CounterpointProject.list('-created_date', 200),
        base44.entities.CustomInstrument.list('-created_date', 200),
      ]);
      setUsers(usersData);
      setSongs(songsData);
      setProjects(projectsData);
      setInstruments(instrumentsData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#1E1E1E]">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#1E1E1E]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  // --- Analytics computations ---
  const totalUsers = users.length;
  const totalSongs = songs.length;
  const totalProjects = projects.length;
  const totalInstruments = instruments.length;

  // Users joined per day (last 30 days)
  const now = Date.now();
  const msPerDay = 86400000;
  const usersByDay = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * msPerDay);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    usersByDay[key] = 0;
  }
  users.forEach(u => {
    if (!u.created_date) return;
    const d = new Date(u.created_date);
    if (now - d.getTime() > 30 * msPerDay) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in usersByDay) usersByDay[key]++;
  });
  const userGrowthData = Object.entries(usersByDay).map(([date, count]) => ({ date, count }));

  // Projects created per day (last 30 days)
  const projectsByDay = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * msPerDay);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    projectsByDay[key] = 0;
  }
  projects.forEach(p => {
    if (!p.created_date) return;
    const d = new Date(p.created_date);
    if (now - d.getTime() > 30 * msPerDay) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in projectsByDay) projectsByDay[key]++;
  });
  const projectActivityData = Object.entries(projectsByDay).map(([date, count]) => ({ date, count }));

  // Top users by project count
  const projectsPerUser = {};
  projects.forEach(p => {
    const email = p.created_by || 'Unknown';
    projectsPerUser[email] = (projectsPerUser[email] || 0) + 1;
  });
  const topUsers = Object.entries(projectsPerUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count]) => ({ email, count }));

  // Most used species in projects
  const speciesCount = {};
  projects.forEach(p => {
    const s = p.settings?.species || 'Unknown';
    speciesCount[s] = (speciesCount[s] || 0) + 1;
  });
  const speciesData = Object.entries(speciesCount)
    .sort((a, b) => b[1] - a[1])
    .map(([species, count]) => ({ species, count }));

  // Instruments per user
  const instrumentsPerUser = {};
  instruments.forEach(i => {
    const email = i.created_by || 'Unknown';
    instrumentsPerUser[email] = (instrumentsPerUser[email] || 0) + 1;
  });

  // Recent activity (last 20 projects + songs combined)
  const recentActivity = [
    ...projects.map(p => ({ type: 'project', name: p.name || 'Untitled', user: p.created_by, date: p.created_date, updated: p.updated_date })),
    ...songs.map(s => ({ type: 'song', name: s.name || 'Untitled', user: s.created_by, date: s.created_date, updated: s.updated_date })),
  ].sort((a, b) => new Date(b.updated || b.date) - new Date(a.updated || a.date)).slice(0, 25);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1E1E] via-[#232323] to-[#1A1A1A] p-6 text-white">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Public Songs', value: totalSongs, icon: Music, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Projects Saved', value: totalProjects, icon: FileMusic, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Custom Instruments', value: totalInstruments, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
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
            <TabsTrigger value="users" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Users</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Growth */}
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

              {/* Project Activity */}
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

            {/* Species Usage */}
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

            {/* Top Users by Projects */}
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
                        <div
                          className="h-full bg-purple-500/60 rounded-full flex items-center px-3 transition-all"
                          style={{ width: `${Math.max(10, (count / (topUsers[0]?.count || 1)) * 100)}%` }}
                        >
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
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> All Users ({totalUsers})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 font-medium px-4 py-3">User</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Role</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Projects</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Instruments</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
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
                          <td className="px-4 py-3 text-slate-300">{projectsPerUser[u.email] || 0}</td>
                          <td className="px-4 py-3 text-slate-300">{instrumentsPerUser[u.email] || 0}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.created_date)}</td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr>
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
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-400" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Type</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Name</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">User</th>
                        <th className="text-left text-slate-400 font-medium px-4 py-3">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((item, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3">
                            <Badge className={item.type === 'song' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                              {item.type === 'song' ? '🎵 Song' : '📁 Project'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{item.user || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(item.updated || item.date)}</td>
                        </tr>
                      ))}
                      {recentActivity.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No activity yet.</td></tr>
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