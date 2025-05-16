/** @type {import('tailwindcss').Config} */
module.exports = {
  // Content paths - where Tailwind should look for class usage
  // This tells Tailwind which files to scan for class names
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  
  // Theme customization - where you define your design system
  theme: {
    // You can completely override default theme settings
    // or use `extend` to add to the defaults
    extend: {
      // Custom color palette for our application
      colors: {
        // Primary blue color with various shades
        primary: {
          50: '#EBF5FF',
          100: '#E1EFFE',
          200: '#C3DDFD',
          300: '#A4CAFE',
          400: '#76A9FA',
          500: '#3F83F8',
          600: '#2563EB', // This is our main brand color
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Secondary colors
        secondary: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        // Alert/Warning colors
        warning: '#FBBF24',
        error: '#EF4444',
        success: '#10B981',
      },
      // Custom spacing values
      spacing: {
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
      // Custom fonts (you would need to import these elsewhere)
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'system-ui', 'sans-serif'],
      },
      // Custom border radius
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      // Custom animations
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      // Custom box shadows
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card': '0px 4px 12px rgba(0, 0, 0, 0.05)',
      },
      // Responsive design breakpoints
      screens: {
        'xs': '475px',
        // Default Tailwind breakpoints included automatically:
        // 'sm': '640px',
        // 'md': '768px',
        // 'lg': '1024px',
        // 'xl': '1280px',
        // '2xl': '1536px',
      },
    },
  },
  
  // Plugins section - extend Tailwind with additional functionality
  plugins: [
    // You would add plugins here like:
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/aspect-ratio'),
  ],
  
  // Core plugins - disable any unused core features for smaller builds
  corePlugins: {
    // Example: disable opacity variants for background colors if not needed
    // backgroundOpacity: false,
  },
  
  // Prefix - add a prefix to all Tailwind classes to avoid conflicts
  // prefix: 'tw-',  // This would change 'bg-blue-500' to 'tw-bg-blue-500'
  
  // Important - make all Tailwind utilities use the !important modifier
  // important: true,
  
  // Separator - change the separator character in class names
  // separator: '_',  // This would change 'bg-blue-500' to 'bg_blue_500'
  
  // Variants - control which variants are generated for each utility
  // In Tailwind CSS v3, the JIT engine automatically generates all variants
  // This section is less necessary than in earlier versions
}
