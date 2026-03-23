import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { RefreshCw, TrendingUp, Newspaper, BarChart3, ExternalLink, Shield, ShieldAlert, Filter, Heart, MessageCircle, Eye, Repeat2, Target, Search, X, ChevronDown, ArrowUpDown, Link2 } from 'lucide-react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { SpotlightCard } from '../components/ui/Spotlight';
import { TextGenerateEffect } from '../components/ui/TextGenerateEffect';
import { Meteors } from '../components/ui/Meteors';

function ScoreBadge({ rank }) {
  const cls = rank <= 3 ? 'score-high' : rank <= 10 ? 'score-medium' : 'score-low';
  return <div className={`score-badge ${cls}`} title={`当前排名 #${rank}`}>{rank}</div>;
}

function SourceTag({ source }) {
  const colors = {
    web: 'bg-neon-blue/10 text-neon-blue border-neon-blue/20',
    twitter: 'bg-aurora-cyan/10 text-aurora-cyan border-aurora-cyan/20',
    rss: 'bg-aurora-purple/10 text-aurora-purple border-aurora-purple/20',
    bilibili: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    weibo: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[source] || colors.web}`}>
      {source}
    </span>
  );
}

function HotspotCard({ item, rank }) {
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
      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-aurora-cyan transition-all"
          title="查看原文"
        >
          <ExternalLink size={16} />
        </a>
      )}

      <div className="relative z-10 flex items-start gap-4 pr-8">
        <ScoreBadge rank={rank} />
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
            {item.heat_score != null && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-600 border-orange-500/20 font-medium">
                热度 {item.heat_score}
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

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    const next = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
    onChange(next);
  };

  const display = selected.length ? `${label} (${selected.length})` : label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-dark w-auto text-sm flex items-center gap-1.5 cursor-pointer select-none"
      >
        {display}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 min-w-[160px] max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left text-xs text-slate-400 hover:text-aurora-cyan px-2.5 py-1 border-b border-slate-100 mb-1"
            >
              清除选择
            </button>
          )}
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-slate-300 text-aurora-cyan focus:ring-aurora-cyan/30"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function PushStatusBar() {
  const [isPushing, setIsPushing] = useState(false);
  const [isPushedAll, setIsPushedAll] = useState(false);

  useEffect(() => {
    if (window.pushStatusForDemo) {
      setIsPushing(window.pushStatusForDemo.isPushing);
      setIsPushedAll(window.pushStatusForDemo.isPushedAll);
    }
  });

  if (isPushing) {
    return (
      <div className="flex items-center gap-2 py-2 px-4 mb-2 bg-yellow-50 border border-yellow-100 rounded-lg w-fit mx-auto animate-fade-in">
        <Loader2 size={18} className="animate-spin text-yellow-500" />
        <span className="text-sm text-yellow-700 font-medium">推送中...</span>
      </div>
    );
  }
  if (isPushedAll) {
    return (
      <div className="flex items-center gap-2 py-2 px-4 mb-2 bg-emerald-50 border border-emerald-100 rounded-lg w-fit mx-auto animate-fade-in">
        <CheckCircle2 size={18} className="text-emerald-600" />
        <span className="text-sm text-emerald-700 font-medium">已全部推送</span>
      </div>
    );
  }
  return null;
}

function RadarIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/></svg>
  );
}

export default function Dashboard() {
  const { lastMessage } = useOutletContext();
  const [hotspots, setHotspots] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);
  const [sort, setSort] = useState('published_at');
  const [filters, setFilters] = useState({
    sources: [],
    keywords: [],
    min_score: '',
    max_score: '',
    time_range: 'all',
    has_url: false,
  });
  const [keywords, setKeywords] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanWarning, setScanWarning] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = { page, limit: 20, sort, verified_only: '1' };
      if (filters.sources.length) params.source = filters.sources.join(',');
      if (filters.min_score) params.min_score = filters.min_score;
      if (filters.max_score) params.max_score = filters.max_score;
      if (filters.keywords.length) params.keyword_id = filters.keywords.join(',');
      if (searchQuery) params.search = searchQuery;
      if (filters.time_range !== 'all') params.time_range = filters.time_range;
      if (filters.has_url) params.has_url = '1';

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
  }, [page, filters, sort, searchQuery]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchDataRef.current(), 60000);
    return () => clearInterval(interval);
  }, []);

  const stopCountdown = useCallback(() => {
    setRefreshing(false);
    setCountdown(0);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setRefreshing(true);
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopCountdown();
          fetchDataRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopCountdown]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const filtersRef = useRef({ filters, searchQuery });
  useEffect(() => {
    filtersRef.current = { filters, searchQuery };
  }, [filters, searchQuery]);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage;
    if (type === 'new_hotspot' && data) {
      const { filters: f, searchQuery: sq } = filtersRef.current;
      const matchesKeyword = !f.keywords.length || f.keywords.includes(String(data.keyword_id));
      const matchesSource = !f.sources.length || f.sources.includes(data.source);
      const matchesScore = (!f.min_score || data.heat_score >= Number(f.min_score)) && (!f.max_score || data.heat_score <= Number(f.max_score));
      const matchesVerified = data.is_verified;
      const matchesSearch = !sq || data.title?.toLowerCase().includes(sq.toLowerCase()) || data.summary?.toLowerCase().includes(sq.toLowerCase());
      const matchesUrl = !f.has_url || (data.source_url && data.source_url !== '');

      if (matchesKeyword && matchesSource && matchesScore && matchesVerified && matchesSearch && matchesUrl) {
        setHotspots(prev => [data, ...prev].slice(0, 20));
        setTotal(prev => prev + 1);
      }
      setStats(prev => prev ? {
        ...prev,
        todayHotspots: (prev.todayHotspots || 0) + 1,
        totalHotspots: (prev.totalHotspots || 0) + 1,
      } : prev);
    }
    if (type === 'scan-progress' && data?.status === 'completed') {
      fetchDataRef.current();
    }
    if (type === 'scan-progress') {
      if (data?.status === 'started') { if (!refreshing) startCountdown(); }
      if (data?.status === 'completed' || data?.status === 'error') stopCountdown();
      if (data?.status === 'no_keywords') {
        stopCountdown();
        setScanWarning('没有已启用的关键词，请先到「关键词管理」页面启用至少一个关键词');
        setTimeout(() => setScanWarning(''), 6000);
      }
    }
  }, [lastMessage]);

  const handleRefresh = async () => {
    startCountdown();
    try {
      await api.refreshHotspots();
    } catch (err) {
      console.error('Refresh failed:', err);
      stopCountdown();
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
          {refreshing ? `扫描中... ${countdown}s` : '立即扫描'}
        </button>
      </div>

      {/* Scan Warning */}
      {scanWarning && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {scanWarning}
        </div>
      )}

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
              placeholder="在已抓取的热点中筛选..."
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

      {/* Filter & Sort Bar */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-semibold text-slate-600 mr-2">筛选</span>
          <MultiSelect
            label="全部关键词"
            options={keywords.map(kw => ({ value: String(kw.id), label: kw.keyword }))}
            selected={filters.keywords}
            onChange={vals => { setFilters(f => ({ ...f, keywords: vals })); setPage(1); }}
          />
          <MultiSelect
            label="全部来源"
            options={[
              { value: 'web', label: 'Web' },
              { value: 'twitter', label: 'Twitter' },
              { value: 'rss', label: 'RSS' },
              { value: 'bilibili', label: 'B站' },
              { value: 'weibo', label: '微博' },
            ]}
            selected={filters.sources}
            onChange={vals => { setFilters(f => ({ ...f, sources: vals })); setPage(1); }}
          />
          <MultiSelect
            label="全部时间"
            options={[
              { value: 'today', label: '今天' },
              { value: '3days', label: '3天内' },
              { value: '7days', label: '7天内' },
            ]}
            selected={filters.time_range === 'all' ? [] : [filters.time_range]}
            onChange={vals => { setFilters(f => ({ ...f, time_range: vals.length ? vals[vals.length - 1] : 'all' })); setPage(1); }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">热度</span>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="0"
              value={filters.min_score}
              onChange={e => { setFilters(f => ({ ...f, min_score: e.target.value })); setPage(1); }}
              className="input-dark w-20 text-sm text-center"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="10"
              value={filters.max_score}
              onChange={e => { setFilters(f => ({ ...f, max_score: e.target.value })); setPage(1); }}
              className="input-dark w-20 text-sm text-center"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.has_url}
              onChange={e => { setFilters(f => ({ ...f, has_url: e.target.checked })); setPage(1); }}
              className="rounded border-slate-300 text-aurora-cyan focus:ring-aurora-cyan/30"
            />
            可访问原文
          </label>
        </div>
        {/* 排序 */}
        <div className="flex items-center gap-4 flex-wrap pt-3 border-t border-slate-100 mt-3">
          <span className="text-base font-semibold text-slate-600 mr-2">排序</span>
          <div className="flex items-center gap-2">
            {[
              { value: 'published_at', label: '最新发布' },
              { value: 'created_at', label: '最新发现' },
              { value: 'engagement', label: '互动数据' },
              { value: 'confidence', label: '相关性最高' },
            ].map(opt => (
              <button
                key={opt.value}
                className={`px-3 py-1 rounded border text-sm transition-colors ${sort === opt.value ? 'bg-aurora-cyan/90 text-white border-aurora-cyan' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                onClick={() => { setSort(opt.value); setPage(1); }}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 推送状态提示 */}
      <PushStatusBar />

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
          {hotspots.map((item, index) => (
            <HotspotCard key={item.id} item={item} rank={(page - 1) * 20 + index + 1} />
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
