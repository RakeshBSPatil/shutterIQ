/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#060B19',
          900: '#0B132B',
          800: '#1C2541',
          700: '#2A375B',
        },
      },
    },
  },
  plugins: [],
};
