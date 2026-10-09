# Dynamic Island Notification System — Detailed Functionality Prompt

## Overview
The Dynamic Island is a notification system inspired by macOS Dynamic Island. It displays real-time notifications (alerts, messages, emergencies) as an animated pill/bell icon in the top-right corner of the viewport. Users can click to expand and view notification details, dismiss notifications, and interact with them.

---

## Core Responsibilities

### 1. Rendering Location & Z-Index
- Rendered globally in `App.tsx` at `fixed top-3 right-3 z-[5000]`
- Always visible in viewport regardless of current page/route
- Must NOT be clipped by any parent container `overflow-hidden` or `clip-path`
- Must sit above all other UI elements including the Shell sidebar, mobile nav, and content areas
- The expanded dropdown must NOT be clipped by any container
- Must render above the `BleConnectDialog` (z-[6000]) and `EmergencyModal`
- If a modal/dialog opens, the Dynamic Island must either be hidden behind it or remain accessible

### 2. Display States — Bell Pill (Default)
- **No notifications (`count === 0`):**
  - Show a bell icon (`LuBell size={20}`) with `text-tx3` color (dim/gray)
  - Pill container is `w-11` (fixed width, icon only)
  - Bell is NOT clickable (should not expand)
  - Component is hidden by default via `-translate-y-20 opacity-0 pointer-events-none`
  - When first notification arrives, animate in from top (`translate-y-0 opacity-100 pointer-events-auto`)
  - Entrance animation: `expand-from-capsule` — scale from 0.3 to 1 with slight translateY

- **With notifications (`count > 0`):**
  - Show a bell icon (`LuBell size={20}`) with `text-ac` color (brand blue)
  - Show a red badge counter badge at `-top-2 -right-2`:
    - `flex h-5 min-w-5 items-center justify-center rounded-full bg-ac px-1.5 text-[0.5rem] font-extrabold text-white`
    - Display `count > 99 ? '99+' : count`
  - Pill is clickable to expand
  - Bell should have a subtle pulse/glow animation to draw attention
  - On hover, pill background changes to `hover:bg-s2/50`
  - Pill container is `w-11` in collapsed state

- **When expanded (`expanded === true`):**
  - Pill expands to `w-[26rem]` (wide, showing content)
  - Inside the expanded pill, display:
    - Left: Icon circle with type-specific color:
      - `critical` → `bg-rd/15 text-rd` with `LuTriangleAlert size={16}`
      - `warning` → `bg-am/15 text-am` with `LuInfo size={16}`
      - `info` → `bg-ac/15 text-ac` with `LuInfo size={16}`
    - Center: Notification title (bold, `[0.68rem]`) and message text (truncated, `[0.58rem] text-tx2`)
    - Right: Close button (`LuX size={12}`) that collapses the pill
  - Also show the expanded dropdown below the pill (see below)

### 3. Display States — Expanded Dropdown
- When `expanded === true`, render a dropdown below the pill:
  - Position: `absolute bottom-full left-1/2 -translate-x-1/2 mb-2`
  - Width: `w-[26rem]`
  - Styling: `rounded-3xl border-2 border-tx3/15 bg-s1 p-4`
  - Animation: `initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}`
  - Content:
    - **Header row** (`flex items-center gap-3 border-b-2 border-tx3/10 px-5 py-4`):
      - Type icon circle (same as pill expanded state but larger: `h-10 w-10 rounded-2xl`)
      - Title (bold `[0.82rem]`) and message (`[0.68rem] leading-relaxed text-tx2`)
      - No close button in header (the pill close handles collapse)
    - **Trigger Details** (if `latest.details` exists):
      - Section header: `text-[0.6rem] font-bold tracking-[0.1em] text-tx3 uppercase`
      - Details block: `whitespace-pre-wrap rounded-2xl border border-tx3/10 bg-s2/50 p-3 text-[0.66rem] leading-relaxed text-tx2`
    - **"More notifications" section** (if `items.length > 1`):
      - Section header: `text-[0.6rem] font-bold tracking-[0.1em] text-tx3 uppercase` showing `{items.length - 1} more notifications`
      - List of up to 5 most recent notifications (excluding latest):
        - Each item: `flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-s2/50`
        - Type icon circle (`h-6 w-6 rounded-full` with type-specific colors)
        - Truncated title (`text-[0.64rem] font-medium text-tx2`)
        - Clicking dismisses that specific notification

### 4. Auto-Hide Behavior
- **Default behavior:** Component is hidden (`-translate-y-20 opacity-0 pointer-events-none`) when there are no notifications
- When a notification is added:
  - Component slides down into view (`translate-y-0 opacity-100 pointer-events-auto`)
  - A 15-second auto-hide timer starts
  - If another notification arrives within 15 seconds, the timer resets
