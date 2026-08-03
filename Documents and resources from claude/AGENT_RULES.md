# AI Agent Development Rules
For Website, Mobile App & Software Development

## 1. Core Development Principle

Always follow the **Source of Truth Approach**.

Nothing should be hardcoded unless it is a temporary placeholder during early prototyping and clearly marked with TODO comments.

All important values, content, features, functions, configurations, labels, pricing, user data, product data, service data, media, and dynamic UI elements must come from a proper source of truth such as:

- Database
- Backend API
- CMS
- Environment variables
- Global config files
- Constants file
- Design token file
- Theme/style guideline file

Hardcoded values should be avoided in components, screens, pages, and business logic.

---

## 2. Dynamic Data & Backend Connectivity

All features and functions must be dynamically connected with the backend and database wherever required.

The agent must ensure:

- No static dummy data in production-ready files.
- All forms submit data to backend/database.
- All user-generated data is stored properly.
- All admin-editable content should be manageable from backend/CMS/admin panel.
- All variable values should come from database, API, config, or environment files.
- API integration should include proper loading, success, error, and empty states.
- Data should be validated on both frontend and backend.
- Backend responses should be structured, predictable, and reusable.

---

## 3. Asset Management Rules

All images, icons, videos, illustrations, animations, and media assets must be saved in properly categorized folders.

Recommended folder structure:

```txt
/assets
  /images
    /hero
    /banners
    /products
    /portfolio
    /team
    /backgrounds
    /placeholders
  /icons
    /navigation
    /services
    /social
    /features
  /videos
  /animations
  /logos
  /fonts
```

Every asset must be renamed properly using a clear naming convention.

Example:

```txt
hero-home-1440x900.webp
service-uiux-icon-64x64.svg
portfolio-branding-card-800x600.webp
placeholder-user-avatar-300x300.webp
```

Asset names should include:

- Purpose
- Placement
- Size/dimensions
- Format
- Placeholder name if applicable

Avoid random names like:

```txt
image1.png
final-new.png
abc.jpg
icon-copy.svg
```

---

## 4. Image Optimization Rules

Images must be optimized before use.

The agent must ensure:

- Use the smallest possible file size while maintaining visual quality.
- Use modern formats like WebP, AVIF, or optimized SVG wherever possible.
- Use PNG only when transparency is required.
- Use JPG/JPEG only for photographs where WebP is not suitable.
- Never upload unnecessarily large images.
- Never use pixelated or low-quality images.
- Image dimensions should match actual screen usage.
- Use responsive image sizes for different screen widths.
- Use lazy loading for below-the-fold images.
- Use proper alt text for accessibility and SEO.
- Compress all generated images before production use.

Recommended image handling:

```txt
Mobile: smaller optimized image
Tablet: medium optimized image
Desktop: larger optimized image
Retina screens: high-density image where required
```

---

## 5. Responsive Design Rules

All pages, screens, sections, components, and layouts must be fully responsive.

The agent must test and support:

- Mobile screens
- Tablet screens
- Laptop screens
- Desktop screens
- Large displays

The UI should not break on any screen size.

Required responsive behavior:

- Flexible grids
- Fluid typography
- Proper spacing
- Adaptive layouts
- Responsive navigation
- Touch-friendly buttons
- Proper image scaling
- No horizontal overflow
- Forms usable on mobile
- Modals/drawers optimized for small screens

The agent must never design only for desktop.

---

## 6. Brand Identity & Style Guidelines

Always strictly follow the provided brand identity and style guidelines.

The agent must follow:

- Font family
- Typography scale
- Font weights
- Color palette
- Gradients
- Button styles
- Icon style
- Illustration style
- Border radius
- Spacing system
- Shadows
- Graphic elements
- Logo usage
- UI component style
- Animation style

No random colors, fonts, icons, or design styles should be added without matching the brand guideline.

If brand guidelines are provided, create a reusable theme/token system.

Recommended structure:

```txt
/styles
  theme.ts
  colors.ts
  typography.ts
  spacing.ts
  shadows.ts
  breakpoints.ts
```

---

## 7. Component-Based Development

The agent must create reusable, scalable, and clean components.

Avoid repeating the same UI code again and again.

Each component should be:

- Reusable
- Responsive
- Easy to maintain
- Connected with dynamic props/data
- Styled according to brand system
- Properly named
- Organized in folders

Recommended structure:

```txt
/components
  /common
  /layout
  /forms
  /cards
  /buttons
  /navigation
  /modals
  /sections
```

---

## 8. Clean Code Rules

The agent must write clean, readable, and maintainable code.

Rules:

