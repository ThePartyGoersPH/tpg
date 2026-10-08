# Smart DSS (Decision Support System) — Context File

## Overview
The DSS is a rule-based pattern analysis engine built directly into the bar owner platform.
It reads from existing operational data (sales, reservations, inventory, POS orders) and
surfaces actionable recommendations — no external AI or ML service required.

**Thesis description:**
> "The system includes a decision support system that analyzes sales and reservation patterns
> to help bar owners make better business decisions."

---

## 1. Recommendation Types & Trigger Conditions

### 📦 Inventory
| Trigger | Severity | Title |
|---|---|---|
| Item stock = 0, still listed as available on menu | `critical` | Out of Stock on Menu |
| Stock ≤ reorder level AND sold in last 7 days | `critical` | Low Stock Alert |
| Sold ≥ 70% of current stock in last 7 days | `warning` | Fast-Moving Item |
| Zero sales in last 30 days, stock > 0 | `warning` | Slow-Moving Item |

### 🍺 Menu / Sales
| Trigger | Severity | Title |
|---|---|---|
| #1 item by quantity sold this week | `positive` | Top Performer |
| Item sales dropped >50% vs previous week | `warning` | Sales Drop Detected |
| Menu item has never been ordered (no reservation_items, no sales) | `insight` | Unordered Menu Item |

### 📅 Reservation
| Trigger | Severity | Title |
|---|---|---|
| Top day-of-week ≥ 40% above average over last 30 days | `insight` | Peak Day Detected |
| Single table accounts for ≥ 80% of all reservations (last 30d, min 5) | `insight` | Most Requested Table |
| Reservations this week < 60% of last week | `warning` | Reservations Down |

### 💰 Revenue
| Trigger | Severity | Title |
|---|---|---|
| This week POS revenue < 70% of last week | `warning` | Revenue Drop |
| Weekend revenue ≥ 3× weekday revenue (last 30 days) | `insight` | Weekend Revenue Spike |

---

## 2. Severity Levels

| Severity | Color | Meaning |
|---|---|---|
| `critical` | 🔴 Red `#ef4444` | Needs immediate attention — stock depleted, high-risk item |
| `warning` | 🟡 Amber `#f59e0b` | Should be addressed soon — declining sales, low stock |
| `insight` | 🔵 Blue `#3b82f6` | Informational pattern — peak times, table popularity |
| `positive` | 🟢 Green `#22c55e` | Good performance highlight — top sellers, growth |

Sorting order when returning: `critical → warning → insight → positive`

---

## 3. API Endpoint

### `GET /owner/dss/recommendations`
- **Auth**: Bearer token required (`requireAuth`)
- **Permission**: `analytics_bar_view`
- **Rate**: Results cached 30 minutes per bar (in-memory)

#### Response
```json
{
  "success": true,
  "generated_at": "2026-03-22T14:00:00.000Z",
  "cached": false,
  "recommendations": [
    {
      "id": 1,
      "type": "inventory",
      "severity": "critical",
      "icon": "warning",
      "title": "Low Stock Alert",
      "message": "San Miguel Light stock is critically low — only 4 units left.",
      "action_label": "Update Stock",
      "action_route": "/inventory"
    },
    {
      "id": 2,
      "type": "reservation",
      "severity": "insight",
      "icon": "calendar",
      "title": "Peak Day Detected",
      "message": "Fridays are your busiest — consider requiring advance reservations on Fridays.",
      "action_label": "View Reservations",
      "action_route": "/reservations"
    }
  ]
}
```

#### Empty state (not enough data)
```json
{
  "success": true,
  "generated_at": "...",
  "recommendations": [],
  "message": "Not enough data yet to generate recommendations"
}
```

#### Recommendation object fields
| Field | Type | Description |
|---|---|---|
| `id` | number | Sequential ID (1-based) |
| `type` | string | `inventory`, `menu`, `reservation`, `revenue` |
| `severity` | string | `critical`, `warning`, `insight`, `positive` |
| `icon` | string | Icon hint: `warning`, `trending_up`, `trending_down`, `star`, `info`, `calendar` |
| `title` | string | Short heading |
| `message` | string | Full recommendation text |
| `action_label` | string | Button label |
| `action_route` | string | Frontend route to navigate to |

---

## 4. Caching Strategy

- **Type**: In-process Node.js `Map` (no Redis required)
- **Key**: `barId` (integer)
- **TTL**: 30 minutes (`30 * 60 * 1000` ms)
- **Invalidation**: Automatic on TTL expiry; no manual invalidation
- **Cache variable**: `dssCache` in `routes/dss.js`
- **Cached fields**: `{ ts: Date.now(), recommendations: [...] }`
- **On hit**: Returns cached data + `"cached": true` in response
- **On miss**: Runs all queries, stores result, returns `"cached": false`

```js
const dssCache = new Map();
const DSS_CACHE_TTL = 30 * 60 * 1000;
```

---

## 5. Dashboard Panel — How It Consumes Recommendations

**File**: `src/pages/Dashboard.jsx`
**Permission gate**: `analytics_bar_view`

### Fetch behaviour
- Fetches on component mount alongside the regular dashboard summary
- Sets a `setInterval` to re-fetch every 30 minutes (`DSS_REFRESH_MS`)
- Manual **Refresh** button available at any time
- Shows "Last updated: HH:MM:SS" timestamp

