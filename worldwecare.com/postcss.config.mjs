/**
 * Tailwind CSS v4 wires itself through PostCSS. No tailwind.config.js
 * is needed — theme customization lives directly inside globals.css
 * via `@theme { … }`.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
