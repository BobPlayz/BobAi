# UI/UX Pro Max

Use this skill whenever BobAI's web interface is created, redesigned, or reviewed.

## goals

- design from the product's purpose and users, not from generic AI-dashboard templates
- choose a deliberate visual direction before implementing components
- keep typography, spacing, hierarchy, color, elevation, and interaction states consistent
- prefer clear information architecture and strong primary actions
- make responsive behavior intentional across mobile, tablet, and desktop
- preserve accessibility: keyboard access, visible focus, semantic controls, readable contrast, reduced-motion support, and useful alternative text
- use animation to communicate state, hierarchy, and continuity rather than decoration
- avoid excessive gradients, random glass cards, unnecessary badges, oversized headings, and animation that competes with the task
- reuse the existing BobAI design system and components before introducing new patterns
- preserve working functionality and change only the code required for the requested design work

## motion rules

BobAI uses the Motion library when animation is needed. Prefer small, purposeful transitions, layout changes, presence transitions, and gesture feedback. Respect `prefers-reduced-motion` and avoid animation on every element.

## review checklist

Before considering a UI task complete, check:

1. hierarchy and primary action are obvious
2. navigation works at every supported viewport
3. empty, loading, success, error, and disabled states exist where relevant
4. interactive elements have hover, focus, active, and disabled states
5. typography and spacing use consistent tokens
6. important content remains readable without relying on color alone
7. animation has a purpose and a reduced-motion path
8. existing components are not duplicated unnecessarily
9. images have meaningful alt text when they convey information
10. the final interface feels intentional for BobAI rather than like a generic generated template
