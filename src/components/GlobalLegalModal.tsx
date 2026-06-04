import React from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";

interface PopiaModalProps {
  onClose: () => void;
}

export const GlobalLegalModal = ({ onClose }: PopiaModalProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-6 overflow-hidden pointer-events-auto"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-zinc-950 border border-zinc-800/50 sm:rounded-[2.5rem] rounded-t-[2.5rem] w-full max-w-2xl text-left shadow-2xl flex flex-col max-h-[85dvh]"
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-900">
          <div className="flex items-center gap-3 text-zinc-100">
            <ShieldCheck className="w-6 h-6 text-[#f59e0b]" />
            <h2 className="text-sm font-black uppercase tracking-widest">
              Global Legal & Privacy (POPIA)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto font-mono text-xs flex-1 space-y-8 text-zinc-400">
          <section className="space-y-4">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm border-l-4 border-[#f59e0b] pl-3">
              I. The Independent Rider Agreement
            </h3>
            <p>
              By accessing the Local Eats SA Rider Network, you agree that you
              are operating as an <strong>Independent Contractor</strong>. You
              are not a formal employee of Local Eats SA.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-500">
              <li>
                You control your active online status and accept deliveries at
                your sole discretion.
              </li>
              <li>
                You are responsible for your own transport setup, valid
                licensing, and operational expenses.
              </li>
              <li>
                Local Eats SA acts exclusively as a technology bridge (software
                service) pairing Independent Riders with local Merchant
                requests.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm border-l-4 border-emerald-500 pl-3">
              II. Privacy & POPIA Compliance
            </h3>
            <p>
              In accordance with the South African Protection of Personal
              Information Act (POPIA), rigorous restrictions apply to Customer
              tracking telemetry and dataset exposure:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-500">
              <li>
                <strong>Temporary Payload Delivery:</strong> Customer contact
                nodes (names, phone numbers) and exact GPS coordinate payloads
                are encrypted during delivery.
              </li>
              <li>
                <strong>Zero-Retention Policy:</strong> Riders are strictly
                prohibited from copying, screen-recording, or retaining client
                information outside the active navigation loop of the mobile web
                app. All customer coordinates and telemetry are wiped from
                independent interfaces upon order completion.
              </li>
              <li>
                The Local Eats SA software portal aggregates anonymized lat/lng
                metrics for localized surge monitoring only.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm border-l-4 border-cyan-500 pl-3">
              III. Merchant & Client Liability
            </h3>
            <p>
              Food quality, menu accuracy, packaging integrities, and
              preparation timelines remain the sole legal obligation of the
              licensed Merchant generating the dispatch request.
            </p>
            <p className="text-zinc-500">
              Local Eats SA disclaims liability for order deviations at point of
              sale. Pricing algorithms, Digital/Cash-on-Arrival rules, and
              platform aggregator exemptions are explicitly acknowledged at the
              storefront checkout layer.
            </p>
          </section>
        </div>

        <div className="p-6 border-t border-zinc-900 bg-zinc-900/20 rounded-b-[2.5rem]">
          <button
            onClick={onClose}
            className="w-full py-4 bg-[#f59e0b] text-black font-black uppercase tracking-[0.2em] rounded-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)]"
          >
            Acknowledge & Sync Operations
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
