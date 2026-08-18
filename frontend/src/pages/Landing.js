import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Zap, Users, Clock, ShieldCheck } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg">ShiftFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/pricing" data-testid="landing-pricing-link" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:inline">Tarifs</Link>
            <Link to="/login" data-testid="landing-login-link" className="text-sm text-gray-600 hover:text-gray-900">Se connecter</Link>
            <Link to="/register" data-testid="landing-cta-nav" className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors">
              Tester gratuitement
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Nouveau · MVP
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight leading-[1.05] text-gray-900">
                Remplissez vos équipes de montage <span className="text-blue-600">automatiquement.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">
                Arrêtez de relancer vos monteurs un par un sur WhatsApp. Créez une mission, sélectionnez vos intervenants et laissez ShiftFlow gérer les confirmations et les remplacements.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register" data-testid="hero-cta-primary" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors">
                  Tester gratuitement <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#comment" data-testid="hero-cta-secondary" className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors">
                  Voir comment ça marche
                </a>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />Sans compte pour les monteurs</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />Mobile-first</div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="relative rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-200">
                <img
                  src="https://images.pexels.com/photos/29775304/pexels-photo-29775304.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                  alt="Technicien événementiel"
                  className="w-full h-[420px] object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-lg p-4 border border-gray-200">
                  <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Salon Lille · 29 août</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="font-display font-bold text-gray-900">Montage stand Nike</div>
                    <span className="text-xs px-2 py-1 rounded-md status-confirmed border font-medium">8/8 confirmés</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment" className="py-20 bg-[#F9FAFB] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Comment ça marche</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold font-display text-gray-900 tracking-tight">Un flux simple, quatre étapes.</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "01", t: "Créez votre mission", d: "Nom, date, lieu, nombre de personnes. C'est tout." },
              { n: "02", t: "Sélectionnez vos intervenants", d: "Dans l'ordre de priorité que vous souhaitez." },
              { n: "03", t: "Ils répondent en un clic", d: "Aucun compte, aucun téléchargement. Juste un lien SMS." },
              { n: "04", t: "Remplacements automatiques", d: "Refus ou absence ? Le suivant est contacté." },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="text-xs font-mono text-blue-600 font-bold">{s.n}</div>
                <div className="mt-3 font-display font-bold text-lg text-gray-900">{s.t}</div>
                <div className="mt-2 text-sm text-gray-600 leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Pour qui</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold font-display tracking-tight">Conçu pour les agences terrain.</h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              WhatsApp + Excel + appels + relances = perte de temps. ShiftFlow centralise tout dans un tableau de bord qui vous dit qui vient <em>vraiment</em>.
            </p>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {[
              { i: Users, t: "Agences de montage de stands" },
              { i: Zap, t: "Prestataires événementiels techniques" },
              { i: Clock, t: "Équipes son & lumière" },
              { i: ShieldCheck, t: "Équipes de démontage" },
            ].map((x, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">
                  <x.i className="w-5 h-5 text-blue-700" />
                </div>
                <div className="font-medium text-gray-900">{x.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problème / Solution */}
      <section className="py-20 bg-[#F9FAFB] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="text-xs uppercase tracking-widest text-red-700 font-bold">Le problème</div>
            <h3 className="mt-3 text-2xl font-display font-bold">"WhatsApp + Excel + appels + relances = perte de temps."</h3>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Vous relancez chaque monteur individuellement, vous ne savez pas qui est vraiment confirmé, et un désistement la veille vous fait perdre des heures.
            </p>
          </div>
          <div className="bg-blue-600 rounded-xl p-8 text-white">
            <div className="text-xs uppercase tracking-widest text-blue-200 font-bold">La solution</div>
            <h3 className="mt-3 text-2xl font-display font-bold">"Un seul tableau de bord pour savoir qui vient réellement."</h3>
            <p className="mt-4 text-blue-100 leading-relaxed">
              Envoyez une mission, ShiftFlow contacte vos intervenants dans l'ordre. Refus, absence, annulation : le suivant est contacté automatiquement.
            </p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">Prêt à ne plus jamais relancer un monteur ?</h2>
          <p className="mt-4 text-gray-600 text-lg">Créez votre première mission en moins de 2 minutes.</p>
          <Link to="/register" data-testid="footer-cta" className="mt-8 inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-md font-medium transition-colors">
            Commencer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <div>© 2026 ShiftFlow · Tous droits réservés</div>
          <div className="flex gap-6">
            <Link to="/pricing" className="hover:text-gray-800">Tarifs</Link>
            <Link to="/login" className="hover:text-gray-800">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