### Rendering
- **Loading state**: 3 animated skeleton cards (`animate-pulse`)
- **Recommendations present**: Each rendered as a card with:
  - Colored dot (severity color)
  - Severity label badge (e.g. `CRITICAL`, `WARNING`)
  - Title + message text
  - Action button → navigates to `action_route` via `useNavigate`
- **Empty state**: Green checkmark + "All good! No suggestions at the moment."

### `severityConfig` object (in `Dashboard.jsx`)
```js
const severityConfig = {
  critical: { dot: '#ef4444', label: 'CRITICAL',  bg: 'rgba(239,68,68,0.08)',  border: ..., text: '#ef4444' },
  warning:  { dot: '#f59e0b', label: 'WARNING',   bg: 'rgba(245,158,11,0.08)', ... },
  insight:  { dot: '#3b82f6', label: 'INSIGHT',   bg: 'rgba(59,130,246,0.08)', ... },
  positive: { dot: '#22c55e', label: 'POSITIVE',  bg: 'rgba(34,197,94,0.08)',  ... },
};
```

---

## 6. Inventory Page — Inline DSS Badges

**File**: `src/pages/Inventory.jsx`

### How it works
- On page load, calls `dssApi.getRecommendations()` alongside the inventory list fetch
- Stores results in `dssRecs` state
- `getDssBadge(itemName)` matches each inventory item by checking if the item name appears in any recommendation's `message` or `title` (case-insensitive substring match)
- If a match is found, renders an inline badge next to the item name

### Badge types
| Badge | Trigger | Color |
|---|---|---|
| `Out of Stock` | `title === 'Out of Stock on Menu'` | Red `#ff6666` |
| `Low Stock` | `severity === 'critical'` | Red `#ef4444` |
| `Top Seller` | `type === 'menu' && severity === 'positive'` | Green `#22c55e` |
| `Not Selling` | `severity === 'warning'` | Amber `#f59e0b` |

### Tooltip
- Hovering the badge shows a dark tooltip with the full recommendation `message`
- Tooltip is positioned below the badge, `z-50`, `pointer-events-none`
- State: `tooltipId` tracks which item's tooltip is visible (by `item.id`)

---

## 7. Minimum Data Requirements

Before recommendations are generated, the endpoint checks:

```sql
-- At least 1 sale in the last 7 days
SELECT COUNT(*) FROM sales WHERE bar_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)

-- At least 1 reservation in the last 7 days  
SELECT COUNT(*) FROM reservations WHERE bar_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
```

If **both** counts are zero → returns `recommendations: []` with message `"Not enough data yet to generate recommendations"`.

Individual recommendation checks also require specific minimum thresholds (e.g. ≥5 reservations before table popularity analysis runs).

---

## 8. How to Extend the DSS with New Recommendation Types

1. **Add a new query block** in `routes/dss.js` inside the `GET /owner/dss/recommendations` handler
2. **Follow the pattern**:
```js
const [rows] = await pool.query(`SELECT ... FROM ... WHERE bar_id = ? AND ...`, [barId]);
if (rows.length && <condition>) {
  recs.push({
    id: idSeq++,
    type: 'your_type',       // inventory | menu | reservation | revenue | staffing | etc.
    severity: 'warning',     // critical | warning | insight | positive
    icon: 'trending_down',   // icon hint for frontend
    title: 'Short Title',
    message: `Dynamic message with ${data}.`,
    action_label: 'Button Label',
    action_route: '/relevant-page',
  });
}
```
3. **The sort + cap is automatic** — just push to `recs[]`, the system will sort by severity and take the top 8
4. **No frontend changes needed** for new types — the Dashboard panel renders any recommendation generically
5. **For Inventory badges**: if the new recommendation mentions inventory item names in its `message`, the badge will auto-appear on the Inventory page

---

## 9. Data Sources Used

| Table | Used For |
|---|---|
| `inventory_items` | Stock levels, reorder levels, fast/dead stock detection |
| `sales` | Sales velocity, top sellers, drop detection, 7/30-day windows |
| `menu_items` | Items never ordered, out-of-stock-but-listed detection |
| `reservation_items` | Menu items ordered via reservations |
| `reservations` | Peak days, table popularity, volume trends |
| `bar_tables` | Table number lookup for reservation analysis |
| `pos_orders` | Revenue trends, weekend vs weekday comparison |

---

## 10. Thesis Talking Points

> "The platform includes a built-in Decision Support System (DSS) that continuously
> monitors sales velocity, inventory levels, reservation patterns, and revenue trends
> to surface actionable business intelligence for bar owners."

> "Recommendations are generated in real time using rule-based pattern analysis
> against the bar's own operational data — no external AI service required."

> "The DSS helps bar owners identify low-stock risks, underperforming menu items,
> peak demand periods, and revenue anomalies — directly from their dashboard."

> "The system caches recommendations per bar for 30 minutes to ensure performance
> while maintaining data freshness, and auto-refreshes on the dashboard every 30 minutes."

> "Inline DSS indicators on the Inventory page surface item-level insights at a glance,
> allowing staff to immediately identify which items need attention without navigating away."
