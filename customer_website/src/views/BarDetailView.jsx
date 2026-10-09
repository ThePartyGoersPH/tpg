import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useView } from '../hooks/useView';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { VIEWS } from '../contexts/ViewContext';
import { barService } from '../services/barService';
import { reservationService } from '../services/reservationService';
import { socialService } from '../services/socialService';
import { eventService } from '../services/eventService';
import { paymentService } from '../services/paymentService';
import { packageService } from '../services/packageService';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { imageUrl } from '../utils/imageUrl';
import { getBarOpenStatus } from '../utils/barOpenStatus';
import { canOrderAtBar, isOwnOrWorkBar, isBarOwner, readOnlyMessage } from '../utils/ownerPreview';
import { managerPortalUrl } from '../utils/managerLinks';
import { barApi } from '../api/barApi';
import { Flame, MessageCircle, Utensils, Wine, Star, Phone, Mail, Globe, MapPin, CalendarDays, CreditCard, Smartphone, ShoppingCart, Heart, Music, Users, Mic, Shield, UtensilsCrossed, Package as PackageIcon, Search, Filter, Play, X, Video, Camera, ChevronLeft, ChevronRight, ThumbsUp, Send, Share2, Smile, LayoutGrid, Martini, Beer, GlassWater, CupSoda, Armchair } from 'lucide-react';

const MENU_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='44' fill='%23333333'%3E%F0%9F%8D%BD%3C/text%3E%3C/svg%3E`;
const CART_PERSIST_HOURS = 24;
const CART_STORAGE_PREFIX = 'bar_detail_cart_state_';

const PKG_IMAGES = {
  1: '/uploads/packages/vip_package.jpg',
  2: '/uploads/packages/group_package.jpg',
  3: '/uploads/packages/premium_package.jpg',
  4: '/uploads/packages/essentials_package.jpg',
};

const PKG_BADGES = {
  3: { label: 'Best Value', cls: 'value', icon: '💎' },
  2: { label: 'Most Popular', cls: 'popular', icon: '🔥' },
  1: { label: 'Premium', cls: 'premium', icon: '⭐' },
};

const PKG_SHOW_THRESHOLD = 5;

const PACKAGE_TABLE_MAP = {
  1: { floorFilter: 'VIP Section', capacityMin: 8, capacityMax: 15, defaultGuests: 10, tierLabel: 'VIP' },
  3: { floorFilter: 'Ground Floor', capacityMin: 2, capacityMax: 8, defaultGuests: 4, tierLabel: 'Front-Stage' },
};

// Derive a table tier for a package: prefer DB-assigned tables
// (Package → Tables mapping), fall back to the legacy hardcoded map.
const tierForPackage = (pkg) => {
  const assigned = Array.isArray(pkg?.assigned_tables) ? pkg.assigned_tables : [];
  if (assigned.length > 0) {
    const floors = assigned.map((t) => t.floor || t.floor_assignment).filter(Boolean);
    const floorFilter = floors.sort((a, b) =>
      floors.filter((f) => f === a).length - floors.filter((f) => f === b).length).pop() || null;
    const capacities = assigned.map((t) => Number(t.capacity) || 0).filter((n) => n > 0);
    const defaultGuests = capacities.length ? Math.max(...capacities) : 4;
    return {
      floorFilter,
      capacityMin: 1,
      capacityMax: Number.MAX_SAFE_INTEGER,
      defaultGuests,
      tierLabel: floorFilter || 'Included',
      assignedIds: assigned.map((t) => Number(t.id)),
    };
  }
  return PACKAGE_TABLE_MAP[pkg?.package_id ?? pkg?.id] || null;
};

function PackageCard({ pkg, pkgQty, onAdd, onRemove, readOnly, disabled, disabledReason, bundled }) {
  const [expanded, setExpanded] = useState(false);
  const imgSrc = PKG_IMAGES[pkg.id];
  const inclusions = pkg.inclusions || [];
  const visibleInclusions = expanded ? inclusions : inclusions.slice(0, PKG_SHOW_THRESHOLD);
  const hasMore = inclusions.length > PKG_SHOW_THRESHOLD;
  const isUnavailable = pkg.is_available === false;

  return (
    <div className={`pkg-card${bundled ? ' pkg-bundled' : ''}`}>
      {imgSrc && <img className="pkg-card-image" src={imgSrc} alt={pkg.name} onError={(e) => { e.target.style.display = 'none'; }} />}
      <div className="pkg-card-body">
        <div className="pkg-card-header">
          <h4 className="pkg-card-name">{pkg.name}</h4>
          <span className="pkg-card-price">₱{Number(pkg.price || 0).toLocaleString()}</span>
        </div>
        {pkg.description && <p className="pkg-card-desc">{pkg.description}</p>}
        {pkg.requires_table !== 0 && pkg.requires_table !== false && (
          <p style={{ margin: '0.2rem 0 0.75rem' }}>
            <span className="pkg-table-badge">
              <Armchair size={13} />
              {Array.isArray(pkg.assigned_tables) && pkg.assigned_tables.length > 0
                ? `Includes table: ${pkg.assigned_tables.map(t => `#${t.table_number}`).join(', ')}`
                : 'Table included — auto-assigned at booking'}
            </span>
          </p>
        )}
        {inclusions.length > 0 && (
          <div className="pkg-inclusions">
            <p className="pkg-inclusions-title">What's included</p>
            {visibleInclusions.map((inc, idx) => (
              <div className="pkg-inclusion-item" key={idx}>
                <span className="pkg-inclusion-check">✓</span>
                <span>{inc.quantity}x {inc.item_name}</span>
              </div>
            ))}
            {hasMore && (
              <button className="pkg-show-more" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : `+ ${inclusions.length - PKG_SHOW_THRESHOLD} more items`}
              </button>
            )}
          </div>
        )}
        <div className="pkg-card-actions">
          {readOnly ? (
            <span style={{ display: 'block', textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 8, padding: '0.45rem 0.5rem', lineHeight: 1.4 }}>
              Ordering disabled in preview mode
            </span>
          ) : isUnavailable ? (
            <>
              <button className="btn btn-sm" disabled style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}>Currently Unavailable</button>
              {pkg.unavailable_reason && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: '0.35rem 0 0', lineHeight: 1.4 }}>{pkg.unavailable_reason}</p>
              )}
            </>
          ) : pkgQty === 0 ? (
            <>
              <button
                className="btn btn-red btn-sm"
                style={{ width: '100%', ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                onClick={() => onAdd(pkg)}
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
              >
                + Add Package to Order
              </button>
              {disabled && disabledReason && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: '0.35rem 0 0', lineHeight: 1.4 }}>{disabledReason}</p>
              )}
            </>
          ) : (
            <div className="qty-control" style={{ border: '1px solid var(--color-border)', width: '100%', justifyContent: 'space-between' }}>
              <button className="qty-btn" style={{ color: 'var(--color-text-primary)' }} onClick={() => onRemove(pkg)}>−</button>
              <span className="qty-value" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{pkgQty}</span>
              <button
                className="qty-btn"
                style={{ color: 'var(--color-text-primary)', ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                onClick={() => onAdd(pkg)}
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
              >+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return ['1', 'true', 'yes'].includes(v.trim().toLowerCase());
  return false;
};

const dayHoursByIndex = [
  'sunday_hours',
  'monday_hours',
  'tuesday_hours',
  'wednesday_hours',
  'thursday_hours',
  'friday_hours',
  'saturday_hours',
];

const parseClockToMinutes = (token) => {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hh = Number(match[1]);
  const mm = Number(match[2] || 0);
  const meridiem = match[3] ? match[3].toLowerCase() : null;
  if (mm < 0 || mm > 59) return null;

  if (meridiem) {
    if (hh < 1 || hh > 12) return null;
    if (meridiem === 'am' && hh === 12) hh = 0;
    if (meridiem === 'pm' && hh !== 12) hh += 12;
  }

  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
};

const getLocalTodayDateString = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeReservationDateInput = (rawDate) => {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(`${str}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;

  return str;
};

