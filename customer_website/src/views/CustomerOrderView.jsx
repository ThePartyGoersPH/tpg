import { useEffect, useState, useMemo, useCallback } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { barService } from '../services/barService';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { imageUrl } from '../utils/imageUrl';
import {
  ShoppingCart, Plus, Minus, Trash2, ArrowLeft, Smartphone, CreditCard,
  Tag, Receipt, Info, ChevronDown, ChevronUp, Package, Percent
} from 'lucide-react';

const MENU_PH = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23333'%3E%F0%9F%8D%BD%3C/text%3E%3C/svg%3E`;

// ── Tax computation (mirrors backend exactly) ─────────────────────────────────
function computeTax(rawSubtotal, taxConfig) {
  if (!taxConfig) return { net_subtotal: rawSubtotal, tax_amount: 0, total_amount: rawSubtotal };
  const taxType = (taxConfig.tax_type || 'NON_VAT').toUpperCase();
  const taxRate = Number(taxConfig.tax_rate || 0);
  const taxMode = (taxConfig.tax_mode || 'EXCLUSIVE').toUpperCase();
  const s = Number(rawSubtotal);

  if (taxType === 'NON_VAT' || taxRate === 0) {
    return { net_subtotal: s, tax_amount: 0, total_amount: s };
  }
  if (taxMode === 'EXCLUSIVE') {
    const tax = parseFloat((s * taxRate / 100).toFixed(2));
    return { net_subtotal: s, tax_amount: tax, total_amount: parseFloat((s + tax).toFixed(2)) };
  }
  // INCLUSIVE
  const tax = parseFloat((s - s / (1 + taxRate / 100)).toFixed(2));
  return { net_subtotal: parseFloat((s - tax).toFixed(2)), tax_amount: tax, total_amount: s };
}

