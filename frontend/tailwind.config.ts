import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f766e", // teal 700
          dark: "#115e59",
          light: "#5eead4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
