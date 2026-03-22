import { NavLink, Outlet } from 'react-router-dom';
import { Radar, Key, Bell, Settings, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { GridBackground } from './ui/GridBackground';

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
    { to: '/', icon: Radar, label: '仪表盘' },
    { to: '/keywords', icon: Key, label: '关键词' },
    { to: '/notifications', icon: Bell, label: '通知', badge: unread },
    { to: '/settings', icon: Settings, label: '设置' },
  ];

  return (
    <>
      <GridBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Floating Top Navbar - Desktop */}
        <header className="hidden lg:block sticky top-0 z-50">
          <div className="mx-auto max-w-6xl px-6 pt-4">
            <nav className="flex items-center justify-between px-6 py-3 rounded-2xl bg-dark-900/70 backdrop-blur-xl border border-[var(--color-glass-border)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurora-cyan to-aurora-purple flex items-center justify-center text-sm">
                  🔥
                </div>
                <span className="font-bold text-lg tracking-tight text-black">李柯兵AI热点监控工具</span>
                <div className="flex items-center gap-1.5 ml-3 px-2 py-1 rounded-md bg-green-50">
                  {connected ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-xs text-emerald-600">在线</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-xs text-red-500">离线</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-0.5 min-w-[18px] h-[18px] bg-aurora-pink/20 text-aurora-pink text-[11px] font-medium px-1 rounded-full flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 lg:px-8 pt-4 lg:pt-6 pb-24 lg:pb-10 overflow-auto">
          <Outlet context={{ lastMessage, setUnread }} />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-16 bg-dark-900/80 backdrop-blur-xl border-t border-[var(--color-glass-border)]">
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