- **Mouse interaction:**
  - `onMouseEnter`: If `items.length > 0`, set `hide = false` (keep visible)
  - `onMouseLeave`: Restart the 15-second auto-hide timer
- The component should NOT auto-hide if the user is actively hovering over it
- The timer must be properly cleaned up on unmount and when `items.length` changes

### 5. Notification Types & Styling

#### `info` type:
- Icon: `LuInfo`
- Colors: `bg-ac/15 text-ac` (pill), `bg-ac/15 text-ac` (dropdown icon)
- Badge count: `bg-ac` (blue)

#### `warning` type:
- Icon: `LuInfo` (same icon as info but different color)
- Colors: `bg-am/15 text-am` (amber)
- Badge count: `bg-ac` (still blue for count badge)

#### `critical` type:
- Icon: `LuTriangleAlert`
- Colors: `bg-rd/15 text-rd` (red)
- Badge count: `bg-ac` (still blue for count badge)
- Should trigger a subtle pulse animation on the bell icon

### 6. Notification Data Model
```typescript
interface IslandNotification {
  id: string           // Unique identifier, e.g., `msg-${nodeId}-${Date.now()}` or `alert-${item.id}`
  title: string        // Main title shown in notification
  message?: string     // Short message/subtitle shown in expanded view
  details?: string     // Full details shown in "Trigger Details" section
  type: 'info' | 'warning' | 'critical'  // Severity type
  ts: number           // Timestamp (Date.now())
}
```

### 7. Notification Sources
Notifications are triggered from multiple sources via `notifyDynamicIsland(n)`:

#### A. New Messages (`notifyNewMessage` from `lib/notify.ts`):
- Called when a new message arrives from a field node
- `title`: `emergency ? 'Emergency' : \`Message · Node-${nodeId}\``
- `message`: `text.slice(0, 80)` — truncated message text
- `details`: Full message with node ID, priority, timestamp, and full text
- `type`: `emergency ? 'critical' : 'info'`
- Priority 3 = emergency/critical, others = info

#### B. Alert Popups (`fireAlertIsland` from `components/ui/PopupCenter.tsx`):
- Called when an alert popup fires
- `title`: `item.title`
- `message`: `item.message`
- `details`: `Severity: ${danger ? 'Critical' : 'Warning'}\nTime: ...\n\n${item.message}`
- `type`: `danger ? 'critical' : 'warning'`

#### C. Future sources:
- Any code can call `notifyDynamicIsland(n)` with a valid `Omit<IslandNotification, 'ts'>` object
- The function should always add the notification to the store with `ts: Date.now()`

---

## Zustand Store Integration

### Store selectors:
```typescript
const items = useNexusStore((s) => s.islandNotifications)  // Array<IslandNotification>
const dismissIslandNotification = useNexusStore((s) => s.dismissIslandNotification)
const addIslandNotification = useNexusStore((s) => s.addIslandNotification)
```

### Store actions:
- `addIslandNotification(n)`: Adds notification with timestamp:
  ```typescript
  set((s) => ({
    islandNotifications: [...s.islandNotifications, { ...n, ts: Date.now() }],
  }))
  ```
- `dismissIslandNotification(id)`: Removes by id:
  ```typescript
  set((s) => ({
    islandNotifications: s.islandNotifications.filter((x) => x.id !== id),
  }))
  ```
- `clearIslandNotifications()`: Clears all

### Re-render behavior:
- The component subscribes to `islandNotifications` array
- Zustand should trigger re-render when array changes (new array reference via spread)
- Must NOT cause infinite re-renders

---

## Animation & Transition Requirements

