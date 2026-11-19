/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./options.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070B18",
          900: "#0B1020",
          800: "#121A33",
          700: "#1B2547",
        },
        electric: {
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
        },
        violetglow: {
          400: "#A78BFA",
          500: "#7C3AED",
          600: "#6D28D9",
        },
      },
      boxShadow: {
        glow: "0 0 32px rgba(59, 130, 246, 0.35)",
        "glow-emerald": "0 0 32px rgba(16, 185, 129, 0.35)",
        "glow-violet": "0 0 32px rgba(124, 58, 237, 0.35)",
      },
    },
  },
  plugins: [],
};
