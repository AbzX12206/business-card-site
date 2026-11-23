/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Палитра из ТЗ: фон #F8FAFC, текст #0F172A, акцент #0284C7.
        canvas: "#F8FAFC",
        ink: {
          DEFAULT: "#0F172A",
          muted: "#475569", // контраст на canvas ≈ 7:1
        },
        line: "#E2E8F0",
        accent: {
          DEFAULT: "#0284C7", // декоративные элементы, крупные иконки
          dark: "#0369A1", // кнопки и ссылки с текстом (белый на нём ≈ 5.9:1, AA)
          soft: "#E0F2FE",
        },
        wa: {
          DEFAULT: "#128C7E", // плавающая кнопка (графика, ≥ 3:1)
          dark: "#0B6B5E", // кнопка с текстом (белый на нём ≈ 6.4:1)
        },
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          "Inter",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
      spacing: {
        // Вертикальный ритм секций: py-section
        section: "clamp(3.5rem, 8vw, 6rem)",
      },
      borderRadius: {
        card: "1rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.05), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
  plugins: [],
};
