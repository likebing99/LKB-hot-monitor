import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { Bell, BellOff, Check, CheckCheck } from 'lucide-react';
import { TextGenerateEffect } from '../components/ui/TextGenerateEffect';

export default function Notifications() {
  const { lastMessage, setUnread } = useOutletContext();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchNotifications = async () => {
    try {
      const params = { page, limit: 20 };
      if (filter === 'unread') params.unread_only = true;
      const res = await api.getNotifications(params);
      setNotifications(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [page, filter]);

  useEffect(() => {
    if (lastMessage?.type === 'new_hotspot') fetchNotifications();
  }, [lastMessage]);

  const handleMarkRead = async (id) => {
    try {
      await api.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <TextGenerateEffect words="通知中心" className="text-2xl font-bold text-gradient" />
          <p className="text-sm text-slate-500 mt-1.5">热点发现实时推送</p>
        </div>
        <button onClick={handleMarkAllRead} className="btn-ghost flex items-center gap-2 text-sm">
          <CheckCheck size={16} /> 全部已读
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: '全部' },
          { key: 'unread', label: '未读' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-aurora-cyan/8 text-aurora-cyan border border-aurora-cyan/15'
                : 'btn-ghost'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">加载中...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-24 glass-card">
          <BellOff size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">{filter === 'unread' ? '没有未读通知' : '暂无通知'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`glass-card p-4 animate-fade-in transition-all ${!n.is_read ? 'border-l-2 border-l-aurora-cyan' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${n.is_read ? 'text-slate-400 bg-slate-100' : 'text-aurora-cyan bg-aurora-cyan/8'}`}>
                  <Bell size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${n.is_read ? 'text-slate-500' : 'text-slate-800'}`}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{new Date(n.created_at).toLocaleString('zh-CN')}</span>
                    {n.hotspot_id && (
                      <span className="text-aurora-purple/70">#{n.hotspot_id}</span>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 text-slate-400 hover:text-aurora-cyan transition-colors rounded-lg hover:bg-slate-100"
                    title="标记已读"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button className="btn-ghost text-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            上一页
          </button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button className="btn-ghost text-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
