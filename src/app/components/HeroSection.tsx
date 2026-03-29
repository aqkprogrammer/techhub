import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-9xl font-black text-slate-900"
      >
        404
      </motion.h1>

      <h2 className="mt-4 text-2xl font-semibold text-slate-800">
        This route doesn’t compile.
      </h2>

      <p className="mt-3 max-w-md text-slate-600 text-center">
        The page you’re looking for doesn’t exist.
        Let’s get you back to building greatness.
      </p>
    </>
  );
}
