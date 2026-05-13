import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import heroOrb from "@/assets/hero-orb.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unsaid — Say what's unsaid" },
      {
        name: "description",
        content:
          "An AI-guided space for anonymous, meaningful human connection. No profiles. No performance. Just honest conversation.",
      },
      { property: "og:title", content: "Unsaid — Say what's unsaid" },
      {
        property: "og:description",
        content: "Real people. Real conversations. Begin with words, not profiles.",
      },
    ],
  }),
  component: Landing,
});

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="relative w-2.5 h-2.5 rounded-full bg-ember shadow-[0_0_20px_var(--ember)]" />
          <span className="font-display text-lg tracking-tight">Unsaid</span>
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm text-muted-foreground">
          <a href="#idea" className="hover:text-foreground transition-colors">
            The idea
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#voices" className="hover:text-foreground transition-colors">
            Voices
          </a>
        </nav>
        <Link
          to="/auth"
          className="text-sm px-4 py-2 rounded-full glass hover:bg-white/5 transition-colors"
        >
          Enter
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain">
      {/* Ambient orb */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <motion.img
          src={heroOrb}
          alt=""
          width={1536}
          height={1536}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.7, scale: 1 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          className="w-[120vmin] h-[120vmin] object-cover blur-[2px] animate-breathe"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/40 to-background" />
      </div>

      <div className="relative z-10 max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-ember animate-pulse" />A quieter corner of
          the internet
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
          className="font-display text-[clamp(2.75rem,7vw,5.75rem)] leading-[1.02] tracking-tight"
        >
          Say what&rsquo;s <em className="italic font-light text-ember">unsaid.</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Meet people who truly understand you. No followers, no performance just honest
          conversation, guided gently by an AI that listens first.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 1 }}
          className="mt-12 flex items-center justify-center gap-4"
        >
          <Link
            to="/auth"
            className="group relative px-7 py-3.5 rounded-full bg-ember text-primary-foreground font-medium text-sm tracking-wide shadow-[var(--shadow-ember)] hover:scale-[1.02] transition-transform"
          >
            Begin
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <a
            href="#idea"
            className="px-6 py-3.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            What is this?
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-muted-foreground/60"
      >
        scroll quietly
      </motion.div>
    </section>
  );
}

function Idea() {
  const lines = [
    "There are things you've never told anyone.",
    "Not because they're secrets —",
    "but because no one ever asked.",
    "Unsaid begins where small talk ends.",
  ];
  return (
    <section id="idea" className="relative py-40 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, delay: i * 0.15 }}
            className={`font-display text-3xl md:text-5xl leading-tight ${
              i === lines.length - 1 ? "text-ember italic font-light" : "text-foreground/85"
            }`}
          >
            {line}
          </motion.p>
        ))}
      </div>
    </section>
  );
}

function How() {
  const steps = [
    {
      n: "01",
      title: "A quiet conversation",
      body: "An AI companion meets you first. No forms. Just a question, gently asked, and the space to answer however you'd like.",
    },
    {
      n: "02",
      title: "An intentional introduction",
      body: "When something resonates, the AI introduces you to another person who's also been thinking about it — anonymously.",
    },
    {
      n: "03",
      title: "A conversation that stays",
      body: "If you both choose to continue, your inbox holds it. Come back tomorrow, next week, whenever the words return.",
    },
  ];
  return (
    <section id="how" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="font-display text-4xl md:text-6xl mb-20 max-w-2xl"
        >
          Connection, slowed down.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-px bg-border/40 rounded-3xl overflow-hidden glass">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, delay: i * 0.15 }}
              className="p-10 bg-card/40 hover:bg-card/70 transition-colors"
            >
              <div className="text-xs tracking-[0.3em] text-ember mb-8">{s.n}</div>
              <h3 className="font-display text-2xl mb-4">{s.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-[15px]">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Voices() {
  const voices = [
    {
      name: "VelvetSignal",
      line: "I told them something I'd been carrying for years. They just… stayed.",
    },
    {
      name: "QuietOrbit",
      line: "It didn't feel like an app. It felt like a long walk with someone who got it.",
    },
    {
      name: "MidnightPassenger",
      line: "No photos. No bios. Somehow, more honest than anywhere else.",
    },
    { name: "HollowBloom", line: "I came back at 2am. The same conversation was waiting." },
  ];
  return (
    <section id="voices" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-xs tracking-[0.3em] text-muted-foreground mb-6"
        >
          ANONYMOUS · UNEDITED
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="font-display text-4xl md:text-6xl mb-16 max-w-3xl"
        >
          Whispers from inside.
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-6">
          {voices.map((v, i) => (
            <motion.figure
              key={v.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className="relative p-10 rounded-3xl glass overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--gradient-ember)] opacity-40 blur-2xl animate-drift" />
              <blockquote className="relative font-display text-xl md:text-2xl leading-snug text-foreground/90">
                &ldquo;{v.line}&rdquo;
              </blockquote>
              <figcaption className="relative mt-6 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-ember to-accent shadow-[0_0_20px_var(--ember-deep)]" />
                {v.name}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="relative py-40 px-6 overflow-hidden">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="w-[80vmin] h-[80vmin] rounded-full bg-[var(--gradient-ember)] blur-3xl animate-breathe" />
      </div>
      <div className="max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="font-display text-5xl md:text-7xl leading-[1.05]"
        >
          Somewhere, someone is{" "}
          <em className="italic font-light text-ember">thinking the same thing.</em>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 1 }}
          className="mt-12"
        >
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-ember text-primary-foreground font-medium text-sm tracking-wide shadow-[var(--shadow-ember)] hover:scale-[1.02] transition-transform"
          >
            Enter Unsaid
            <span>→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ember" />
          <span className="font-display tracking-tight">Unsaid</span>
          <span className="opacity-60">— anonymous by design</span>
        </div>
        <div className="opacity-60">© {new Date().getFullYear()} · A quieter way to be heard</div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="relative">
      <Nav />
      <main>
        <Hero />
        <Idea />
        <How />
        <Voices />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
