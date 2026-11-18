/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: '#3B82F6',
          secondary: '#60A5FA',
          tertiary: '#93C5FD',
          quaternary: '#BFDBFE',
          quinary: '#DBEAFE',
          senary: '#EFF6FF',
          septenary: '#F3F4F6',
          octonary: '#F9FAFB',
          nonary: '#F3F4F6',
        },
        typography: {
          DEFAULT: {
            css: {
              maxWidth: 'none',
              color: 'inherit',
              a: {
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: '500',
              },
              strong: {
                color: 'inherit',
              },
              p: {
                marginTop: '0.5em',
                marginBottom: '0.5em',
              },
            },
          },
        },
      },
    },
    plugins: [require("tailwindcss-animate"), typography],
  }