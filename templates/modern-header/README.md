# Modern Header Template

A sleek, semi-transparent header template with modern design principles and interactive navigation.

## Features

- **Semi-transparent glass morphism design** with backdrop blur effects
- **Absolute positioning** at the top of the page
- **Two navigation options**: "Template" and "More Templates"
- **Responsive design** that works on all devices
- **Smooth animations** and hover effects
- **Scroll-based header transformation** with enhanced styling when scrolled
- **Interactive selection feedback** with animated notifications

## Design Elements

### Header Structure
- **Logo**: Gradient text with hover scaling effect
- **Navigation Buttons**:
  - Primary button with gradient background
  - Secondary button with transparent background and border
  - Hover effects with shine animation and elevation
- **Glass morphism**: Semi-transparent background with blur effects

### Visual Effects
- **Backdrop filter blur** for modern glass effect
- **Gradient backgrounds** and text effects
- **Smooth transitions** with cubic-bezier timing
- **Box shadows** for depth and elevation
- **Shine animation** on button hover

### Responsive Behavior
- **Mobile-optimized** layout with smaller padding and font sizes
- **Touch-friendly** button sizes
- **Adaptive grid** for feature cards

## Usage

1. **Copy the HTML structure** from `index.html`
2. **Customize the colors** by modifying CSS custom properties in `:root`
3. **Update navigation options** by changing the button text and click handlers
4. **Modify the logo** by updating the `.header-logo` content

## Customization

### Colors
```css
:root {
    --primary-rgb: 14 165 233; /* Change primary color */
    --glass-bg: rgba(255, 255, 255, 0.85); /* Adjust transparency */
}
```

### Button Actions
```javascript
function selectOption(option) {
    // Add your custom logic here
    if (option === 'template') {
        // Handle template selection
    } else if (option === 'more-templates') {
        // Handle more templates selection
    }
}
```

## Browser Support

- Modern browsers with CSS backdrop-filter support
- Fallback styles for older browsers
- Progressive enhancement approach

## Performance

- Optimized CSS with efficient selectors
- Hardware-accelerated animations
- Minimal JavaScript footprint
- Lazy loading compatible