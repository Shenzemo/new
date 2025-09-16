import React, { useEffect, useState, useMemo } from 'react';

// Helper: Persian number formatter
const toPersianNumber = (num) => {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return String(num).replace(/\d/g, (d) => persianDigits[+d]);
};

export default function VirtualNumbersHomepage() {
  // --- State Management ---
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filters
  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');

  // State for the purchase modal
  const [selectedForPurchase, setSelectedForPurchase] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://api.kalafin.shop/api/services');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setAllServices(data);
        setError(null);
      } catch (e) {
        console.warn('Failed to load from API. Error:', e);
        setError('خطا در دریافت لیست سرویس‌ها');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // --- Filtering Logic ---
  const filteredServices = useMemo(() => {
    return allServices.filter((s) => {
      const searchableText = `${s.service} ${s.country} ${s.country_persian} ${s.service_persian}`.toLowerCase();
      if (query && !searchableText.includes(query.toLowerCase())) {
        return false;
      }
      if (serviceFilter && s.service_persian !== serviceFilter) return false;
      if (countryFilter && s.country_persian !== countryFilter) return false;
      if (operatorFilter && s.operator !== operatorFilter) return false;
      return true;
    });
  }, [allServices, query, serviceFilter, countryFilter, operatorFilter]);

  // --- Create unique lists for dropdowns ---
  const uniqueServices = useMemo(() => [...new Set(allServices.map(s => s.service_persian || s.service))].sort(), [allServices]);
  const uniqueCountries = useMemo(() => [...new Set(allServices.map(s => s.country_persian || s.country))].sort(), [allServices]);
  const uniqueOperators = useMemo(() => [...new Set(allServices.map(s => s.operator))].sort(), [allServices]);

  // --- Event Handlers ---
  const openPurchaseModal = (service) => {
    setSelectedForPurchase(service);
    setShowModal(true);
  };

  const handlePurchase = async (svc) => {
    if (!svc) return;
    setLoading(true);
    try {
      const res = await fetch('https://api.kalafin.shop/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: svc.id }),
      });
      if (!res.ok) throw new Error('Purchase failed');
      const data = await res.json();
      alert('خرید موفق! شماره: ' + (data.number || '—'));
      setShowModal(false);
    } catch (e) {
      alert('خطا در خرید: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans" dir="rtl">
      {/* Top bar */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold">VN</div>
              <div className="text-lg font-semibold">شماره‌ مجازی</div>
            </div>
            <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm">ورود / ثبت‌نام</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Hero Section with Filters */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">خرید شماره مجازی مطمئن و فوری</h1>
            <p className="mt-4 text-gray-600">دریافت شماره برای تلگرام، واتساپ، اینستاگرام و ده‌ها سرویس دیگر — تحویل فوری و پشتیبانی ۲۴ ساعته.</p>
            <div className="mt-6">
              <a href="#services" className="bg-blue-600 text-white px-5 py-3 rounded-md shadow">مشاهده همه سرویس‌ها</a>
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow space-y-4">
            <h3 className="text-lg font-semibold">جستجو و فیلتر پیشرفته</h3>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو (مثلا: تلگرام یا روسیه...)" className="w-full p-3 rounded-md border" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-full p-2 rounded-md border">
                <option value="">همه سرویس‌ها</option>
                {uniqueServices.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="w-full p-2 rounded-md border">
                <option value="">همه کشورها</option>
                {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} className="w-full p-2 rounded-md border">
                <option value="">همه اپراتورها</option>
                {uniqueOperators.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section id="services" className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">سرویس‌های موجود</h2>
            <div className="text-sm text-gray-500">{toPersianNumber(filteredServices.length)} سرویس یافت شد</div>
          </div>

          <div>
            {loading && <div className="p-6 bg-white rounded shadow text-center">در حال بارگذاری...</div>}
            {error && <div className="p-3 bg-yellow-50 text-yellow-800 rounded mt-3 text-center">{error}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-lg shadow flex flex-col justify-between">
                  <div>
                    <div className="font-semibold">{s.service_persian}</div>
                    <div className="text-sm text-gray-500">{s.country_persian} • اپراتور: {s.operator}</div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-lg font-bold text-blue-600">{toPersianNumber(s.price_toman)} <span className="text-xs">تومان</span></div>
                    <button onClick={() => openPurchaseModal(s)} className="bg-green-500 text-white px-4 py-2 rounded">خرید</button>
                  </div>
                </div>
              ))}
            </div>

            {filteredServices.length === 0 && !loading && (
              <div className="mt-6 p-6 bg-white rounded shadow text-center text-gray-500">موردی یافت نشد. فیلترها را تغییر دهید.</div>
            )}
          </div>
        </section>
      </main>

      {/* Purchase Modal */}
      {showModal && selectedForPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-lg">خرید: {selectedForPurchase.service_persian} — {selectedForPurchase.country_persian}</div>
                <div className="text-sm text-gray-500">قیمت: {toPersianNumber(selectedForPurchase.price_toman)} تومان</div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400">بستن ✕</button>
            </div>
            <div className="mt-4">
              <div className="mt-4 flex gap-2">
                <button onClick={() => handlePurchase(selectedForPurchase)} className="flex-1 bg-blue-600 text-white py-2 rounded">تایید و خرید</button>
                <button onClick={() => setShowModal(false)} className="flex-1 border py-2 rounded">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}