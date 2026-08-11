import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Layers, Sun, ArrowRight } from "lucide-react";

import { BlurText } from "@/components/landing/BlurText";
import { FadingVideo } from "@/components/landing/FadingVideo";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";
const CAPABILITIES_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QueuePredict — Know Before You Wait" },
      {
        name: "description",
        content:
          "QueuePredict forecasts real-world queues with AI. See live crowd levels, wait times and 4-hour predictions for banks, hospitals and more.",
      },
      { property: "og:title", content: "QueuePredict — Know before you go" },
      {
        property: "og:description",
        content:
          "AI-powered live crowd levels, wait times and 4-hour queue forecasts on an interactive map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NAV_LINKS = [
  "Find Nearby Services",
  "Compare Waiting Times",
  "Real-Time Crowd Updates",
  "AI-Powered Predictions",
  "Report Current Crowd",
];
const PARTNERS = ["Banks", "Hospitals", "Government Offices", "Retail Stores"];

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: "LIVE CROWD",
    tag: "Real-time",
    body: "See current crowd levels reported by users at nearby locations.",
  },
  {
    icon: Layers,
    title: "AI WAIT PREDICTION",
    tag: "Predictive",
    body: "Get an estimated waiting time using real-time reports and historical patterns.",
  },
  {
    icon: Sun,
    title: "SMART CHOICE",
    tag: "Decision",
    body: "Compare nearby locations by crowd, distance, and predicted waiting time.",
  },
];


function Landing() {
  return (
    <main className="bg-black text-white">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <FadingVideo
          src={HERO_VIDEO}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/85" />

        <nav className="relative z-20 mx-auto mt-6 flex w-[min(1180px,92vw)] items-center justify-between gap-4 rounded-full liquid-glass liquid-glass-strong px-3 py-2 md:fixed md:inset-x-0 md:top-6">
          <span className="pl-4 font-display text-xl italic tracking-tight">QueuePredict</span>
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link}>
                <a
                  href="#capabilities"
                  className="rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
          <Link
            to="/app"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
          >
            Explore Live Queues
          </Link>
        </nav>

        <div className="relative z-10 mx-auto flex w-[min(1180px,92vw)] flex-1 flex-col justify-center pt-28 pb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-6 w-fit rounded-full liquid-glass px-4 py-1.5 text-xs uppercase tracking-[0.24em] text-white/70"
          >
            Stop guessing. Start knowing.
          </motion.p>

          <h1 className="max-w-4xl font-display text-5xl italic leading-[1.02] sm:text-6xl md:text-7xl lg:text-8xl">
            <BlurText text="Know Before You Wait." />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mt-8 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            QueuePredict helps you check crowd levels, predict waiting times, and choose the
            best time and place to visit.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Explore Live Queues
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#capabilities"
              className="inline-flex items-center gap-2 rounded-full liquid-glass liquid-glass-strong px-7 py-4 text-sm font-medium text-white/85"
            >
              Report a Queue
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-14 flex flex-wrap gap-4"
          >
            {[
              { value: "LESS WAITING", label: "Skip the busiest hours" },
              { value: "BETTER PLANNING", label: "Pick the right time to go" },
              { value: "REAL-TIME INFORMATION", label: "Live crowd updates from users" },
              { value: "SMARTER DECISIONS", label: "Choose the fastest nearby option" },
            ].map((stat) => (
              <div
                key={stat.value}
                className="min-w-[220px] flex-1 rounded-[28px] liquid-glass liquid-glass-strong px-6 py-5"
              >
                <p className="font-display text-3xl italic md:text-4xl">{stat.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-3"
          >
            <span className="text-xs uppercase tracking-[0.22em] text-white/40">
              Supported locations
            </span>
            {PARTNERS.map((partner) => (
              <span
                key={partner}
                className="font-display text-xl italic text-white/55 transition-colors hover:text-white"
              >
                {partner}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* --------------------------- CAPABILITIES --------------------------- */}
      <section
        id="capabilities"
        className="relative flex min-h-screen flex-col justify-center overflow-hidden"
      >
        <FadingVideo
          src={CAPABILITIES_VIDEO}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90" />

        <div className="relative z-10 mx-auto w-[min(1180px,92vw)] py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <span className="rounded-full liquid-glass px-4 py-1.5 text-xs uppercase tracking-[0.24em] text-white/65">
              Real-Time Crowd Updates
            </span>
            <h2 className="mt-6 font-display text-5xl italic leading-tight md:text-7xl">
              Compare Waiting Times
            </h2>
            <p className="mt-5 text-base text-white/65 md:text-lg">
              Find nearby services, see how busy they are right now, and let AI-powered
              predictions tell you when to go — QueuePredict turns waiting into a decision.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, delay: index * 0.12 }}
                className="rounded-[32px] liquid-glass liquid-glass-strong p-7"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 font-display text-3xl italic">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{item.body}</p>
                <span className="mt-6 inline-block rounded-full border border-white/20 px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-white/70">
                  {item.tag}
                </span>
              </motion.article>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-14"
          >
            <Link
              to="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              QueuePredict — Turn waiting into a decision.
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