- Use meaningful variable names.
- Avoid unnecessary code.
- Remove unused imports.
- Remove unused files.
- Avoid duplicate logic.
- Use comments only where needed.
- Follow consistent formatting.
- Keep files organized.
- Keep functions small and focused.
- Avoid deeply nested code.
- Use proper error handling.

Bad example:

```js
const x = "Design";
```

Good example:

```js
const serviceTitle = serviceData.title;
```

---

## 9. Environment & Configuration Rules

Sensitive or environment-specific values must never be hardcoded.

Use environment variables for:

- API keys
- Backend URLs
- Database URLs
- Payment gateway keys
- Auth keys
- Email service keys
- Third-party integrations
- Storage bucket paths

Example:

```env
NEXT_PUBLIC_API_BASE_URL=
DATABASE_URL=
PAYMENT_GATEWAY_KEY=
CLOUD_STORAGE_BUCKET=
```

Never expose secret keys on frontend.

---

## 10. Form & Data Handling Rules

All forms must be fully functional.

The agent must ensure:

- Proper input validation
- Required field validation
- File upload support where required
- Correct data categorization
- Backend/database submission
- Success message
- Error message
- Loading state
- Spam protection if needed
- Clear user feedback

For file upload forms:

- Support JPG, PNG, PDF, DOCX, and other required formats.
- Store files in organized cloud storage folders.
- Save file URLs/references in database.
- Show upload progress where possible.
- Restrict file size and invalid file types.

---

## 11. API & Database Rules

All API calls must be organized properly.

Recommended structure:

```txt
/services
  apiClient.ts
  authService.ts
  userService.ts
  productService.ts
  projectService.ts
  uploadService.ts
```

The agent must ensure:

- Proper API error handling
- Token/auth handling
- Reusable API client
- Database schema is clean
- Relationships are clearly defined
- Data models are scalable
- No duplicate records unless required
- Secure access rules
- Proper CRUD operations

---

## 12. Authentication & Security Rules

The agent must follow secure development practices.

Required security rules:

- Never expose secret keys.
- Validate user input.
- Sanitize form data.
- Protect private routes.
- Use role-based access where required.
- Use secure authentication.
- Use HTTPS in production.
- Prevent unauthorized database access.
- Apply proper CORS rules.
- Protect file uploads.
- Avoid storing sensitive data in local storage unless necessary.

---

## 13. Performance Rules

The final project must be optimized for speed and smooth usage.

The agent must ensure:

- Fast initial loading
- Optimized images
- Lazy loading
- Code splitting where needed
- Minimized unused JavaScript
- Optimized fonts
- Proper caching
- Lightweight animations
- Avoid unnecessary re-renders
- Avoid heavy libraries unless required

The website/app should feel smooth on both high-end and low-end devices.

---

## 14. SEO Rules for Websites

For website projects, the agent must include SEO best practices.

Required:

- Proper page titles
- Meta descriptions
- Open Graph tags
- Twitter/social preview tags
- Clean URL structure
- Semantic HTML
- Proper heading hierarchy
- Image alt text
- Sitemap
- Robots.txt
- Schema markup where useful
- Fast loading speed
- Mobile-friendly layout

---

## 15. Accessibility Rules

The agent must create accessible UI.

Required:

- Proper color contrast
- Readable font sizes
- Keyboard navigation support
- Focus states
- Alt text for images
- Labels for form fields
- ARIA attributes where needed
- Buttons should have clear text
- Avoid relying only on color to communicate meaning

---

## 16. UI/UX Rules

The agent must focus on clear, smooth, and user-friendly experience.

Required:

- Clear navigation
- Clean visual hierarchy
- Proper spacing
- Consistent components
- Clear CTAs
- Helpful empty states
- Helpful error states
- Smooth transitions
- Avoid clutter
- Avoid unnecessary complexity
- Keep user journey simple

Every screen should answer:

```txt
What is this screen for?
What should the user do here?
What happens after the action?
```

---

## 17. Mobile App Specific Rules

For mobile apps, the agent must ensure:

- Touch-friendly buttons
- Proper safe area handling
- Responsive layouts for different devices
- Smooth scrolling
- Native-feeling interactions
- Offline/error states where needed
- Optimized app assets
- Proper navigation structure
- App permissions handled clearly
- Push notifications only if required
- No unnecessary heavy assets

---

## 18. Admin Panel Rules

If an admin panel is part of the project, all editable website/app content should be manageable from admin.

Admin should be able to manage:

- Services
- Products
- Categories
- Images
- Banners
- Users
- Orders
- Leads
- Form submissions
- Blog posts
- Testimonials
- Pricing
- FAQs
- Portfolio items
- Project requests

