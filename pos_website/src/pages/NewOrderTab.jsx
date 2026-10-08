import { useEffect, useMemo, useRef, useState } from 'react';
import { posApi } from '../api/pos';
import { Beer, GlassWater, Minus, Package, Plus, ReceiptText, Search, UtensilsCrossed } from 'lucide-react';
import { getUploadUrl } from '../api/client';
import { io } from 'socket.io-client';

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function thumbIconFor(category) {
  const key = String(category || '').toLowerCase();
  if (key.includes('beer')) return { Icon: Beer, cls: 'ph-beers' };
  if (key.includes('cocktail') || key.includes('drink') || key.includes('spirits')) {
    return { Icon: GlassWater, cls: 'ph-cocktails' };
  }
  if (key.includes('package')) return { Icon: Package, cls: 'ph-packages' };
  return { Icon: UtensilsCrossed, cls: 'ph-default' };
}

function paymentMethodLabel(value) {
  const method = String(value || '').toLowerCase();
  if (method === 'gcash') return 'GCash';
  if (method === 'paymaya') return 'PayMaya';
  if (method === 'cash') return 'Cash';
  return value || 'Unpaid';
}

export default function NewOrderTab({ canManage, onOrderCreated }) {
  const [menu, setMenu] = useState([]);
  const [packages, setPackages] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState({});
  const [packageCart, setPackageCart] = useState({});
  const [tableId, setTableId] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [customerName, setCustomerName] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentPrompt, setPaymentPrompt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [checkoutData, setCheckoutData] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState('');
  const [shiftSummary, setShiftSummary] = useState(null);
  const [orderReviewOpen, setOrderReviewOpen] = useState(false);
  const [paymentSuccessModal, setPaymentSuccessModal] = useState(null);
  const completedOnlineOrderRef = useRef(null);

  const hasOpenShift = Boolean(shiftSummary?.shift?.id);

  const selectedItems = useMemo(() => {
    return menu
      .filter((item) => Number(cart[item.id] || 0) > 0 && Number(item.stock_qty || 0) > 0)
      .map((item) => ({
        menu_item_id: item.id,
        quantity: Number(cart[item.id]),
        menu_name: item.menu_name,
        selling_price: Number(item.selling_price || 0),
        category: item.category,
        image_path: item.image_path,
      }));
  }, [cart, menu]);

  const selectedPackages = useMemo(() => {
    return packages
      .filter((pkg) => Number(packageCart[pkg.id] || 0) > 0 && Number(pkg.stock_qty || 0) > 0 && pkg.is_available !== false)
      .map((pkg) => ({
        package_id: pkg.id,
        quantity: Number(packageCart[pkg.id]),
        name: pkg.name,
        price: Number(pkg.price || 0),
        stock_qty: Number(pkg.stock_qty || 0),
      }));
  }, [packageCart, packages]);

  const categories = useMemo(() => {
    const map = new Map();
    for (const item of menu) {
      const key = String(item.category || 'other').toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [
      { id: 'all', label: 'All Menu', count: menu.length },
      ...Array.from(map.entries()).map(([id, count]) => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        count,
      })),
      { id: 'packages', label: 'Packages', count: packages.length },
    ];
  }, [menu, packages.length]);

  const filteredMenu = useMemo(() => {
    if (category === 'packages') return [];
    return menu.filter((item) => {
      const name = String(item.menu_name || '').toLowerCase();
      const hitSearch = !search || name.includes(search.toLowerCase());
      const hitCategory = category === 'all' || String(item.category || 'other').toLowerCase() === category;
      return hitSearch && hitCategory;
    });
  }, [category, menu, search]);

  const filteredPackages = useMemo(() => {
    if (category !== 'all' && category !== 'packages') return [];
    return packages.filter((pkg) => {
      const name = String(pkg.name || '').toLowerCase();
      return !search || name.includes(search.toLowerCase());
    });
  }, [category, packages, search]);

  const total = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity * item.selling_price, 0);
  }, [selectedItems]);

  const packageTotal = useMemo(() => {
    return selectedPackages.reduce((sum, pkg) => sum + pkg.quantity * pkg.price, 0);
  }, [selectedPackages]);

  const selectedTablePrice = useMemo(() => {
    if (orderType !== 'dine_in' || !tableId) return 0;
    const selectedTable = tables.find((table) => Number(table.id) === Number(tableId));
    return Number(selectedTable?.price || 0);
  }, [orderType, tableId, tables]);

  const selectedTable = useMemo(() => {
    if (orderType !== 'dine_in' || !tableId) return null;
    return tables.find((table) => Number(table.id) === Number(tableId)) || null;
  }, [orderType, tableId, tables]);

  const grandTotal = useMemo(() => total + packageTotal + selectedTablePrice, [packageTotal, selectedTablePrice, total]);

  const isTableBlocked = (table) => {
    const status = String(table?.status || '').toLowerCase();
    return status === 'occupied' || status === 'unavailable';
  };

  const tableStatusLabel = (table) => {
    const status = String(table?.status || '').toLowerCase();
    if (status === 'reserved') {
      if (table?.reservation_source === 'booked') return 'Reserved (booked)';
      if (table?.reservation_source === 'manual') return 'Reserved (manual)';
      return 'Reserved';
    }
    if (status === 'occupied') return 'Occupied';
    if (status === 'unavailable') return 'Unavailable';
    return 'Available';
  };

  const isItemOutOfStock = (item) => Number(item?.stock_qty || 0) <= 0;

  const isPackageOutOfStock = (pkg) => Number(pkg?.stock_qty || 0) <= 0 || pkg?.is_available === false;

  const itemMaxQty = (id) => {
    const menuItem = menu.find((item) => Number(item.id) === Number(id));
    return Math.max(0, Number(menuItem?.stock_qty || 0));
  };

  const packageMaxQty = (id) => {
    const pkg = packages.find((item) => Number(item.id) === Number(id));
    if (!pkg || pkg.is_available === false) return 0;
    return Math.max(0, Number(pkg.stock_qty || 0));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const recover = async (p) => { try { return await p; } catch { return null; } };
      const [menuRes, packageRes, tableRes, shiftRes] = await Promise.all([
        recover(posApi.getMenu()),
        recover(posApi.getPackages()),
        recover(posApi.getTables()),
        recover(posApi.getCurrentShift()),
      ]);
      setMenu(menuRes?.data?.data || menuRes?.data || []);
      setPackages(packageRes?.data?.data || packageRes?.data || []);
      setTables(tableRes?.data?.data || tableRes?.data || []);
      setShiftSummary(shiftRes?.data?.data || shiftRes?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load menu, packages, and tables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markOnlinePaymentSuccess = async ({ orderId, method, amount }) => {
    const paidOrderId = Number(orderId || paymentPrompt?.id || 0);
    if (!paidOrderId) return;
    if (completedOnlineOrderRef.current === paidOrderId) return;
    completedOnlineOrderRef.current = paidOrderId;

    const resolvedOrderNumber = paymentPrompt?.order_number || paidOrderId;
    const resolvedMethod = String(method || paymentMethod || '').toLowerCase();
    const resolvedAmount = Number(amount || paymentPrompt?.total_amount || 0);

    setOnlineStatus('Payment confirmed by PayMongo.');
    setCheckoutData(null);
    setMessage(`Order ${resolvedOrderNumber} paid via ${paymentMethodLabel(resolvedMethod)}.`);
    setPaymentPrompt(null);
    setPaymentSuccessModal({
      orderNumber: resolvedOrderNumber,
      paymentMethod: paymentMethodLabel(resolvedMethod),
      amountReceived: resolvedAmount,
    });

    if (typeof onOrderCreated === 'function') {
      onOrderCreated({ id: paidOrderId });
    }

    await load();
  };

  useEffect(() => {
    if (!paymentPrompt?.id) return undefined;

    const token = localStorage.getItem('pos_token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://api.thepartygoers.fun';
    if (!token) return undefined;

    const socket = io(apiBaseUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    socket.on('orderPaid', async (payload) => {
      const paidOrderId = Number(payload?.order_id || 0);
      if (paidOrderId !== Number(paymentPrompt.id)) return;

      await markOnlinePaymentSuccess({
        orderId: paidOrderId,
        method: payload?.payment_method,
        amount: payload?.amount_received || payload?.amount,
      });
    });

    socket.on('orderPaymentFailed', (payload) => {
      const failedOrderId = Number(payload?.order_id || 0);
      if (failedOrderId !== Number(paymentPrompt.id)) return;
      setOnlineStatus('Online payment failed or expired. Generate a new QR to retry.');
    });

    return () => {
      socket.disconnect();
    };
  }, [paymentMethod, paymentPrompt]);

  useEffect(() => {
    if (!paymentPrompt?.id) return undefined;
    if (paymentMethod === 'cash') return undefined;
    if (!checkoutData?.checkout_session_id && !checkoutData?.reference_id) return undefined;

    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const { data } = await posApi.reconcileOrderPayment({ order_id: Number(paymentPrompt.id) });
        const result = data?.data || {};
        if (cancelled) return;

        if (String(result.status || '').toLowerCase() === 'paid') {
          cancelled = true;
          clearInterval(timer);
          await markOnlinePaymentSuccess({
            orderId: paymentPrompt.id,
            method: result.payment_method || paymentMethod,
            amount: result.amount_received || result.amount || paymentPrompt.total_amount,
          });
        }
      } catch {
        // Silent retry while waiting for payment confirmation.
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkoutData, paymentMethod, paymentPrompt]);

  useEffect(() => {
    if (orderType !== 'dine_in' && tableId) {
      setTableId('');
    }
  }, [orderType, tableId]);

  useEffect(() => {
    if (!tableId) return;
    const selectedTable = tables.find((table) => Number(table.id) === Number(tableId));
    if (selectedTable && isTableBlocked(selectedTable)) {
      setTableId('');
      setError(`Table ${selectedTable.table_number || selectedTable.id} is now ${selectedTable.status}. Please select another table.`);
    }
  }, [tableId, tables]);

  const setQty = (id, value) => {
    const max = itemMaxQty(id);
    const nextValue = Math.min(max, Math.max(0, Number(value || 0)));
    setCart((prev) => ({ ...prev, [id]: nextValue }));
  };

  const bumpQty = (id, delta) => {
    const current = Number(cart[id] || 0);
    const max = itemMaxQty(id);
    const next = Math.min(max, Math.max(0, current + delta));
    setCart((prev) => ({ ...prev, [id]: next }));
  };

  const setPackageQty = (id, value) => {
    const max = packageMaxQty(id);
    const nextValue = Math.min(max, Math.max(0, Number(value || 0)));
    setPackageCart((prev) => ({ ...prev, [id]: nextValue }));
  };

  const bumpPackageQty = (id, delta) => {
    const current = Number(packageCart[id] || 0);
    const max = packageMaxQty(id);
    const next = Math.min(max, Math.max(0, current + delta));
    setPackageCart((prev) => ({ ...prev, [id]: next }));
  };

  const createOrder = async () => {
    const validationError = getOrderValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    setOrderReviewOpen(false);
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        table_id: orderType === 'dine_in' && tableId ? Number(tableId) : null,
        items: selectedItems.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
        packages: selectedPackages.map((pkg) => ({
          package_id: pkg.package_id,
          quantity: pkg.quantity,
        })),
        notes: [
          customerName ? `Customer: ${customerName}` : null,
          `Order Type: ${orderType}`,
          selectedPackages.length
            ? `Packages: ${selectedPackages.map((pkg) => `${pkg.name} x${pkg.quantity}`).join(', ')}`
            : null,
          notes.trim() || null,
        ].filter(Boolean).join(' | ') || null,
      };

      const { data } = await posApi.createOrder(payload);
      const created = data?.data || data;

      setCart({});
      setPackageCart({});
      setTableId('');
      setNotes('');
      setCustomerName('');
      setMessage(`Order created: ${created.order_number || created.id}`);

      setPaymentPrompt({
        id: created.id,
        order_number: created.order_number,
        total_amount: Number(created.total_amount || grandTotal || 0),
      });
      completedOnlineOrderRef.current = null;
      setPaymentMethod('cash');
      setAmountReceived(String(Number(created.total_amount || grandTotal || 0)));
      setCheckoutData(null);
      setOnlineStatus('');

      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  const getOrderValidationError = () => {
    if (!canManage) {
      return 'You do not have permission to create orders.';
    }
    if (!selectedItems.length && !selectedPackages.length) {
      return 'Select at least one menu item or package.';
    }

    if (!hasOpenShift) {
      return 'No open shift found. Start your shift in Report tab before creating orders.';
    }

    if (orderType === 'dine_in' && tableId) {
      const selectedTable = tables.find((table) => Number(table.id) === Number(tableId));
      if (selectedTable && isTableBlocked(selectedTable)) {
        return `Table ${selectedTable.table_number || selectedTable.id} is currently ${selectedTable.status}. Please choose another table.`;
      }
    }

    return '';
  };

  const openOrderReview = () => {
    const validationError = getOrderValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setMessage('');
    setOrderReviewOpen(true);
  };

  const closePaymentPrompt = () => {
    setPaymentPrompt(null);
    setPaymentMethod('cash');
    setAmountReceived('');
    setCheckoutData(null);
    setOnlineStatus('');
  };

  const cancelCreatedOrder = async () => {
    if (!paymentPrompt?.id || cancellingOrder) return;
    const ok = window.confirm('Cancel this order? This will mark it as cancelled and remove it from active pending orders.');
    if (!ok) return;

    setCancellingOrder(true);
    setError('');
    try {
      await posApi.cancelOrder(paymentPrompt.id);
      setMessage(`Order ${paymentPrompt.order_number || paymentPrompt.id} cancelled.`);
      closePaymentPrompt();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancellingOrder(false);
    }
  };

  const submitPayment = async () => {
    if (!paymentPrompt?.id || paying) return;

    setPaying(true);
    setError('');
    try {
      if (paymentMethod === 'cash') {
        const amount = Number(amountReceived || 0);
        const totalAmount = Number(paymentPrompt.total_amount || 0);
        if (!amount || amount < totalAmount) {
          setError('Amount received must be equal to or greater than total.');
          return;
        }

        await posApi.payOrder(paymentPrompt.id, {
          payment_method: 'cash',
          amount_received: amount,
        });

        setMessage(`Order ${paymentPrompt.order_number || paymentPrompt.id} paid successfully.`);

        if (typeof onOrderCreated === 'function') {
          onOrderCreated({ id: paymentPrompt.id });
        }

        closePaymentPrompt();
        await load();
        return;
      }

      const { data } = await posApi.createCheckout({
        order_id: Number(paymentPrompt.id),
        payment_method: paymentMethod,
      });

      const payload = data?.data || data;
      setCheckoutData(payload || null);
      setOnlineStatus(`Waiting for ${paymentMethodLabel(paymentMethod)} payment confirmation...`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to process payment.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <span className="es-icon"><ReceiptText size={20} /></span>
        <strong>Loading your menu…</strong>
        <p>Fetching items, packages, tables, and your current shift.</p>
      </div>
    );
  }

  return (
    <section className="pos-workspace">
      <div className="menu-browser">
        <div className="browser-top">
          <div>
            <h3>Point of Sale</h3>
            <span className="head-sub">Tap an item to add it to the ticket</span>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <ReceiptText size={14} /> Reload Menu
          </button>
        </div>

        <div className="category-row">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={category === cat.id ? 'cat-pill active' : 'cat-pill'}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
              <span className="cat-count">{cat.count}</span>
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your menu..."
          />
        </label>

        <div className="menu-grid">
          {filteredMenu.map((item) => {
            const outOfStock = isItemOutOfStock(item);
            const qty = Number(cart[item.id] || 0);
            const { Icon, cls } = thumbIconFor(item.category);
            const stockQty = Number(item.stock_qty || 0);

            return (
            <article
              key={item.id}
              className={`menu-card${qty > 0 ? ' is-selected' : ''}${outOfStock ? ' out-of-stock' : ''}`}
            >
              <div className={`item-thumb${outOfStock ? ' oos' : ''}`}>
                {item.image_path ? (
                  <img src={getUploadUrl(item.image_path)} alt={item.menu_name} />
                ) : (
                  <span className={`thumb-ph ${cls}`}><Icon size={26} /></span>
                )}
                <span className={`thumb-badge${outOfStock ? ' oos' : ''}`}>
                  {outOfStock ? 'Out of stock' : (item.category || 'Menu')}
                </span>
              </div>

              <div className="item-body">
                <h4>{item.menu_name}</h4>
                <p className={`item-stock${stockQty > 0 && stockQty <= 10 ? ' low' : ''}`}>
                  {outOfStock ? 'Unavailable' : `Stock: ${stockQty}`}
                </p>
              </div>

              <div className="card-foot">
                <strong className="item-price">{currency(item.selling_price)}</strong>
                <div className="qty-stepper">
                  <button
                    type="button"
                    className="minus"
                    aria-label={`Remove one ${item.menu_name}`}
                    onClick={() => bumpQty(item.id, -1)}
                    disabled={outOfStock || qty <= 0}
                  >
                    <Minus size={15} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={itemMaxQty(item.id)}
                    value={qty}
                    aria-label={`${item.menu_name} quantity`}
                    onChange={(e) => setQty(item.id, e.target.value)}
                    disabled={outOfStock}
                  />
                  <button
                    type="button"
                    className={`plus${qty > 0 ? ' hot' : ''}`}
                    aria-label={`Add one ${item.menu_name}`}
                    onClick={() => bumpQty(item.id, 1)}
                    disabled={outOfStock}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </article>
          )})}
        </div>

        {(category === 'all' || category === 'packages') ? (
          <>
            <div className="browser-top" style={{ marginTop: '0.75rem' }}>
              <div>
                <h3>Packages</h3>
                <span className="head-sub">Bundled deals and promos</span>
              </div>
            </div>

            <div className="menu-grid">
              {filteredPackages.map((pkg) => {
                const outOfStock = isPackageOutOfStock(pkg);
                const qty = Number(packageCart[pkg.id] || 0);
                const packageLabel = outOfStock
                  ? (pkg.unavailable_reason || 'Unavailable')
                  : `Stock: ${Number(pkg.stock_qty || 0)}`;

                return (
                  <article
                    key={`pkg-${pkg.id}`}
                    className={`menu-card${qty > 0 ? ' is-selected' : ''}${outOfStock ? ' out-of-stock' : ''}`}
                  >
                    <div className={`item-thumb${outOfStock ? ' oos' : ''}`}>
                      <span className="thumb-ph ph-packages"><Package size={26} /></span>
                      <span className={`thumb-badge${outOfStock ? ' oos' : ''}`}>
                        {outOfStock ? 'Unavailable' : 'Package'}
                      </span>
                    </div>

                    <div className="item-body">
                      <h4>{pkg.name}</h4>
                      <p className="item-stock">
                        {pkg.inclusions?.length ? `${pkg.inclusions.length} inclusions · ` : ''}
                        {packageLabel}
                      </p>
                    </div>

                    <div className="card-foot">
                      <strong className="item-price">{currency(pkg.price)}</strong>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="minus"
                          aria-label={`Remove one ${pkg.name}`}
                          onClick={() => bumpPackageQty(pkg.id, -1)}
                          disabled={outOfStock || qty <= 0}
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={packageMaxQty(pkg.id)}
                          value={qty}
                          aria-label={`${pkg.name} quantity`}
                          onChange={(e) => setPackageQty(pkg.id, e.target.value)}
                          disabled={outOfStock}
                        />
                        <button
                          type="button"
                          className={`plus${qty > 0 ? ' hot' : ''}`}
                          aria-label={`Add one ${pkg.name}`}
                          onClick={() => bumpPackageQty(pkg.id, 1)}
                          disabled={outOfStock}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {!filteredMenu.length && !filteredPackages.length ? (
          <div className="empty-state">
            <span className="es-icon"><Search size={20} /></span>
            <strong>Nothing matches your filters</strong>
            <p>Try a different category or clear the search box to see the full menu.</p>
          </div>
        ) : null}
      </div>

      <aside className="order-panel">
        <div className="ticket-head">
          <div className="ticket-title">
            <h3>{customerName || "Customer's Name"}</h3>
            <span className="ticket-no">NEW ORDER</span>
          </div>
          {hasOpenShift ? (
            <p>Shift #{shiftSummary?.shift?.id} · Expected {currency(shiftSummary?.breakdown?.expected_cash || 0)}</p>
          ) : (
            <p className="error-msg">No open shift. Start a shift in the Report tab before taking orders.</p>
          )}
        </div>

        <div className="order-body">
          <div className="order-fields">
            <label>
              Customer Name
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Select Table
              <select value={tableId} onChange={(e) => setTableId(e.target.value)} disabled={orderType !== 'dine_in'}>
                <option value="">Select Table</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id} disabled={isTableBlocked(table)}>
                    Table {String(table.table_number || table.id).padStart(2, '0')} ({tableStatusLabel(table)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Order Type
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                <option value="dine_in">Dine In</option>
                <option value="takeaway">Take Away</option>
              </select>
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Add order note..." />
            </label>
          </div>

          <div className="order-items">
            <div className="items-caption">
              <span>Order Items</span>
              <span>{selectedItems.length + selectedPackages.length}</span>
            </div>
            {selectedItems.length === 0 && selectedPackages.length === 0 ? (
              <p className="empty-note">No items yet — tap <strong>+</strong> on the menu to build this ticket.</p>
            ) : null}
            {selectedItems.map((item) => (
              <div className="order-line" key={item.menu_item_id}>
                <div className="line-main">
                  <span>{item.menu_name}</span>
                  <small>{item.quantity} × {currency(item.selling_price)}</small>
                </div>
                <div className="line-side">
                  <strong className="line-total">{currency(item.quantity * item.selling_price)}</strong>
                  <div className="qty-stepper">
                    <button type="button" className="minus" aria-label={`Remove one ${item.menu_name}`} onClick={() => bumpQty(item.menu_item_id, -1)}>
                      <Minus size={14} />
                    </button>
                    <span className="qty-val">{item.quantity}</span>
                    <button type="button" className="plus hot" aria-label={`Add one ${item.menu_name}`} onClick={() => bumpQty(item.menu_item_id, 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {selectedPackages.map((pkg) => (
              <div className="order-line" key={`pkg-line-${pkg.package_id}`}>
                <div className="line-main">
                  <span>{pkg.name} (Package)</span>
                  <small>{pkg.quantity} × {currency(pkg.price)}</small>
                </div>
                <div className="line-side">
                  <strong className="line-total">{currency(pkg.quantity * pkg.price)}</strong>
                  <div className="qty-stepper">
                    <button type="button" className="minus" aria-label={`Remove one ${pkg.name}`} onClick={() => bumpPackageQty(pkg.package_id, -1)}>
                      <Minus size={14} />
                    </button>
                    <span className="qty-val">{pkg.quantity}</span>
                    <button type="button" className="plus hot" aria-label={`Add one ${pkg.name}`} onClick={() => bumpPackageQty(pkg.package_id, 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="totals-box">
            <div><span>Menu Subtotal</span><strong>{currency(total)}</strong></div>
            <div><span>Packages</span><strong>{currency(packageTotal)}</strong></div>
            <div><span>Table Charge</span><strong>{currency(selectedTablePrice)}</strong></div>
            <div className="grand"><span>Total</span><strong>{currency(grandTotal)}</strong></div>
          </div>
        </div>

        <div className="ticket-foot">
          <button className="place-btn" onClick={openOrderReview} disabled={submitting || !canManage || (!selectedItems.length && !selectedPackages.length) || !hasOpenShift}>
            {submitting ? 'Placing Order...' : !hasOpenShift && canManage ? 'Start Shift to Order' : 'Place Order'}
          </button>
          <p className="ticket-hint">
            {!canManage
              ? 'Your account can view the menu but not place orders.'
              : !hasOpenShift
                ? 'Start a shift in Report to enable checkout.'
                : !selectedItems.length && !selectedPackages.length
                  ? 'Add at least one item to continue.'
                  : 'Sends the ticket to the kitchen and opens payment.'}
          </p>
        </div>
      </aside>

      {message ? <p className="ok-msg">{message}</p> : null}
      {error ? <p className="error-msg">{error}</p> : null}

      {orderReviewOpen ? (
        <div className="modal-backdrop" onClick={() => setOrderReviewOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Review Customer Order</h3>
            <p>Please double-check the summary before placing this order.</p>

            <div className="payment-panel">
              <div className="review-meta-grid">
                <div>
                  <span className="empty-note">Customer</span>
                  <strong>{customerName || 'Walk-in customer'}</strong>
                </div>
                <div>
                  <span className="empty-note">Order Type</span>
                  <strong>{orderType === 'dine_in' ? 'Dine In' : 'Take Away'}</strong>
                </div>
                <div>
                  <span className="empty-note">Table</span>
                  <strong>
                    {selectedTable
                      ? `Table ${String(selectedTable.table_number || selectedTable.id).padStart(2, '0')} (${tableStatusLabel(selectedTable)})`
                      : 'No table selected'}
                  </strong>
                </div>
              </div>

              <div className="items-list">
                {selectedItems.map((item) => (
                  <div className="item-row" key={`review-item-${item.menu_item_id}`}>
                    <span>{item.menu_name} x{item.quantity}</span>
                    <strong>{currency(item.quantity * item.selling_price)}</strong>
                  </div>
                ))}
                {selectedPackages.map((pkg) => (
                  <div className="item-row" key={`review-pkg-${pkg.package_id}`}>
                    <span>{pkg.name} (Package) x{pkg.quantity}</span>
                    <strong>{currency(pkg.quantity * pkg.price)}</strong>
                  </div>
                ))}
                {selectedTablePrice > 0 ? (
                  <div className="item-row" key="review-table-charge">
                    <span>Table Charge</span>
                    <strong>{currency(selectedTablePrice)}</strong>
                  </div>
                ) : null}
              </div>

              {notes.trim() ? (
                <div className="review-notes-box">
                  <span className="empty-note">Notes</span>
                  <p>{notes.trim()}</p>
                </div>
              ) : null}

              <div className="totals-box review-totals-box">
                <div><span>Menu Subtotal</span><strong>{currency(total)}</strong></div>
                <div><span>Packages</span><strong>{currency(packageTotal)}</strong></div>
                <div><span>Table Charge</span><strong>{currency(selectedTablePrice)}</strong></div>
                <div className="grand"><span>Grand Total</span><strong>{currency(grandTotal)}</strong></div>
              </div>
            </div>

            <div className="payment-actions-row">
              <button className="btn-secondary" onClick={() => setOrderReviewOpen(false)} disabled={submitting}>Back to Edit</button>
              <button className="place-btn" onClick={createOrder} disabled={submitting}>
                {submitting ? 'Placing Order...' : 'Confirm & Place Order'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentPrompt ? (
        <div className="modal-backdrop">
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{paymentPrompt.order_number || `Order #${paymentPrompt.id}`}</h3>
            <p>Total: {currency(paymentPrompt.total_amount)}</p>

            <div className="payment-panel">
              <div className="payment-row">
                <label>Mode of Payment</label>
                <select value={paymentMethod} onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setCheckoutData(null);
                  setOnlineStatus('');
                }}>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">PayMaya</option>
                </select>
              </div>

              {paymentMethod === 'cash' ? (
                <div className="payment-row">
                  <label>Amount Received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
              ) : null}

              <button className="btn-primary btn-lg btn-block" onClick={submitPayment} disabled={paying}>
                {paying ? 'Processing...' : paymentMethod === 'cash' ? 'Confirm Cash Payment' : `Generate ${paymentMethodLabel(paymentMethod)} QR`}
              </button>

              {checkoutData?.qr_code ? (
                <div className="qr-box">
                  <img src={checkoutData.qr_code} alt="PayMongo checkout QR" />
                  <a href={checkoutData.checkout_url} target="_blank" rel="noreferrer">Open checkout page</a>
                </div>
              ) : null}

              {onlineStatus ? <p className="empty-note">{onlineStatus}</p> : null}
            </div>

            <div className="payment-actions-row">
              <button className="btn-secondary" onClick={closePaymentPrompt}>Keep Pending</button>
              <button className="btn-danger" onClick={cancelCreatedOrder} disabled={cancellingOrder || paying}>
                {cancellingOrder ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentSuccessModal ? (
        <div className="modal-backdrop" onClick={() => setPaymentSuccessModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Payment Successful</h3>
            <p>The customer payment is done and successful.</p>

            <div className="payment-panel">
              <div className="item-row">
                <span>Order</span>
                <strong>{paymentSuccessModal.orderNumber}</strong>
              </div>
              <div className="item-row">
                <span>Payment Method</span>
                <strong>{paymentSuccessModal.paymentMethod}</strong>
              </div>
              <div className="item-row">
                <span>Amount Received</span>
                <strong>{currency(paymentSuccessModal.amountReceived)}</strong>
              </div>
            </div>

            <div className="payment-actions-row">
              <button onClick={() => setPaymentSuccessModal(null)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
