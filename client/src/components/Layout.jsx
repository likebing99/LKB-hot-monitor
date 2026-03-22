import { NavLink, Outlet } from 'react-router-dom';
import { Radar, Key, Bell, Settings, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Layout() {
  const { connected, lastMessage } = useWebSocket();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.getNotifications({ unread_only: true, limit: 1 }).then(res => {
      setUnread(res.total || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'new_hotspot') {
      setUnread(prev => prev + 1);
    }
  }, [lastMessage]);

  const navItems = [
    { to: '/', icon: Radar, label: '热点雷达' },
    { to: '/keywords', icon: Key, label: '关键词' },
    { to: '/notifications', icon: Bell, label: '通知', badge: unread },
    { to: '/settings', icon: Settings, label: '设置' },
  ];

  return (
    <>
      <div className="aurora-bg" />
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex flex-col w-64 p-6 border-r border-[var(--color-glass-border)]">
          <div className="mb-10">
            <h1 className="neon-text text-xl font-bold tracking-tight">
              🔥 AI 热点监控
            </h1>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              {connected ? (
                <><Wifi size={12} className="text-emerald-400" /> 实时连接</>
              ) : (
                <><WifiOff size={12} className="text-red-400" /> 连接断开</>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto bg-aurora-pink/20 text-aurora-pink text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-6 text-xs text-slate-600">
            <div className="glass-card p-3">
              <p>每 30 分钟自动扫描</p>
              <p className="mt-1 text-slate-500">powered by AI</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 overflow-auto">
          <Outlet context={{ lastMessage, setUnread }} />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-16 bg-dark-900/90 backdrop-blur-lg border-t border-[var(--color-glass-border)]">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs transition-colors ${isActive ? 'text-aurora-cyan' : 'text-slate-500'}`
              }
            >
              <div className="relative">
                <item.icon size={20} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-aurora-pink text-white text-[10px] rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
