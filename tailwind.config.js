/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sunset: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          rose: "#e8896b",
          peach:"#f4a574",
          gold: "#d4a574",
          deep: "#3d1e15",
        },
      },
      fontFamily: {
        serif: ["'Cormorant Garamond'", "Georgia", "serif"],
        script: ["'Dancing Script'", "cursive"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui"],
      },
      animation: {
        "fade-in": "fadeIn 1.2s ease-in-out",
        "slow-pan": "slowPan 20s ease-in-out infinite alternate",
        "shimmer": "shimmer 3s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slowPan: {
          "0%":   { transform: "scale(1.05) translate(0,0)" },
          "100%": { transform: "scale(1.15) translate(-2%,-2%)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%":     { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};