No content should require code changes if it is meant to be updated regularly.

---

## 19. Error Handling Rules

The agent must add proper error handling everywhere.

Required states:

- Loading
- Success
- Error
- Empty data
- Network failure
- Unauthorized access
- Form validation error
- File upload error
- Payment failure if payment is used

Never leave the user confused after an action.

---

## 20. Testing & Quality Check Rules

Before final delivery, the agent must check:

- All pages load properly.
- All links work.
- All buttons work.
- All forms submit correctly.
- All images load properly.
- Responsive design works.
- No console errors.
- No broken layouts.
- No unused dummy data.
- No hardcoded production content.
- Database connection works.
- Backend API works.
- Authentication works if included.
- File upload works if included.

---

## 21. Documentation Rules

The agent must maintain basic project documentation.

Required documentation:

```txt
README.md
.env.example
setup-guide.md
database-schema.md
api-documentation.md
deployment-guide.md
```

README should include:

- Project overview
- Tech stack
- Installation steps
- Environment variables
- Development command
- Build command
- Deployment notes
- Folder structure
- Known limitations

---

## 22. Version Control Rules

The agent must keep the project clean for version control.

Rules:

- Do not commit `.env` files.
- Add `.env.example`.
- Add proper `.gitignore`.
- Avoid uploading unnecessary generated files.
- Keep commit-ready clean structure.
- Remove unused assets and components.
- Keep naming consistent.

---

## 23. Final Delivery Rules

Before final output, the agent must provide:

- Summary of completed work
- Files created/updated
- Features implemented
- Database/backend changes
- Environment variables required
- Testing checklist
- Known pending items
- Deployment instructions

The project should not be considered complete until it is functional, responsive, dynamic, optimized, and aligned with the given brand guidelines.

---

## 24. Scalability Rules

The agent must build with future expansion in mind.

Required:

- Keep architecture modular.
- Avoid tightly coupled logic.
- Use reusable services and utilities.
- Keep database schema extendable.
- Plan for new roles, features, and modules.
- Avoid one-time hacks that will break future development.

---

## 25. State Management Rules

Use proper state management according to project size.

The agent must ensure:

- Local UI state stays inside components where appropriate.
- Global state is used only when multiple screens need shared data.
- Server state should be handled through API/query layers where possible.
- Avoid unnecessary prop drilling.
- Keep state predictable and easy to debug.

---

## 26. Routing & Navigation Rules

All navigation must be clean, logical, and scalable.

The agent must ensure:

- Clear route structure.
- Protected routes for authenticated sections.
- Redirects for unauthorized access.
- Active state for navigation items.
- Meaningful page URLs.
- Back button behavior works correctly.
- Mobile navigation works smoothly.

---

## 27. Payment & Transaction Rules

If payment is included, the agent must follow secure payment flow.

Required:

- Never hardcode payment status.
- Payment confirmation must come from backend/webhook.
- Store transaction records in database.
- Show proper success, failure, and pending states.
- Generate invoice/receipt if required.
- Do not expose private payment keys on frontend.

---

## 28. Notification Rules

If notifications are included, they must be meaningful and non-intrusive.

The agent must support:

- Email notifications where required.
- In-app notifications where required.
- Push notifications only when useful.
- Clear notification preferences if needed.
- No duplicate or unnecessary alerts.

---

## 29. Content Management Rules

All regularly changing website/app content should be editable without touching code.

Dynamic content may include:

- Hero text
- Service details
- Pricing
- Portfolio projects
- Blog posts
- FAQs
- Testimonials
- Contact details
- Banners
- Offers
- Case studies

Prefer CMS/admin/database over static text inside components.

---

## 30. AI Agent Workflow Rules

The AI agent must work in a structured development process.

Before coding, the agent should:

- Understand the project goal.
- Review brand guidelines.
- Review existing file structure.
- Identify the source of truth.
- Plan database/backend requirements.
- Check responsive requirements.
- Identify reusable components.

During coding, the agent should:

- Make focused changes.
- Avoid breaking existing working features.
- Keep code organized.
- Reuse existing patterns.
- Update related files properly.
- Avoid duplicate components.

After coding, the agent should:

- Review functionality.
- Check responsiveness.
- Check console errors.
- Check dynamic data flow.
- Confirm no production hardcoding remains.
- Provide a clean summary.

---

# Final Rule

Build everything as a scalable real-world product, not as a static demo.

The final website, mobile app, or software must be:

- Dynamic
- Responsive
- Secure
- Optimized
- Brand-consistent
- Database-connected
- Easy to maintain
- Ready for future updates