### Entrance/Exit Animations:
- **Container show/hide:** `transition-all duration-300` with `-translate-y-20` / `translate-y-0` and `opacity-0` / `opacity-100`
- **Pill expand/collapse:** `framer-motion` `layout` with `spring` (`stiffness: 400, damping: 30`)
- **Bell opacity:** `AnimatePresence mode="popLayout"` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}`
- **Dropdown:** `motion.div` with `initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}`
- **List items:** Smooth fade-in with stagger (consider adding delay per item)

### Hover/Interaction States:
- Bell pill hover: `hover:bg-s2/50`
- Dropdown item hover: `hover:bg-s2/50`
- Close button hover: `hover:bg-tx3/10 hover:text-tx`
- Dismiss button hover: `hover:bg-s2/50`
- Connect button hover: `hover:bg-ac/12`
- Manage button hover: `hover:bg-gn/20`

### Reduced Motion:
- All animations should respect `@media (prefers-reduced-motion: reduce)`
- When reduced motion is preferred, disable all CSS/JS animations and transitions
- Fall back to instant show/hide without animation

---

## Edge Cases & Error Handling

### Empty State:
- When `items.length === 0`, component must be hidden (`hide = true`)
- `handlePillClick` must return early if `count === 0`
- `latest` will be `undefined` when array is empty — all JSX must use optional chaining (`latest?.`)

### Single Notification Dismissal:
- When dismissing the last notification (`items.length <= 1`), collapse the expanded pill (`setExpanded(false)`)
- After dismissing, the auto-hide timer should start or the component should hide

### Multiple Notifications:
- Show only the latest notification details in the expanded pill
- Show count of remaining notifications in the "more notifications" section
- Limit "more notifications" list to 5 items
- Slice: `items.slice(0, -1).reverse().slice(0, 5)`

### Notification Overflow:
- If `count > 99`, display `99+` on the badge
- Badge must not overflow or break layout

### Rapid Succession:
- If 10+ notifications arrive rapidly, the component should handle them without performance issues
- Use `useRef` for timer management, not state
- Do NOT create a new timer for every notification — only reset the existing one

### Store Updates:
- `addIslandNotification` must create a new array reference to trigger zustand subscription
- `dismissIslandNotification` must also create a new array reference
- Must NOT mutate the existing array

---

## Accessibility Requirements

### ARIA:
- Bell button should have `aria-label="Notifications"`
- Expanded dropdown should have `aria-label="Notification details"`
- Dismiss buttons should have `aria-label="Dismiss notification"`
- Close button should have `aria-label="Close notifications"`

### Keyboard:
- Bell pill should be focusable via `Tab`
- `Escape` key should collapse the expanded pill and dropdown
- Notification list items should be focusable and activatable via `Enter`
- Focus trap when dropdown is expanded (focus should cycle within dropdown)

### Screen Readers:
- Count badge should be announced as `{count} notifications`
- Latest notification title and message should be announced
- Critical notifications should have `role="alert"`

---

## CSS Classes Reference

### Container:
```
relative z-[300] flex justify-center
translate-y-0 opacity-100 pointer-events-auto (visible)
-translate-y-20 opacity-0 pointer-events-none (hidden)
transition-all duration-300
```

### Bell pill (collapsed):
```
overflow-hidden border-2 border-tx3/15 bg-s1 rounded-full cursor-pointer hover:bg-s2/50 w-11
```

### Bell pill (expanded):
```
overflow-hidden border-2 border-tx3/15 bg-s1 rounded-full cursor-pointer hover:bg-s2/50 w-[26rem]
```

### Badge:
```
absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ac px-1.5 text-[0.5rem] font-extrabold text-white
```

### Dropdown:
```
absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[26rem] rounded-3xl border-2 border-tx3/15 bg-s1 p-4
```

### Icon colors:
- `critical`: `bg-rd/15 text-rd`
- `warning`: `bg-am/15 text-am`
- `info`: `bg-ac/15 text-ac`

---

## Testing Checklist

1. ✅ No notification → bell is hidden
2. ✅ Notification arrives → bell slides in, badge shows count
3. ✅ Click bell → expands to show title and message
4. ✅ Click again or close → collapses back to pill
5. ✅ Hover over bell → stays visible, stops auto-hide
6. ✅ Leave hover → 15s timer starts, hides after timeout
7. ✅ Multiple notifications → badge count updates, "more notifications" section appears
8. ✅ Dismiss notification → removed from list, count updates
9. ✅ Dismiss last notification → pill collapses, hides after timeout
10. ✅ Critical notification → red icon, red styling
11. ✅ Message notification → shows sender, message preview, and full details in dropdown
12. ✅ Mouse enters dropdown → stays visible
13. ✅ Mouse leaves dropdown → timer restarts
14. ✅ Escape key → collapses dropdown
15. ✅ Reduced motion → no animations
16. ✅ Rapid notifications → no performance issues, all added to store
17. ✅ Unmount → timer cleaned up, no memory leaks
18. ✅ `notifyDynamicIsland` works from any module
19. ✅ `addIslandNotification` triggers zustand re-render
20. ✅ Component renders above all other z-index layers
21. ✅ Component NOT clipped by any parent overflow
22. ✅ Expanded pill width animates smoothly (`w-11` → `w-[26rem]`)
23. ✅ Dropdown appears below pill, not overlapping
24. ✅ `details` text displays in `whitespace-pre-wrap` block
25. ✅ Badge never shows `0` (only when `count > 0`)
