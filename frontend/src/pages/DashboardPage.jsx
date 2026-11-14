import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bus,
  Clock,
  Database,
  Loader2,
  MapPin,
  PlusCircle,
  Sparkles,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client.js';
import { riskBadgeClasses } from '../constants/demo.js';

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState([]);
  const [riders, setRiders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const [vRes, rRes, pRes] = await Promise.all([
        apiClient.get('/vehicles'),
        apiClient.get('/riders'),
        apiClient.get('/plans'),
      ]);
      setVehicles(vRes.data.vehicles || []);
      setRiders(rRes.data.riders || []);
      setPlans(pRes.data.plans || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function handleSeedDemo() {
    setSeeding(true);
    setError('');
    setStatusMessage('');
    try {
      const res = await apiClient.post('/demo/seed');
      setStatusMessage(
        `Loaded ${res.data.seeded.vehicles} vehicles and ${res.data.seeded.riders} deterministic riders across 6 neighbourhoods.`
      );
      await loadOverview();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to seed demo data'));
    } finally {
      setSeeding(false);
    }
  }

  async function handleDeletePlan(planId) {
    setDeletingId(planId);
    setError('');
    try {
      await apiClient.delete(`/plans/${planId}`);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete plan'));
    } finally {
      setDeletingId(null);
    }
  }

  const totalSeats = vehicles.reduce((s, v) => s + Number(v.capacity || 0), 0);
  const avgDistSavingsPct =
    plans.length > 0
      ? (
          plans.reduce(
            (s, p) => s + Number(p.result?.savings?.distanceSavedPct || 0),
            0
          ) / plans.length
        ).toFixed(1)
      : '0.0';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
        <span className="text-sm font-medium">Loading coordinator workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Operations Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Monitor fleet readiness, review optimized dispatch plans, and track savings vs
            sign-up-order rosters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors min-h-[44px] disabled:opacity-60"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Database className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            )}
            <span>{seeding ? 'Seeding...' : 'Load demo data'}</span>
          </button>

          <Link
            to="/plans/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors min-h-[44px] shadow-sm"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>New Morning Plan</span>
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {statusMessage}
        </div>
      )}

      {/* KPI Cards */}
      <section aria-label="Workspace metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Fleet Vehicles</span>
            <Bus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{vehicles.length}</p>
          <p className="mt-1 text-xs text-slate-600">{totalSeats} total passenger seats</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Registered Riders</span>
            <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{riders.length}</p>
          <p className="mt-1 text-xs text-slate-600">
            <Link to="/fleet" className="text-emerald-700 font-semibold hover:underline">
              Manage stops &amp; fleet &rarr;
            </Link>
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Saved Dispatch Plans</span>
            <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{plans.length}</p>
          <p className="mt-1 text-xs text-slate-600">With AI insights &amp; risk analysis</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Avg Distance Savings</span>
            <TrendingDown className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">
            {avgDistSavingsPct}%
          </p>
          <p className="mt-1 text-xs text-slate-600">vs sign-up-order roster baseline</p>
        </div>
      </section>

      {/* Onboarding card when workspace is empty */}
      {(vehicles.length === 0 || riders.length === 0) && (
        <section className="rounded-2xl bg-navy-900 text-white p-6 sm:p-8 shadow-md border border-navy-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Quick-Start Sandbox
              </span>
              <h2 className="text-xl sm:text-2xl font-bold">
                Load Demo Data to test ShuttleIQ in 5 seconds
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Seeds 4 shuttles (14, 14, 8, 8 seats), 30 deterministic riders spread across 6
                neighbourhoods around TechPark North Campus, and an initial optimized morning
                plan ready for What-If stress tests and Gemini AI insights.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={seeding}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold px-5 py-3 text-sm transition-colors min-h-[48px] disabled:opacity-60"
              >
                {seeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Database className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{seeding ? 'Loading Demo Fleet...' : 'Load Demo Data'}</span>
              </button>
              <Link
                to="/fleet"
                className="inline-flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800 hover:bg-navy-700 text-white font-semibold px-5 py-3 text-sm transition-colors min-h-[48px]"
              >
                Add Manually
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Plans List */}
      <section aria-labelledby="plans-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="plans-heading" className="text-lg font-bold text-slate-900">
            Morning Dispatch Plans
          </h2>
          {plans.length > 0 && (
            <Link
              to="/plans/new"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              + Generate another scenario
            </Link>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-base font-semibold text-slate-800">No dispatch plans yet</p>
            <p className="text-sm text-slate-600 mt-1 mb-5">
              Load the demo fleet above or add vehicles &amp; riders, then build your first
              optimized morning route plan.
            </p>
            <Link
              to="/plans/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 text-sm min-h-[44px]"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Create First Plan</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plans.map((plan) => {
              const summary = plan.result?.summary || {};
              const savings = plan.result?.savings || {};
              const riskLevel = summary.worstRiskLevel || 'low';
              const riskScore = summary.worstRiskScore ?? 0;

              return (
                <article
                  key={plan.id}
                  className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-emerald-300 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                        <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          <span>{plan.dest_name}</span>
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${riskBadgeClasses(
                          riskLevel
                        )}`}
                      >
                        {riskLevel} risk ({riskScore}%)
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        Arrive {plan.arrival_time} ({plan.buffer_min}m buffer)
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 capitalize">
                        Weather: {(plan.conditions?.weather || 'clear').replace('_', ' ')}
                      </span>
                      {plan.conditions?.incident && plan.conditions.incident !== 'none' && (
                        <span className="rounded-md bg-amber-100 px-2.5 py-1 font-medium text-amber-800 capitalize">
                          {plan.conditions.incident.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-xs">
                      <div>
                        <dt className="text-slate-500">Fleet / Riders</dt>
                        <dd className="font-bold text-slate-900 mt-0.5">
                          {summary.vehiclesUsed ?? 0} vans &bull; {summary.assignedRiders ?? 0}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Total Distance</dt>
                        <dd className="font-bold text-slate-900 mt-0.5">
                          {summary.totalDistanceKm ?? 0} km
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">vs Sign-Up Order</dt>
                        <dd className="font-bold text-emerald-700 mt-0.5">
                          -{savings.distanceSavedKm ?? 0} km ({savings.distanceSavedPct ?? 0}%)
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deletingId === plan.id}
                      aria-label={`Delete ${plan.name}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-2 py-2 rounded-lg min-h-[40px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{deletingId === plan.id ? 'Deleting...' : 'Delete'}</span>
                    </button>

                    <Link
                      to={`/plans/${plan.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white px-3.5 py-2 text-xs font-semibold transition-colors min-h-[40px]"
                    >
                      <span>Inspect Plan &amp; AI</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
