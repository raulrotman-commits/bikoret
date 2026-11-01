import type { Config } from "tailwindcss";

// צבעי רוטמן בטיחות (מהפלייר): כחול כהה #0D2153 ← #06102B, זהב #D4A018, טקסט לבן
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF1F8",
          100: "#D5DCEC",
          200: "#AAB7D6",
          300: "#7A8DBC",
          500: "#2A3F7A",
          700: "#13286A",
          800: "#0D2153",
          900: "#06102B",
        },
        gold: {
          50: "#FBF5E3",
          100: "#F5E6B8",
          300: "#E6C25A",
          500: "#D4A018",
          600: "#B78A12",
          700: "#8A6500",
        },
        danger: {
          50: "#FDECEC",
          500: "#C62828",
          700: "#8E1B1B",
        },
      },
      fontFamily: {
        sans: ["Heebo", "Assistant", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
