import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { RefreshCw, TrendingUp, Newspaper, BarChart3, ExternalLink, Shield, ShieldAlert, Filter, Heart, MessageCircle, Eye, Repeat2, Target, Search, X } from 'lucide-react';
import { SpotlightCard } from '../components/ui/Spotlight';
import { TextGenerateEffect } from '../components/ui/TextGenerateEffect';
import { Meteors } from '../components/ui/Meteors';

function ScoreBadge({ score }) {
  const cls = score >= 8 ? 'score-high' : score >= 5 ? 'score-medium' : 'score-low';
  return <div className={`score-badge ${cls}`}>{score}</div>;
}

function SourceTag({ source }) {
  const colors = {
    web: 'bg-neon-blue/10 text-neon-blue border-neon-blue/20',
    twitter: 'bg-aurora-cyan/10 text-aurora-cyan border-aurora-cyan/20',
    rss: 'bg-aurora-purple/10 text-aurora-purple border-aurora-purple/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[source] || colors.web}`}>
      {source}
    </span>
  );
}

function HotspotCard({ item }) {
  let rawData = null;
  let aiData = null;
  try { rawData = item.raw_data ? JSON.parse(item.raw_data) : null; } catch {}
  try { aiData = item.ai_analysis ? JSON.parse(item.ai_analysis) : null; } catch {}

  const engagement = rawData?.engagement;
  const author = rawData?.author;
  const confidence = aiData?.confidence;
  const keyword = item.keyword_text || item.keyword;

  const formatNum = (n) => {
    if (n == null) return null;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  return (
    <SpotlightCard className="glass-card p-5 animate-fade-in">
      {/* External link */}
      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-aurora-cyan transition-all"
          title="查看原文"
        >
          <ExternalLink size={16} />
        </a>
      )}

      <div className="relative z-10 flex items-start gap-4 pr-8">
        <ScoreBadge score={item.heat_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <SourceTag source={item.source} />
            {keyword && (
              <span className="text-xs bg-aurora-purple/8 text-aurora-purple/90 px-2 py-0.5 rounded-md border border-aurora-purple/15">
                {keyword}
              </span>
            )}
            {item.is_verified ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Shield size={12} /> 已验证
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <ShieldAlert size={12} /> 未验证
              </span>
            )}
            <span className="text-xs text-slate-600 ml-auto whitespace-nowrap">
              {item.published_at ? new Date(item.published_at).toLocaleString('zh-CN') : ''}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">
            {item.title}
          </h3>
          {item.summary && (
            <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-3">{item.summary}</p>
          )}

          {/* Bottom info bar */}
          <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-slate-200">
            {confidence != null && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Target size={12} className="text-aurora-cyan" />
                <span className="text-slate-700 font-medium">{Math.round(confidence * 100)}%</span>
              </span>
            )}
            {engagement && item.source === 'twitter' && (
              <>
                {engagement.likes != null && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Heart size={12} className="text-rose-500" />
                    <span className="text-slate-600">{formatNum(engagement.likes)}</span>
                  </span>
                )}
                {engagement.replies != null && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MessageCircle size={12} className="text-aurora-cyan" />
                    <span className="text-slate-600">{formatNum(engagement.replies)}</span>
                  </span>
                )}
                {engagement.retweets != null && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Repeat2 size={12} className="text-emerald-600" />
                    <span className="text-slate-600">{formatNum(engagement.retweets)}</span>
                  </span>
                )}
                {engagement.views != null && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Eye size={12} className="text-aurora-purple" />
                    <span className="text-slate-600">{formatNum(engagement.views)}</span>
                  </span>
                )}
              </>
            )}
            {author?.name && (
              <span className="text-xs text-slate-600 ml-auto">
                by <span className="text-slate-500">{author.name}</span>
                {author.username && <span className="text-slate-600"> @{author.username}</span>}
              </span>
            )}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

