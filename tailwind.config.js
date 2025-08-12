/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enable dark mode using the 'class' strategy
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom Colors with Light and Dark Variants
      colors: {
        brandBlue: {
          DEFAULT: '#1E40AF', // Light mode color
          dark: '#1E3A8A',    // Dark mode color
        },
        brandRed: {
          DEFAULT: '#DC2626', // Light mode color
          dark: '#B91C1C',    // Dark mode color
        },
        // Define additional custom colors with variants
        brandGreen: {
          DEFAULT: '#10B981',
          dark: '#059669',
        },
        // Optionally, you can add custom shades or additional colors
      },
      // Custom Animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        fadeOut: 'fadeOut 0.3s ease-in',
      },
      // Custom Spacing
      spacing: {
        '128': '32rem', // Example custom spacing
        // Add more custom spacing as needed
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),        // Better form styling
    require('@tailwindcss/typography'),   // Rich text styling
    require('@tailwindcss/aspect-ratio'), // Aspect ratio utilities
    // Add other plugins as needed
  ],
}