const buildHourlySlots = (hoursText, reservationDate) => {
  if (!hoursText) return [];
  const normalized = String(hoursText).replace(/\s+to\s+/gi, ' - ').replace(/\u2013|\u2014/g, '-').trim();
  const range = normalized.match(/(.+?)\s*-\s*(.+)/);
  if (!range) return [];
  const start = parseClockToMinutes(range[1]);
  const end = parseClockToMinutes(range[2]);
  if (start === null || end === null) return [];

  const slots = [];
  const startHour = Math.ceil(start / 60);
  const endHour = Math.ceil(end / 60);

  if (end > start) {
    for (let h = startHour; h < endHour; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
  } else {
    for (let h = startHour; h < 24; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
    for (let h = 0; h < endHour; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
  }

  const todayStr = getLocalTodayDateString();
  if (reservationDate === todayStr) {
    const nowHour = new Date().getHours();
    return slots.filter((slot) => Number(slot.slice(0, 2)) > nowHour);
  }

  return slots;
};

const formatHourLabel = (value) => {
  const hh = Number(String(value).slice(0, 2));
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const suffix = hh >= 12 ? 'PM' : 'AM';
  return `${h12}:00 ${suffix}`;
};

const parseEventClockToMinutes = (token) => {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hh = Number(match[1]);
  const mm = Number(match[2] || 0);
  const meridiem = match[4] ? match[4].toLowerCase() : null;
  if (mm < 0 || mm > 59) return null;

  if (meridiem) {
    if (hh < 1 || hh > 12) return null;
    if (meridiem === 'am' && hh === 12) hh = 0;
    if (meridiem === 'pm' && hh !== 12) hh += 12;
  }

  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
};

const parseEventBaseDate = (rawDate) => {
  if (!rawDate) return null;
  const dateText = String(rawDate).trim();
  const ymd = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }

  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const getEventWindow = (event) => {
  const eventDate = event?.event_date || event?.eventDate;
  const startRaw = event?.start_time || event?.startTime;
  const endRaw = event?.end_time || event?.endTime;

  const baseDate = parseEventBaseDate(eventDate);
  const startMinutes = parseEventClockToMinutes(startRaw);
  const endMinutes = parseEventClockToMinutes(endRaw);
  if (!baseDate || startMinutes === null || endMinutes === null) return null;

  const start = new Date(baseDate.getTime() + startMinutes * 60000);
  const end = new Date(baseDate.getTime() + endMinutes * 60000);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
};

const isEventOngoingNow = (event, now = new Date()) => {
  const status = String(event?.status || '').trim().toLowerCase();
  if (status && status !== 'active') return false;

  const window = getEventWindow(event);
  if (!window) return false;

  return now >= window.start && now < window.end;
};


function ReadOnlyInfoCard({ note, showPortalLinks }) {
  return (
    <div
      className="glass-card"
      data-testid="read-only-info-card"
      style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.07)', borderRadius: '14px', padding: '1rem 1.15rem', marginBottom: '0.25rem' }}
    >
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <Shield size={18} color="#d97706" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24', fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem' }}>
            {note}
          </p>
          {showPortalLinks && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.7rem' }}>
              <a
                className="btn btn-red btn-sm"
                style={{ fontWeight: 700, borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                href={managerPortalUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Owner Portal
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BarDetailView() {
  const { viewParams, navigate, goBack, canGoBack } = useView();
  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const isLightMode = theme === 'light';
  const barId = viewParams.barId;
  const cartStorageKey = useMemo(() => (barId ? `${CART_STORAGE_PREFIX}${barId}` : null), [barId]);

  const [bar, setBar] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [events, setEvents] = useState([]);
  const [reviewData, setReviewData] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(false);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Checkout feedback toast: always visible (fixed, top-center) so validation
  // and gateway errors can't fail silently below the fold near the cart panel.
  const [checkoutToast, setCheckoutToast] = useState(null);
  const checkoutToastTimer = useRef(null);

  const showCheckoutToast = useCallback((type, text) => {
    if (checkoutToastTimer.current) clearTimeout(checkoutToastTimer.current);
    setCheckoutToast({ type, text });
    checkoutToastTimer.current = setTimeout(() => setCheckoutToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (checkoutToastTimer.current) clearTimeout(checkoutToastTimer.current);
  }, []);

  // Menu Search & Filter
  const [menuSearch, setMenuSearch] = useState('');
  // Top-level menu tabs: Exclusive Packages | All Menu Items | per-category.
  // Keeps packages out of the long vertical stack so each view fits above the fold.
  const [menuTab, setMenuTab] = useState('packages');
  // Category tab scroller: arrows + mouse-drag + vertical-wheel support so
  // desktop users can always reach overflowed tabs.
  const menuTabsRef = useRef(null);
  const tabsDrag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const [tabsDragging, setTabsDragging] = useState(false);

  // Review form
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');

  // Table availability
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [availableTables, setAvailableTables] = useState([]);
  const [checkingTables, setCheckingTables] = useState(false);
  const [tableMsg, setTableMsg] = useState('');
  const [hasChecked, setHasChecked] = useState(false);

  // Cart
  const [cartItems, setCartItems] = useState([]);
  const [cartTables, setCartTables] = useState([]);
  // Order type: table_booking needs date/time/party/table; takeout is
  // food-only (no tables, full payment) with pickup/delivery fulfillment.
  const [orderType, setOrderType] = useState('table_booking');
  const isTableBooking = orderType === 'table_booking';
  // Takeout fulfillment + delivery contact (PII never persisted to storage).
  const [fulfillment, setFulfillment] = useState('pickup');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [oversizedConfirm, setOversizedConfirm] = useState(null);
  const [tableAssignMsg, setTableAssignMsg] = useState('');
  const [guestCountManual, setGuestCountManual] = useState(false);
  const [autoAssigningPkg, setAutoAssigningPkg] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentType, setPaymentType] = useState('downpayment'); // 'downpayment' or 'full'
  const [activeTab, setActiveTab] = useState('overview');
  const [videos, setVideos] = useState([]);
  const [videoPlayer, setVideoPlayer] = useState(null);
  const [photoPlayer, setPhotoPlayer] = useState(null);
  const [photoPlayerIndex, setPhotoPlayerIndex] = useState(0);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [viewerEngagement, setViewerEngagement] = useState({ likes: 0, comments: 0, liked: false });
  const [viewerComments, setViewerComments] = useState([]);
  const [viewerCommentText, setViewerCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyMentionPrefix, setReplyMentionPrefix] = useState('');
  const [replyMentionUserId, setReplyMentionUserId] = useState(null);
  const [replyMentionName, setReplyMentionName] = useState('');
  const viewerFocusedRef = useRef(false);
  const highlightCommentIdRef = useRef(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const commentsScrollRef = useRef(null);
  const minReservationDate = getLocalTodayDateString();

  const acceptGcash = useMemo(() => bar ? (toBool(bar.accept_gcash) && toBool(bar.accept_online_payment)) : false, [bar]);
  const acceptOnline = useMemo(() => bar ? toBool(bar.accept_online_payment) : false, [bar]);

  // Bar fulfillment settings for takeout orders (defaults: pickup on).
  const pickupAllowed = !bar || Number(bar.allow_pickup) !== 0;
  const deliveryAllowed = !!bar && Number(bar.allow_delivery) === 1;
  const barDeliveryFee = Math.max(0, Number(bar?.delivery_fee || 0));
  const deliveryFee = !isTableBooking && fulfillment === 'delivery' ? barDeliveryFee : 0;

  // Takeout is a restobar-only, owner-opt-in mode: the venue category (or bar
  // types) must mention restobar, the master switch must be on, and at least
  // one fulfillment mode must be enabled. Otherwise the option stays hidden.
  const isRestobar = (() => {
    if (/restobar/i.test(String(bar?.category || ''))) return true;
    const raw = bar?.bar_types;
    const types = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || '[]'); } catch { return []; } })();
    return Array.isArray(types) && types.some((t) => /restobar/i.test(String(t || '')));
  })();
  const takeoutEnabled = !!bar && Number(bar.is_takeout_enabled) === 1 && (pickupAllowed || deliveryAllowed);
  const takeoutVisible = isRestobar && takeoutEnabled;

  // Alcohol classification for takeout filtering (food items only).
  const ALCOHOL_CATEGORIES = ['cocktail', 'cocktails', 'beer', 'beers', 'spirit', 'spirits', 'liquor', 'wine', 'shots'];
  const ALCOHOL_KEYWORDS = ['beer', 'whiskey', 'whisky', 'vodka', 'tequila', 'rum', 'gin', 'cocktail', 'mojito', 'margarita', 'liquor', 'spirit', 'cognac', 'hennessy', 'wine', 'shot', 'brandy', 'bourbon', 'sake', 'soju'];
  const isAlcoholMenuItem = (item) => ALCOHOL_CATEGORIES.includes(String(item?.category || item?.menu_category || '').trim().toLowerCase());
  const isAlcoholPackage = (pkg) => {
    const text = `${pkg?.name || ''} ${(pkg?.inclusions || []).map((i) => i.item_name).join(' ')}`.toLowerCase();
    return ALCOHOL_KEYWORDS.some((k) => text.includes(k));
  };

  // The bar can only sell once it has a working payment setup. Until then the
  // Bar Menu tab renders a plain empty state and no ordering/reservation UI.
  const paymentsReady = useMemo(() => Boolean(bar?.payments_ready), [bar]);

  // View-only rule (shared helper): bar owners everywhere, staff/workers at
  // their own bar(s). Everyone else (customers) can order normally.
  // Read-only visitors still see the full menu + packages, minus all
  // ordering/booking/payment controls, plus an info card instead.
  const canOrder = useMemo(() => (bar ? canOrderAtBar(user, bar) : true), [user, bar]);
  const readOnlyNote = useMemo(() => (bar ? readOnlyMessage(user, bar) : null), [user, bar]);
  const hideFollow = useMemo(() => (bar ? isOwnOrWorkBar(user, bar) : false), [user, bar]);
  const showPortalLinks = useMemo(() => isBarOwner(user), [user]);

  const menuTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Table-inclusive packages bundle their assigned table into the package
  // price: a cart table bound to an active table-required package is ₱0.00.
  // Standalone bookings (no covering package) keep the standard table fee.
  const coveringPackageForTable = (tableId) => {
    const id = Number(tableId);
    const tablePkgs = cartItems.filter((i) => i.isPackage && i.requires_table);
    for (const p of tablePkgs) {
      const ids = Array.isArray(p.table_ids) && p.table_ids.length
        ? p.table_ids.map(Number)
        : Array.isArray(p.assigned_tables)
          ? p.assigned_tables.map((t) => Number(t.id ?? t))
          : [];
      // No mapping on the package (legacy tier) → it covers the cart table.
      if (ids.length === 0 || ids.includes(id)) return p;
    }
    return null;
  };
  const tableTotal = cartTables.reduce(
    (sum, t) => sum + (coveringPackageForTable(t.id) ? 0 : Number(t.price || 0)),
    0
  );
  const totalCapacity = cartTables.reduce((sum, t) => sum + Number(t.capacity || 0), 0);
  const grandTotal = menuTotal + tableTotal + deliveryFee;
  // Bar VAT configuration (public fields from the bar detail endpoint).
  // BIR-off, NON_VAT, or 0% rate all mean "no tax lines, standard net total".
  const birRegistered = !!bar && Number(bar.is_bir_registered) === 1;
  const barTaxType = String(bar?.tax_type || 'NON_VAT').toUpperCase();
  const barTaxRate = Math.max(0, Number(bar?.tax_rate || 0));
  const barTaxMode = String(bar?.tax_mode || 'EXCLUSIVE').toUpperCase();
  const taxApplies = birRegistered && barTaxType !== 'NON_VAT' && barTaxRate > 0 &&
    (barTaxMode === 'EXCLUSIVE' || barTaxMode === 'INCLUSIVE');
  const taxAmount = !taxApplies ? 0 : barTaxMode === 'EXCLUSIVE'
    ? Number((grandTotal * barTaxRate / 100).toFixed(2))
    : Number((grandTotal - grandTotal / (1 + barTaxRate / 100)).toFixed(2));
  const netSubtotal = !taxApplies ? grandTotal
    : barTaxMode === 'EXCLUSIVE' ? grandTotal : Number((grandTotal - taxAmount).toFixed(2));
  // EXCLUSIVE adds tax on top; INCLUSIVE already contains it.
  const payableTotal = taxApplies && barTaxMode === 'EXCLUSIVE'
    ? Number((grandTotal + taxAmount).toFixed(2)) : grandTotal;
  const rawDepositPercent = Number(bar?.minimum_reservation_deposit);
  const depositPercent = Number.isFinite(rawDepositPercent)
    ? Math.max(0, Math.min(rawDepositPercent, 100))
    : 50;
  const isZeroDownPayment = depositPercent <= 0;
  const downPaymentAmount = Number((payableTotal * (depositPercent / 100)).toFixed(2));
  // Takeout is food-only: always full food payment, no deposit split.
  const effectivePaymentType = !isTableBooking ? 'full' : (isZeroDownPayment ? 'full' : paymentType);
  const effectivePaymentAmount = effectivePaymentType === 'full' ? payableTotal : downPaymentAmount;
  const ongoingEventsNow = useMemo(() => {
    const now = new Date();
    return (events || []).filter((ev) => isEventOngoingNow(ev, now));
  }, [events]);

  // Split media into videos (trailers/clips) and photos
  const trailers = useMemo(() => videos.filter(v => v.media_type !== 'photo'), [videos]);
  const photos = useMemo(() => videos.filter(v => v.media_type === 'photo'), [videos]);

  // Unified media array for the Stories carousel (featured video first, then rest)
  const allMedia = useMemo(() => {
    const featured = trailers.find(v => v.is_featured) || trailers[0];
    const rest = [...trailers, ...photos].filter(v => !featured || v.id !== featured.id);
    return featured ? [featured, ...rest] : rest;
  }, [trailers, photos]);
  const selectedReservationMoment = useMemo(() => {
    const normalizedDate = normalizeReservationDateInput(resDate);
    const reservationMinutes = parseEventClockToMinutes(resTime);
    if (!normalizedDate || reservationMinutes === null) return null;

    const baseDate = parseEventBaseDate(normalizedDate);
    if (!baseDate) return null;

    return new Date(baseDate.getTime() + reservationMinutes * 60000);
  }, [resDate, resTime]);
  const conflictingOngoingEvent = useMemo(() => {
    if (!selectedReservationMoment) return null;

    for (const event of ongoingEventsNow) {
      const window = getEventWindow(event);
      if (!window) continue;
      if (selectedReservationMoment >= window.start && selectedReservationMoment < window.end) {
        return event;
      }
    }
    return null;
  }, [ongoingEventsNow, selectedReservationMoment]);
  const isSelectedSlotBlockedByOngoingEvent = Boolean(conflictingOngoingEvent);
  const ongoingEventSlotNote = useMemo(() => {
    if (!isSelectedSlotBlockedByOngoingEvent) return '';

    const eventTitle = String(conflictingOngoingEvent?.title || 'this event').trim();
    const window = getEventWindow(conflictingOngoingEvent);
    const rangeText = window
      ? `${window.start.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} to ${window.end.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
      : null;

    if (rangeText) {
      return `Selected time overlaps the ongoing event (${eventTitle}) from ${rangeText}. Please choose another timeslot.`;
    }
    return `Selected time overlaps the ongoing event (${eventTitle}). Please choose another timeslot.`;
  }, [conflictingOngoingEvent, isSelectedSlotBlockedByOngoingEvent]);

  const openingHours = useMemo(() => {
    if (!bar) return [];
    return [
      ['Monday', bar.monday_hours], ['Tuesday', bar.tuesday_hours], ['Wednesday', bar.wednesday_hours],
      ['Thursday', bar.thursday_hours], ['Friday', bar.friday_hours], ['Saturday', bar.saturday_hours], ['Sunday', bar.sunday_hours],
    ];
  }, [bar]);

  const openStatus = useMemo(() => getBarOpenStatus(bar), [bar]);

  const availableHourOptions = useMemo(() => {
    if (!resDate || !bar) return [];
    const d = new Date(`${resDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return [];
    const col = dayHoursByIndex[d.getDay()];
    return buildHourlySlots(bar?.[col], resDate);
  }, [bar, resDate]);

  useEffect(() => {
    if (!resDate) return;
    if (!availableHourOptions.length) {
      if (resTime) setResTime('');
      return;
    }
    if (!availableHourOptions.includes(resTime)) {
      setResTime(availableHourOptions[0]);
      setCartTables([]);
      setHasChecked(false);
      setTableMsg('');
    }
  }, [availableHourOptions, resDate, resTime]);

  const reviews = reviewData?.reviews || [];

  useEffect(() => {
    if (!barId) return;
    loadAll();
  }, [barId]);

  useEffect(() => {
    if (!cartStorageKey) return;
    try {
      const raw = localStorage.getItem(cartStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const ts = new Date(parsed?.timestamp || 0).getTime();
      const expiry = ts + CART_PERSIST_HOURS * 60 * 60 * 1000;
      if (!ts || Date.now() > expiry) {
        localStorage.removeItem(cartStorageKey);
        return;
      }

      if (Array.isArray(parsed.cartItems)) setCartItems(parsed.cartItems);
      if (Array.isArray(parsed.cartTables)) setCartTables(parsed.cartTables);
      else if (parsed.cartTable) setCartTables([parsed.cartTable]);
      if (typeof parsed.resDate === 'string') setResDate(parsed.resDate);
      if (typeof parsed.resTime === 'string') setResTime(parsed.resTime);
      if (parsed.partySize !== undefined && parsed.partySize !== null) setPartySize(parsed.partySize);
      if (typeof parsed.paymentMethod === 'string') setPaymentMethod(parsed.paymentMethod);
      if (['table_booking', 'takeout'].includes(parsed.orderType)) setOrderType(parsed.orderType);
      else if (parsed.orderType === 'dine_in') setOrderType('takeout'); // legacy mode folded into takeout
      if (['pickup', 'delivery'].includes(parsed.fulfillment)) setFulfillment(parsed.fulfillment);
    } catch (_) {
      localStorage.removeItem(cartStorageKey);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey) return;
    const hasData = Boolean(cartItems.length || cartTables.length || resDate || resTime);
    if (!hasData) {
      localStorage.removeItem(cartStorageKey);
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      cartItems,
      cartTables,
      resDate,
      resTime,
      partySize,
      paymentMethod,
      orderType,
      fulfillment,
    };
    localStorage.setItem(cartStorageKey, JSON.stringify(payload));
  }, [cartStorageKey, cartItems, cartTables, resDate, resTime, partySize, paymentMethod, orderType, fulfillment]);

  useEffect(() => {
    if (!bar) return;
    if (acceptGcash) setPaymentMethod('gcash');
    else if (acceptOnline) setPaymentMethod('paymaya');
  }, [bar, acceptGcash, acceptOnline]);

  useEffect(() => {
    if (isZeroDownPayment && paymentType === 'downpayment') {
      setPaymentType('full');
    }
  }, [isZeroDownPayment, paymentType]);

  useEffect(() => {
    if (!isSelectedSlotBlockedByOngoingEvent) return;
    setCartTables([]);
    setAvailableTables([]);
    setHasChecked(false);
    setTableMsg(ongoingEventSlotNote || 'Selected reservation time overlaps an ongoing event. Please choose another timeslot.');
  }, [isSelectedSlotBlockedByOngoingEvent, ongoingEventSlotNote]);

  // ── Media Viewer: keyboard navigation ──
  useEffect(() => {
    if (!mediaViewerOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setMediaViewerOpen(false);
      if (e.key === 'ArrowLeft' && mediaIndex > 0) setMediaIndex(mediaIndex - 1);
      if (e.key === 'ArrowRight' && mediaIndex < allMedia.length - 1) setMediaIndex(mediaIndex + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mediaViewerOpen, mediaIndex, allMedia.length]);

  // ── Media Viewer: sync open media to URL query params ──
  useEffect(() => {
    if (!barId) return;
    const params = new URLSearchParams(window.location.search);
    if (mediaViewerOpen && allMedia[mediaIndex]) {
      const mediaId = allMedia[mediaIndex].id;
      if (params.get('media') !== String(mediaId) || params.get('bar') !== String(barId)) {
        params.set('media', mediaId);
        params.set('bar', barId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ mediaViewer: true }, '', newUrl);
      }
    } else if (!mediaViewerOpen) {
      if (params.has('media') || params.has('comment') || params.has('bar')) {
        params.delete('media');
        params.delete('comment');
        params.delete('bar');
        const qs = params.toString();
        const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [mediaViewerOpen, mediaIndex, allMedia, barId]);

  // ── Media Viewer: handle browser back/forward ──
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const mediaId = params.get('media');
      if (mediaId && allMedia.length > 0) {
        const idx = allMedia.findIndex(m => String(m.id) === mediaId);
        if (idx >= 0) {
          setMediaIndex(idx);
          setMediaViewerOpen(true);
        }
      } else {
        setMediaViewerOpen(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [allMedia]);

  // ── Media Viewer: auto-open from URL on mount (page reload / deep-link) ──
  useEffect(() => {
    if (allMedia.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('media');
    const commentId = params.get('comment');
    if (mediaId) {
      const idx = allMedia.findIndex(m => String(m.id) === mediaId);
      if (idx >= 0) {
        setMediaIndex(idx);
        setMediaViewerOpen(true);
        if (commentId) highlightCommentIdRef.current = Number(commentId);
      }
    }
  }, [allMedia]);

  // ── Media Viewer: auto-open from notification deep-link ──
  useEffect(() => {
    const openMediaId = viewParams?.openMediaId;
    const highlightId = viewParams?.highlightCommentId;
    if (openMediaId && allMedia.length > 0) {
      const idx = allMedia.findIndex(m => m.id === openMediaId);
      if (idx >= 0) {
        setMediaIndex(idx);
        setMediaViewerOpen(true);
        if (highlightId) highlightCommentIdRef.current = highlightId;
      }
    }
  }, [viewParams?.openMediaId, viewParams?.highlightCommentId, allMedia]);

  // ── Media Viewer: scroll to and highlight comment ──
  useEffect(() => {
    const cid = highlightCommentIdRef.current;
    if (!cid || !mediaViewerOpen || viewerComments.length === 0) return;
    highlightCommentIdRef.current = null;
    setHighlightedCommentId(cid);
    setTimeout(() => {
      const el = document.getElementById(`media-comment-${cid}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    const timer = setTimeout(() => setHighlightedCommentId(null), 3000);
    return () => clearTimeout(timer);
  }, [viewerComments, mediaViewerOpen]);

  // ── Media Viewer: fetch engagement + comments when slide changes ──
  useEffect(() => {
    if (!mediaViewerOpen || !allMedia[mediaIndex]) return;
    const item = allMedia[mediaIndex];
    let cancelled = false;
    (async () => {
      try {
        const [engRes, commentsRes] = await Promise.all([
          barApi.mediaEngagement(item.id),
          barApi.mediaComments(item.id),
        ]);
        if (cancelled) return;
        setViewerEngagement(engRes.data?.data || { likes: 0, comments: 0, liked: false });
        setViewerComments(commentsRes.data?.data || []);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [mediaViewerOpen, mediaIndex, allMedia]);

  // Reset focus flag when viewer closes so it re-focuses next open
  useEffect(() => {
    if (!mediaViewerOpen) viewerFocusedRef.current = false;
  }, [mediaViewerOpen]);

  const loadAll = async () => {
    try {
      setLoading(true); setErr('');
      const [detail, ev, rev, mine, elig, fol] = await Promise.all([
        barService.detail(barId), barService.events(barId),
        barService.reviews(barId), barService.myReview(barId), barService.reviewEligibility(barId),
        socialService.followStatus(barId),
      ]);
      let menu = [];
      try {
        menu = await barService.menuWithBestSellers(barId);
      } catch (_) {
        menu = await barService.menu(barId);
      }

      let pkgs = [];
      try {
        pkgs = await packageService.getBarPackages(barId);
      } catch (_) { }

      let vids = [];
      try {
        vids = await barService.videos(barId);
      } catch (_) { }

      setBar(detail); setMenuItems(menu); setPackages(pkgs); setEvents(ev); setReviewData(rev); setVideos(vids);
      setMyReview(mine); setReviewEligibility(Boolean(elig?.eligible));
      setFollowing(Boolean(fol?.following));
      if (mine) { setRevRating(mine.rating || 5); setRevComment(mine.comment || ''); }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load bar details.');
    } finally { setLoading(false); }
  };

  // ── Media Viewer: toggle like ──
  const handleViewerLike = async () => {
    if (!allMedia[mediaIndex]) return;
    const item = allMedia[mediaIndex];
    try {
      const { data } = await barApi.toggleMediaLike(item.id);
      setViewerEngagement(prev => ({
        ...prev,
        liked: data.data.liked,
        likes: data.data.likes,
      }));
    } catch (_) {}
  };

  // ── Media Viewer: submit comment ──
  const handleViewerComment = async () => {
    if (!allMedia[mediaIndex] || !viewerCommentText.trim()) return;
    const item = allMedia[mediaIndex];
    const content = viewerCommentText.trim();
    setViewerCommentText('');
    try {
      const resp = await barApi.addMediaComment(item.id, content);
      const data = resp.data;
      if (data?.success && data?.data) {
        setViewerComments(prev => [...prev, data.data]);
        setViewerEngagement(prev => ({ ...prev, comments: prev.comments + 1 }));
      } else {
        console.error('MEDIA COMMENT: unexpected response', data);
      }
    } catch (err) {
      console.error('MEDIA COMMENT FAILED:', err?.response?.data || err.message || err);
    }
  };

  // ── Media Viewer: toggle comment like ──
  const handleCommentLike = async (commentId) => {
    try {
      const resp = await barApi.toggleCommentLike(commentId);
      const data = resp.data;
      if (data?.success && data?.data) {
        setViewerComments(prev => prev.map(c =>
          c.id === commentId
            ? { ...c, liked_by_user: data.data.liked, like_count: data.data.like_count }
            : c
        ));
      }
    } catch (err) {
      console.error('COMMENT LIKE FAILED:', err?.response?.data || err.message || err);
    }
  };

  // ── Media Viewer: submit reply ──
  const handleReplySubmit = async (topParentId) => {
    if (!allMedia[mediaIndex] || !replyText.trim()) return;
    const item = allMedia[mediaIndex];
    const content = replyText.trim();
    const mentionUserId = replyMentionUserId;
    const mentionName = replyMentionName || null;
    setReplyText('');
    setReplyMentionPrefix('');
    setReplyMentionUserId(null);
    setReplyMentionName('');
    setReplyingTo(null);
    try {
      const resp = await barApi.addMediaComment(item.id, content, topParentId, mentionUserId, mentionName);
      const data = resp.data;
      if (data?.success && data?.data) {
        setViewerComments(prev => [...prev, data.data]);
        setViewerEngagement(prev => ({ ...prev, comments: prev.comments + 1 }));
      } else {
        console.error('REPLY: unexpected response', data);
      }
    } catch (err) {
      console.error('REPLY FAILED:', err?.response?.data || err.message || err);
    }
  };

  // ── Cart handlers ──
  const addToCart = (item) => {
    const price = Number(item.price ?? item.selling_price ?? 0);
    const name = item.name || item.menu_name || 'Item';
    const stockQty = Number(item.stock_qty ?? item.stockQty ?? 999);
    const packageId = item.package_id ?? (typeof item.id === 'string' && /^pkg_(\d+)$/i.test(item.id) ? Number(String(item.id).match(/^pkg_(\d+)$/i)?.[1]) : null);

    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      const currentQty = existing ? existing.qty : 0;

      // Check if adding one more would exceed stock
      if (currentQty >= stockQty) {
        return prev; // Don't add, already at max stock
      }

      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        id: item.id, name, price, qty: 1, image_path: item.image_path,
        stock_qty: stockQty, isPackage: Boolean(item.isPackage),
        package_id: packageId, requires_table: Boolean(item.requires_table),
        assigned_tables: Array.isArray(item.assigned_tables) ? item.assigned_tables : [],
        table_ids: Array.isArray(item.table_ids) ? item.table_ids : [],
      }];
    });
  };

  const removeFromCart = (itemId) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (!existing || existing.qty <= 1) return prev.filter(i => i.id !== itemId);
      return prev.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const getItemQty = (itemId) => cartItems.find(i => i.id === itemId)?.qty || 0;

  // ── Table availability ──
  const handleCheckTables = async () => {
    if (isSelectedSlotBlockedByOngoingEvent) {
      setTableMsg(ongoingEventSlotNote || 'Selected reservation time overlaps an ongoing event. Please choose another timeslot.');
      setAvailableTables([]);
      setHasChecked(false);
      setCartTables([]);
      return;
    }

    if (!resDate || !resTime || !partySize) return;

    const normalizedDate = normalizeReservationDateInput(resDate);
    if (!normalizedDate) {
      setTableMsg('Please enter a valid reservation date.');
      setAvailableTables([]);
      setHasChecked(false);
      setCartTables([]);
      return;
    }
    if (normalizedDate < minReservationDate) {
      setTableMsg('Past reservation dates are not allowed.');
      setAvailableTables([]);
      setHasChecked(false);
      setCartTables([]);
      return;
    }

    setCheckingTables(true); setTableMsg(''); setAvailableTables([]); setHasChecked(false); setCartTables([]);
    try {
      const avail = await barService.availableTables(barId, { date: normalizedDate, time: resTime, party_size: Number(partySize) });
      setAvailableTables(avail); setHasChecked(true);
      setTableMsg(avail.length ? `${avail.length} table(s) available — select one below.` : 'No available tables for the selected date and time.');
    } catch (e) {
      setTableMsg(e?.response?.data?.message || 'Failed to check table availability.');
    } finally { setCheckingTables(false); }
  };

  const selectTable = (table) => {
    const exists = cartTables.find(t => t.id === table.id);
    if (exists) {
      setCartTables(prev => prev.filter(t => t.id !== table.id));
      return;
    }
    const ps = Number(partySize) || 2;
    if (table.capacity > ps + 2) {
      setOversizedConfirm(table);
      return;
    }
    setCartTables(prev => [...prev, { id: table.id, table_number: table.table_number, capacity: table.capacity, price: Number(table.price || 0) }]);
  };

  const confirmOversized = () => {
    if (oversizedConfirm) {
      setCartTables(prev => [...prev, { id: oversizedConfirm.id, table_number: oversizedConfirm.table_number, capacity: oversizedConfirm.capacity, price: Number(oversizedConfirm.price || 0) }]);
    }
    setOversizedConfirm(null);
  };

  // ── Category tab scroller: arrows already scrollBy; these add
  // mouse-drag scrolling and vertical-wheel-to-horizontal conversion
  // for desktop users whose tabs overflow off-screen.
  const scrollMenuTabs = (dir) => {
    menuTabsRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  const onTabsPointerDown = (e) => {
    const el = menuTabsRef.current;
    if (!el) return;
    tabsDrag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };

  const onTabsPointerMove = (e) => {
    const st = tabsDrag.current;
    const el = menuTabsRef.current;
    if (!st.down || !el) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 6) {
      st.moved = true;
      setTabsDragging(true);
    }
    if (st.moved) el.scrollLeft = st.startScroll - dx;
  };

  const endTabsDrag = () => {
    tabsDrag.current.down = false;
    setTabsDragging(false);
  };

  // Swallow the click that ends a drag so a drag doesn't switch tabs.
  const onTabsClickCapture = (e) => {
    if (tabsDrag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      tabsDrag.current.moved = false;
    }
  };

  useEffect(() => {
    const el = menuTabsRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth + 1) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [activeTab, packages.length, menuItems.length]);

  const activeTablePkg = useMemo(() => {
    const found = cartItems.find(i => i.isPackage && i.requires_table);
    if (!found) return null;
    // Resolve full package details (assigned tables) from the loaded list
    const full = (packages || []).find(p => Number(p.id) === Number(found.package_id));
    const merged = { ...(full || {}), ...found };
    const tier = tierForPackage(merged);
    return tier ? { ...merged, tier } : null;
  }, [cartItems, packages]);

  const tableRequired = useMemo(() => {
    return cartItems.some(i => i.isPackage && i.requires_table);
  }, [cartItems]);

  // Exception to the menu lock: a package that bundles table(s) stays
  // orderable before any manual table pick — adding it auto-binds its table.
  const packageBundlesTable = (pkg) => {
    if (!pkg || pkg.requires_table === 0 || pkg.requires_table === false) return false;
    const mapped = [
      ...((pkg.table_ids || []).map(Number)),
      ...((pkg.assigned_tables || []).map((t) => Number(t?.id ?? t))),
    ].filter((n) => Number.isFinite(n) && n > 0);
    if (mapped.length > 0) return true;
    return Boolean(tierForPackage({ ...(pkg || {}), package_id: pkg?.package_id ?? pkg?.id }));
  };

  // Sequential flow gate: menu/packages unlock only after Step 1 is done —
  // table booking needs date + time + guests + a table; takeout mode itself
  // is the completed Step 1.
  const step1Done = isTableBooking
    ? Boolean(resDate && resTime && partySize && cartTables.length > 0)
    : true;
  const menuLocked = canOrder && !step1Done;
  const menuLockReason = 'Please pick a table and reservation date first.';

  const autoAssignTableForPackage = useCallback(async (pkgId) => {
    const cartPkg = cartItems.find(i => i.isPackage && Number(i.package_id) === Number(pkgId));
    const full = (packages || []).find(p => Number(p.id) === Number(pkgId));
    const merged = { ...(full || {}), ...(cartPkg || {}), package_id: pkgId };
    const tier = tierForPackage(merged);
    if (!tier) return;
    if (!resDate || !resTime) {
      setTableAssignMsg('');
      return;
    }
    if (cartTables.length > 0) return;
    // Use the customer's ACTUAL party size — not the tier default — so a
    // 5-guest party still matches its 8/10-pax assigned tables instead of
    // querying only for the default headcount.
    const need = Number(partySize) || tier.defaultGuests;
    setAutoAssigningPkg(pkgId);
    try {
      const avail = await barService.availableTables(barId, {
        date: normalizeReservationDateInput(resDate),
        time: resTime,
        party_size: need,
      });
      const assignedIds = new Set((tier.assignedIds || []).map(Number));
      // Assigned tables must fit the party; any active package stays
      // selectable as long as party size <= assigned table capacity.
      const assignedAvail = avail.filter(t => assignedIds.has(Number(t.id)) && Number(t.capacity) >= need);
      const pool = assignedAvail.length > 0 ? assignedAvail : avail.filter(t => Number(t.capacity) >= need);
      const matches = tier.floorFilter
        ? pool.filter(t => (t.floor || t.floor_assignment) === tier.floorFilter && t.capacity >= tier.capacityMin && t.capacity <= tier.capacityMax)
            .sort((a, b) => Math.abs(a.capacity - need) - Math.abs(b.capacity - need))
        : [];
      const best = matches[0]
        || pool.filter(t => t.capacity >= tier.capacityMin)
            .sort((a, b) => a.capacity - b.capacity)[0];
      if (best && !cartTables.some(ct => ct.id === best.id)) {
        setCartTables(prev => [...prev, { id: best.id, table_number: best.table_number, capacity: best.capacity, price: Number(best.price || 0) }]);
        setHasChecked(true);
        setAvailableTables(avail);
        const viaAssigned = assignedIds.has(Number(best.id)) ? 'included with your package' : 'matching your package';
        setTableAssignMsg(`Table #${best.table_number} (${best.floor || best.floor_assignment || tier.floorFilter || 'floor'}, ${best.capacity} pax) assigned — ${viaAssigned}. No manual pick needed.`);
        setTimeout(() => setTableAssignMsg(''), 6000);
      } else if (!best) {
        const msg = assignedIds.size > 0
          ? 'The table included in this package is unavailable for this date/time slot.'
          : `No tables seating ${need} guest${need !== 1 ? 's' : ''} are available for this date/time. Please try a different date.`;
        setErr(msg);
        showCheckoutToast('error', msg);
      }
    } catch (_) {
      // silent
    } finally {
      setAutoAssigningPkg(null);
    }
  }, [resDate, resTime, barId, cartTables, cartItems, packages, partySize]);

  // Auto-bind the package's table as soon as date + time are chosen —
  // the customer can go straight to checkout without a manual table pick.
  // Table bookings only: dine-in/takeout orders never hold tables.
  useEffect(() => {
    if (!isTableBooking) return;
    if (!activeTablePkg || !resDate || !resTime) return;
    if (cartTables.length > 0 || autoAssigningPkg) return;
    if (isSelectedSlotBlockedByOngoingEvent) return;
    autoAssignTableForPackage(activeTablePkg.package_id);
  }, [isTableBooking, activeTablePkg, resDate, resTime, cartTables.length, autoAssigningPkg, isSelectedSlotBlockedByOngoingEvent, autoAssignTableForPackage]);

  // If takeout stops being offered (category/settings change), fall back
  // to Table Booking rather than stranding the drawer in a hidden mode.
  useEffect(() => {
    if (!bar || takeoutVisible || orderType === 'table_booking') return;
    setOrderType('table_booking');
    setCartTables([]);
    setHasChecked(false);
    setTableMsg('');
    setAvailableTables([]);
  }, [bar, takeoutVisible, orderType]);

  // Switching order type: table-required packages can't go table-less, and
  // leaving Table Booking drops any held tables (tableId -> null).
  // Entering takeout purges alcohol (restricted to table bookings).
  const handleOrderTypeChange = (next) => {
    if (next === orderType) return;
    if (next !== 'table_booking' && tableRequired) {
      showCheckoutToast('error', 'This package requires a table reservation — remove it first to switch order type.');
      return;
    }
    if (next === 'takeout' && !pickupAllowed && !deliveryAllowed) {
      showCheckoutToast('error', 'This bar does not offer takeout right now.');
      return;
    }
    if (next === 'takeout') {
      const toRemove = cartItems.filter((ci) => {
        if (ci.isPackage) {
          const pkg = (packages || []).find((p) => Number(p.id) === Number(ci.package_id));
          return pkg ? isAlcoholPackage(pkg) : false;
        }
        const menu = (menuItems || []).find((m) => Number(m.id) === Number(ci.id));
        return menu ? isAlcoholMenuItem(menu) : false;
      });
      if (toRemove.length) {
        const names = [...new Set(toRemove.map((ci) => ci.name))];
        setCartItems((prev) => prev.filter((ci) => !toRemove.some((r) => r.id === ci.id)));
        showCheckoutToast('info', `Liquor items are restricted to Table Bookings and have been removed from your Takeout order (${names.join(', ')}).`);
      }
    }
    setOrderType(next);
    if (next !== 'table_booking') {
      setCartTables([]);
      setHasChecked(false);
      setTableMsg('');
      setAvailableTables([]);
      setPartySize('1');
      setFulfillment(pickupAllowed ? 'pickup' : 'delivery');
    }
  };

  const handleAddPackage = useCallback((pkg) => {
    if (!isTableBooking && isAlcoholPackage(pkg)) {
      showCheckoutToast('error', 'Liquor packages are restricted to Table Bookings.');
      return;
    }
    const needsTable = pkg.requires_table !== 0 && pkg.requires_table !== false;
    if (needsTable && !isTableBooking) {
      // A table-required package forces Table Booking mode.
      setOrderType('table_booking');
      showCheckoutToast('info', 'Table Booking selected — this package includes a table.');
    }
    addToCart({
      id: `pkg_${pkg.id}`, name: pkg.name,
      price: Number(pkg.price || 0), isPackage: true,
      // null stock (unknown / unmapped inventory) means uncapped — only a
      // real 0 from the stock gate blocks adding.
      package_id: pkg.id, stock_qty: Number(pkg.stock_qty ?? 999),
      requires_table: pkg.requires_table !== 0 && pkg.requires_table !== false,
      assigned_tables: Array.isArray(pkg.assigned_tables) ? pkg.assigned_tables : [],
      table_ids: Array.isArray(pkg.table_ids) ? pkg.table_ids : [],
    });
    setToastMsg(`${pkg.name} added to order`);
    setTimeout(() => setToastMsg(''), 2000);
    const tier = tierForPackage(pkg);
    if (tier) {
      if (!guestCountManual) {
        setPartySize(String(tier.defaultGuests));
      }
      if (resDate && resTime) {
        setTimeout(() => autoAssignTableForPackage(pkg.id), 300);
      }
    }
  }, [addToCart, autoAssignTableForPackage, guestCountManual, resDate, resTime, isTableBooking]);
  // ── Checkout ──
  const handleCheckout = async () => {
    // Checkout payload contract (must ALL be populated before submission):
    // barId, order_type, table_ids[] (booking only), menu_items[],
    // notes(packages), reservation_date, reservation_time, party_size,
    // paymentType('full'|'downpayment'), paymentMethod('gcash'|'paymaya'),
    // amount(effectivePaymentAmount).
    const fail = (text) => {
      setErr(text);
      showCheckoutToast('error', text);
    };
    // Check authentication first
    if (!isAuthenticated) {
      fail('Please sign in to make a reservation.');
      setTimeout(() => {
        navigate(VIEWS.LOGIN, { returnTo: VIEWS.BAR_DETAIL, barId });
      }, 1500);
      return;
    }
    // View-only roles can never check out, even if they reach this handler.
    if (!canOrderAtBar(user, bar)) {
      fail(readOnlyNote || 'Ordering is disabled in preview mode.');
      return;
    }
    if (tableRequired && !isTableBooking) { fail('This package requires a table reservation — switch back to Table Booking to check out.'); return; }
    if (isTableBooking && tableRequired && !cartTables.length) { fail('Please select at least one table before checking out.'); return; }
    // Takeout fulfillment rules: pickup/delivery availability comes from the
    // bar; delivery needs full contact details.
    let ff = null;
    if (!isTableBooking) {
      ff = fulfillment === 'delivery' ? 'delivery' : 'pickup';
      if (ff === 'pickup' && !pickupAllowed) { fail('This bar does not offer store pickup.'); return; }
      if (ff === 'delivery' && !deliveryAllowed) { fail('This bar does not offer delivery.'); return; }
      if (ff === 'delivery' && (!deliveryName.trim() || !deliveryPhone.trim() || !deliveryAddress.trim())) {
        fail('Please enter your name, phone number, and delivery address.');
        return;
      }
      if (ff !== fulfillment) setFulfillment(ff);
    }
    if (!resDate || !resTime) { fail('Please select a date and time for your reservation.'); return; }
    const ps = Number(partySize) || 2;
    if (isTableBooking && tableRequired && totalCapacity < ps) { fail(`Selected tables seat ${totalCapacity} — your party needs ${ps} guests. Please add more tables.`); return; }

    const normalizedDate = normalizeReservationDateInput(resDate);
    if (!normalizedDate) { fail('Please enter a valid reservation date.'); return; }
    if (normalizedDate < minReservationDate) { fail('Past reservation dates are not allowed.'); return; }
    if (isSelectedSlotBlockedByOngoingEvent) { fail(ongoingEventSlotNote || 'Selected reservation time overlaps an ongoing event. Please choose another timeslot.'); return; }

    if (!acceptOnline && !acceptGcash) { fail('This bar does not accept online payments at this time.'); return; }
    // The method picker is hidden for table-less orders — fall back to the
    // bar's first available method so the payload is never empty.
    const method = ['gcash', 'paymaya'].includes(paymentMethod)
      ? paymentMethod
      : (acceptGcash ? 'gcash' : 'paymaya');
    if (method !== paymentMethod) setPaymentMethod(method);
    setCheckingOut(true); setErr(''); setMsg('');
    try {
      const paymentAmount = effectivePaymentAmount;

      if (effectivePaymentType === 'downpayment' && paymentAmount <= 0) {
        throw new Error('Down payment is disabled for this bar. Please use Full Payment.');
      }

      const directMenuItems = cartItems.filter(i => !i.isPackage && Number(i.id) > 0);
      const packageItems = cartItems.filter(i => i.isPackage);
      const noteParts = [];

      if (directMenuItems.length > 0) {
        noteParts.push(`Order: ${directMenuItems.map(i => `${i.name} x${i.qty}`).join(', ')}`);
      }

      if (packageItems.length > 0) {
        noteParts.push(`Packages: ${packageItems.map(i => `pkg_${i.package_id || String(i.id).replace(/^pkg_/i, '')}::${i.name} x${i.qty}`).join(', ')}`);
      }

      const orderNote = noteParts.join(' || ');
      // VAT snapshot for receipts/logs (only when the bar's tax applies).
      const taxSnapshot = taxApplies ? {
        tax_rate: barTaxRate,
        tax_mode: barTaxMode,
        tax_amount: taxAmount,
        net_subtotal: netSubtotal,
      } : {};
      const resResult = await reservationService.create({
        bar_id: Number(barId),
        order_type: orderType,
        ...(isTableBooking ? {} : {
          fulfillment: ff,
          delivery_name: ff === 'delivery' ? deliveryName.trim() : undefined,
          delivery_phone: ff === 'delivery' ? deliveryPhone.trim() : undefined,
          delivery_address: ff === 'delivery' ? deliveryAddress.trim() : undefined,
          delivery_notes: ff === 'delivery' && deliveryNotes.trim() ? deliveryNotes.trim() : undefined,
        }),
        table_ids: isTableBooking ? cartTables.map(t => t.id) : [],
        reservation_date: normalizedDate,
        reservation_time: resTime,
        party_size: Number(partySize),
        notes: orderNote,
        menu_items: directMenuItems.map(i => ({
          menu_item_id: i.id,
          quantity: i.qty,
          unit_price: i.price,
        })),
        ...taxSnapshot,
      });
      const resId = resResult?.data?.id || resResult?.id;
      if (!resId) throw new Error('Reservation could not be created. Please try again.');

      const baseUrl = window.location.origin;
      const pay = await paymentService.createPayment({
        payment_type: 'reservation',
        related_id: resId,
        amount: paymentAmount,
        payment_method: method,
        bar_id: Number(barId),
        success_url: `${baseUrl}/payment/success?ref={REFERENCE_ID}`,
        cancel_url: `${baseUrl}/`,
        ...taxSnapshot,
      });
      const checkoutUrl = pay?.data?.checkout_url || pay?.checkout_url;
      if (checkoutUrl) {
        showCheckoutToast('info', 'Reservation created — redirecting to secure payment…');
        setTimeout(() => { window.location.href = checkoutUrl; }, 600);
      } else {
        setCartItems([]); setCartTables([]);
        try { if (cartStorageKey) localStorage.removeItem(cartStorageKey); } catch (_) { /* storage may be unavailable */ }
        const doneMsg = 'Reservation submitted! You will be notified once confirmed.';
        setMsg(doneMsg);
        showCheckoutToast('success', doneMsg);
        setTimeout(() => navigate(VIEWS.RESERVATIONS, {}), 1600);
      }
    } catch (e) {
      const canRetry = Boolean(e?.response?.data?.can_retry);
      const baseMsg = e?.response?.data?.message || e?.message || 'Checkout failed. Please try again.';
      const text = canRetry
        ? `${baseMsg} Your reservation is saved — please try the payment again.`
        : baseMsg;
      setErr(text);
      showCheckoutToast('error', text);
    } finally { setCheckingOut(false); }
  };

  const handleFollow = async () => {
    try {
      if (following) { const r = await socialService.unfollow(barId); setFollowing(r?.following || false); }
      else { const r = await socialService.follow(barId); setFollowing(r?.following ?? true); }
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to update follow.'); }
  };

  const handleLikeEvent = async (ev) => {
    try {
      const isLiked = ev.user_liked;
      if (isLiked) {
        const r = await eventService.unlike(ev.id);
        setEvents(p => p.map(i => i.id === ev.id ? { ...i, like_count: r.likeCount ?? Math.max(0, i.like_count - 1), user_liked: false } : i));
      } else {
        const r = await eventService.like(ev.id);
        setEvents(p => p.map(i => i.id === ev.id ? { ...i, like_count: r.likeCount ?? i.like_count + 1, user_liked: true } : i));
      }
    } catch (_) { }
  };

  const handleReview = async (e) => {
    e.preventDefault(); setSubmittingRev(true); setErr(''); setMsg('');
    try {
      await barService.submitReview(barId, { rating: Number(revRating), comment: revComment.trim() });
      setMsg('Review saved.'); await loadAll();
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to save review.'); }
    finally { setSubmittingRev(false); }
  };

  const handleDeleteReview = async () => {
    setSubmittingRev(true);
    try { await barService.deleteReview(barId); setMsg('Review removed.'); await loadAll(); }
    catch (e) { setErr(e?.response?.data?.message || 'Failed to delete review.'); }
    finally { setSubmittingRev(false); }
  };

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading bar...</span></div>;
  if (err && !bar) return <p className="error-text">{err}</p>;
  if (!bar) return <div className="glass-card empty-state"><div className="empty-icon"><Wine size={32} /></div><h3 className="text-h3">Bar not found</h3></div>;

  return (
    <div className="flex flex-col gap-xl">
      {canGoBack && (
        <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ alignSelf: 'flex-start' }}>← Back</button>
      )}

      {/* Hero */}
      <section className="glass-card" style={{ overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: '16px' }}>
        <div className="detail-hero-wrap">
          <img
            className="detail-hero-img"
            src={imageUrl(bar.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='400' viewBox='0 0 1200 400'%3E%3Crect width='1200' height='400' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`}
            alt={bar.name}
            loading="eager"
            draggable={false}
            onError={e => { e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='400' viewBox='0 0 1200 400'%3E%3Crect width='1200' height='400' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='%23333'%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E`; }}
          />
          <div className="detail-hero-overlay" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(10,10,10,0.92) 100%)' }} />
          <div className="detail-hero-info">
            <div className="detail-hero-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
              {bar.logo_path && (
                <img
                  src={imageUrl(bar.logo_path)}
                  alt={`${bar.name} logo`}
                  style={{
                    width: '110px',
                    height: '110px',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '4px',
                    backdropFilter: 'blur(10px)',
                    border: '3px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    flexShrink: 0
                  }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#CC0000', color: '#ffffff', padding: '0.2rem 0.65rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    <span>{(bar.category || 'Bar').toUpperCase()}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: openStatus.isOpen ? 'rgba(16,185,129,0.2)' : 'rgba(156,163,175,0.2)', color: openStatus.isOpen ? '#34d399' : '#9ca3af', padding: '0.2rem 0.65rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', backdropFilter: 'blur(4px)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: openStatus.isOpen ? '#10b981' : '#9ca3af' }} />
                    {openStatus.label}
                  </span>
                </div>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, lineHeight: 1.1, color: '#FFFFFF', letterSpacing: '-0.5px', textShadow: '0 2px 14px rgba(0,0,0,0.9)', margin: '0 0 0.35rem' }}>{bar.name}</h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.88rem', margin: '0 0 0.25rem', fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{bar.address}, {bar.city}, {bar.state}</p>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  <Star size={14} fill="#d97706" stroke="#d97706" /> <strong style={{ color: '#FFFFFF', fontWeight: 700 }}>{bar.rating || '0.0'}</strong> ({bar.review_count || 0} reviews) · {bar.follower_count || 0} followers
                </p>
              </div>
            </div>
            {!hideFollow && (
              <button className={`btn ${following ? 'btn-ghost' : 'btn-red'}`} onClick={handleFollow} style={{ flexShrink: 0, padding: '0.65rem 1.4rem', fontWeight: 700, borderRadius: '10px', boxShadow: '0 4px 14px rgba(204,0,0,0.3)' }}>
                {following ? 'Unfollow' : '+ Follow'}
              </button>
            )}
          </div>
        </div>
        {bar.description && (
          <div className="glass-card-body" style={{ paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
            <p className="text-body" style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-text-primary)', margin: 0 }}>{bar.description}</p>
          </div>
        )}
      </section>

      {msg && <div className="alert alert-info">{msg}</div>}
      {err && <div className="alert alert-err">{err}</div>}

      {/* Tab Navigation */}
      <section className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: '14px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'menu', label: 'Bar Menu' },
            { key: 'events', label: 'All Events' },
            { key: 'about', label: 'About' }
          ].map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1,
                  padding: '1rem 1.25rem',
                  background: isActive ? (isLightMode ? 'rgba(204,0,0,0.06)' : 'rgba(204,0,0,0.15)') : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #CC0000' : '3px solid transparent',
                  color: isActive ? '#CC0000' : 'var(--color-text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* ─── VIBE CHECK: Instagram Stories-style Media Showcase ─── */}
          {(trailers.length > 0 || photos.length > 0) && (
            <section style={{ marginBottom: '0.25rem' }}>
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={22} color="#CC0000" />
                  <h2 className="text-h2" style={{ margin: 0, fontSize: '1.15rem' }}>Vibe Check</h2>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {allMedia.length} item{allMedia.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Stories Carousel */}
              <div style={{
                display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem',
                scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}>
                {allMedia.map((item, idx) => {
                  const isVideo = item.media_type !== 'photo';
                  const isFeatured = idx === 0 && isVideo;
                  return (
                    <div
                      key={item.id}
                      onClick={() => { setMediaIndex(idx); setMediaViewerOpen(true); }}
                      style={{
                        flex: isFeatured ? '0 0 220px' : '0 0 150px',
                        borderRadius: 16, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                        border: isFeatured ? '2px solid #CC0000' : '1px solid var(--color-border)',
                        background: '#000', scrollSnapAlign: 'start',
                        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                        boxShadow: isFeatured ? '0 0 20px rgba(204,0,0,0.35), 0 4px 16px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
                        aspectRatio: '9/16',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(204,0,0,0.4), 0 8px 24px rgba(0,0,0,0.5)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = isFeatured ? '0 0 20px rgba(204,0,0,0.35), 0 4px 16px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)'; }}
                    >
                      {/* Media */}
                      {isVideo ? (
                        <video
                          src={imageUrl(item.video_url)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          preload={isFeatured ? 'auto' : 'metadata'}
                          muted loop playsInline
                          autoPlay={isFeatured}
                          onMouseEnter={(e) => { if (!isFeatured) e.target.play().catch(() => {}); }}
                          onMouseLeave={(e) => { if (!isFeatured) { e.target.pause(); e.target.currentTime = 0; } }}
                        />
                      ) : (
                        <img
                          src={imageUrl(item.video_url)}
                          alt={item.caption || ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          loading="lazy"
                        />
                      )}

                      {/* Gradient overlay at bottom */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        pointerEvents: 'none',
                      }} />

                      {/* Video play badge */}
                      {isVideo && (
                        <div style={{
                          position: 'absolute', top: 10, left: 10,
                          width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,0,0,0.85)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(204,0,0,0.4)',
                        }}>
                          <Play size={12} color="#fff" fill="#fff" />
                        </div>
                      )}

                      {/* Featured badge */}
                      {isFeatured && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          background: 'rgba(204,0,0,0.9)', color: '#fff', padding: '0.15rem 0.5rem',
                          borderRadius: 6, fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: '0.5px', backdropFilter: 'blur(4px)',
                        }}>
                          Featured
                        </div>
                      )}

                      {/* Caption / label at bottom */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '0.75rem 0.6rem 0.6rem',
                      }}>
                        <p style={{
                          color: '#fff', fontWeight: 700, fontSize: '0.78rem', margin: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}>
                          {item.label || item.caption || (isFeatured ? 'Featured' : `#${idx + 1}`)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Hours + Contact */}
          <section className="g g-2">
            <div className="glass-card glass-card-body" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-h3 mb-md" style={{ color: 'var(--color-text-primary)', fontFamily: "'Outfit', sans-serif", fontSize: '1.15rem' }}>Operating Hours</h3>
              {openingHours.map(([day, hrs]) => (
                <div className="hours-row" key={day} style={{ borderBottom: '1px solid var(--color-border)', padding: '0.5rem 0' }}>
                  <span className="hours-day" style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>{day}</span>
                  <span className="hours-val" style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>{hrs || 'Unavailable'}</span>
                </div>
              ))}
            </div>
            <div className="glass-card glass-card-body" style={{ border: '1px solid var(--color-border)' }}>
              <h3 className="text-h3 mb-md" style={{ color: 'var(--color-text-primary)', fontFamily: "'Outfit', sans-serif", fontSize: '1.15rem' }}>Contact</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', margin: 0, fontSize: '0.88rem' }}>
                  <Phone size={15} color="#CC0000" /> <span style={{ color: 'var(--color-text-primary)' }}>{bar.phone || 'No phone listed'}</span>
                </p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', margin: 0, fontSize: '0.88rem' }}>
                  <Mail size={15} color="#CC0000" /> <span style={{ color: 'var(--color-text-primary)' }}>{bar.email || 'No email listed'}</span>
                </p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', margin: 0, fontSize: '0.88rem' }}>
                  <Globe size={15} color="#CC0000" /> <span style={{ color: 'var(--color-text-primary)' }}>{bar.website || 'No website listed'}</span>
                </p>
              </div>
              <button
                className="btn btn-red btn-sm mt-md"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: 8, fontWeight: 700 }}
                onClick={() => navigate(VIEWS.MAP)}
              >
                <MapPin size={14} /> View on Map
              </button>
            </div>
          </section>

          {/* Featured Events Preview */}
          {events.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="text-h2">Upcoming Events</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('events')}
                  style={{ fontSize: '0.85rem' }}
                >
                  View All →
                </button>
              </div>
              <div className="g g-3">
                {events.slice(0, 3).map((ev) => (
                  <div className="glass-card" key={ev.id} style={{ overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'relative', overflow: 'hidden', height: '180px' }}>
                      <img
                        src={imageUrl(ev.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='180' viewBox='0 0 400 180'%3E%3Crect width='400' height='180' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23333'%3E%F0%9F%8E%89%3C/text%3E%3C/svg%3E`}
                        alt={ev.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='180' viewBox='0 0 400 180'%3E%3Crect width='400' height='180' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23333'%3E%F0%9F%8E%89%3C/text%3E%3C/svg%3E`; }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(220, 38, 38, 0.95)',
                        backdropFilter: 'blur(10px)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'white'
                      }}>
                        {formatDate(ev.event_date)}
                      </div>
                    </div>
                    <div className="glass-card-body" style={{ padding: '1rem' }}>
                      <h4 className="text-h4" style={{ marginBottom: '0.5rem' }}>{ev.title}</h4>
                      <p className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CalendarDays size={12} /> {formatTime(ev.start_time)} — {formatTime(ev.end_time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Packages Section */}
          {packages.length > 0 && (
            <section>
              <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Packages</h2>
              <div className="g g-3">
                {packages.map((pkg) => (
                  <div className="glass-card glass-card-body" key={pkg.id}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-h3" style={{ marginBottom: '0.5rem' }}>{pkg.name}</h3>
                        {pkg.description && (
                          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>{pkg.description}</p>
                        )}
                      </div>
                      <span className="text-2xl font-extrabold" style={{ color: '#CC0000', flexShrink: 0, marginLeft: '1rem' }}>
                        ₱{Number(pkg.price || 0).toLocaleString()}
                      </span>
                    </div>
                    {pkg.inclusions && pkg.inclusions.length > 0 && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#888' }}>Package Includes:</p>
                        <ul className="space-y-1.5">
                          {pkg.inclusions.map((inc, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2" style={{ color: '#ccc' }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#CC0000' }} />
                              <span>{inc.quantity}x {inc.item_name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Staff Types Section */}
          {bar && bar.staff_types && (() => {
            try {
              const staffTypes = typeof bar.staff_types === 'string' ? JSON.parse(bar.staff_types) : bar.staff_types;
              if (Array.isArray(staffTypes) && staffTypes.length > 0) {
                const staffIcons = {
                  'DJ': <Music size={16} />,
                  'Live Band': <Music size={16} />,
                  'Host / Emcee': <Mic size={16} />,
                  'Security': <Shield size={16} />,
                  'Waitstaff': <UtensilsCrossed size={16} />,
                  'Guard': <Shield size={16} />
                };
                return (
                  <section>
                    <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Staff & Services</h2>
                    <div className="glass-card glass-card-body">
                      <div className="tag-pill-group">
                        {staffTypes.map((type, idx) => (
                          <span key={idx} className="tag-pill">
                            <span className="tag-pill-icon">{staffIcons[type] || <Users size={16} />}</span>
                            <span className="tag-pill-label">{type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }
            } catch { }
            return null;
          })()}

          {/* Bar Type Conditional Content Sections */}
          {bar && bar.bar_types && (() => {
            try {
              const barTypes = typeof bar.bar_types === 'string' ? JSON.parse(bar.bar_types) : bar.bar_types;
              if (Array.isArray(barTypes) && barTypes.length > 0) {
                const norm = barTypes.map(t => String(t).toLowerCase());
                const isRestobar = norm.some(t => t.includes('restobar'));
                const isBarClub = norm.some(t => t.includes('club') || t === 'bar' || t.includes('bar / club') || t.includes('bar/club'));
                const isComedyBar = norm.some(t => t.includes('comedy'));
                return (
                  <>
                    {isRestobar && (
                      <section>
                        <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Performers</h2>
                        <div className="glass-card glass-card-body">
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Live bands, singers, and performers regularly entertain guests at this restobar.</p>
                          <div className="tag-pill" style={{ marginTop: '1rem' }}>
                            <span className="tag-pill-icon"><Music size={16} /></span>
                            <span className="tag-pill-label">Live Entertainment Available</span>
                          </div>
                        </div>
                      </section>
                    )}
                    {isBarClub && (
                      <section>
                        <h2 className="text-h2" style={{ marginBottom: '1rem' }}>DJ / Music</h2>
                        <div className="glass-card glass-card-body">
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Professional DJs and curated music playlists create the perfect atmosphere for your night out.</p>
                          <div className="tag-pill" style={{ marginTop: '1rem' }}>
                            <span className="tag-pill-icon"><Music size={16} /></span>
                            <span className="tag-pill-label">DJ & Music Entertainment</span>
                          </div>
                        </div>
                      </section>
                    )}
                    {isComedyBar && (
                      <section>
                        <h2 className="text-h2" style={{ marginBottom: '1rem' }}>Comedians / Shows</h2>
                        <div className="glass-card glass-card-body">
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Stand-up comedians and comedy shows provide non-stop laughter and entertainment.</p>
                          <div className="tag-pill" style={{ marginTop: '1rem' }}>
                            <span className="tag-pill-icon"><Mic size={16} /></span>
                            <span className="tag-pill-label">Comedy Shows & Stand-up</span>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                );
              }
            } catch { }
            return null;
          })()}

          {/* Reviews Preview */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="text-h2">Reviews</h2>
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                {reviewData?.average_rating || 0} ★ ({reviewData?.review_count || 0} reviews)
              </span>
            </div>
            {reviews.length === 0 ? (
              <div className="glass-card empty-state">
                <div className="empty-icon"><MessageCircle size={32} /></div>
                <p className="text-muted">No reviews yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                {reviews.slice(0, 3).map(r => (
                  <div className="glass-card glass-card-body" key={r.id}>
                    <div className="review-header">
                      <div className="review-author">
                        {r.profile_picture
                          ? <img src={imageUrl(r.profile_picture)} className="review-avatar" alt="" />
                          : <div className="review-avatar-ph">{r.first_name?.[0]}{r.last_name?.[0]}</div>}
                        <div>
                          <strong className="text-white" style={{ fontSize: '0.9rem' }}>{r.first_name} {r.last_name}</strong>
                          <div className="star-rating">{[1, 2, 3, 4, 5].map(s => <span key={s} className={s <= r.rating ? 'star filled' : 'star'}>★</span>)}</div>
                        </div>
                      </div>
                      <span className="text-dim" style={{ fontSize: '0.75rem' }}>{formatDate(r.created_at)}</span>
                    </div>
                    <p className="text-body" style={{ fontSize: '0.9rem' }}>{r.comment || 'No written comment.'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Add-to-Cart Toast */}
      {toastMsg && (
        <div className="pkg-toast">
          <span className="pkg-toast-icon">✓</span>
          <div>
            <div className="pkg-toast-text">{toastMsg}</div>
            <div className="pkg-toast-sub">View your order in the sidebar</div>
          </div>
        </div>
      )}

      {/* Checkout Toast: portaled to document.body so no transformed ancestor
          can break its fixed positioning — always visible at viewport top */}
      {checkoutToast && createPortal(
        <div className={`checkout-toast checkout-toast-${checkoutToast.type}`} role="alert">
          <span className="checkout-toast-icon">
            {checkoutToast.type === 'success' ? '✓' : checkoutToast.type === 'info' ? '…' : '!'}
          </span>
          <div className="checkout-toast-text">{checkoutToast.text}</div>
          <button type="button" className="checkout-toast-close" aria-label="Dismiss" onClick={() => setCheckoutToast(null)}>×</button>
        </div>,
        document.body
      )}

      {/* Bar Menu Tab */}
      {activeTab === 'menu' && (() => {
        const categories = Array.from(
          new Set(['All', ...menuItems.map(i => i.category || i.menu_category).filter(Boolean)])
        );

        // Top-level tabs: packages first, then All + each menu category.
        // Takeout mode shows food categories only (liquor is table-booking only).
        const menuTabs = [
          { key: 'packages', label: 'Exclusive Packages', icon: PackageIcon },
          { key: 'all', label: 'All Menu Items', icon: LayoutGrid },
          ...categories.filter((c) => c !== 'All' && (isTableBooking || !ALCOHOL_CATEGORIES.includes(String(c).trim().toLowerCase()))).map((c) => ({ key: c, label: c, icon: null })),
        ];

        const displayedMenuItems = menuItems.filter(item => {
          const name = (item.name || item.menu_name || '').toLowerCase();
          const desc = (item.description || item.menu_description || '').toLowerCase();
          const cat = item.category || item.menu_category || '';
          const q = menuSearch.trim().toLowerCase();
          const tabCat = menuTab === 'all' ? 'All' : menuTab;

          const matchesQuery = !q || name.includes(q) || desc.includes(q) || cat.toLowerCase().includes(q);
          const matchesCategory = tabCat === 'All' || cat === tabCat;
          const matchesTakeout = isTableBooking || !isAlcoholMenuItem(item);

          return matchesQuery && matchesCategory && matchesTakeout;
        });

        const displayedPackages = packages.filter((pkg) => {
          const q = menuSearch.trim().toLowerCase();
          if (!isTableBooking && isAlcoholPackage(pkg)) return false;
          if (!q) return true;
          const name = (pkg.name || '').toLowerCase();
          const desc = (pkg.description || '').toLowerCase();
          const inc = (pkg.inclusions || []).map((i) => i.item_name).join(' ').toLowerCase();
          return name.includes(q) || desc.includes(q) || inc.includes(q);
        });

        // Payment setup not finished: the whole ordering/reservation surface
        // is replaced by a branded empty state. No technical detail is shown.
        if (!paymentsReady && canOrder) {
          return (
            <section style={{ marginBottom: '1.5rem' }}>
              <div className="flex flex-col gap-sm mb-lg">
                <h2 className="text-h2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', margin: 0, color: 'var(--color-text-primary)' }}>
                  Bar Menu &amp; Packages
                </h2>
              </div>
              <div className="glass-card empty-state" style={{ border: '1px solid var(--color-border)', borderRadius: '14px', padding: '3.5rem 1.5rem' }}>
                <div className="empty-icon"><CreditCard size={34} color="#CC0000" /></div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.5rem 0' }}>
                  Menu Not Available Yet
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0, maxWidth: '34rem', lineHeight: 1.6 }}>
                  {"This bar hasn't finished setting up payments. Please check back soon."}
                </p>
              </div>
            </section>
          );
        }

        return (
          <section className="menu-cart-layout" style={!canOrder ? { gridTemplateColumns: '1fr' } : undefined}>
            {/* Owner/manager preview: payment setup unfinished, so customers
                still see the blocked state while this bar's own staff can add
                products and tables through the existing management screens. */}
            {!canOrder && readOnlyNote && (
              <ReadOnlyInfoCard note={readOnlyNote} showPortalLinks={showPortalLinks} />
            )}

            {/* Left: Menu */}
            <div className="menu-section">
              {/* Sticky tab header: title + search + category quick-jump tabs */}
              <div className="menu-sticky-bar">
                <div className="flex items-center justify-between flex-wrap gap-sm">
                  <h2 className="text-h2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', margin: 0, color: 'var(--color-text-primary)' }}>
                    Bar Menu &amp; Packages
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {menuTab === 'packages'
                      ? `${displayedPackages.length} package${displayedPackages.length !== 1 ? 's' : ''}`
                      : `${displayedMenuItems.length} item${displayedMenuItems.length !== 1 ? 's' : ''} available`}
                  </span>
                </div>

                <div className="grab-search-box menu-search-box">
                  <Search size={16} color="#CC0000" />
                  <input
                    type="text"
                    className="grab-search-input"
                    placeholder={menuTab === 'packages' ? 'Search packages...' : 'Search drinks, cocktails, food...'}
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {/* Tabbed navigation: packages vs menu categories */}
                <div className="menu-tabs-nav">
                  <button
                    type="button"
                    className="menu-tabs-arrow"
                    aria-label="Scroll categories left"
                    onClick={() => scrollMenuTabs(-1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div
                    className={`menu-tabs-scroll${tabsDragging ? ' dragging' : ''}`}
                    role="tablist"
                    aria-label="Menu categories"
                    ref={menuTabsRef}
                    onPointerDown={onTabsPointerDown}
                    onPointerMove={onTabsPointerMove}
                    onPointerUp={endTabsDrag}
                    onPointerLeave={endTabsDrag}
                    onClickCapture={onTabsClickCapture}
                  >
                    {menuTabs.map((tab) => {
                      const isSelected = menuTab === tab.key;
                      const catIcons = { Beers: Beer, Cocktails: Martini, Spirits: GlassWater, 'Non-Alcoholic': CupSoda };
                      const TabIcon = tab.icon || catIcons[tab.label] || Utensils;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`cat-pill menu-tab-pill ${isSelected ? 'active' : ''}`}
                          onClick={() => setMenuTab(tab.key)}
                        >
                          <span className="cat-pill-icon"><TabIcon size={14} /></span>
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="menu-tabs-arrow"
                    aria-label="Scroll categories right"
                    onClick={() => scrollMenuTabs(1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Packages view: compact swipeable carousel
                  (per-card lock hints live under each disabled button) */}
              {menuTab === 'packages' && (
                <div className="mb-lg">
                  {displayedPackages.length === 0 ? (
                    <div className="glass-card empty-state" style={{ border: '1px solid var(--color-border)', borderRadius: '14px', padding: '3rem 1.5rem' }}>
                      <div className="empty-icon"><PackageIcon size={32} color="#CC0000" /></div>
                      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.5rem 0' }}>
                        {menuSearch ? 'No matching packages' : 'No packages available'}
                      </h3>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>
                        {menuSearch ? 'Try searching another keyword.' : 'This venue has not published any packages yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className={`pkg-grid pkg-grid-compact${menuLocked ? ' menu-locked' : ''}`}>
                      {displayedPackages.map((pkg) => (
                        <PackageCard
                          key={pkg.id}
                          pkg={pkg}
                          pkgQty={getItemQty(`pkg_${pkg.id}`)}
                          onAdd={(p) => handleAddPackage(p)}
                          onRemove={(p) => removeFromCart(`pkg_${p.id}`)}
                          readOnly={!canOrder}
                          disabled={menuLocked && !packageBundlesTable(pkg)}
                          disabledReason={menuLockReason}
                          bundled={packageBundlesTable(pkg)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Menu items view */}
              {menuTab !== 'packages' && (
              <>
              <h3 className="text-h3 mb-md menu-section-title">
                <Utensils size={18} color="#CC0000" />
                {menuTab === 'all' ? 'Menu Items' : menuTab}
              </h3>
              {displayedMenuItems.length === 0 ? (
                <div className="glass-card empty-state" style={{ border: '1px solid var(--color-border)', borderRadius: '14px', padding: '3rem 1.5rem' }}>
                  <div className="empty-icon"><Utensils size={32} color="#CC0000" /></div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.5rem 0' }}>
                    {menuSearch || menuTab !== 'all' ? 'No matching menu items' : 'No menu published yet'}
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>
                    {menuSearch || menuTab !== 'all' ? 'Try searching another keyword or switching tabs.' : 'This venue has not published their menu items.'}
                  </p>
                </div>
              ) : (
                <div className={`menu-grid${menuLocked ? ' menu-locked' : ''}`}>
                  {displayedMenuItems.map((item) => {
                    const qty = getItemQty(item.id);
                    const name = item.name || item.menu_name || 'Menu Item';
                    const desc = item.description || item.menu_description || '';
                    const price = Number(item.price ?? item.selling_price ?? 0);
                    const category = item.category || item.menu_category || '';
                    const imgSrc = item.image_path ? imageUrl(item.image_path) : null;
                    const salesRank = Number(item.sales_rank || 0);
                    const isBestSeller = toBool(item.is_best_seller) || (Number.isFinite(salesRank) && salesRank > 0 && salesRank <= 3);
                    const stockQty = Number(item.stock_qty ?? item.stockQty ?? 999);
                    const isAtMaxStock = qty >= stockQty;
                    const isLowStock = stockQty > 0 && stockQty <= 5;
                    const isOutOfStock = stockQty <= 0;

                    return (
                      <div className="glass-card menu-item-card" key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: '14px' }}>
                        <div className="menu-item-media">
                          <img
                            src={imgSrc || MENU_PLACEHOLDER}
                            alt={name}
                            className="menu-item-img"
                            loading="lazy"
                            onError={(e) => { e.target.onerror = null; e.target.src = MENU_PLACEHOLDER; }}
                          />
                          <span className="menu-price-tag">₱{price.toFixed(2)}</span>
                          {isBestSeller && <span className="menu-best-tag"><Flame size={11} /> Best Seller</span>}
                        </div>
                        <div className="menu-item-body">
                          <div className="flex justify-between items-start gap-sm">
                            <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', fontFamily: "'Outfit', sans-serif", flex: 1 }}>{name}</h4>
                          </div>
                          {(isOutOfStock || isLowStock) && (
                            <div className="flex gap-xs flex-wrap mt-xs">
                              {isOutOfStock && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>Out of Stock</span>}
                              {!isOutOfStock && isLowStock && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>Only {stockQty} left</span>}
                            </div>
                          )}
                          {desc && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', lineHeight: 1.45, margin: '0.35rem 0 0' }}>{desc}</p>}
                          {category && <span style={{ marginTop: '0.5rem', display: 'inline-block', fontSize: '0.72rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-card)', padding: '0.2rem 0.55rem', borderRadius: 4, border: '1px solid var(--color-border)', width: 'fit-content' }}>{category}</span>}
                          <div className="menu-item-actions" style={{ marginTop: '0.75rem' }}>
                            {!canOrder ? (
                              <span
                                style={{ display: 'block', textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 8, padding: '0.45rem 0.5rem', lineHeight: 1.4 }}
                                title="Not available in owner preview"
                              >
                                Ordering disabled in preview mode
                              </span>
                            ) : isOutOfStock ? (
                              <button className="btn btn-sm" disabled style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}>
                                Out of Stock
                              </button>
                            ) : qty === 0 ? (
                              <button
                                className="btn btn-red btn-sm"
                                style={{ width: '100%', fontWeight: 700, borderRadius: 8, ...(menuLocked ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
                                onClick={() => addToCart(item)}
                                disabled={menuLocked}
                                title={menuLocked ? menuLockReason : undefined}
                              >
                                + Add to Order
                              </button>
                            ) : (
                              <div className="qty-control" style={{ border: '1px solid var(--color-border)', width: '100%', justifyContent: 'space-between' }}>
                                <button className="qty-btn" style={{ color: 'var(--color-text-primary)' }} onClick={() => removeFromCart(item.id)}>−</button>
                                <span className="qty-value" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{qty}</span>
                                <button
                                  className="qty-btn"
                                  style={{ color: 'var(--color-text-primary)', ...((isAtMaxStock || menuLocked) ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                                  onClick={() => addToCart(item)}
                                  disabled={isAtMaxStock || menuLocked}
                                  title={menuLocked ? menuLockReason : undefined}
                                >+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </>
            )}
            </div>

            {/* Right: Cart Panel — customers only; read-only roles get an
                info card instead (ordering stays behind the payment gate). */}
            {canOrder ? (
            <div
              className="cart-panel"
              id="cart-panel"
            >
              <div className="cart-sticky glass-card glass-card-body" style={{ border: '1px solid var(--color-border)', borderRadius: '16px' }}>
                <h3 className="text-h3 mb-md" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                  <ShoppingCart size={18} color="#CC0000" /> Your Order
                </h3>

                {/* Step Indicator: 1 Details -> 2 Items -> 3 Payment */}
                {(() => {
                  const detailsDone = isTableBooking
                    ? Boolean(resDate && resTime && partySize && cartTables.length > 0)
                    : Boolean(resDate && resTime);
                  const itemsDone = cartItems.length > 0;
                  const currentStep = !detailsDone ? 1 : (!itemsDone ? 2 : 3);
                  const steps = ['Details', 'Items', 'Payment'];
                  return (
                    <div className="step-indicator">
                      {steps.map((label, i) => {
                        const s = i + 1;
                        const done = s === 1 ? detailsDone : s === 2 ? (detailsDone && itemsDone) : false;
                        const active = currentStep === s;
                        return (
                          <span key={label} style={{ display: 'contents' }}>
                            {i > 0 && <span className={`step-line ${(s === 2 && detailsDone) || (s === 3 && detailsDone && itemsDone) ? 'completed' : ''}`} />}
                            <span className={`step-dot ${done ? 'completed' : active ? 'active' : 'pending'}`}>{done ? '✓' : s}</span>
                            <span className={`step-label ${active || done ? 'active' : 'pending'}`}>{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Table Reservation Picker */}
                <div className="cart-section">
                  <p className="text-label mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Utensils size={13} /> Order Type
                  </p>
                  <div className="pay-options" role="radiogroup" aria-label="Order type">
                    {[
                      { value: 'table_booking', label: 'Table Booking' },
                      ...(takeoutVisible ? [{ value: 'takeout', label: 'Takeout / Food Order' }] : []),
                    ].map((o) => (
                      <label key={o.value} className={`pay-option ${orderType === o.value ? 'selected' : ''}`}>
                        <input type="radio" name="ot" value={o.value} checked={orderType === o.value} onChange={(e) => handleOrderTypeChange(e.target.value)} />
                        <span className="pay-option-label">{o.label}</span>
                      </label>
                    ))}
                  </div>
                  {!isTableBooking && (
                    <>
                      <p style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '0.5rem 0.6rem', lineHeight: 1.4, marginTop: '0.5rem' }}>
                        ✓ Takeout order — no table needed, pay the full food amount.
                      </p>
                      <p className="text-label mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem' }}>
                        Fulfillment
                      </p>
                      <div className="pay-options" role="radiogroup" aria-label="Fulfillment">
                        {pickupAllowed && (
                          <label className={`pay-option ${fulfillment === 'pickup' ? 'selected' : ''}`}>
                            <input type="radio" name="ff" value="pickup" checked={fulfillment === 'pickup'} onChange={(e) => setFulfillment(e.target.value)} />
                            <span className="pay-option-label">Store Pickup</span>
                          </label>
                        )}
                        {deliveryAllowed && (
                          <label className={`pay-option ${fulfillment === 'delivery' ? 'selected' : ''}`}>
                            <input type="radio" name="ff" value="delivery" checked={fulfillment === 'delivery'} onChange={(e) => setFulfillment(e.target.value)} />
                            <span className="pay-option-label">Delivery{barDeliveryFee > 0 ? ` (+₱${Number(barDeliveryFee).toFixed(2)})` : ''}</span>
                          </label>
                        )}
                      </div>
                      {fulfillment === 'pickup' ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.55rem 0.65rem', lineHeight: 1.5, marginTop: '0.5rem' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text-primary)' }}>Pick up at the store</p>
                          {(bar?.address || bar?.city) && (
                            <p style={{ margin: '0.25rem 0 0' }}>{[bar.address, bar.city, bar.state].filter(Boolean).join(', ')}</p>
                          )}
                          <p style={{ margin: '0.25rem 0 0', color: '#4ade80' }}>Estimated ready in ~30 minutes · Fee ₱0.00</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-sm" style={{ marginTop: '0.5rem' }}>
                          <input
                            className="glass-input"
                            placeholder="Full name *"
                            value={deliveryName}
                            onChange={(e) => setDeliveryName(e.target.value)}
                            autoComplete="name"
                          />
                          <input
                            className="glass-input"
                            placeholder="Contact / phone number *"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            inputMode="tel"
                            autoComplete="tel"
                          />
                          <textarea
                            className="glass-input"
                            placeholder="Delivery address *"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            rows={2}
                            style={{ resize: 'vertical' }}
                          />
                          <input
                            className="glass-input"
                            placeholder="Special instructions (optional)"
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-label mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem' }}>
                    <CalendarDays size={13} /> Date & Time
                    <span className="text-red" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>*required</span>
                  </p>
                  <div className="flex flex-col gap-sm">
                    {activeTablePkg && !resDate && (
                      <div style={{ fontSize: '0.73rem', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '0.4rem 0.6rem', lineHeight: 1.4 }}>
                        📦 Select a date & time to auto-assign a {activeTablePkg.tier.floorFilter} table for your {activeTablePkg.tier.tierLabel} package.
                      </div>
                    )}
                    <input
                      className="glass-input"
                      type="date"
                      value={resDate}
                      min={minReservationDate}
                      onChange={e => { setResDate(e.target.value); setCartTables([]); setHasChecked(false); setTableMsg(''); }}
                    />
                    <select
                      className="glass-input"
                      value={resTime}
                      disabled={!resDate}
                      onChange={e => { setResTime(e.target.value); setCartTables([]); setHasChecked(false); setTableMsg(''); }}
                      style={!resDate ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                      <option value="">{resDate ? 'Select hour' : 'Pick a date first'}</option>
                      {availableHourOptions.map((slot) => (
                        <option key={slot} value={slot}>{formatHourLabel(slot)}</option>
                      ))}
                    </select>
                    {resDate && availableHourOptions.length === 0 && (
                      <p className="text-dim" style={{ fontSize: '0.7rem', marginTop: '-0.25rem', color: '#f59e0b' }}>
                        No operating hours configured for this day.
                      </p>
                    )}
                    {resDate && availableHourOptions.length > 0 && (() => {
                      const d = new Date(`${resDate}T00:00:00`);
                      const col = ['sunday_hours', 'monday_hours', 'tuesday_hours', 'wednesday_hours', 'thursday_hours', 'friday_hours', 'saturday_hours'][d.getDay()];
                      const hrs = bar?.[col];
                      return hrs ? (
                        <p style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '-0.25rem' }}>
                          Open: {hrs}
                        </p>
                      ) : null;
                    })()}
                    <input
                      className="glass-input"
                      type="number"
                      min="1"
                      placeholder="Party size (number of guests)"
                      value={partySize}
                      onChange={e => { setPartySize(e.target.value); setCartTables([]); setHasChecked(false); setTableMsg(''); setGuestCountManual(true); }}
                    />
                    {!tableRequired && cartItems.length > 0 && resDate && resTime && (
                      <div style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '0.5rem 0.6rem', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        ✓ No table reservation required for this order — check below to reserve one optionally.
                      </div>
                    )}
                    {isTableBooking && (
                    <button
                      className="btn-outline"
                      onClick={activeTablePkg && resDate && resTime ? () => autoAssignTableForPackage(activeTablePkg.package_id) : handleCheckTables}
                      disabled={checkingTables || autoAssigningPkg || !resDate || !resTime || !partySize || isSelectedSlotBlockedByOngoingEvent}
                    >
                      {checkingTables || autoAssigningPkg
                        ? (autoAssigningPkg ? 'Assigning table...' : 'Checking...')
                        : isSelectedSlotBlockedByOngoingEvent
                          ? 'Selected Slot Unavailable'
                          : activeTablePkg && resDate && resTime
                            ? `🔄 Assign ${activeTablePkg.tier.tierLabel} Table`
                            : '🔍 Check Availability'}
                    </button>
                    )}

                    {isTableBooking && activeTablePkg && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'rgba(201,118,47,0.08)', border: '1px solid rgba(201,118,47,0.2)', borderRadius: '8px', padding: '0.4rem 0.6rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
                        📦 <strong style={{ color: 'var(--red-primary)' }}>{activeTablePkg.name}</strong> — {activeTablePkg.tier.defaultGuests} guests · {activeTablePkg.tier.floorFilter}
                      </div>
                    )}

                    {isTableBooking && tableAssignMsg && (
                      <div className="alert alert-info mt-sm" style={{ fontSize: '0.8rem' }}>
                        {tableAssignMsg}
                      </div>
                    )}

                    {isSelectedSlotBlockedByOngoingEvent && (
                      <div className="alert alert-warn" style={{ fontSize: '0.8rem' }}>
                        {ongoingEventSlotNote || 'Selected reservation time overlaps an ongoing event. Please choose another timeslot.'}
                      </div>
                    )}
                  </div>

                  {isTableBooking && tableMsg && (
                    <div className={`alert mt-sm ${availableTables.length > 0 ? 'alert-info' : 'alert-warn'}`}>
                      {tableMsg}
                    </div>
                  )}

                  {isTableBooking && hasChecked && availableTables.length > 0 && (() => {
                    const ps = Number(partySize) || 2;
                    const idealMax = ps * 2;
                    const ideal = [];
                    const oversized = [];
                    for (const t of availableTables) {
                      if (t.capacity <= idealMax) {
                        ideal.push({ ...t, _fit: t.capacity - ps });
                      } else {
                        oversized.push({ ...t, _fit: t.capacity - ps });
                      }
                    }
                    ideal.sort((a, b) => a._fit - b._fit);
                    oversized.sort((a, b) => a.capacity - b.capacity);
                    const sorted = [...ideal, ...oversized];
                    return (
                    <>
                      {cartTables.length > 0 && (
                        <div className="alert alert-info mt-sm" style={{ fontSize: '0.85rem' }}>
                          <strong>{cartTables.length} table(s) selected</strong> · Total capacity: {totalCapacity} pax · Party size: {partySize} pax
                          {totalCapacity < partySize && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⚠️ Need more capacity</span>}
                          {totalCapacity >= partySize && <span style={{ color: '#4ade80', marginLeft: '0.5rem' }}>✓ Sufficient capacity</span>}
                        </div>
                      )}
                      {oversized.length > 0 && ideal.length > 0 && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0.25rem' }}>
                          Best fits for {ps} {ps === 1 ? 'guest' : 'guests'} shown first
                        </p>
                      )}
                      <div className="table-grid mt-sm">
                        {sorted.map(t => {
                          const isSelected = cartTables.some(ct => ct.id === t.id);
                          const isOversized = t.capacity > idealMax;
                          return (
                            <button
                              key={t.id}
                              className={`table-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => selectTable(t)}
                            >
                              {t.image_path ? (
                                <img
                                  src={imageUrl(t.image_path)}
                                  alt={`Table ${t.table_number}`}
                                  className="table-image"
                                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.5rem' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className="table-placeholder" style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: t.image_path ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                                <Utensils size={32} style={{ opacity: 0.3, color: 'var(--text-muted)' }} />
                              </div>
                              <span className="table-num">
                                {isSelected && <span style={{ color: '#4ade80', marginRight: '0.25rem' }}>✓</span>}
                                Table #{t.table_number}
                              </span>
                              {t.floor && <span className="table-floor" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Floor: {t.floor}</span>}
                              <span className="table-cap">Cap: {t.capacity} pax</span>
                              {isOversized && (
                                <span style={{ fontSize: '0.65rem', color: '#f59e0b', lineHeight: 1.3, textAlign: 'center' }}>
                                  Seats {t.capacity} — larger than needed
                                </span>
                              )}
                              {Number(t.price) > 0 && <span className="table-price">₱{Number(t.price).toFixed(2)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                    );
                  })()}
                </div>

                {/* Cart Items */}
                {cartItems.length > 0 && (() => {
                  const pkgItems = cartItems.filter(i => i.isPackage);
                  const menuCartItems = cartItems.filter(i => !i.isPackage);
                  return (
                    <div className="cart-section">
                      {pkgItems.length > 0 && (
                        <>
                          <p className="cart-items-section-title"><PackageIcon size={12} /> Packages ({pkgItems.reduce((s, i) => s + i.qty, 0)})</p>
                          <div className="cart-items-list">
                            {pkgItems.map(item => (
                              <div className="cart-item-row" key={item.id}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p className="cart-item-name">{item.name}</p>
                                  <p className="cart-item-sub">₱{item.price.toFixed(2)} × {item.qty}</p>
                                </div>
                                <div className="flex items-center gap-sm" style={{ flexShrink: 0 }}>
                                  <span className="cart-item-total">₱{(item.price * item.qty).toFixed(2)}</span>
                                  <div className="qty-control sm">
                                    <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                                    <span className="qty-value">{item.qty}</span>
                                    <button className="qty-btn" onClick={() => addToCart({ id: item.id, name: item.name, price: item.price, isPackage: true, package_id: item.package_id, requires_table: item.requires_table })}>+</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {menuCartItems.length > 0 && <div className="cart-divider" />}
                        </>
                      )}
                      {menuCartItems.length > 0 && (
                        <>
                          <p className="cart-items-section-title"><Utensils size={12} /> Menu Items ({menuCartItems.reduce((s, i) => s + i.qty, 0)})</p>
                          <div className="cart-items-list">
                            {menuCartItems.map(item => (
                              <div className="cart-item-row" key={item.id}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p className="cart-item-name">{item.name}</p>
                                  <p className="cart-item-sub">₱{item.price.toFixed(2)} × {item.qty}</p>
                                </div>
                                <div className="flex items-center gap-sm" style={{ flexShrink: 0 }}>
                                  <span className="cart-item-total">₱{(item.price * item.qty).toFixed(2)}</span>
                                  <div className="qty-control sm">
                                    <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                                    <span className="qty-value">{item.qty}</span>
                                    <button className="qty-btn" onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}>+</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Order Total */}
                {(cartTables.length > 0 || cartItems.length > 0) && (
                  <div className="cart-total-box">
                    {cartTables.map(table => {
                      const cover = coveringPackageForTable(table.id);
                      const fee = cover ? 0 : Number(table.price || 0);
                      return (
                        <div className="cart-total-row" key={table.id}>
                          <span>Table #{table.table_number} ({table.capacity} pax){cover ? ` — Included in ${cover.name}` : ''}</span>
                          <span>₱{fee.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    {cartItems.map(item => (
                      <div className="cart-total-row" key={item.id}>
                        <span>{item.name} ×{item.qty}</span>
                        <span>₱{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                    {deliveryFee > 0 && (
                      <div className="cart-total-row">
                        <span>Delivery Fee</span>
                        <span>₱{deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {taxApplies && barTaxMode === 'INCLUSIVE' && (
                      <>
                        <div className="cart-total-row">
                          <span>Subtotal (Net of VAT)</span>
                          <span>₱{netSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="cart-total-row">
                          <span>VAT ({barTaxRate.toFixed(0)}% Included)</span>
                          <span>₱{taxAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {taxApplies && barTaxMode === 'EXCLUSIVE' && (
                      <>
                        <div className="cart-total-row">
                          <span>Subtotal</span>
                          <span>₱{grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="cart-total-row">
                          <span>VAT ({barTaxRate.toFixed(0)}%)</span>
                          <span>₱{taxAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="cart-grand-total">
                      <span>Total</span>
                      <span>₱{payableTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {(cartTables.length > 0 || cartItems.length > 0) && (acceptGcash || acceptOnline) && grandTotal > 0 && isTableBooking && (
                  <>
                    <div className="cart-section">
                      <p className="text-label mb-sm">Payment Type</p>
                      <div className="pay-options">
                        <label
                          className={`pay-option ${effectivePaymentType === 'downpayment' ? 'selected' : ''}`}
                          style={isZeroDownPayment ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                        >
                          <input
                            type="radio"
                            name="pt"
                            value="downpayment"
                            checked={effectivePaymentType === 'downpayment'}
                            onChange={e => setPaymentType(e.target.value)}
                            disabled={isZeroDownPayment}
                          />
                          <span className="pay-option-label">Down Payment ({depositPercent.toFixed(0)}%)</span>
                        </label>
                        <label className={`pay-option ${effectivePaymentType === 'full' ? 'selected' : ''}`}>
                          <input type="radio" name="pt" value="full" checked={effectivePaymentType === 'full'} onChange={e => setPaymentType(e.target.value)} />
                          <span className="pay-option-label">Full Payment (100%)</span>
                        </label>
                      </div>
                      {isZeroDownPayment && (
                        <div className="rounded-lg px-3 py-2 mt-2" style={{ background: 'rgba(96, 165, 250, 0.10)', border: '1px solid rgba(96, 165, 250, 0.35)' }}>
                          <p className="text-xs" style={{ color: '#93c5fd', lineHeight: '1.4' }}>
                            Down payment is currently set to 0%, so only Full Payment is available.
                          </p>
                        </div>
                      )}
                      {effectivePaymentType === 'downpayment' && (
                        <div className="rounded-lg px-3 py-2 mt-2" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                          <p className="text-xs font-semibold" style={{ color: '#fbbf24', marginBottom: '0.25rem' }}>⚠ Non-Refundable Policy</p>
                          <p className="text-xs" style={{ color: '#d97706', lineHeight: '1.4' }}>
                            Down payment is <strong>non-refundable</strong> if you are a no-show within 30 minutes of your reservation time. Please arrive on time or contact the bar to reschedule.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="cart-total-box" style={{ marginTop: '0.75rem' }}>
                      <div className="cart-total-row">
                        <span>Total estimated bill</span>
                        <span>₱{payableTotal.toFixed(2)}</span>
                      </div>
                      <div className="cart-grand-total">
                        <span>{effectivePaymentType === 'full' ? 'Full payment (100%)' : `Down payment (${depositPercent.toFixed(0)}%)`}</span>
                        <span>₱{effectivePaymentAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Payment Method (shown whenever checkout is possible so the
                    payload method is always an explicit customer choice) */}
                {(cartTables.length > 0 || cartItems.length > 0) && (acceptGcash || acceptOnline) && (
                  <div className="cart-section">
                    <p className="text-label mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><CreditCard size={13} /> Payment Method</p>
                    <div className="pay-options">
                      {acceptGcash && (
                        <label className={`pay-option ${paymentMethod === 'gcash' ? 'selected' : ''}`}>
                          <input type="radio" name="pm" value="gcash" checked={paymentMethod === 'gcash'} onChange={e => setPaymentMethod(e.target.value)} />
                          <span className="pay-option-icon"><Smartphone size={18} /></span>
                          <span className="pay-option-label">GCash</span>
                        </label>
                      )}
                      {acceptOnline && (
                        <label className={`pay-option ${paymentMethod === 'paymaya' ? 'selected' : ''}`}>
                          <input type="radio" name="pm" value="paymaya" checked={paymentMethod === 'paymaya'} onChange={e => setPaymentMethod(e.target.value)} />
                          <span className="pay-option-icon"><CreditCard size={18} /></span>
                          <span className="pay-option-label">Card / PayMaya</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {cartTables.length > 0 && !acceptGcash && !acceptOnline && (
                  <div className="alert alert-warn mt-sm">This bar does not accept online payments at this time.</div>
                )}

                {/* Oversized Table Confirmation */}
                {isTableBooking && oversizedConfirm && (
                  <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.4rem' }}>
                      Table larger than needed
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                      Table #{oversizedConfirm.table_number} seats {oversizedConfirm.capacity} — more than your group of {partySize}. Are you sure?
                    </p>
                    <div className="flex gap-sm">
                      <button className="btn btn-red btn-sm" style={{ flex: 1, fontSize: '0.78rem' }} onClick={confirmOversized}>
                        Yes, select it
                      </button>
                      <button className="btn-outline" style={{ flex: 1, fontSize: '0.78rem', padding: '0.4rem 0.6rem' }} onClick={() => setOversizedConfirm(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Checkout Button */}
                {(() => {
                  const ps = Number(partySize) || 2;
                  const capacityInsufficient = tableRequired && cartTables.length > 0 && totalCapacity < ps;
                  const needsTables = tableRequired && !cartTables.length;
                  return (
                    <>
                      <button
                        type="button"
                        className="btn btn-red w-full mt-md"
                        onClick={handleCheckout}
                        disabled={checkingOut || needsTables || effectivePaymentAmount <= 0 || isSelectedSlotBlockedByOngoingEvent || capacityInsufficient}
                      >
                        {checkingOut
                          ? 'Processing...'
                          : needsTables
                            ? 'Select Table(s) to Checkout'
                            : capacityInsufficient
                              ? `Need more capacity (${totalCapacity}/${ps} pax)`
                              : isSelectedSlotBlockedByOngoingEvent
                                ? 'Selected Slot Unavailable'
                                : effectivePaymentType === 'full'
                                  ? `Pay Full Amount — ₱${payableTotal.toFixed(2)}`
                                  : `Pay Down Payment — ₱${downPaymentAmount.toFixed(2)}`}
                      </button>
                      {capacityInsufficient && (
                        <p style={{ fontSize: '0.72rem', color: '#ef4444', textAlign: 'center', marginTop: '0.4rem' }}>
                          Selected tables seat {totalCapacity} — your party needs {ps}. Add more tables.
                        </p>
                      )}
                    </>
                  );
                })()}

                {isSelectedSlotBlockedByOngoingEvent && (
                  <p className="text-dim mt-sm" style={{ fontSize: '0.75rem', textAlign: 'center', color: '#f59e0b' }}>
                    {ongoingEventSlotNote || 'Selected reservation time overlaps an ongoing event. Please choose another timeslot.'}
                  </p>
                )}

                {!cartTables.length && tableRequired && (
                  <p className="text-dim mt-sm" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                    A table reservation is required to complete your order.
                  </p>
                )}
              </div>
            </div>
            ) : (
              readOnlyNote && (
                <ReadOnlyInfoCard note={readOnlyNote} showPortalLinks={showPortalLinks} />
              )
            )}

            {/* Mobile floating cart bar: full-width menu on small screens */}
            {canOrder && (cartItems.length > 0 || cartTables.length > 0) && (
              <button
                type="button"
                className="cart-fab"
                onClick={() => document.getElementById('cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <span className="cart-fab-count">
                  {cartItems.reduce((s, i) => s + (i.qty || 0), 0) + cartTables.length} item{(cartItems.reduce((s, i) => s + (i.qty || 0), 0) + cartTables.length) !== 1 ? 's' : ''} in cart — ₱{payableTotal.toFixed(2)}
                </span>
                <span className="cart-fab-action">View Cart / Reserve</span>
              </button>
            )}
          </section>
        );
      })()}

      {/* All Events Tab */}
      {activeTab === 'events' && (
        events.length > 0 ? (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <CalendarDays size={28} style={{ color: 'var(--red)' }} />
              <h2 className="text-h2" style={{ margin: 0 }}>All Events</h2>
              <span className="badge-glass" style={{ marginLeft: 'auto' }}>{events.length} event{events.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="g g-3">
              {events.map((ev) => {
                const eventDateStr = ev.event_date ? ev.event_date.split('T')[0] : null;
                const isUpcoming = eventDateStr && new Date(eventDateStr + 'T23:59:59') >= new Date();
                return (
                  <div className="glass-card" key={ev.id} style={{ overflow: 'hidden', position: 'relative', opacity: isUpcoming ? 1 : 0.72 }}>
                    {!isUpcoming && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, background: 'rgba(0,0,0,0.55)', padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>Past Event</div>
                    )}
                    <div style={{ position: 'relative', overflow: 'hidden', height: '220px' }}>
                      <img
                        src={imageUrl(ev.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='64' fill='%23333'%3E%F0%9F%8E%89%3C/text%3E%3C/svg%3E`}
                        alt={ev.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease'
                        }}
                        onError={e => { e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'%3E%3Crect width='400' height='220' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='64' fill='%23333'%3E%F0%9F%8E%89%3C/text%3E%3C/svg%3E`; }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(220, 38, 38, 0.95)',
                        backdropFilter: 'blur(10px)',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, color: 'white' }}>
                          {new Date(ev.event_date).getDate()}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                          {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div className="glass-card-body" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h3 className="text-h3" style={{ fontSize: '1.25rem', fontWeight: 700, flex: 1 }}>{ev.title}</h3>
                        {ev.event_type && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(204,0,0,0.15)',
                            color: '#f87171',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(204,0,0,0.3)',
                            whiteSpace: 'nowrap',
                            marginLeft: '0.5rem'
                          }}>
                            {ev.event_type}
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.75rem',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <CalendarDays size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {formatDate(ev.event_date)} · {formatTime(ev.start_time)} — {formatTime(ev.end_time)}
                        </span>
                      </div>
                      {/* Feature 3: Entrance fee display */}
                      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {Number(ev.entry_price || 0) > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(204,0,0,0.15)', color: '#f87171', borderRadius: '12px', border: '1px solid rgba(204,0,0,0.25)' }}>
                            🎟 ₱{Number(ev.entry_price).toLocaleString()} entrance
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(74,222,128,0.1)', color: '#4ade80', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.2)' }}>
                            FREE Entry
                          </span>
                        )}
                      </div>
                      {ev.description && (
                        <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                          {ev.description}
                        </p>
                      )}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <span style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}>
                          <Heart size={14} style={{ color: 'var(--red)' }} />
                          {ev.like_count || 0} {(ev.like_count || 0) === 1 ? 'like' : 'likes'}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: ev.user_liked ? 'rgba(220, 38, 38, 0.15)' : undefined,
                            color: ev.user_liked ? '#f87171' : undefined,
                            border: ev.user_liked ? '1px solid rgba(220, 38, 38, 0.3)' : undefined
                          }}
                          onClick={() => handleLikeEvent(ev)}
                        >
                          <Heart size={14} fill={ev.user_liked ? '#f87171' : 'none'} stroke={ev.user_liked ? '#f87171' : 'currentColor'} />
                          {ev.user_liked ? 'Unlike' : 'Like Event'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="glass-card empty-state">
            <div className="empty-icon"><CalendarDays size={32} /></div>
            <h3 className="text-h3">No Events Yet</h3>
            <p className="text-muted mt-sm">This bar hasn't posted any events.</p>
          </div>
        )
      )}

      {/* About Tab — Redesigned */}
      {activeTab === 'about' && (() => {
        const todayIdx = new Date().getDay();
        const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][todayIdx];
        const todayHours = openingHours.find(([d]) => d === todayName)?.[1] || '';
        const isOpenNow = openStatus?.isOpen;
        const ratingAvg = Number(reviewData?.average_rating || 0);
        const ratingCount = Number(reviewData?.review_count || 0);
        // Rating distribution (if available from backend, else synthesize from reviews)
        const ratingDist = [5,4,3,2,1].map(star => {
          const count = (reviews || []).filter(r => Number(r.rating) === star).length;
          return { star, count, pct: ratingCount ? Math.round((count / Math.max(ratingCount,1)) * 100) : 0 };
        });
        // Parse bar_types for vibes chips
        let vibeChips = [];
        try {
          const raw = bar?.bar_types;
          const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(arr)) vibeChips = arr.map(s => String(s).trim()).filter(Boolean);
        } catch {}
        const vibeIconMap = { restobar: '🎸', club: '🎧', bar: '🍸', comedy: '🎤', ktv: '🎙️', karaoke: '🎙️', lounge: '🛋️', pub: '🍺' };
        const vibeLabel = (t) => t;

        return (
        <>
          {/* About This Bar */}
          {(bar.description || bar.category || bar.price_range) && (
            <section className="glass-card glass-card-body">
              <h3 className="text-h3 mb-md">About This Bar</h3>
              {bar.description && (
                <p className="text-body" style={{ lineHeight: 1.7, marginBottom: '1rem' }}>{bar.description}</p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {bar.category && <span className="badge-red">{bar.category}</span>}
                {bar.price_range && <span className="badge-glass">{bar.price_range}</span>}
                {bar.city && (
                  <span className="badge-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={11} /> {bar.city}{bar.state ? `, ${bar.state}` : ''}
                  </span>
                )}
                {bar.address && <span className="badge-glass">{bar.address}</span>}
              </div>
            </section>
          )}

          {/* Hours + Contact — two-column, visually distinct */}
          <section className="g g-2">
            {/* Operating Hours — visual schedule */}
            <div className="glass-card" style={{ overflow: 'hidden', border: isOpenNow ? '1px solid rgba(74,222,128,0.18)' : undefined }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.9rem 1.1rem',
                background: isOpenNow ? 'linear-gradient(135deg, rgba(74,222,128,0.10), rgba(74,222,128,0.02))' : 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                    background: isOpenNow ? '#4ade80' : '#6b7280',
                    boxShadow: isOpenNow ? '0 0 8px rgba(74,222,128,0.6)' : 'none', flexShrink: 0
                  }} />
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: isOpenNow ? '#4ade80' : '#9ca3af' }}>
                    {isOpenNow ? 'Open Now' : 'Closed Now'}
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {todayHours ? `Today: ${todayHours}` : 'Today: Closed'}
                </span>
              </div>
              <div style={{ padding: '0.6rem 1.1rem 0.9rem' }}>
                <h3 className="text-h3" style={{ marginBottom: '0.6rem', fontSize: '0.95rem' }}>Operating Hours</h3>
                {openingHours.map(([day, hrs]) => {
                  const isToday = day === todayName;
                  const hasHours = hrs && String(hrs).trim() && !/unavailable/i.test(String(hrs));
                  return (
                    <div key={day} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.45rem 0.6rem', borderRadius: 8, marginBottom: 2,
                      background: isToday ? 'rgba(204,0,0,0.08)' : 'transparent',
                      borderLeft: isToday ? '3px solid #CC0000' : '3px solid transparent',
                    }}>
                      <span style={{
                        fontSize: '0.84rem',
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#fff' : 'var(--text-muted)',
                      }}>{day}{isToday && <span style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, background: '#CC0000', color: '#fff', padding: '1px 5px', borderRadius: 999 }}>TODAY</span>}</span>
                      <span style={{
                        fontSize: '0.84rem', fontWeight: isToday ? 600 : 500,
                        color: hasHours ? (isToday ? '#fff' : 'var(--text-primary)') : '#6b7280',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasHours ? '#4ade80' : '#4b5563', display: 'inline-block', flexShrink: 0 }} />
                        {hasHours ? hrs : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Closed</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact — distinct card */}
            <div className="glass-card glass-card-body" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 className="text-h3 mb-md">Contact & Location</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Phone size={13} style={{ color: '#f87171' }} /></span>
                  <span className="text-body" style={{ fontSize: '0.88rem' }}>{bar.phone || 'No phone listed'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mail size={13} style={{ color: '#f87171' }} /></span>
                  <span className="text-body" style={{ fontSize: '0.88rem', wordBreak: 'break-all' }}>{bar.email || 'No email listed'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Globe size={13} style={{ color: '#f87171' }} /></span>
                  <span className="text-body" style={{ fontSize: '0.88rem', wordBreak: 'break-all' }}>{bar.website || 'No website listed'}</span>
                </div>
              </div>
              <button className="btn btn-glass btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.9rem', width: 'fit-content' }} onClick={() => navigate(VIEWS.MAP)}><MapPin size={14} /> View on Map</button>
            </div>
          </section>

          {/* Vibes / Entertainment — editorial, nightlife-forward */}
          <section className="glass-card" style={{
            padding: '1.15rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(204,0,0,0.10) 0%, rgba(120,20,60,0.08) 35%, rgba(20,20,30,0.6) 100%)',
            border: '1px solid rgba(204,0,0,0.18)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.06, background: 'radial-gradient(ellipse at 20% 0%, #ff3366 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, #7c3aed 0%, transparent 50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.25rem' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(204,0,0,0.18)', border: '1px solid rgba(204,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={15} style={{ color: '#f87171' }} />
                </span>
                <h3 className="text-h3" style={{ margin: 0 }}>Vibes & Entertainment</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.85rem' }}>What this bar brings to the night</p>
              {vibeChips.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {vibeChips.map((t, i) => {
                    const key = String(t).toLowerCase();
                    const icon = Object.entries(vibeIconMap).find(([k]) => key.includes(k))?.[1] || '✦';
                    return (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.4rem 0.75rem', borderRadius: 999,
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
                        color: '#fff', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em',
                        backdropFilter: 'blur(6px)'
                      }}>
                        <span>{icon}</span> {vibeLabel(t)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', borderRadius: 999, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>
                    🎧 DJ & Music Entertainment
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', alignSelf: 'center' }}>— more vibes can be added by the bar owner</span>
                </div>
              )}
            </div>
          </section>

          {/* Reviews — distinct rhythm */}
          <section className="glass-card" style={{ overflow: 'hidden' }}>
            {/* Reviews header + rating summary */}
            <div style={{ padding: '1.15rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h2 className="text-h2" style={{ margin: 0 }}>Reviews</h2>
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    {ratingCount ? `${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'} · updated live` : 'No reviews yet — be the first'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: 74, padding: '0.6rem 0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{ratingAvg.toFixed(1)}</div>
                    <div style={{ fontSize: '0.78rem', color: '#f59e0b', letterSpacing: 2, marginTop: 2 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= Math.round(ratingAvg) ? '#f59e0b' : 'rgba(255,255,255,0.18)' }}>★</span>)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{ratingCount} total</div>
                  </div>
                  {ratingCount > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                      {ratingDist.map(({ star, count, pct }) => (
                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 18 }}>{star}★</span>
                          <span style={{ flex: 1, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'block' }}>
                            <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: star >= 4 ? '#f59e0b' : star === 3 ? '#a3a3a3' : '#6b7280', borderRadius: 999 }} />
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Review list */}
            <div style={{ padding: '1rem 1.25rem' }}>
              {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.6rem 1rem 1.25rem', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.10)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <MessageCircle size={22} style={{ color: '#f87171' }} />
                  </div>
                  <p style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', margin: '0 0 0.25rem' }}>No reviews yet</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', margin: '0 0 0.9rem' }}>Be the first to share your experience at {bar.name || 'this bar'}.</p>
                  {(reviewEligibility || myReview) ? (
                    <button className="btn btn-red btn-sm" onClick={() => document.getElementById('about-review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      Be the first to leave a review
                    </button>
                  ) : (
                    <p className="text-muted" style={{ fontSize: '0.78rem' }}>Complete a reservation to unlock reviewing.</p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ padding: '0.9rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.55rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {r.profile_picture
                            ? <img src={imageUrl(r.profile_picture)} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#CC0000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem' }}>{r.first_name?.[0]}{r.last_name?.[0]}</div>}
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem', lineHeight: 1.1 }}>{r.first_name} {r.last_name}</div>
                            <div style={{ fontSize: '0.82rem', color: '#f59e0b', letterSpacing: 1, lineHeight: 1 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= Number(r.rating) ? '#f59e0b' : 'rgba(255,255,255,0.18)' }}>★</span>)}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</span>
                      </div>
                      <p className="text-body" style={{ fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{r.comment || 'No written comment.'}</p>
                      {r.reply && (
                        <div style={{ marginTop: '0.7rem', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #CC0000', borderRadius: '0 8px 8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                            <span style={{ display: 'inline-block', background: '#CC0000', color: '#fff', fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bar Owner</span>
                            <strong className="text-white" style={{ fontSize: '0.82rem' }}>{r.reply_author || 'Owner'}</strong>
                          </div>
                          <p className="text-muted" style={{ fontSize: '0.84rem', margin: 0 }}>{r.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Write / update review — anchored */}
            <div id="about-review-form" style={{ padding: '0 1.25rem 1.25rem' }}>
              {!reviewEligibility && !myReview ? (
                <div style={{ padding: '0.85rem 1rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-muted" style={{ fontSize: '0.84rem', margin: 0 }}>You can leave a review after completing a reservation at this bar.</p>
                </div>
              ) : (
                <form style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onSubmit={handleReview}>
                  <h3 className="text-h3" style={{ margin: 0 }}>{myReview ? 'Update your review' : 'Write a review'}</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="glass-select" value={revRating} onChange={e => setRevRating(e.target.value)} style={{ width: 'auto' }}>
                      {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} Star{v > 1 ? 's' : ''}</option>)}
                    </select>
                    <button className="btn btn-red btn-sm" type="submit" disabled={submittingRev}>
                      {submittingRev ? 'Saving...' : myReview ? 'Update' : 'Submit'}
                    </button>
                  </div>
                  <textarea className="glass-textarea" value={revComment} onChange={e => setRevComment(e.target.value)} placeholder="Share your experience..." />
                  {myReview && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={handleDeleteReview} disabled={submittingRev} style={{ alignSelf: 'flex-start' }}>
                      Delete Review
                    </button>
                  )}
                </form>
              )}
            </div>
          </section>
        </>
        );
      })()}

      {/* ═══════ FACEBOOK-STYLE FULLSCREEN MEDIA VIEWER ═══════ */}
      {mediaViewerOpen && allMedia.length > 0 && (() => {
        const current = allMedia[mediaIndex];
        if (!current) return null;
        const isVideo = current.media_type !== 'photo';
        const canPrev = mediaIndex > 0;
        const canNext = mediaIndex < allMedia.length - 1;
        const close = () => setMediaViewerOpen(false);
        const goPrev = () => { if (canPrev) setMediaIndex(mediaIndex - 1); };
        const goNext = () => { if (canNext) setMediaIndex(mediaIndex + 1); };
        const timeAgo = (() => {
          if (!current.uploaded_at) return '';
          const diff = Date.now() - new Date(current.uploaded_at).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return 'Just now';
          if (mins < 60) return mins + 'm ago';
          const hrs = Math.floor(mins / 60);
          if (hrs < 24) return hrs + 'h ago';
          const days = Math.floor(hrs / 24);
          return days + 'd ago';
        })();

        return createPortal(
          <div
            className="media-viewer-root"
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: '#000', display: 'flex',
              userSelect: 'none', overflow: 'hidden',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowLeft') goPrev();
              if (e.key === 'ArrowRight') goNext();
            }}
            tabIndex={0}
            ref={(el) => { if (el && !viewerFocusedRef.current) { viewerFocusedRef.current = true; el.focus(); } }}
          >
            {/* ── Close button ── */}
            <button onClick={close} style={{
              position: 'fixed', top: '0.75rem', left: '0.75rem',
              width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--color-bg-card, #1E1B18)', color: 'var(--color-text-primary, #FBF9F6)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 6001, transition: 'background 0.2s, border-color 0.2s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-red-primary, #C9762F)'; e.currentTarget.style.background = 'var(--color-bg-elevated, #26221E)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'var(--color-bg-card, #1E1B18)'; }}
            >
              <X size={20} />
            </button>

            {/* ── LEFT: Media area ── */}
            <div className="media-viewer-media" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', minWidth: 0,
            }}>
              {/* Prev arrow */}
              {canPrev && (
                <button onClick={goPrev} style={{
                  position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'var(--color-bg-card, #1E1B18)', color: 'var(--color-text-primary, #FBF9F6)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, border-color 0.2s', zIndex: 5,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated, #26221E)'; e.currentTarget.style.borderColor = 'var(--color-red-primary, #C9762F)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-card, #1E1B18)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              {/* Media — landscape fills width, portrait fills height */}
              {isVideo ? (
                <video
                  key={current.id}
                  src={imageUrl(current.video_url)}
                  controls
                  autoPlay
                  playsInline
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'contain', borderRadius: 12,
                  }}
                />
              ) : (
                <img
                  key={current.id}
                  src={imageUrl(current.video_url)}
                  alt={current.caption || current.label || ''}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'contain', borderRadius: 12,
                  }}
                />
              )}

              {/* Next arrow */}
              {canNext && (
                <button onClick={goNext} style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'var(--color-bg-card, #1E1B18)', color: 'var(--color-text-primary, #FBF9F6)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, border-color 0.2s', zIndex: 5,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated, #26221E)'; e.currentTarget.style.borderColor = 'var(--color-red-primary, #C9762F)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-card, #1E1B18)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Counter */}
              {allMedia.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--color-bg-card, #1E1B18)', color: 'var(--color-text-muted, #A39890)',
                  padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                  border: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                }}>
                  {mediaIndex + 1} / {allMedia.length}
                </div>
              )}
            </div>

            {/* ── RIGHT: Info panel ── */}
            <div className="media-viewer-panel" style={{
              width: '380px', minWidth: '340px', maxWidth: '380px',
              height: '100vh',
              background: 'var(--color-bg-card, #1E1B18)',
              borderLeft: '1px solid var(--color-border, rgba(234,229,223,0.12))',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              {/* Header: bar info */}
              <div style={{
                padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
                  background: 'var(--color-bg-elevated, #26221E)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--color-red-primary, #C9762F)',
                }}>
                  {bar?.logo_path ? (
                    <img src={imageUrl(bar.logo_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'var(--color-red-primary, #C9762F)', fontWeight: 800, fontSize: '1rem', fontFamily: "'Sora', sans-serif" }}>
                      {(bar?.name || 'B')[0]}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: 'var(--color-text-primary, #FBF9F6)', fontWeight: 700, fontSize: '0.95rem',
                    margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontFamily: "'Sora', 'DM Sans', sans-serif",
                  }}>
                    {bar?.name || 'Bar'}
                  </p>
                  <p style={{ color: 'var(--color-text-muted, #A39890)', fontSize: '0.72rem', margin: '0.15rem 0 0' }}>
                    {timeAgo}
                  </p>
                </div>
              </div>

              {/* Caption */}
              {(current.label || current.caption) && (
                <div style={{ padding: '0.85rem 1.25rem 0.5rem' }}>
                  <p style={{
                    color: 'var(--color-text-primary, #FBF9F6)', fontSize: '0.88rem',
                    lineHeight: 1.55, margin: 0,
                  }}>
                    {current.label || current.caption}
                  </p>
                </div>
              )}

              {/* Stats row: likes · comments */}
              <div style={{
                padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.8rem', color: 'var(--color-text-muted, #A39890)',
              }}>
                {viewerEngagement.likes > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'var(--color-red-primary, #C9762F)', color: '#fff', fontSize: '0.6rem' }}>👍</span>
                    {viewerEngagement.likes}
                  </span>
                )}
                {viewerEngagement.comments > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                    💬 {viewerEngagement.comments} comment{viewerEngagement.comments !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{
                display: 'flex', borderBottom: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                padding: '0.25rem 0.5rem',
              }}>
                {[
                  {
                    icon: <ThumbsUp size={16} fill={viewerEngagement.liked ? '#C9762F' : 'none'} color={viewerEngagement.liked ? '#C9762F' : 'var(--color-text-muted, #A39890)'} />,
                    label: 'Like',
                    active: viewerEngagement.liked,
                    onClick: handleViewerLike,
                  },
                  {
                    icon: <MessageCircle size={16} color="var(--color-text-muted, #A39890)" />,
                    label: 'Comment',
                    onClick: () => {},
                  },
                  {
                    icon: <Share2 size={16} color="var(--color-text-muted, #A39890)" />,
                    label: 'Share',
                    onClick: () => {},
                  },
                ].map((btn) => (
                  <button key={btn.label} onClick={btn.onClick} style={{
                    flex: 1, padding: '0.55rem 0.5rem', border: 'none', background: 'transparent',
                    color: btn.active ? 'var(--color-red-primary, #C9762F)' : 'var(--color-text-muted, #A39890)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    transition: 'background 0.15s, color 0.15s', borderRadius: 8,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated, #26221E)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>

              {/* Comments list */}
              <div ref={commentsScrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem',
                display: 'flex', flexDirection: 'column', gap: '0.85rem',
              }}>
                {viewerComments.length === 0 && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '2.5rem 1rem', textAlign: 'center',
                  }}>
                    <MessageCircle size={28} color="var(--color-text-muted, #A39890)" style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                    <p style={{
                      color: 'var(--color-text-muted, #A39890)', fontSize: '0.85rem', margin: 0,
                      lineHeight: 1.5,
                    }}>
                      No comments yet. Be the first to comment!
                    </p>
                  </div>
                )}
                {(() => {
                  const topLevel = viewerComments.filter(c => !c.parent_comment_id);
                  const repliesMap = {};
                  viewerComments.filter(c => c.parent_comment_id).forEach(c => {
                    if (!repliesMap[c.parent_comment_id]) repliesMap[c.parent_comment_id] = [];
                    repliesMap[c.parent_comment_id].push(c);
                  });
                  const timeAgo = (dateStr) => {
                    const d = Date.now() - new Date(dateStr).getTime();
                    const m = Math.floor(d / 60000);
                    if (m < 1) return 'now';
                    if (m < 60) return m + 'm';
                    const h = Math.floor(m / 60);
                    if (h < 24) return h + 'h';
                    return Math.floor(h / 24) + 'd';
                  };
                  const renderComment = (c, isReply = false) => (
                    <div key={c.id} id={`media-comment-${c.id}`} style={{
                      display: 'flex', gap: '0.6rem', marginBottom: isReply ? '0.4rem' : '0',
                      background: highlightedCommentId === c.id ? 'rgba(201,118,47,0.15)' : 'transparent',
                      borderRadius: 12, padding: highlightedCommentId === c.id ? '0.4rem' : '0',
                      transition: 'background 0.3s ease',
                    }}>
                      <div style={{
                        width: isReply ? 28 : 34, height: isReply ? 28 : 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        background: 'var(--color-bg-elevated, #26221E)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                      }}>
                        {c.profile_picture ? (
                          <img src={imageUrl(c.profile_picture)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: 'var(--color-red-primary, #C9762F)', fontSize: isReply ? '0.6rem' : '0.72rem', fontWeight: 700 }}>
                            {(c.first_name || '?')[0]}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          background: 'var(--color-bg-elevated, #26221E)', borderRadius: 14,
                          padding: '0.55rem 0.8rem',
                          border: '1px solid var(--color-border, rgba(234,229,223,0.06))',
                        }}>
                          <p style={{
                            color: 'var(--color-text-primary, #FBF9F6)', fontWeight: 700,
                            fontSize: '0.8rem', margin: 0,
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            {c.first_name} {c.last_name}
                          </p>
                          <p style={{
                            color: 'var(--color-text-primary, #FBF9F6)', fontSize: '0.84rem',
                            margin: '0.15rem 0 0', lineHeight: 1.45, wordBreak: 'break-word',
                            opacity: 0.88,
                          }}>
                            {c.mentioned_user_id && c.mentioned_user_name ? (
                              <>
                                <span style={{ color: 'var(--color-red-primary, #C9762F)', fontWeight: 700 }}>@{c.mentioned_user_name}</span>
                                {' '}{c.content}
                              </>
                            ) : (
                              c.content
                            )}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.85rem', padding: '0.3rem 0.8rem 0', alignItems: 'center' }}>
                          <span
                            onClick={() => handleCommentLike(c.id)}
                            style={{
                              color: c.liked_by_user ? 'var(--color-red-primary, #C9762F)' : 'var(--color-text-muted, #A39890)',
                              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'color 0.15s',
                            }}
                          >
                            {c.liked_by_user ? 'Liked' : 'Like'}
                            {(c.like_count > 0) && <span style={{ marginLeft: '0.25rem', fontWeight: 500 }}>({c.like_count})</span>}
                          </span>
                          <span
                            onClick={() => {
                              if (replyingTo === c.id) {
                                setReplyingTo(null);
                                setReplyText('');
                                setReplyMentionPrefix('');
                                setReplyMentionUserId(null);
                                setReplyMentionName('');
                                return;
                              }
                              const authorName = `${c.first_name} ${c.last_name}`;
                              setReplyingTo(c.id);
                              setReplyText('');
                              setReplyMentionPrefix(`@${authorName} `);
                              setReplyMentionUserId(c.user_id);
                              setReplyMentionName(authorName);
                            }}
                            style={{
                              color: replyingTo === c.id ? 'var(--color-red-primary, #C9762F)' : 'var(--color-text-muted, #A39890)',
                              fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Reply
                          </span>
                          <span style={{ color: 'var(--color-text-muted, #A39890)', fontSize: '0.65rem', opacity: 0.6, marginLeft: 'auto' }}>
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        {/* Reply input inline */}
                        {replyingTo === c.id && (
                          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0.8rem 0', alignItems: 'center' }}>
                            <input
                              value={`${replyMentionPrefix}${replyText}`}
                              onChange={(e) => {
                                const full = e.target.value;
                                if (replyMentionPrefix && full.startsWith(replyMentionPrefix)) {
                                  setReplyText(full.slice(replyMentionPrefix.length));
                                } else {
                                  setReplyText(full);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReplySubmit(isReply ? (c.parent_comment_id || c.id) : c.id);
                                }
                              }}
                              placeholder={`Reply to ${c.first_name}...`}
                              autoFocus
                              style={{
                                flex: 1,
                                background: 'var(--color-bg-card, #1E1B18)',
                                border: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                                borderRadius: 20, padding: '0.4rem 0.75rem',
                                color: 'var(--color-text-primary, #FBF9F6)',
                                fontSize: '0.8rem', outline: 'none',
                              }}
                            />
                            <button onClick={() => {
                              handleReplySubmit(isReply ? (c.parent_comment_id || c.id) : c.id);
                            }} disabled={!replyText.trim()} style={{
                              width: 28, height: 28, borderRadius: '50%', border: 'none',
                              background: replyText.trim() ? 'var(--color-red-primary, #C9762F)' : 'var(--color-bg-card, #1E1B18)',
                              color: replyText.trim() ? '#fff' : 'var(--color-text-muted, #A39890)',
                              cursor: replyText.trim() ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <Send size={12} />
                            </button>
                          </div>
                        )}
                        {/* Nested replies — flat, same indent */}
                        {repliesMap[c.id] && repliesMap[c.id].length > 0 && (
                          <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                            {repliesMap[c.id].map(r => renderComment(r, true))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  return topLevel.map(c => renderComment(c, false));
                })()}
              </div>

              {/* Comment input — pinned at bottom */}
              <div style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                background: 'var(--color-bg-elevated, #26221E)',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
              }}>
                {user ? (
                  <>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      background: 'var(--color-bg-card, #1E1B18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                    }}>
                      {user?.profile_picture ? (
                        <img src={imageUrl(user.profile_picture)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: 'var(--color-red-primary, #C9762F)', fontSize: '0.72rem', fontWeight: 700 }}>
                          {(user?.first_name || '?')[0]}
                        </span>
                      )}
                    </div>
                    <input
                      value={viewerCommentText}
                      onChange={(e) => setViewerCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleViewerComment(); } }}
                      placeholder={`Comment as ${user?.first_name || 'you'}...`}
                      style={{
                        flex: 1,
                        background: 'var(--color-bg-card, #1E1B18)',
                        border: '1px solid var(--color-border, rgba(234,229,223,0.12))',
                        borderRadius: 20, padding: '0.5rem 0.9rem',
                        color: 'var(--color-text-primary, #FBF9F6)',
                        fontSize: '0.84rem', outline: 'none', transition: 'border-color 0.2s',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--color-red-primary, #C9762F)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--color-border, rgba(234,229,223,0.12))'; }}
                    />
                    <button onClick={handleViewerComment} disabled={!viewerCommentText.trim()} style={{
                      width: 36, height: 36, borderRadius: '50%', border: 'none',
                      background: viewerCommentText.trim() ? 'var(--color-red-primary, #C9762F)' : 'var(--color-bg-card, #1E1B18)',
                      color: viewerCommentText.trim() ? '#fff' : 'var(--color-text-muted, #A39890)',
                      cursor: viewerCommentText.trim() ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s, color 0.2s', flexShrink: 0,
                    }}>
                      <Send size={15} />
                    </button>
                  </>
                ) : (
                  <p style={{
                    color: 'var(--color-text-muted, #A39890)', fontSize: '0.82rem',
                    margin: 0, textAlign: 'center', width: '100%',
                  }}>
                    <button
                      onClick={() => navigate(VIEWS.LOGIN)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--color-red-primary, #C9762F)',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', padding: 0,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >Log in</button>
                    {' '}to comment
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

export default BarDetailView;