export default function Dashboard() {
  const { lastMessage } = useOutletContext();
  const [hotspots, setHotspots] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ source: '', verified_only: false, min_score: '' });
  const [keywords, setKeywords] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const params = { page, limit: 20 };
      if (filters.source) params.source = filters.source;
      if (filters.verified_only) params.verified_only = true;
      if (filters.min_score) params.min_score = filters.min_score;
      if (selectedKeyword) params.keyword_id = selectedKeyword;
      if (searchQuery) params.search = searchQuery;

      const [hotspotsRes, statsRes, kwRes] = await Promise.all([
        api.getHotspots(params),
        api.getStats(),
        api.getKeywords(),
      ]);
      setHotspots(hotspotsRes.data || []);
      setTotal(hotspotsRes.pagination?.total || 0);
      setStats(statsRes);
      setKeywords(kwRes || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, filters, selectedKeyword, searchQuery]);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [page, filters, selectedKeyword, searchQuery]);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage;
    if (
      type === 'new_hotspot' ||
      type === 'keyword-hit' ||
      (type === 'scan-progress' && data?.status === 'completed')
    ) {
      fetchData();
    }
    if (type === 'scan-progress') {
      if (data?.status === 'started') setRefreshing(true);
      if (data?.status === 'completed' || data?.status === 'error') setRefreshing(false);
    }
  }, [lastMessage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshHotspots();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <TextGenerateEffect
            words="热点雷达"
            className="text-2xl lg:text-3xl font-bold text-gradient"
          />
          <p className="text-sm text-slate-500 mt-1.5">实时追踪 AI 领域最新动态</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? '扫描中...' : '立即扫描'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: TrendingUp, label: '今日热点', value: stats.todayHotspots, color: 'text-aurora-cyan', glow: '#16a34a' },
            { icon: Newspaper, label: '总热点数', value: stats.totalHotspots, color: 'text-aurora-purple', glow: '#059669' },
            { icon: BarChart3, label: '平均热度', value: stats.avgScore ? Number(stats.avgScore).toFixed(1) : '0', color: 'text-aurora-pink', glow: '#ec4899' },
            { icon: Filter, label: '监控词数', value: stats.keywordCount, color: 'text-aurora-green', glow: '#22c55e' },
          ].map((s, i) => (
            <div
              key={i}
              className={`stat-card animate-fade-in stagger-${i + 1}`}
              style={{ '--glow-color': s.glow }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-green-50 ${s.color}`}>
                  <s.icon size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800 tracking-tight">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSearchQuery(searchInput.trim()); setPage(1); } }}
              placeholder="搜索热点，如：GPT-5、DeepSeek、AI编程..."
              className="input-dark w-full pl-10 pr-10 text-sm"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => { setSearchQuery(searchInput.trim()); setPage(1); }}
            className="btn-primary text-sm px-4 py-2 whitespace-nowrap flex items-center gap-1.5"
          >
            <Search size={14} />
            搜索
          </button>
        </div>
        {searchQuery && (
          <div className="mt-2 text-xs text-slate-500">
            搜索结果：<span className="text-aurora-cyan">"{searchQuery}"</span> 共 <span className="text-slate-700 font-medium">{total}</span> 条
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="input-dark w-auto text-sm"
            value={selectedKeyword}
            onChange={e => { setSelectedKeyword(e.target.value); setPage(1); }}
          >
            <option value="">全部关键词</option>
            {keywords.map(k => (
              <option key={k.id} value={k.id}>{k.keyword}</option>
            ))}
          </select>
          <select
            className="input-dark w-auto text-sm"
            value={filters.source}
            onChange={e => { setFilters(f => ({ ...f, source: e.target.value })); setPage(1); }}
          >
            <option value="">全部来源</option>
            <option value="web">Web</option>
            <option value="twitter">Twitter</option>
            <option value="rss">RSS</option>
          </select>
          <select
            className="input-dark w-auto text-sm"
            value={filters.min_score}
            onChange={e => { setFilters(f => ({ ...f, min_score: e.target.value })); setPage(1); }}
          >
            <option value="">全部热度</option>
            <option value="8">🔥 高热 (≥8)</option>
            <option value="5">⭐ 中等 (≥5)</option>
            <option value="3">📌 低热 (≥3)</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.verified_only}
              onChange={e => { setFilters(f => ({ ...f, verified_only: e.target.checked })); setPage(1); }}
              className="accent-aurora-cyan"
            />
            仅已验证
          </label>
        </div>
      </div>

      {/* Hotspot List */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
          加载中...
        </div>
      ) : hotspots.length === 0 ? (
        <div className="relative text-center py-24 glass-card overflow-hidden">
          <div className="relative z-10">
            <RadarIcon size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">暂无热点数据</p>
            <p className="text-sm text-slate-400 mt-1">点击「立即扫描」开始获取热点</p>
          </div>
          <Meteors number={8} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hotspots.map(item => (
            <HotspotCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            className="btn-ghost text-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            className="btn-ghost text-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

function RadarIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/></svg>
  );
}
