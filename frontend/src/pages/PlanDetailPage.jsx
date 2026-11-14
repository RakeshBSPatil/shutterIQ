import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client.js';
import RouteMap from '../components/RouteMap.jsx';
import {
  INCIDENT_OPTIONS,
  ROUTE_COLORS,
  WEATHER_OPTIONS,
  riskBadgeClasses,
} from '../constants/demo.js';

const SUGGESTED_QUESTIONS = [
  'Which shuttle departs earliest and why?',
  'Which route has the highest lateness risk and what extra buffer is suggested?',
  'How much distance and ride time did we save vs the sign-up-order roster?',
  'Are any riders unassigned or riding longer than 45 minutes?',
];

export default function PlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [activeTab, setActiveTab] = useState('insights');

  // Insights state
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [copiedRoute, setCopiedRoute] = useState('');

  // What-If state
  const [whatIfWeather, setWhatIfWeather] = useState('clear');
  const [whatIfIncident, setWhatIfIncident] = useState('none');
  const [removedVehicleIds, setRemovedVehicleIds] = useState([]);
  const [absentRiderIds, setAbsentRiderIds] = useState([]);
  const [runningWhatIf, setRunningWhatIf] = useState(false);
  const [whatIfOutput, setWhatIfOutput] = useState(null);
  const [showWhatIfOnMap, setShowWhatIfOnMap] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingChat, setSendingChat] = useState(false);

  const loadPlan = useCallback(async () => {
    setError('');
    try {
      const res = await apiClient.get(`/plans/${id}`);
      const loaded = res.data.plan;
      setPlan(loaded);
      setWhatIfWeather(loaded.conditions?.weather || 'clear');
      setWhatIfIncident(loaded.conditions?.incident || 'none');

      const initialExpanded = {};
      (loaded.result?.routes || []).forEach((r, idx) => {
        if (idx === 0) initialExpanded[r.vehicleId] = true;
      });
      setExpandedRoutes(initialExpanded);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load plan details'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  async function handleDeletePlan() {
    try {
      await apiClient.delete(`/plans/${id}`);
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete plan'));
    }
  }

  function toggleRouteCard(vehicleId) {
    setExpandedRoutes((prev) => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
  }

  async function handleGenerateInsights() {
    setGeneratingInsights(true);
    setError('');
    try {
      const res = await apiClient.post(`/plans/${id}/insights`);
      setPlan((prev) => ({ ...prev, insights: res.data.insights }));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to generate AI insights'));
    } finally {
      setGeneratingInsights(false);
    }
  }

  async function handleCopyMessage(route, message) {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedRoute(route);
      setTimeout(() => setCopiedRoute(''), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  }

  function toggleVehicleRemoval(vId) {
    setRemovedVehicleIds((prev) =>
      prev.includes(vId) ? prev.filter((item) => item !== vId) : [...prev, vId]
    );
  }

  function toggleRiderAbsence(rId) {
    setAbsentRiderIds((prev) =>
      prev.includes(rId) ? prev.filter((item) => item !== rId) : [...prev, rId]
    );
  }

  async function handleRunWhatIf(e) {
    e.preventDefault();
    setRunningWhatIf(true);
    setError('');
    try {
      const res = await apiClient.post(`/plans/${id}/whatif`, {
        weather: whatIfWeather,
        incident: whatIfIncident,
        removeVehicleIds: removedVehicleIds,
        absentRiderIds,
      });
      setWhatIfOutput(res.data);
      setShowWhatIfOnMap(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to run What-If simulation'));
    } finally {
      setRunningWhatIf(false);
    }
  }

  async function sendChatQuestion(text) {
    const trimmed = text.trim();
    if (!trimmed || sendingChat) return;

    const historyPayload = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setChatMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setChatInput('');
    setSendingChat(true);
    setError('');

    try {
      const res = await apiClient.post(`/plans/${id}/chat`, {
        message: trimmed,
        history: historyPayload,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          source: res.data.source,
        },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send chat message'));
    } finally {
      setSendingChat(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
        <span className="text-sm font-medium">Loading optimized plan...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
        <p className="text-base font-bold text-slate-900">Plan not found</p>
        <p className="text-sm text-slate-600 mt-1 mb-4">{error}</p>
        <Link to="/" className="text-sm font-semibold text-emerald-700 hover:underline">
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  const baseResult = plan.result || {};
  const activeMapResult =
    showWhatIfOnMap && whatIfOutput?.result ? whatIfOutput.result : baseResult;

  const summary = baseResult.summary || {};
  const baselineSummary = baseResult.baseline?.summary || {};
  const savings = baseResult.savings || {};
  const routes = activeMapResult.routes || [];
  const unassigned = activeMapResult.unassignedRiders || [];

  const snapshotVehicles = plan.inputs?.vehicles || [];
  const snapshotRiders = plan.inputs?.riders || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {plan.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Destination: <strong className="text-slate-900">{plan.dest_name}</strong> &bull;
            Deadline: <strong className="text-slate-900">{plan.arrival_time}</strong> (
            {plan.buffer_min} min buffer) &bull; Weather:{' '}
            <span className="capitalize">
              {(plan.conditions?.weather || 'clear').replace('_', ' ')}
            </span>{' '}
            &bull; Incident:{' '}
            <span className="capitalize">
              {(plan.conditions?.incident || 'none').replace('_', ' ')}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleDeletePlan}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 min-h-[42px]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>Delete Plan</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      {/* KPI Row */}
      <section aria-label="Plan performance indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Vehicles Used</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {summary.vehiclesUsed ?? 0}{' '}
            <span className="text-sm font-medium text-slate-500">
              / {snapshotVehicles.length}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Baseline: {baselineSummary.vehiclesUsed ?? 0} vehicles
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Distance</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {summary.totalDistanceKm ?? 0} km
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Saves {savings.distanceSavedKm ?? 0} km ({savings.distanceSavedPct ?? 0}%) vs
            sign-up order
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Avg Ride Time</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {summary.avgRideMin ?? 0} min
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Saves {savings.avgRideSavedMin ?? 0} min ({savings.avgRideSavedPct ?? 0}%) vs
            baseline
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Seat Utilization</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {summary.utilizationPct ?? 0}%
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {summary.assignedRiders ?? 0} assigned &bull; {summary.unassignedCount ?? 0}{' '}
            unassigned
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Worst Route Risk</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {summary.worstRiskScore ?? 0}%
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${riskBadgeClasses(
                summary.worstRiskLevel
              )}`}
            >
              {summary.worstRiskLevel || 'low'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Baseline worst: {baselineSummary.worstRiskScore ?? 0}%
          </p>
        </div>
      </section>

      {unassigned.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-900"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">
              {unassigned.length} rider(s) could not fit within available vehicle capacity
            </p>
            <p className="text-xs mt-1">
              Unassigned: {unassigned.map((u) => u.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Map Section */}
      <section aria-label="Shuttle route map" className="space-y-2">
        {whatIfOutput && (
          <div className="flex items-center justify-between rounded-xl bg-navy-900 text-white px-4 py-2.5 text-xs">
            <span className="font-semibold">
              {showWhatIfOnMap
                ? 'Map preview: Showing simulated What-If scenario routes'
                : 'Map preview: Showing saved baseline optimized routes'}
            </span>
            <button
              type="button"
              onClick={() => setShowWhatIfOnMap((v) => !v)}
              className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold px-3 py-1.5"
            >
              {showWhatIfOnMap ? 'Switch to Base Plan' : 'Show What-If on Map'}
            </button>
          </div>
        )}

        <RouteMap
          routes={routes}
          destination={activeMapResult.destination || {
            name: plan.dest_name,
            lat: plan.dest_lat,
            lng: plan.dest_lng,
          }}
          unassignedRiders={unassigned}
        />
      </section>

      {/* Collapsible Route Cards */}
      <section aria-labelledby="routes-heading" className="space-y-3">
        <h2 id="routes-heading" className="text-lg font-bold text-slate-900">
          Route Manifests ({routes.length})
        </h2>

        {routes.length === 0 ? (
          <p className="rounded-xl bg-white border border-slate-200 p-6 text-sm text-slate-600">
            No active routes in this view.
          </p>
        ) : (
          <div className="space-y-3">
            {routes.map((route, idx) => {
              const isOpen = Boolean(expandedRoutes[route.vehicleId]);
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

              return (
                <article
                  key={route.vehicleId}
                  className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleRouteCard(route.vehicleId)}
                    className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block w-3.5 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {route.vehicleName}
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            Driver: {route.driverName || 'Unassigned'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${riskBadgeClasses(
                              route.risk?.level
                            )}`}
                          >
                            {route.risk?.level} risk ({route.risk?.score}%)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Depart <strong>{route.departureTime}</strong> &rarr; Arrive{' '}
                          <strong>{route.arrivalTime}</strong> &bull; {route.riderCount}/
                          {route.capacity} seats ({route.utilizationPct}%) &bull;{' '}
                          {route.distanceKm} km &bull; {route.durationMin} min
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>p80 delay: {route.risk?.p80DelayMin} min</span>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 px-5 py-4 bg-slate-50/70 space-y-4">
                      {/* Risk factors */}
                      <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs space-y-1">
                        <p className="font-bold text-slate-800">
                          Arrival Risk Analysis (Suggested extra buffer: +
                          {route.risk?.suggestedExtraBufferMin ?? 0} min)
                        </p>
                        <ul className="list-disc pl-5 text-slate-600 space-y-0.5">
                          {(route.risk?.factors || []).map((f, fIdx) => (
                            <li key={fIdx}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Stop table */}
                      <div
                        tabIndex={0}
                        role="region"
                        aria-labelledby={`stops-caption-${route.vehicleId}`}
                        className="table-wrapper rounded-lg border border-slate-200 bg-white"
                      >
                        <table className="w-full text-left text-xs">
                          <caption
                            id={`stops-caption-${route.vehicleId}`}
                            className="visually-hidden"
                          >
                            Pickup stop schedule for {route.vehicleName}
                          </caption>
                          <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                            <tr>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Stop</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Rider</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Address</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Pickup ETA</th>
                              <th scope="col" className="px-3 py-2.5 font-semibold">Ride Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {route.stops.map((stop) => (
                              <tr key={stop.riderId}>
                                <td className="px-3 py-2.5 font-bold text-slate-800">
                                  #{stop.order}
                                </td>
                                <th scope="row" className="px-3 py-2.5 font-semibold text-slate-900">
                                  {stop.name}
                                </th>
                                <td className="px-3 py-2.5 text-slate-600">{stop.address}</td>
                                <td className="px-3 py-2.5 font-bold text-emerald-700">
                                  {stop.eta}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                  {stop.rideMinutes} min
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* AI Insights / What-If / Chat Tabs */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div
          role="tablist"
          aria-label="Plan analysis tools"
          className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4"
        >
          <button
            type="button"
            role="tab"
            id="tab-insights"
            aria-selected={activeTab === 'insights'}
            onClick={() => setActiveTab('insights')}
            className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-bold whitespace-nowrap min-h-[48px] ${
              activeTab === 'insights' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>AI Insights &amp; Notifications</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-whatif"
            aria-selected={activeTab === 'whatif'}
            onClick={() => setActiveTab('whatif')}
            className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-bold whitespace-nowrap min-h-[48px] ${
              activeTab === 'whatif' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            <span>What-If Simulator</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-chat"
            aria-selected={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-bold whitespace-nowrap min-h-[48px] ${
              activeTab === 'chat' ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>Ask ShuttleIQ</span>
          </button>
        </div>

        {/* Panel 1: AI Insights */}
        <div
          role="tabpanel"
          aria-labelledby="tab-insights"
          hidden={activeTab !== 'insights'}
        >
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Executive Dispatch Brief &amp; Rider Alerts
                </h2>
                <p className="text-xs text-slate-600">
                  Privacy-safe analysis: only first names, ETAs, and aggregate metrics are
                  sent to Gemini.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateInsights}
                disabled={generatingInsights}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
              >
                {generatingInsights ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {generatingInsights
                    ? 'Generating...'
                    : plan.insights
                    ? 'Regenerate Insights'
                    : 'Generate AI Insights'}
                </span>
              </button>
            </div>

            {!plan.insights ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                Click &ldquo;Generate AI Insights&rdquo; to produce dispatch recommendations and
                copy-ready rider notifications.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl bg-navy-900 text-white p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Executive Summary
                    </span>
                    <span className="rounded-full bg-navy-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                      Source: {plan.insights.source || 'gemini'}
                    </span>
                  </div>
                  <p className="text-base font-bold">{plan.insights.headline}</p>
                  <p className="text-sm text-slate-300">{plan.insights.risk_summary}</p>
                  <p className="text-xs text-emerald-300 pt-1">
                    {plan.insights.efficiency_notes}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Operational Recommendations
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {(plan.insights.recommendations || []).map((rec, rIdx) => (
                      <div
                        key={rIdx}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1"
                      >
                        <p className="text-sm font-bold text-slate-900">{rec.title}</p>
                        <p className="text-xs text-slate-600">{rec.detail}</p>
                        <p className="text-xs font-semibold text-emerald-700 pt-1">
                          Impact: {rec.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Copyable Rider Notifications
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {(plan.insights.rider_messages || []).map((msg, mIdx) => (
                      <div
                        key={mIdx}
                        className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-500 mb-1">
                            {msg.route}
                          </p>
                          <p className="text-sm text-slate-800">{msg.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.route, msg.message)}
                          className="self-start inline-flex items-center gap-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 min-h-[36px]"
                        >
                          {copiedRoute === msg.route ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Copy message</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: What-If Simulator */}
        <div
          role="tabpanel"
          aria-labelledby="tab-whatif"
          hidden={activeTab !== 'whatif'}
        >
          <div className="p-6 space-y-6">
            <form onSubmit={handleRunWhatIf} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="whatif-weather"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Simulated weather
                  </label>
                  <select
                    id="whatif-weather"
                    value={whatIfWeather}
                    onChange={(e) => setWhatIfWeather(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-h-[44px]"
                  >
                    {WEATHER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="whatif-incident"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Simulated traffic incident
                  </label>
                  <select
                    id="whatif-incident"
                    value={whatIfIncident}
                    onChange={(e) => setWhatIfIncident(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-h-[44px]"
                  >
                    {INCIDENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <fieldset className="rounded-xl border border-slate-200 p-4">
                  <legend className="text-xs font-bold uppercase text-slate-600 px-1">
                    Remove Vehicles (Simulate Breakdown)
                  </legend>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {snapshotVehicles.map((v) => (
                      <label
                        key={v.id}
                        className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={removedVehicleIds.includes(v.id)}
                          onChange={() => toggleVehicleRemoval(v.id)}
                          className="h-4 w-4 accent-emerald-600"
                        />
                        <span>
                          {v.name} ({v.capacity} seats)
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 p-4">
                  <legend className="text-xs font-bold uppercase text-slate-600 px-1">
                    Mark Riders Absent ({absentRiderIds.length} selected)
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {snapshotRiders.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer truncate"
                      >
                        <input
                          type="checkbox"
                          checked={absentRiderIds.includes(r.id)}
                          onChange={() => toggleRiderAbsence(r.id)}
                          className="h-4 w-4 accent-emerald-600 shrink-0"
                        />
                        <span className="truncate">{r.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={runningWhatIf}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-semibold px-5 py-2.5 text-sm min-h-[44px] disabled:opacity-60"
                >
                  {runningWhatIf ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FlaskConical className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  )}
                  <span>
                    {runningWhatIf ? 'Simulating...' : 'Run What-If Simulation'}
                  </span>
                </button>

                {whatIfOutput && (
                  <button
                    type="button"
                    onClick={() => setShowWhatIfOnMap((v) => !v)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-semibold min-h-[44px] ${
                      showWhatIfOnMap
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {showWhatIfOnMap ? 'Showing Scenario on Map ✓' : 'Show Scenario on Map'}
                  </button>
                )}
              </div>
            </form>

            {whatIfOutput && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>AI Scenario Assessment</span>
                    <span>Source: {whatIfOutput.source}</span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {whatIfOutput.narrative}
                  </p>
                </div>

                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="whatif-table-caption"
                  className="table-wrapper rounded-xl border border-slate-200"
                >
                  <table className="w-full text-left text-sm">
                    <caption id="whatif-table-caption" className="visually-hidden">
                      Metric comparison between saved plan and simulated What-If scenario
                    </caption>
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Metric</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Saved Plan</th>
                        <th scope="col" className="px-4 py-3 font-semibold">What-If Scenario</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        {
                          label: 'Vehicles Used',
                          base: summary.vehiclesUsed ?? 0,
                          scen: whatIfOutput.result.summary.vehiclesUsed,
                          delta: whatIfOutput.comparison.vehiclesUsedDelta,
                        },
                        {
                          label: 'Unassigned Riders',
                          base: summary.unassignedCount ?? 0,
                          scen: whatIfOutput.result.summary.unassignedCount,
                          delta: whatIfOutput.comparison.unassignedDelta,
                        },
                        {
                          label: 'Total Distance (km)',
                          base: summary.totalDistanceKm ?? 0,
                          scen: whatIfOutput.result.summary.totalDistanceKm,
                          delta: whatIfOutput.comparison.distanceDeltaKm,
                        },
                        {
                          label: 'Avg Ride Time (min)',
                          base: summary.avgRideMin ?? 0,
                          scen: whatIfOutput.result.summary.avgRideMin,
                          delta: whatIfOutput.comparison.avgRideDeltaMin,
                        },
                        {
                          label: 'Worst Risk Score (%)',
                          base: `${summary.worstRiskScore ?? 0}%`,
                          scen: `${whatIfOutput.result.summary.worstRiskScore}%`,
                          delta: `${whatIfOutput.comparison.worstRiskDeltaPct >= 0 ? '+' : ''}${
                            whatIfOutput.comparison.worstRiskDeltaPct
                          }%`,
                        },
                      ].map((row) => (
                        <tr key={row.label}>
                          <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                            {row.label}
                          </th>
                          <td className="px-4 py-3 text-slate-700">{row.base}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{row.scen}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {typeof row.delta === 'number'
                              ? `${row.delta >= 0 ? '+' : ''}${row.delta}`
                              : row.delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Ask ShuttleIQ Chat */}
        <div
          role="tabpanel"
          aria-labelledby="tab-chat"
          hidden={activeTab !== 'chat'}
        >
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendChatQuestion(q)}
                  disabled={sendingChat}
                  className="rounded-full border border-slate-300 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 h-72 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-16">
                  Ask any operational question grounded in this dispatch plan (e.g. earliest
                  departure, buffer recommendations, or rider ETAs).
                </p>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-xl rounded-xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-navy-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.source && (
                        <span className="block mt-1 text-[10px] font-semibold uppercase text-slate-400">
                          Source: {msg.source}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChatQuestion(chatInput);
              }}
              className="flex gap-2"
            >
              <label htmlFor="chat-input" className="visually-hidden">
                Ask ShuttleIQ about this plan
              </label>
              <input
                id="chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.nativeEvent?.isComposing) {
                    e.preventDefault();
                  }
                }}
                placeholder="Ask about departure times, buffers, risk factors..."
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm min-h-[46px]"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 text-sm min-h-[46px] disabled:opacity-60"
              >
                {sendingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