function fmt(n) { return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function CustomerOrderView() {
  const { viewParams, navigate, goBack, canGoBack } = useView();
  const barId = viewParams?.barId;

  const [bar, setBar] = useState(null);
  const [taxConfig, setTaxConfig] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [placing, setPlacing] = useState(false);

  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('menu');
  const [activeCategory, setActiveCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [expandedTax, setExpandedTax] = useState(false);

  useEffect(() => {
    if (!barId) { setErr('No bar selected.'); setLoading(false); return; }
    setLoading(true); setErr('');
    Promise.all([
      barService.detail(barId),
      barService.menuWithBestSellers(barId).catch(() => barService.menu(barId)),
      orderService.getTaxConfig(barId).catch(() => null),
    ]).then(([barData, menu, tax]) => {
      setBar(barData);
      setMenuItems(Array.isArray(menu) ? menu : []);
      setTaxConfig(tax);
      if (barData?.accept_gcash) setPaymentMethod('gcash');
      else if (barData?.accept_online_payment) setPaymentMethod('paymaya');
    }).catch(e => setErr(e?.response?.data?.message || 'Failed to load bar details.')).finally(() => setLoading(false));
  }, [barId]);

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(m => m.category).filter(Boolean))];
    return cats.length ? ['all', ...cats] : ['all'];
  }, [menuItems]);

  const filteredMenu = useMemo(() => (
    activeCategory === 'all' ? menuItems : menuItems.filter(m => m.category === activeCategory)
  ), [menuItems, activeCategory]);

  const addItem = useCallback((item) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        id: item.id,
        name: item.menu_name,
        price: Number(item.selling_price),
        qty: 1,
        image_path: item.image_path,
      }];
    });
  }, []);

  const removeItem = useCallback((itemId) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === itemId);
      if (!ex || ex.qty <= 1) return prev.filter(i => i.id !== itemId);
      return prev.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i);
    });
  }, []);

  const removeAll = useCallback((itemId) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const getQty = (itemId) => cart.find(i => i.id === itemId)?.qty || 0;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const rawSubtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const { net_subtotal, tax_amount, total_amount } = useMemo(() => computeTax(rawSubtotal, taxConfig), [rawSubtotal, taxConfig]);

  const hasTax = taxConfig && taxConfig.tax_type === 'VAT' && Number(taxConfig.tax_rate) > 0;
  const acceptsOnline = bar?.accept_gcash || bar?.accept_online_payment;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!acceptsOnline) { setErr('This bar does not accept online payments at this time.'); return; }
    setPlacing(true); setErr('');
    try {
      const orderResult = await orderService.createOrder({
        bar_id: barId,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.qty })),
      });
      if (!orderResult?.success) throw new Error(orderResult?.message || 'Order creation failed');
      const order = orderResult.data;

      const payResult = await paymentService.createPayment({
        payment_type: 'order',
        related_id: order.id,
        amount: order.total_amount,
        payment_method: paymentMethod,
        bar_id: barId,
        success_url: `${window.location.origin}/payment/success?ref={REFERENCE_ID}`,
        failed_url: `${window.location.origin}/payment/failed?ref={REFERENCE_ID}`,
      });

      const url = payResult?.data?.checkout_url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received from payment gateway.');
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to place order. Please try again.');
      setPlacing(false);
    }
  };

  if (loading) return (
    <div className="loading-state" style={{ minHeight: '60vh' }}>
      <div className="spinner" />
      <span>Loading menu...</span>
    </div>
  );

  if (err && !bar) return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="empty-icon">⚠️</div>
      <h3 className="text-h3">Could not load</h3>
      <p className="text-muted">{err}</p>
      <button className="btn btn-ghost btn-sm mt-md" onClick={() => canGoBack ? goBack() : navigate(VIEWS.BARS)}>
        <ArrowLeft size={14} /> Go Back
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 4rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingTop: '0.5rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => canGoBack ? goBack() : navigate(VIEWS.BARS)}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-h2" style={{ margin: 0 }}>{bar?.name}</h1>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Online Ordering</p>
        </div>
        {hasTax && (
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.6rem',
            background: 'rgba(220,38,38,0.12)', color: '#f87171',
            borderRadius: '12px', border: '1px solid rgba(220,38,38,0.25)',
          }}>
            <Percent size={11} /> {taxConfig.tax_type} {taxConfig.tax_rate}%
            {taxConfig.tax_mode === 'INCLUSIVE' ? ' (incl.)' : ''}
          </span>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.3rem',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {[
          { key: 'menu', label: 'Menu', icon: <Package size={14} /> },
          { key: 'cart', label: `Cart${cartCount ? ` (${cartCount})` : ''}`, icon: <ShoppingCart size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.4rem', padding: '0.6rem', borderRadius: '8px', border: 'none',
            cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s',
            background: activeTab === t.key ? 'rgba(220,38,38,0.15)' : 'transparent',
            color: activeTab === t.key ? '#f87171' : 'var(--text-muted)',
          }}>
            {t.icon} {t.label}
            {t.key === 'cart' && cartCount > 0 && (
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#CC0000', color: '#fff', fontSize: '0.68rem',
                fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{cartCount > 9 ? '9+' : cartCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ MENU TAB ══════════ */}
      {activeTab === 'menu' && (
        <>
          {/* Category pills */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                  padding: '0.35rem 0.9rem', borderRadius: '20px', border: '1px solid',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  background: activeCategory === cat ? 'rgba(220,38,38,0.15)' : 'transparent',
                  borderColor: activeCategory === cat ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.12)',
                  color: activeCategory === cat ? '#f87171' : 'var(--text-muted)',
                }}>
                  {cat === 'all' ? 'All Items' : cat}
                </button>
              ))}
            </div>
          )}

          {filteredMenu.length === 0 ? (
            <div className="glass-card empty-state">
              <div className="empty-icon"><Package size={36} /></div>
              <p className="text-muted">No items available in this category.</p>
            </div>
          ) : (
            <div className="g g-2" style={{ '--col-min': '260px' }}>
              {filteredMenu.map(item => {
                const qty = getQty(item.id);
                const price = Number(item.selling_price || 0);
                const img = item.image_path ? imageUrl(item.image_path) : '';
                return (
                  <div key={item.id} className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Image */}
                    <div style={{ position: 'relative', height: '150px', overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        src={img || MENU_PH}
                        alt={item.menu_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.src = MENU_PH; }}
                      />
                      {item.is_best_seller === 1 && (
                        <span style={{
                          position: 'absolute', top: '8px', left: '8px',
                          background: 'rgba(234,179,8,0.9)', color: '#1a1a1a',
                          fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                        }}>⭐ Best Seller</span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="glass-card-body" style={{ padding: '0.9rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <h4 className="text-h4" style={{ margin: 0, fontSize: '0.95rem' }}>{item.menu_name}</h4>
                        {item.menu_description && (
                          <p className="text-muted" style={{ fontSize: '0.75rem', margin: '0.2rem 0 0', lineHeight: 1.4 }}>{item.menu_description}</p>
                        )}
                        {item.category && (
                          <span style={{
                            display: 'inline-block', fontSize: '0.68rem', fontWeight: 600,
                            color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)',
                            padding: '0.1rem 0.4rem', borderRadius: '4px', marginTop: '0.3rem',
                          }}>{item.category}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f87171' }}>{fmt(price)}</span>

                        {qty === 0 ? (
                          <button
                            className="btn btn-red btn-sm"
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
                            onClick={() => addItem(item)}
                          >
                            <Plus size={14} /> Add
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={() => removeItem(item.id)}
                              style={{
                                width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                background: 'rgba(220,38,38,0.15)', color: '#f87171',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              }}
                            ><Minus size={13} /></button>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                            <button
                              onClick={() => addItem(item)}
                              style={{
                                width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                background: 'rgba(220,38,38,0.8)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              }}
                            ><Plus size={13} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating cart button on mobile */}
          {cartCount > 0 && (
            <div style={{
              position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
            }}>
              <button
                className="btn btn-red"
                style={{ borderRadius: '50px', padding: '0.8rem 1.4rem', boxShadow: '0 8px 32px rgba(204,0,0,0.4)', fontSize: '0.9rem', fontWeight: 700 }}
                onClick={() => setActiveTab('cart')}
              >
                <ShoppingCart size={16} /> View Cart · {cartCount} item{cartCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════ CART TAB ══════════ */}
      {activeTab === 'cart' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>

          {/* Cart items */}
          {cart.length === 0 ? (
            <div className="glass-card empty-state" style={{ padding: '3rem' }}>
              <div className="empty-icon"><ShoppingCart size={40} /></div>
              <h3 className="text-h3">Your cart is empty</h3>
              <p className="text-muted">Add items from the menu to get started.</p>
              <button className="btn btn-red btn-sm mt-md" onClick={() => setActiveTab('menu')}>
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              {/* Items list */}
              <div className="glass-card glass-card-body">
                <h3 className="text-h3" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={18} /> Order Items
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {item.image_path && (
                        <img
                          src={imageUrl(item.image_path)}
                          alt={item.name}
                          style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(item.price)} each</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button onClick={() => removeItem(item.id)} style={{
                          width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                          background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}><Minus size={12} /></button>
                        <span style={{ fontWeight: 700, minWidth: '22px', textAlign: 'center', fontSize: '0.9rem' }}>{item.qty}</span>
                        <button onClick={() => addItem(item)} style={{
                          width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                          background: 'rgba(220,38,38,0.8)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}><Plus size={12} /></button>
                      </div>
                      <div style={{ minWidth: '70px', textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                        {fmt(item.price * item.qty)}
                      </div>
                      <button onClick={() => removeAll(item.id)} style={{
                        width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                        background: 'rgba(255,255,255,0.05)', color: '#888',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        flexShrink: 0,
                      }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order summary */}
              <div className="glass-card glass-card-body">
                <h3 className="text-h3" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} /> Order Summary
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Subtotal {hasTax && taxConfig.tax_mode === 'INCLUSIVE' ? '(tax-inclusive)' : ''}
                    </span>
                    <span>{fmt(hasTax && taxConfig.tax_mode === 'INCLUSIVE' ? rawSubtotal : net_subtotal)}</span>
                  </div>

                  {/* Tax line */}
                  {hasTax && (
                    <div>
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', cursor: 'pointer' }}
                        onClick={() => setExpandedTax(p => !p)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}>
                          <Tag size={13} />
                          {taxConfig.tax_type} ({taxConfig.tax_rate}%
                          {taxConfig.tax_mode === 'INCLUSIVE' ? ', incl.' : ''})
                          {expandedTax ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                        <span style={{ color: '#fbbf24' }}>+{fmt(tax_amount)}</span>
                      </div>
                      {expandedTax && (
                        <div style={{
                          marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                          background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
                          fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tax Mode</span><span style={{ color: '#e2e8f0' }}>{taxConfig.tax_mode}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tax Base</span><span style={{ color: '#e2e8f0' }}>{fmt(net_subtotal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tax ({taxConfig.tax_rate}%)</span><span style={{ color: '#fbbf24' }}>{fmt(tax_amount)}</span>
                          </div>
                          {taxConfig.tax_mode === 'EXCLUSIVE' && (
                            <div style={{ fontSize: '0.72rem', marginTop: '0.3rem', color: '#888' }}>
                              Tax is added on top of the subtotal.
                            </div>
                          )}
                          {taxConfig.tax_mode === 'INCLUSIVE' && (
                            <div style={{ fontSize: '0.72rem', marginTop: '0.3rem', color: '#888' }}>
                              Tax is already included in the item prices.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.3rem 0' }} />

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                    <span>Total</span>
                    <span style={{ color: '#f87171' }}>{fmt(total_amount)}</span>
                  </div>

                  {hasTax && bar?.tin && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      fontSize: '0.72rem', color: 'var(--text-dim)',
                      padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
                    }}>
                      <Info size={11} /> VAT registered · TIN: {bar.tin}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment method */}
              {acceptsOnline ? (
                <div className="glass-card glass-card-body">
                  <h3 className="text-h3" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={18} /> Payment Method
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {bar?.accept_gcash && (
                      <label style={{
                        flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: '10px',
                        border: `1.5px solid ${paymentMethod === 'gcash' ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        background: paymentMethod === 'gcash' ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.2s',
                      }}>
                        <input type="radio" name="pm" value="gcash" checked={paymentMethod === 'gcash'} onChange={e => setPaymentMethod(e.target.value)} style={{ display: 'none' }} />
                        <Smartphone size={18} style={{ color: paymentMethod === 'gcash' ? '#f87171' : 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>GCash</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Mobile wallet</div>
                        </div>
                      </label>
                    )}
                    {bar?.accept_online_payment && (
                      <label style={{
                        flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: '10px',
                        border: `1.5px solid ${paymentMethod === 'paymaya' ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        background: paymentMethod === 'paymaya' ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.2s',
                      }}>
                        <input type="radio" name="pm" value="paymaya" checked={paymentMethod === 'paymaya'} onChange={e => setPaymentMethod(e.target.value)} style={{ display: 'none' }} />
                        <CreditCard size={18} style={{ color: paymentMethod === 'paymaya' ? '#f87171' : 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Card / PayMaya</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Debit / Credit card</div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="alert alert-warn" style={{ marginTop: 0 }}>
                  This bar does not accept online payments. Please visit in person to order.
                </div>
              )}

              {/* Error */}
              {err && <div className="alert alert-error">{err}</div>}

              {/* Place Order */}
              {acceptsOnline && (
                <button
                  className="btn btn-red"
                  style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 700 }}
                  disabled={placing || cart.length === 0}
                  onClick={handlePlaceOrder}
                >
                  {placing ? 'Processing...' : `Pay ${fmt(total_amount)} with ${paymentMethod === 'gcash' ? 'GCash' : 'Card/PayMaya'}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
