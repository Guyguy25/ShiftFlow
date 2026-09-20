import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Zap,
  Users,
  Clock3,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  CalendarDays,
  BellRing,
  ChevronRight,
  PlayCircle,
  MousePointer2,
  Sparkles,
} from "lucide-react";

const DEMO_STEPS = [
  { id: "created", label: "Mission créée", detail: "Montage stand · Lille · 8 personnes" },
  { id: "sent", label: "WhatsApp envoyé", detail: "Les premiers intervenants sont contactés" },
  { id: "confirmed", label: "Réponses reçues", detail: "6 confirmés · 1 refus · 1 sans réponse" },
  { id: "filled", label: "Équipe complète", detail: "ShiftFlow poursuit jusqu'à remplir les 8 places" },
];

function AppPreview() {
  const [activeStep, setActiveStep] = useState(1);
  const current = DEMO_STEPS[activeStep];

  return (
    <div className="relative">
      <div className="absolute -inset-10 bg-blue-500/10 blur-3xl rounded-full" aria-hidden="true" />
      <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.14)] overflow-hidden">
        <div className="h-11 border-b border-slate-200 bg-slate-50 flex items-center gap-2 px-4">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <div className="ml-3 h-6 flex-1 max-w-48 rounded bg-white border border-slate-200" />
        </div>
        <div className="grid grid-cols-[72px_1fr] sm:grid-cols-[170px_1fr] min-h-[430px]">
          <aside className="border-r border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
              <span className="hidden sm:block text-sm font-bold">ShiftFlow</span>
            </div>
            <div className="mt-5 space-y-2">
              {["Vue", "Missions", "Équipe", "Calendrier"].map((item, i) => (
                <div key={item} className={`h-8 rounded-md flex items-center px-2 text-xs ${i === 1 ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-400"}`}>
                  <span className="w-2 h-2 rounded-full bg-current sm:mr-2" />
                  <span className="hidden sm:inline">{item}</span>
                </div>
              ))}
            </div>
          </aside>
          <div className="p-4 sm:p-6 bg-[#fbfcfe]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-bold">Mission en cours</div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-slate-950">Montage stand · Lille</div>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1">6/8 confirmés</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[['8', 'postes'], ['6', 'confirmés'], ['2', 'à remplir']].map(([n, l]) => (
                <div key={l} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-lg font-bold text-slate-950">{n}</div>
                  <div className="text-[10px] sm:text-xs text-slate-500">{l}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">Cascade automatique</div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />active</div>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  { name: "Karim B.", status: "Confirmé", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                  { name: "Sofia M.", status: "Confirmé", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                  { name: "Lucas D.", status: "Refus", cls: "text-rose-700 bg-rose-50 border-rose-200" },
                  { name: "Nassim R.", status: "Contacté", cls: "text-blue-700 bg-blue-50 border-blue-200" },
                ].map((person, i) => (
                  <div key={person.name} className={`flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 ${i === 3 ? "sf-pulse-ring" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center">{i + 1}</span>
                      <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">{person.name}</span>
                    </div>
                    <span className={`text-[10px] rounded-full border px-2 py-0.5 ${person.cls}`}>{person.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {DEMO_STEPS.map((step, i) => (
                <button key={step.id} type="button" onClick={() => setActiveStep(i)} className={`h-1.5 rounded-full transition-all ${i <= activeStep ? "bg-blue-600" : "bg-slate-200"}`} aria-label={step.label} />
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-slate-950 text-white p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-300 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold">{current.label}</div>
                <div className="text-[11px] text-slate-300 mt-0.5">{current.detail}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:block absolute -left-8 top-20 sf-float rounded-xl border border-slate-200 bg-white shadow-xl px-3 py-2.5">
        <div className="text-[10px] text-slate-500">WhatsApp</div>
        <div className="mt-0.5 text-xs font-semibold text-slate-900">Message envoyé ✓</div>
      </div>
      <div className="hidden lg:block absolute -right-8 bottom-16 sf-float-delayed rounded-xl border border-emerald-200 bg-emerald-50 shadow-xl px-3 py-2.5">
        <div className="text-[10px] text-emerald-700">Équipe</div>
        <div className="mt-0.5 text-xs font-semibold text-emerald-900">+1 confirmation</div>
      </div>
    </div>
  );
}

function FlowStep({ icon: Icon, number, title, text }) {
  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Icon className="w-5 h-5 text-blue-700" /></div>
        <div className="text-xs font-mono text-slate-300">0{number}</div>
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="landing-logo">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm"><Zap className="w-4 h-4 text-white" /></div>
            <span className="font-display font-bold text-lg tracking-tight">ShiftFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
            <a href="#produit" className="hover:text-slate-950">Produit</a>
            <a href="#fonctionnement" className="hover:text-slate-950">Fonctionnement</a>
            <Link to="/pricing" data-testid="landing-pricing-link" className="hover:text-slate-950">Tarifs</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" data-testid="landing-login-link" className="text-sm text-slate-600 hover:text-slate-950 hidden sm:inline">Se connecter</Link>
            <Link to="/register" data-testid="landing-cta-nav" className="text-sm font-semibold bg-slate-950 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-100">
          <div className="absolute inset-0 sf-grid-mask" aria-hidden="true" />
          <div className="absolute top-[-12rem] left-1/2 -translate-x-1/2 w-[44rem] h-[34rem] rounded-full bg-blue-100/70 blur-3xl" aria-hidden="true" />
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-20 sm:py-24 lg:py-28 relative">
            <div className="text-center max-w-4xl mx-auto">
              <div className="sf-fade-up inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                30 jours gratuits · 3 missions · aucune carte bancaire
              </div>
              <h1 className="sf-fade-up sf-fade-up-delay-1 mt-6 text-4xl sm:text-5xl lg:text-7xl leading-[1.02] tracking-[-0.04em] font-display font-bold text-slate-950">
                Vos équipes événementielles, <span className="text-blue-600">sans les relances à répétition.</span>
              </h1>
              <p className="sf-fade-up sf-fade-up-delay-2 mt-6 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-slate-600">
                Créez une mission, classez vos intervenants par priorité et laissez ShiftFlow envoyer les messages WhatsApp, suivre les réponses et poursuivre la cascade jusqu'à ce que votre équipe soit complète.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/register" data-testid="hero-cta-primary" className="sf-shine w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-semibold shadow-[0_10px_30px_rgba(37,99,235,0.22)] transition-all hover:-translate-y-0.5">
                  Créer ma première mission <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#fonctionnement" data-testid="hero-cta-secondary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-6 py-3.5 rounded-xl font-semibold transition-colors">
                  <PlayCircle className="w-4 h-4" /> Voir comment ça marche
                </a>
              </div>
              <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" />Sans compte pour les intervenants</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" />WhatsApp connecté à votre compte</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" />Sans engagement</span>
              </div>
            </div>

            <div id="produit" className="mt-16 sm:mt-20 max-w-5xl mx-auto">
              <AppPreview />
              <p className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5"><MousePointer2 className="w-3.5 h-3.5" />Cliquez sur les étapes sous l'aperçu pour simuler le flux</p>
            </div>
          </div>
        </section>

        <section className="py-9 border-b border-slate-100 bg-slate-50/60">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pensé pour les équipes qui travaillent dans le réel</p>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {["Montage de stands", "Technique événementielle", "Son & lumière", "Montage / démontage"].map((label) => (
                <div key={label} className="text-center text-sm font-medium text-slate-600 rounded-xl border border-slate-200 bg-white px-4 py-3">{label}</div>
              ))}
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.18em] text-blue-700 font-bold">Le flux ShiftFlow</div>
              <h2 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-[-0.03em] text-slate-950">De « il nous manque quelqu'un » à « équipe complète ».</h2>
              <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">Vous gardez le contrôle sur l'ordre de priorité. ShiftFlow s'occupe de la partie répétitive.</p>
            </div>
            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              <FlowStep number={1} icon={CalendarDays} title="Créez la mission" text="Lieu, date, horaires, nombre de personnes et tarif. Vous posez le cadre en quelques minutes." />
              <FlowStep number={2} icon={Users} title="Classez votre équipe" text="Sélectionnez les intervenants et définissez exactement dans quel ordre ils doivent être contactés." />
              <FlowStep number={3} icon={MessageCircle} title="ShiftFlow contacte" text="Les messages partent via votre WhatsApp connecté avec un lien simple pour accepter ou refuser." />
              <FlowStep number={4} icon={RefreshCw} title="La cascade continue" text="Refus, annulation ou place encore vide : ShiftFlow poursuit avec les suivants jusqu'à compléter le besoin." />
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 bg-slate-950 text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-blue-300 font-bold">Le problème que vous connaissez déjà</div>
              <h2 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-[-0.03em]">Un désistement ne devrait pas déclencher 20 messages et 10 appels.</h2>
              <p className="mt-5 text-slate-300 leading-relaxed text-lg">Quand une personne se retire, votre temps devrait servir à gérer l'événement — pas à parcourir WhatsApp pour retrouver quelqu'un en urgence.</p>
              <div className="mt-8 space-y-4">
                {[
                  "Vous choisissez l'ordre des personnes à contacter.",
                  "Les confirmations remontent dans un seul tableau de bord.",
                  "Les intervenants répondent sans créer de compte.",
                  "Les relances et rappels restent visibles dans le journal WhatsApp.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" /><span className="text-slate-200">{item}</span></div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:p-6 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div><div className="text-xs text-slate-400">Vendredi · 06:00</div><div className="mt-1 font-semibold">Montage stand · 8 personnes</div></div>
                  <span className="rounded-full bg-rose-500/10 text-rose-300 border border-rose-400/20 px-2.5 py-1 text-xs">1 désistement</span>
                </div>
                <div className="mt-6 relative h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-blue-500" />
                  <span className="sf-flow-dot absolute top-1/2 -translate-y-1/2 left-0 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    ["18:42", "Lucas annule sa participation", "rose"],
                    ["18:42", "ShiftFlow contacte automatiquement Nassim", "blue"],
                    ["18:47", "Nassim confirme depuis WhatsApp", "green"],
                    ["18:47", "Équipe complète : 8/8", "green"],
                  ].map(([time, text, tone]) => (
                    <div key={time + text} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone === 'rose' ? 'bg-rose-400' : tone === 'blue' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                      <div className="min-w-0"><div className="text-[11px] text-slate-500">{time}</div><div className="text-sm text-slate-200 mt-0.5">{text}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 bg-[#f8fafc] border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-5 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-xs uppercase tracking-[0.18em] text-blue-700 font-bold">Simple à mettre en place</div>
              <h2 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-[-0.03em]">Votre équipe existe déjà. Importez-la, puis travaillez.</h2>
              <p className="mt-4 text-slate-600 text-lg">Pas besoin de reconstruire votre organisation depuis zéro.</p>
            </div>
            <div className="mt-12 grid lg:grid-cols-3 gap-5">
              {[
                { icon: MessageCircle, title: "Connectez WhatsApp", text: "Scannez une fois le QR depuis Appareils connectés, puis utilisez votre propre session WhatsApp dans ShiftFlow.", badge: "Principal" },
                { icon: Users, title: "Importez vos contacts", text: "Récupérez vos contacts WhatsApp et sélectionnez ceux qui doivent devenir des intervenants ShiftFlow.", badge: "Rapide" },
                { icon: ShieldCheck, title: "Gardez le contrôle", text: "Vous décidez qui contacter, dans quel ordre, et vous voyez l'état de chaque mission en temps réel.", badge: "Clair" },
              ].map(({ icon: Icon, title, text, badge }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition-shadow">
                  <div className="flex items-center justify-between"><div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center"><Icon className="w-5 h-5 text-blue-700" /></div><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{badge}</span></div>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-start">
            <div className="lg:sticky lg:top-28">
              <div className="text-xs uppercase tracking-[0.18em] text-blue-700 font-bold">Tout au même endroit</div>
              <h2 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-[-0.03em]">Moins de chaos opérationnel. Plus de visibilité.</h2>
              <p className="mt-4 text-slate-600 leading-relaxed text-lg">ShiftFlow remplace les informations éparpillées entre WhatsApp, les notes, les appels et les fichiers par un flux unique et lisible.</p>
            </div>
            <div className="space-y-4">
              {[
                { icon: CalendarDays, title: "Missions & shifts", text: "Centralisez vos dates, horaires, lieux, besoins en personnel et état de remplissage." },
                { icon: BellRing, title: "Relances WhatsApp", text: "Envoyez les demandes via votre session WhatsApp et suivez les éventuels échecs dans le journal." },
                { icon: Users, title: "Intervenants", text: "Gardez votre équipe enregistrée et réutilisez-la d'une mission à l'autre sans repartir de zéro." },
                { icon: Clock3, title: "Rappels 24h", text: "Réduisez les oublis avec des rappels automatiques avant les shifts lorsque votre WhatsApp est connecté." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex gap-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-slate-700" /></div>
                  <div><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 bg-blue-600 text-white relative overflow-hidden">
          <div className="absolute inset-0 sf-grid-mask opacity-20" aria-hidden="true" />
          <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Zap className="w-3.5 h-3.5" />30 jours gratuits</div>
            <h2 className="mt-5 text-4xl sm:text-6xl font-display font-bold tracking-[-0.04em]">La prochaine relance peut être la dernière que vous faites à la main.</h2>
            <p className="mt-5 text-blue-100 text-lg max-w-2xl mx-auto">Créez votre compte, ajoutez jusqu'à 30 intervenants et testez ShiftFlow sur jusqu'à 3 missions pendant 30 jours. Aucune carte bancaire demandée.</p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/register" data-testid="footer-cta" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-blue-700 px-7 py-3.5 font-semibold hover:bg-blue-50 transition-colors">Tester ShiftFlow <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-7 py-3.5 font-semibold hover:bg-white/15 transition-colors">Voir les tarifs <ChevronRight className="w-4 h-4" /></Link>
            </div>
            <div className="mt-5 text-sm text-blue-100">Puis 49 €/mois si vous passez au Pro · sans engagement</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div><span className="font-semibold text-slate-700">ShiftFlow</span><span>© 2026</span></div>
          <div className="flex gap-6"><Link to="/pricing" className="hover:text-slate-900">Tarifs</Link><Link to="/login" className="hover:text-slate-900">Connexion</Link><Link to="/register" className="hover:text-slate-900">Essayer gratuitement</Link></div>
        </div>
      </footer>
    </div>
  );
}
