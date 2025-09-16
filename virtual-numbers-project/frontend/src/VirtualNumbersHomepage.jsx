// virtual_numbers_homepage.jsx (v3 with SMS checking and timer)
import React, { useEffect, useState, useMemo, useRef } from "react";

// --- Helpers ---
const toPersianNumber = (num) => {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(num || "").replace(/\d/g, (d) => persianDigits[+d]);
};

const currencyToman = (n) => `${toPersianNumber(n)} تومان`;

const serviceLogo = (serviceKey = "") => {
  const s = (serviceKey || "").toLowerCase();
  const domainMap = {
    'تلگرام': 'telegram.org',
    'واتساپ': 'whatsapp.com',
    'گوگل': 'google.com',
    'یوتیوب': 'youtube.com',
    'فیسبوک': 'facebook.com',
    'اینستاگرام': 'instagram.com',
    'آمازون': 'amazon.com',
    'توییتر': 'twitter.com',
    'تیک تاک': 'tiktok.com',
  };
  const domain = domainMap[s] || `${s.replace(/\s+/g, '')}.com`;
  return `https://logo.clearbit.com/${domain}`;
};

const countryFlag = (countryCode = "") => {
  if (!countryCode) return "🏳️";
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
};

const Spinner = ({ className = "w-6 h-6" }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const CountdownTimer = ({ expiryTimestamp }) => {
  const calculateTimeLeft = () => {
    const difference = expiryTimestamp - new Date().getTime();
    let timeLeft = {};
    if (difference > 0) {
      timeLeft = {
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    if (expiryTimestamp <= new Date().getTime()) {
      setTimeLeft({});
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, expiryTimestamp]);

  if (!timeLeft.minutes && !timeLeft.seconds) return <span>منقضی شد</span>;

  return (
    <div className="font-mono text-xl">
      {String(timeLeft.minutes || 0).padStart(2, '0')}:{String(timeLeft.seconds || 0).padStart(2, '0')}
    </div>
  );
};


// --- Main Component ---
export default function VirtualNumbersHomepage() {
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [sort, setSort] = useState("popular");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedForPurchase, setSelectedForPurchase] = useState(null);
  const [purchaseStep, setPurchaseStep] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [favorites, setFavorites] = useState({});
  const [activeOrder, setActiveOrder] = useState(null);
  const pollingInterval = useRef(null);

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
        console.error('Failed to load from API. Error:', e);
        setError('خطا در دریافت لیست سرویس‌ها');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const uniqueServices = useMemo(() => {
    const serviceMap = new Map();
    allServices.forEach(s => {
        const name = s.service_persian || s.service;
        if (!name) return;
        if (!serviceMap.has(name) || (s.priority < serviceMap.get(name).priority)) {
            serviceMap.set(name, s);
        }
    });
    const sortedUniqueServices = [...serviceMap.values()]
        .sort((a, b) => {
            const priorityA = a.priority || 99;
            const priorityB = b.priority || 99;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return (a.service_persian || a.service).localeCompare(b.service_persian || b.service);
        });
    return sortedUniqueServices.map(s => s.service_persian || s.service);
  }, [allServices]);
  
  const uniqueCountries = useMemo(() => {
    if (!selectedService) return [];
    const relevantServices = allServices.filter(s => (s.service_persian || s.service) === selectedService);
    const c = [...new Set(relevantServices.map(x => x.country_persian || x.country || ""))].filter(Boolean);
    return c.sort((a, b) => a.localeCompare(b));
  }, [allServices, selectedService]);

  const uniqueOperators = useMemo(() => {
    if (!selectedService || !selectedCountry) return [];
    const relevantServices = allServices.filter(s => (s.service_persian || s.service) === selectedService && (s.country_persian || s.country) === selectedCountry);
    const o = [...new Set(relevantServices.map(x => x.operator || ""))].filter(Boolean);
    return o.sort((a, b) => a.localeCompare(b));
  }, [allServices, selectedService, selectedCountry]);

  const filtered = useMemo(() => {
    let services = [...allServices];
    if (query) {
      services = services.filter(s =>
        `${s.service} ${s.country_persian} ${s.service_persian}`.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (selectedService) {
      services = services.filter(s => (s.service_persian || s.service) === selectedService);
    }
    if (selectedCountry) {
      services = services.filter(s => (s.country_persian || s.country) === selectedCountry);
    }
    if (selectedOperator) {
      services = services.filter(s => s.operator === selectedOperator);
    }
    if (sort === 'price_asc') {
      services.sort((a, b) => a.price_toman - b.price_toman);
    } else if (sort === 'price_desc') {
      services.sort((a, b) => b.price_toman - a.price_toman);
    }
    // 'popular' sort is the default from the backend
    return services;
  }, [allServices, query, selectedService, selectedCountry, selectedOperator, sort]);
  
  const visibleServices = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const toggleFavorite = (id) => {
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openPurchase = (svc) => {
    setSelectedForPurchase(svc);
    setPurchaseStep(1);
    setPurchaseResult(null);
    setActiveOrder(null);
  };

  const doPurchase = async (svc) => {
    if (!svc) return;
    setPurchaseLoading(true);
    setPurchaseStep(2);
    try {
      const res = await fetch("https://api.kalafin.shop/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: svc.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "خطا در خرید");
      }
      const data = await res.json();
      setActiveOrder({
        id: data.order_id,
        number: data.number,
        status: 'PENDING',
        smsCode: null,
        expiresAt: null,
      });
    } catch (e) {
      setPurchaseResult({ success: false, error: String(e) });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedForPurchase(null);
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("کپی شد!");
    } catch (err) {
      alert("خطا در کپی کردن");
    }
  };

  useEffect(() => {
    if (!activeOrder || !activeOrder.id) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`https://api.kalafin.shop/api/check-order/${activeOrder.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setActiveOrder(prev => ({
          ...prev,
          status: data.status,
          smsCode: data.smsCode,
          expiresAt: new Date().getTime() + data.expiresIn * 1000,
        }));
        if (data.smsCode || data.status === 'FINISHED' || data.status === 'CANCELED' || data.expiresIn <= 0) {
          clearInterval(pollingInterval.current);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    checkStatus();
    pollingInterval.current = setInterval(checkStatus, 5000);
    return () => clearInterval(pollingInterval.current);
  }, [activeOrder ? activeOrder.id : null]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans" dir="rtl">
      {/* Header and main content here */}
       <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl">N</div>
              <h1 className="text-xl font-bold text-gray-800">شماره مجازی</h1>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              ورود / ثبت‌نام
            </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-2">جستجو</h3>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="مثلا: تلگرام / انگلستان"
                  className="w-full p-3 rounded-md border"
                />
                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">۱. سرویس را انتخاب کنید</h4>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {uniqueServices.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSelectedService(selectedService === s ? "" : s);
                            setSelectedCountry("");
                            setSelectedOperator("");
                          }}
                          className={`w-full flex items-center gap-3 text-right px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                            selectedService === s
                              ? "bg-blue-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          <img src={serviceLogo(s)} alt={s} className="w-6 h-6 rounded-full" />
                          {s}
                        </button>
                      ))}
                      </div>
                    </div>
                    {selectedService && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2">۲. کشور را انتخاب کنید</h4>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                           <button
                              onClick={() => setSelectedCountry("")}
                              className={`w-full text-right px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                                selectedCountry === ""
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              همه کشورها
                            </button>
                          {uniqueCountries.map((c) => {
                            const countryData = allServices.find(s => (s.country_persian || s.country) === c);
                            const code = countryData ? countryData.country_code : '';
                            return (
                              <button
                                key={c}
                                onClick={() => {
                                  setSelectedCountry(selectedCountry === c ? "" : c);
                                  setSelectedOperator("");
                                }}
                                className={`w-full flex items-center gap-3 text-right px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                                  selectedCountry === c
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                <img src={countryFlag(code)} alt={c} className="w-6 h-auto rounded" />
                                {c}
                              </button>
                            );
                          })}
                          </div>
                          </div>
                    )}
                    {selectedCountry && (
                       <div>
                        <h4 className="font-semibold text-gray-800 mb-2">۳. اپراتور را انتخاب کنید</h4>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                           <button
                              onClick={() => setSelectedOperator("")}
                              className={`w-full text-right px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                                selectedOperator === ""
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              همه اپراتورها
                            </button>
                          {uniqueOperators.map((o) => (
                            <button
                              key={o}
                              onClick={() => setSelectedOperator(selectedOperator === o ? "" : o)}
                              className={`w-full text-right px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                                selectedOperator === o
                                  ? "bg-blue-600 text-white shadow-md"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <label className="text-sm text-gray-600">مرتب‌سازی:</label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="p-2 rounded-md border text-sm"
                  >
                    <option value="popular">محبوب‌ترین</option>
                    <option value="price_asc">قیمت: کم به زیاد</option>
                    <option value="price_desc">قیمت: زیاد به کم</option>
                  </select>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setQuery("");
                      setSelectedService("");
                      setSelectedCountry("");
                      setSelectedOperator("");
                      setSort("popular");
                    }}
                    className="w-full border rounded-md py-2 text-sm"
                  >
                    پاک‌سازی فیلترها
                  </button>
                </div>
              </div>
            </div>
          </aside>
          
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading && <p>در حال بارگذاری...</p>}
              {!loading && visibleServices.map((s) => (
                <article
                  key={s.id}
                  className="bg-white p-4 rounded-lg shadow flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <img src={serviceLogo(s.service_persian)} alt={s.service_persian} className="w-10 h-10 rounded-full" />
                      <div>
                        <div className="font-semibold text-gray-900">
                          {s.service_persian}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <img src={countryFlag(s.country_code)} alt={s.country_persian} className="w-5 h-auto rounded" />
                          {s.country_persian}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(s.id)}
                      title="افزودن به علاقه‌مندی‌ها"
                      className={`p-2 rounded-full transition-colors ${
                        favorites[s.id]
                          ? "text-yellow-500 bg-yellow-100"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-lg font-bold text-blue-600">
                      {currencyToman(s.price_toman || 0)}
                    </div>
                    <button
                      onClick={() => openPurchase(s)}
                      className="bg-green-500 hover:bg-green-600 transition-colors text-white px-5 py-2 rounded-md font-semibold"
                    >
                      خرید
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setVisibleCount((c) => c + 12)}
                  className="px-6 py-2 border rounded-md"
                >
                  نمایش بیشتر
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedForPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-lg">
                  {selectedForPurchase.service_persian} — {selectedForPurchase.country_persian}
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-500">بستن ✕</button>
            </div>
            
            {purchaseStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold">جزئیات سفارش</h3>
                    <div className="mt-2 text-sm space-y-1">
                      <p>سرویس: {selectedForPurchase.service_persian}</p>
                      <p>کشور: {selectedForPurchase.country_persian}</p>
                      <p>اپراتور: {selectedForPurchase.operator}</p>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <h3 className="font-semibold">مبلغ قابل پرداخت</h3>
                    <p className="text-2xl font-bold my-2">{currencyToman(selectedForPurchase.price_toman)}</p>
                    <button onClick={() => doPurchase(selectedForPurchase)} className="w-full bg-blue-600 text-white py-2 rounded-md">
                      تایید و پرداخت
                    </button>
                </div>
              </div>
            )}

            {purchaseStep === 2 && (
              <div className="mt-4">
                {purchaseLoading && (
                  <div className="text-center p-8"><Spinner /> <p className="mt-2">در حال خرید شماره...</p></div>
                )}
                {activeOrder && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-sm text-gray-600">شماره مجازی شما</div>
                      <div className="my-3 font-mono text-2xl tracking-wider bg-white border p-3 rounded-md">
                        {activeOrder.number}
                      </div>
                      <button onClick={() => copyToClipboard(activeOrder.number)} className="text-sm border px-3 py-1 rounded-md">
                        کپی کردن
                      </button>
                      <div className="mt-6 text-sm text-gray-600">زمان باقی‌مانده</div>
                      <div className="mt-2">
                        {activeOrder.expiresAt ? <CountdownTimer expiryTimestamp={activeOrder.expiresAt} /> : <Spinner className="w-5 h-5 mx-auto" />}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col items-center justify-center">
                      <div className="text-sm text-gray-600">منتظر دریافت کد فعال‌سازی...</div>
                      {activeOrder.smsCode ? (
                        <div className="mt-4 bg-green-100 border-2 border-green-300 p-4 rounded-lg text-center">
                          <div className="font-mono text-3xl tracking-widest text-green-800">
                            {activeOrder.smsCode}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 p-4 rounded-lg bg-gray-100 w-full text-center">
                          <Spinner className="w-8 h-8 mx-auto text-gray-400" />
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-4 text-center">
                        کد دریافتی در این کادر نمایش داده می‌شود. لطفاً شماره را در سرویس مورد نظر وارد کنید.
                      </p>
                    </div>
                  </div>
                )}
                {!purchaseLoading && purchaseResult && !purchaseResult.success && (
                  <div className="p-4 bg-red-50 text-red-700 rounded text-center">
                    <div className="font-semibold">خرید ناموفق</div>
                    <div className="mt-2 text-sm">{purchaseResult.error}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
