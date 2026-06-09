'use client';

import {
  Bot,
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  MapPin,
  Sparkles,
} from 'lucide-react';

/** Aperçu décoratif du tableau de bord (style maquette marketing). */
export function LandingDashboardMockup() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-cyan-500/20 via-blue-600/10 to-transparent rounded-3xl blur-2xl" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0d2137] shadow-2xl shadow-blue-900/40 overflow-hidden">
        <div className="flex min-h-[320px] sm:min-h-[360px]">
          <aside className="w-14 sm:w-16 bg-[#081526] border-r border-white/5 py-4 flex flex-col items-center gap-4 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            {[FileText, Users, BarChart3, MapPin].map((Icon, i) => (
              <div
                key={i}
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  i === 0 ? 'bg-white/15 text-white' : 'text-white/35'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </aside>

          <div className="flex-1 p-3 sm:p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-w-0">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Inscrits', val: '1 248', delta: '+12%', up: true },
                { label: 'Projets', val: '24', delta: '+3', up: true },
                { label: 'Alertes', val: '2', delta: '-1', up: false },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg bg-white border border-slate-200/80 p-2 shadow-sm"
                >
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide">{k.label}</p>
                  <p className="text-sm font-bold text-slate-800">{k.val}</p>
                  <p
                    className={`text-[9px] font-medium ${k.up ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {k.delta}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2 mb-2">
              <div className="col-span-2 rounded-lg bg-white border border-slate-200/80 p-2 h-20 shadow-sm flex flex-col justify-end">
                <div className="flex items-end gap-0.5 h-10">
                  {[40, 65, 45, 80, 55, 70].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-[#2563EB] to-cyan-400"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-[8px] text-slate-400 mt-1">Tendance</p>
              </div>
              <div className="col-span-3 rounded-lg bg-white border border-slate-200/80 p-2 h-20 shadow-sm relative overflow-hidden">
                <MapPin className="h-3 w-3 text-[#2563EB] absolute top-2 left-2" />
                <div className="absolute inset-2 top-5 rounded bg-slate-100">
                  <div className="absolute top-2 left-3 h-2 w-2 rounded-full bg-cyan-500 shadow-sm" />
                  <div className="absolute top-6 right-4 h-2 w-2 rounded-full bg-[#2563EB]" />
                  <div className="absolute bottom-3 left-8 h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="absolute bottom-1.5 left-2 text-[8px] text-slate-400">Cartographie</p>
              </div>
            </div>

            <div className="rounded-lg bg-white border border-slate-200/80 h-14 shadow-sm flex items-center px-2 gap-1">
              <svg className="w-full h-8" viewBox="0 0 200 40" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="2"
                  points="0,30 40,25 80,15 120,20 160,8 200,12"
                />
                <defs>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-2 -left-2 sm:left-4 w-[88%] max-w-xs rounded-xl border border-white/15 bg-[#0d2137]/95 backdrop-blur-md shadow-xl p-3 z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-[#2563EB] flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Kona IA</p>
            <p className="text-[10px] text-white/50">Assistant connecté</p>
          </div>
          <Sparkles className="h-3 w-3 text-cyan-400 ml-auto" />
        </div>
        <p className="text-[11px] text-white/70 mb-2">Comment puis-je vous aider aujourd&apos;hui ?</p>
        <div className="rounded-lg bg-gradient-to-r from-cyan-600/80 to-[#2563EB] px-3 py-1.5 text-center text-[10px] font-medium text-white">
          Analyser mes données
        </div>
      </div>
    </div>
  );
}
