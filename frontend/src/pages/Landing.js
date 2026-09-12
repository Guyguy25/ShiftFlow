import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  Clock,
  ShieldCheck,
  MessageCircle,
  Smartphone,
  BellRing,
  KeyRound,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Petit mockup de carte "mission" réutilisé à plusieurs endroits de la page,
// pour montrer l'interface réelle plutôt qu'une simple photo.
// ---------------------------------------------------------------------------
function MissionCardMock({ title, meta, status, statusClass }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{meta}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="font-display font-bold text-gray-900">{title}</div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-md border font-medium ${statusClass}`}>{status}</span>
      </div>
    </div>
  );
}

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
                1 mission offerte pour tester
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display tracking-tight leading-[1.05] text-gray-900">
                Un désistement de dernière minute ? <span className="text-blue-600">Le suivant est déjà prévenu.</span>
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">
                Arrêtez de relancer vos monteurs un par un sur WhatsApp. Créez une mission, sélectionnez vos intervenants dans l'ordre où vous voulez les contacter, et laissez ShiftFlow gérer les confirmations et les remplacements automatiquement — jour et nuit.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register" data-testid="hero-cta-primary" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors">
                  Tester gratuitement <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#comment" data-testid="hero-cta-secondary" className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors">
                  Voir comment ça marche
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />Sans compte pour les monteurs</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" />1ère mission gratuite</div>
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
              { n: "01", t: "Créez votre mission", d: "Nom, lieu, créneaux, nombre de personnes et compétences requises. C'est tout." },
              { n: "02", t: "Choisissez vos intervenants", d: "Depuis votre équipe déjà enregistrée, importée en un clic depuis WhatsApp ou le répertoire du téléphone." },
              { n: "03", t: "Ils répondent en un clic", d: "Aucun compte, aucun téléchargement. Juste un lien SMS à accepter ou refuser." },
              { n: "04", t: "Remplacements automatiques", d: "Refus, silence ou désistement ? Le suivant sur la liste est recontacté tout seul." },
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

      {/* Scénario concret : le désistement de dernière minute */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Un cas réel</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold font-display tracking-tight text-gray-900">
              "Un monteur se désiste la veille au soir." Voilà ce qui se passe.
            </h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              C'est le scénario qui coûte le plus cher : un appel de dernière minute, et il faut relancer tout le monde à la main pour retrouver quelqu'un à temps.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <MissionCardMock
                title="Montage stand · 6h demain"
                meta="Jeudi 18h42"
                status="Désisté"
                statusClass="status-refused"
              />
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">1. Le désistement arrive.</span> L'intervenant prévu répond « non » depuis son lien SMS — ou ne répond simplement pas dans le délai que vous avez fixé.
              </div>
            </div>
            <div>
              <MissionCardMock
                title="SMS envoyé au suivant"
                meta="Jeudi 18h43"
                status="Contacté"
                statusClass="status-contacted"
              />
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">2. La cascade se déclenche seule.</span> ShiftFlow contacte automatiquement le prochain intervenant disponible dans l'ordre que vous avez défini — sans que vous ayez à décrocher votre téléphone.
              </div>
            </div>
            <div>
              <MissionCardMock
                title="Réponse reçue"
                meta="Jeudi 19h05"
                status="Confirmé"
                statusClass="status-confirmed"
              />
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">3. Il confirme en un tap.</span> Aucun compte à créer : il clique juste sur « Je confirme » depuis le SMS reçu, sur son téléphone.
              </div>
            </div>
            <div>
              <MissionCardMock
                title="Montage stand · 6h demain"
                meta="Vendredi 6h00"
                status="6/6 confirmés"
                statusClass="status-confirmed"
              />
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">4. Vous, vous dormez.</span> Le lendemain matin, le dashboard affiche une équipe au complet — vous découvrez juste que ça s'est réglé tout seul.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connectez vos outils existants */}
      <section className="py-20 bg-[#F9FAFB] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Nouveau</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold font-display tracking-tight text-gray-900">
              Pas besoin de tout ressaisir à la main.
            </h2>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Votre équipe existe déjà quelque part — dans WhatsApp ou dans le répertoire de votre téléphone. ShiftFlow la récupère directement, vous choisissez juste qui importer.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="mt-5 font-display font-bold text-xl text-gray-900">Connectez votre WhatsApp</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Scannez un QR code une seule fois, et retrouvez vos contacts WhatsApp directement dans ShiftFlow. Cochez ceux que vous voulez ajouter à votre équipe, le reste se fait tout seul.
              </p>
              <div className="mt-5 flex items-center gap-3 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-700">WhatsApp connecté — 34 contacts disponibles</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="mt-5 font-display font-bold text-xl text-gray-900">Importez depuis votre téléphone</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Depuis votre mobile, ouvrez directement le répertoire de votre téléphone dans ShiftFlow et sélectionnez vos intervenants dans une checklist — aucune saisie manuelle.
              </p>
              <div className="mt-5 space-y-2">
                {["Karim B. — 06 12 34 56 78", "Sofia M. — 06 98 76 54 32"].map((c) => (
                  <div key={c} className="flex items-center gap-3 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-gray-700">{c}</span>
                  </div>
                ))}
              </div>
            </div>
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

      {/* Ce qu'on vient d'ajouter */}
      <section className="py-20 bg-[#F9FAFB] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Fraîchement ajouté</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold font-display tracking-tight text-gray-900">Ça continue de s'améliorer chaque semaine.</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { i: RefreshCw, t: "Session persistante", d: "Restez connecté d'une visite à l'autre, sans ressaisir vos identifiants à chaque fois." },
              { i: KeyRound, t: "Mot de passe sécurisé", d: "Enregistrement natif du mot de passe dans votre navigateur, connexion en 2 clics." },
              { i: MessageCircle, t: "Connexion WhatsApp", d: "Importez votre équipe existante directement depuis vos contacts WhatsApp." },
              { i: BellRing, t: "Cascade automatique", d: "Relances et remplacements gérés tout seuls, même en dehors de vos heures de bureau." },
            ].map((x, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">
                  <x.i className="w-5 h-5 text-blue-700" />
                </div>
                <div className="mt-4 font-display font-bold text-gray-900">{x.t}</div>
                <div className="mt-2 text-sm text-gray-600 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">Prêt à ne plus jamais relancer un monteur ?</h2>
          <p className="mt-4 text-gray-600 text-lg">Créez votre première mission en moins de 2 minutes — gratuite, sans carte bancaire.</p>
          <Link to="/register" data-testid="footer-cta" className="mt-8 inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-md font-medium transition-colors">
            Commencer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-4 text-sm text-gray-500">Puis 49€/mois si vous continuez. Sans engagement.</div>
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