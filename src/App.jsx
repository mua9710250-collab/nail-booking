import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, AlertCircle, XCircle, Heart, DollarSign, X, Info, ArrowUp, ArrowDown, Database, Clock, Trash2, RotateCcw, CheckCircle, Check, Sparkles, Footprints, Hand, Copy, User, Phone, Eraser, Gift, AlertTriangle, ChevronDown
} from 'lucide-react';

// === FIREBASE IMPORTS & SETUP ===
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, query, getDoc, setLogLevel } from 'firebase/firestore';

// New Color Palette: Soft Beige / Pure White / Light Rose Gold (柔和米白與淺玫瑰金)
const COLORS = {
  BG_OUTER: '#FDF7F5', 
  BG_LIGHT: '#FFFFFF', 
  ACCENT_PALE: '#F0E8E6', 
  TEXT_DARK: '#936E6C', 
  TEXT_NORMAL: '#756D6B', 
  CAL_ACCENT: '#D6A5A3', 

  BG_DEFAULT_CIRCLE: '#F7F2F0', 
  
  OPEN_BOOKING: '#936E6C', 
  HOLIDAY: '#C4AFAE', 
  RESTRICTED: '#E2BCB9', 
  SURCHARGE: '#F0D5D0', 
  
  TEXT_HIGHLIGHT: '#B55745', 
  SLOT_AVAILABLE: '#6DAE78', 
  SLOT_DISABLED: '#E5E7EB', 
  TEXT_DISABLED: '#9CA3AF', 

  HEART_PINK: '#FFB7C5', 
};

// --- SERVICE MENU DATA ---
const SERVICE_CATEGORIES = [
    { id: 'jan_promo', name: '1月活動', icon: <Sparkles size={16}/> },
    { id: 'hand_gel', name: '手部凝膠', icon: <Hand size={16}/> },
    { id: 'design', name: '設計款式', icon: <Sparkles size={16}/> },
    { id: 'foot_gel', name: '足部凝膠', icon: <Footprints size={16}/> },
];

const SERVICE_ITEMS = {
  'jan_promo': [
    { id: 'promo_new', name: "2款 | 本月新款", price: "$1400", time: "2.5~3.5時", note: "原價$1700" },
    { id: 'promo_combo', name: "[手+足] 單色優惠", price: "$2026", time: "2.5~3時", note: "含純色、貓眼等(鏡面除外)" },
  ],
  'hand_gel': [
    { id: 'h_pure', name: "純色凝膠", price: "$1200", time: "1.5~2時", note: "基礎保養+加厚" },
    { id: 'h_cat', name: "貓眼/特殊凝膠", price: "$1300", time: "1.5~2時", note: "含亮片/碎鑽/毛呢" },
    { id: 'h_french', name: "法式凝膠", price: "$1400", time: "1.5~2時", note: "基礎保養+加厚" },
    { id: 'h_grad', name: "漸層凝膠", price: "$1500", time: "1.5~2時", note: "基礎保養+加厚" },
    { id: 'h_mirror', name: "鏡面凝膠", price: "$1500", time: "1.5~2時", note: "基礎保養+加厚" },
  ],
  'design': [
    { id: 'd_simple', name: "簡單設計", price: "$1400", time: "2~3.5時", note: "2~4指輕設計" },
    { id: 'd_adv', name: "進階設計", price: "$1600", time: "2~3.5時", note: "6~8指多層次/仙女感" },
    { id: 'd_custom', name: "客製設計", price: "$1850", time: "2~3.5時", note: "花磚/貼鑽/手繪花" },
    { id: 'h_dye', name: "十指暈染", price: "$1700", time: "2.5~3.5時", note: "全暈染款式均一價" },
    { id: 'd_bring', name: "自帶圖", price: "$1580起", time: "2.5~3.5時", note: "依現場施作為主" },
    { id: 'd_water', name: "手繪.水彩造型", price: "$1800起", time: "2.5~3.5時", note: "依現場施作為主" },
  ],
  'foot_gel': [
    { id: 'f_pure', name: "足部單色", price: "$1300", time: "1~1.5時", note: "除鏡面皆同價" },
    { id: 'f_design', name: "足部造型(不限款)", price: "$1500", time: "2~4時", note: "除大鑽/複雜手繪同價" },
  ]
};

// --- REMOVAL OPTIONS ---
const REMOVAL_MAIN_OPTS = ['不需要', '需要', '卸延甲'];
const REMOVAL_DETAIL_OPTS = [
    { name: '他店卸甲', price: '$200' },
    { name: '本店卸甲', price: '$200' },
    { name: '會員客卸甲', price: '$0' },
];

// --- DEFAULT SETTINGS ---
const DEFAULT_SLOTS_LIST = ['11:00', '13:30', '15:00', '17:30', '19:00'];

// Global Firebase variables
let app, db, auth;

// --- UTILITY FUNCTIONS ---
const formatDate = (day, month) => {
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `2026-${monthStr}-${dayStr}`;
};

const getDayOfWeek = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); 
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `(${days[date.getDay()]})`;
};

// *** CORE LOGIC: Get Available Slots ***
const getSlotsForDate = (dateKey, availableSlots) => {
    if (dateKey === '2026-02-20') return [];

    const [year, month, day] = dateKey.split('-').map(Number);
    
    // Normal line booking periods
    if (month === 1 && day <= 13) return [];
    if (month === 2 && day >= 23) return [];

    const isHoliday = (month === 2 && day >= 14 && day <= 22);
    if (isHoliday) return [];

    const isJanBookable = (month === 1 && day >= 14);
    const isFebBookable = (month === 2 && day <= 13);
    
    if (!isJanBookable && !isFebBookable) return [];

    const slotsData = availableSlots[dateKey];
    
    if (slotsData) {
        return slotsData.slots.filter(s => s.available).map(s => s.time);
    } else {
        return DEFAULT_SLOTS_LIST;
    }
};

// --- HELPER FUNCTIONS FOR RESTRICTIONS ---
const isRestrictedDate = (dateKey) => {
    if (!dateKey) return false;
    const [year, month, day] = dateKey.split('-').map(Number);
    return (month === 2 && day >= 1 && day <= 13);
};

const isServiceAllowedOnRestrictedDate = (item) => {
    const blockedIds = [
        'h_pure', 'h_cat', 'h_french', 'h_grad', 'h_mirror', 
        'f_pure' 
    ];
    return !blockedIds.includes(item.id);
};


// --- DATE CALENDAR VIEW SUB-COMPONENT (Shared) ---
const DateCalendarView = ({ monthInfo, availableSlots, selectedDateKey, onSelectDate, COLORS, isAdmin = false }) => {
    const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];
    const { days, start, month } = monthInfo;
    const monthName = month === 1 ? '一月' : '二月';
    
    let daysGrid = [];
    for (let i = 0; i < start; i++) {
        daysGrid.push(<div key={`empty-${month}-${i}`} className="h-9"></div>); 
    }
    
    for (let day = 1; day <= days; day++) {
        const dateKey = formatDate(day, month);
        const slots = getSlotsForDate(dateKey, availableSlots);
        const hasAvailableSlots = slots.length > 0;
        const isLastSlot = slots.length === 1;
        const isSelected = dateKey === selectedDateKey;
        
        // Compact sizing for mobile
        let dayClass = `w-8 h-8 text-sm font-semibold flex items-center justify-center rounded-full transition-colors`;
        
        const is2_20 = dateKey === '2026-02-20'; 
        const isHoliday = (month === 2 && day >= 14 && day <= 22) && !is2_20; 
        const isBookablePeriod = (month === 1 && day >= 14) || (month === 2 && day <= 13) || is2_20;
        const isNormalLinePeriod = (month === 1 && day <= 13) || (month === 2 && day >= 23);
        
        let isClickable = isAdmin ? true : (isBookablePeriod || isNormalLinePeriod); 

        if (isNormalLinePeriod) {
            dayClass += ` text-[${COLORS.TEXT_NORMAL}] bg-[${COLORS.BG_DEFAULT_CIRCLE}]`;
        } else if (!isBookablePeriod && !isAdmin) {
            // Not bookable (Before 1/14 or After 2/22)
            dayClass += ` text-[${COLORS.TEXT_NORMAL}] opacity-30 cursor-not-allowed`;
            isClickable = false;
        } else if (isHoliday) {
            dayClass += ` text-white bg-[${COLORS.HOLIDAY}] ${isAdmin ? 'hover:opacity-80' : 'cursor-not-allowed opacity-70'}`;
            if (!isAdmin) isClickable = false;
        } else if (isSelected) {
            dayClass += ` bg-[${COLORS.OPEN_BOOKING}] text-white shadow-lg border-2 border-white`;
        } else if (is2_20) {
            dayClass += ` bg-[${COLORS.RESTRICTED}] text-white hover:bg-[${COLORS.CAL_ACCENT}]`;
        } else if (hasAvailableSlots) {
             dayClass += ` text-[${COLORS.TEXT_DARK}] bg-[${COLORS.BG_DEFAULT_CIRCLE}] hover:bg-[${COLORS.ACCENT_PALE}]`;
        } else {
             // Fully booked dates OR normal dates without slots saved -> Default Circle Color
             dayClass += ` text-[${COLORS.TEXT_NORMAL}] bg-[${COLORS.BG_DEFAULT_CIRCLE}] opacity-60 ${isAdmin ? '' : 'cursor-not-allowed'}`;
             if (!isAdmin) isClickable = false;
        }
        
        let indicator = null;
        if (hasAvailableSlots && !isSelected && !is2_20 && !isHoliday && !isNormalLinePeriod && isClickable) {
            if (isLastSlot) {
                // RED PULSING DOT for last slot
                indicator = <div className="w-1.5 h-1.5 rounded-full mt-0.5 shadow-md animate-pulse" style={{ backgroundColor: COLORS.TEXT_HIGHLIGHT }}></div>;
            } else {
                // GREEN DOT for available
                indicator = <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: COLORS.SLOT_AVAILABLE }}></div>;
            }
        } else {
            indicator = <div className="w-1.5 h-1.5 mt-0.5"></div>;
        }

        daysGrid.push(
            <div key={dateKey} className="flex flex-col items-center justify-start h-10 cursor-pointer" onClick={() => isClickable && onSelectDate(dateKey)}>
                <button
                    disabled={!isClickable}
                    className={dayClass}
                    title={dateKey}
                    style={{ pointerEvents: 'none' }}
                >
                    {day}
                </button>
                {indicator}
            </div>
        );
    }
    
    return (
        <div className={`p-3 rounded-xl shadow-inner mb-4`} style={{ backgroundColor: COLORS.BG_OUTER, border: `1px solid ${COLORS.ACCENT_PALE}` }}>
            <h4 className={`text-center text-lg font-bold mb-2`} style={{ color: COLORS.CAL_ACCENT }}>
                {monthName}
            </h4>
            <div className="grid grid-cols-7 text-center mb-1">
                {dayHeaders.map(d => (
                    <div key={d} className={`text-xs font-bold text-[${COLORS.TEXT_NORMAL}]`}>{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {daysGrid}
            </div>
        </div>
    );
};


// --- BOOKING FORM COMPONENT ---
const BookingForm = ({ availableSlots, COLORS, getDayOfWeek, janInfo, febInfo }) => {
    // Form States
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedDateKey, setSelectedDateKey] = useState('');
    
    // Multi-select for time
    const [selectedTimes, setSelectedTimes] = useState([]);
    
    const [removalType, setRemovalType] = useState(''); 
    const [removalDetail, setRemovalDetail] = useState(''); 

    const [selectedCategory, setSelectedCategory] = useState('jan_promo');
    const [selectedService, setSelectedService] = useState(null); 

    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [statusMessage, setStatusMessage] = useState("🗓️ 請選擇日期");
    const [extraInfo, setExtraInfo] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    
    const [validationMsg, setValidationMsg] = useState('');
    const timeSectionRef = useRef(null);

    // --- Validation Functions ---
    const validateName = (val) => /^[\u4E00-\u9FA5]{2,}$/.test(val);
    const validatePhone = (val) => /^09\d{8}$/.test(val);

    // --- Date/Time Logic ---
    const handleDateSelection = (dateKey) => {
        setSelectedDateKey(dateKey);
        setIsCalendarOpen(false);
        // Do not clear selectedTimes here to allow multi-day selection
        setSelectedService(null);

        setTimeout(() => {
            timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const handleTimeToggle = (time) => {
        const isSelected = selectedTimes.some(slot => slot.date === selectedDateKey && slot.time === time);
        
        if (isSelected) {
            setSelectedTimes(prev => prev.filter(slot => !(slot.date === selectedDateKey && slot.time === time)));
        } else {
            setSelectedTimes(prev => [...prev, { date: selectedDateKey, time }].sort((a, b) => {
                 if (a.date !== b.date) return a.date.localeCompare(b.date);
                 return a.time.localeCompare(b.time);
            }));
        }
    };
    
    const removeSelectedSlot = (index) => {
        const newSlots = [...selectedTimes];
        newSlots.splice(index, 1);
        setSelectedTimes(newSlots);
    };
    
    const handleServiceSelect = (item) => {
        // Validation check against current view date (simple check)
        if (isRestrictedDate(selectedDateKey)) {
            if (!isServiceAllowedOnRestrictedDate(item)) {
                alert("此期間只接造型款式，❌期間暫不接透明/單色/純漸層/純卸甲/純保養");
                return;
            }
        }
        setSelectedService(item);
    };

    useEffect(() => {
        if (!selectedDateKey) {
             setAvailableTimes([]);
             setStatusMessage("🗓️ 請選擇日期");
             setExtraInfo(null);
             return;
        }
        
        if (selectedDateKey === '2026-02-20') {
             setAvailableTimes([]);
             setStatusMessage("⚠️ 3月預約開放日：請直接至預約系統上預約。");
             setExtraInfo(null);
             return; 
        }

        const dateParts = selectedDateKey.split('-');
        const month = parseInt(dateParts[1]);
        const day = parseInt(dateParts[2]);
        
        if ((month === 1 && day <= 13) || (month === 2 && day >= 23)) {
             setAvailableTimes([]);
             setStatusMessage("請至官方LINE線上系統預約"); 
             setExtraInfo(null);
             return;
        }

        const times = getSlotsForDate(selectedDateKey, availableSlots);
        setAvailableTimes(times);
        
        const isRestrictedAndSurcharge = (month === 2 && day >= 1 && day <= 13);
        const isSurchargeOnly = (month === 1 && day >= 14);

        if (times.length > 0) {
             setStatusMessage(`✅ ${selectedDateKey.substring(5)} 剩餘 ${times.length} 個空檔`);
             if (isRestrictedAndSurcharge) {
                 setExtraInfo({ 
                     text: "⚠️ (不接單色類/保養) 均加價+$100", 
                     color: COLORS.TEXT_HIGHLIGHT 
                 });
             } else if (isSurchargeOnly) {
                 setExtraInfo({ 
                     text: "💰 本日為加價時段 / 均加價+$100", 
                     color: COLORS.TEXT_DARK 
                 });
             } else {
                 setExtraInfo(null);
             }
        } else {
             setStatusMessage("❌ 今日預約已滿");
             setExtraInfo(null);
        }
    }, [selectedDateKey, availableSlots]);
    
    // --- Removal Logic Change ---
    const handleRemovalMainSelect = (type) => {
        setRemovalType(type);
        if (type === '不需要' || type === '卸延甲') {
            setRemovalDetail(''); 
        }
    };

    // --- Generate Output Text ---
    const generateBookingText = () => {
        // Updated logic: Group by date and format
        let timeDisplay = "";
        
        if (selectedTimes.length > 0) {
            const groupedSlots = selectedTimes.reduce((acc, slot) => {
                if (!acc[slot.date]) {
                    acc[slot.date] = [];
                }
                acc[slot.date].push(slot.time);
                return acc;
            }, {});

            // Format string: "1/14(三)13:30、15:00"
            const formattedLines = Object.keys(groupedSlots).sort().map(date => {
                const [y, m, d] = date.split('-');
                const shortDate = `${parseInt(m)}/${parseInt(d)}`; 
                const dayStr = getDayOfWeek(date); // (三)
                const times = groupedSlots[date].sort().join('、');
                return `${shortDate}${dayStr}${times}`;
            });
            
            timeDisplay = formattedLines.join('\n');
        } else if (selectedDateKey === '2026-02-20') {
             timeDisplay = "3月預約開放日 (請至系統預約)";
        }
        
        let removalText = removalType;
        if (removalType === '需要' && removalDetail) {
            removalText = `${removalType} (${removalDetail})`;
        } else if (removalType === '卸延甲') {
            removalText = "卸延甲 ($200)";
        }
        
        let serviceText = '';
        let serviceTime = '';
        if (selectedService) {
            serviceText = `${selectedService.name}`;
            if (selectedService.originalPrice) {
                 serviceText += ` (特價${selectedService.price})`;
            } else {
                 serviceText += ` (${selectedService.price})`;
            }
            serviceTime = selectedService.time || '';
        }

        return `【預約資料】
姓名：${name}
電話：${phone}
預約時段：
${timeDisplay}
卸甲需求：${removalText}
服務項目：${serviceText}
預計時間：${serviceTime}`;
    };

    // --- Handle Copy with Validation ---
    const handleCopy = () => {
        const missingFields = [];
        const formatErrors = [];

        if (!name) missingFields.push("姓名");
        else if (!validateName(name)) formatErrors.push("姓名請填寫完整中文全名 (不可用英文/綽號)");

        if (!phone) missingFields.push("電話");
        else if (!validatePhone(phone)) formatErrors.push("電話格式錯誤 (需為09開頭10碼數字)");

        // Validate multiple slots
        const isSpecialDay = selectedDateKey === '2026-02-20';
        const dateParts = selectedDateKey.split('-');
        const m = dateParts ? parseInt(dateParts[1]) : 0;
        const d = dateParts ? parseInt(dateParts[2]) : 0;
        const isNormalLine = (m === 1 && d <= 13) || (m === 2 && d >= 23);

        if (selectedTimes.length === 0 && !isSpecialDay && !isNormalLine) {
            missingFields.push("預約時段");
        } else if (selectedTimes.length < 2 && !isSpecialDay && !isNormalLine) {
            formatErrors.push("請至少選擇 2 個預約時段 (以利安排)");
        }
        
        const isRemovalValid = 
            removalType === '不需要' || 
            removalType === '卸延甲' || 
            (removalType === '需要' && removalDetail);
        if (!removalType || !isRemovalValid) missingFields.push("卸甲需求");
        
        if (!selectedService) missingFields.push("服務項目");
        
        if (missingFields.length > 0) {
            setValidationMsg(`尚未填寫：${missingFields.join('、')}`);
            setTimeout(() => setValidationMsg(''), 3000);
            return;
        }

        if (formatErrors.length > 0) {
            setValidationMsg(`⚠️ ${formatErrors.join('\n')}`);
            setTimeout(() => setValidationMsg(''), 4000);
            return;
        }
        
        setValidationMsg('');
        const text = generateBookingText();
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
        }
        document.body.removeChild(textArea);
    };

    const is2_20 = selectedDateKey === '2026-02-20';

    return (
        <div className="bg-white p-6 sm:rounded-2xl shadow-lg mb-8" style={{ border: `2px solid ${COLORS.TEXT_DARK}` }}>
            {/* Warning Header */}
            <div className="mb-6 p-3 rounded-xl text-center border-l-4" style={{ backgroundColor: '#FFF5F5', borderColor: COLORS.TEXT_HIGHLIGHT }}>
                <p className="font-bold text-sm" style={{ color: COLORS.TEXT_HIGHLIGHT }}>
                    ⚠️ 如首次到訪請填寫完整資料<br/>且須註冊預約系統 才能成功預約
                </p>
            </div>

            <h3 className={`font-black text-xl mb-4 flex items-center gap-2`} style={{ color: COLORS.TEXT_DARK }}>
                <Calendar size={22} /> 預約資料填寫
            </h3>

            <div className="space-y-6">
                {/* 1. Personal Info */}
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className={`block text-sm font-bold mb-1 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                            <User size={16} /> 姓名 (請打全名):
                        </label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例: 王小美 (中文全名)"
                            className={`w-full p-4 border-2 rounded-xl focus:outline-none transition-all text-base ${name && !validateName(name) ? 'border-red-400 bg-red-50' : ''}`}
                            style={{ borderColor: name && !validateName(name) ? '#FCA5A5' : COLORS.ACCENT_PALE, color: COLORS.TEXT_NORMAL }}
                        />
                        {name && !validateName(name) && <p className="text-xs text-red-500 mt-1">請填寫中文全名 (不接受英文名/綽號)</p>}
                    </div>
                    <div>
                        <label className={`block text-sm font-bold mb-1 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                            <Phone size={16} /> 電話 (09開頭10碼):
                        </label>
                        <input 
                            type="tel" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="例: 0912345678"
                            maxLength="10"
                            className={`w-full p-4 border-2 rounded-xl focus:outline-none transition-all text-base ${phone && !validatePhone(phone) ? 'border-red-400 bg-red-50' : ''}`}
                            style={{ borderColor: phone && !validatePhone(phone) ? '#FCA5A5' : COLORS.ACCENT_PALE, color: COLORS.TEXT_NORMAL }}
                        />
                        {phone && !validatePhone(phone) && <p className="text-xs text-red-500 mt-1">請輸入正確的 10 碼手機號碼</p>}
                    </div>
                </div>

                {/* 2. Date & Time Selection */}
                <div>
                    <label className={`block text-sm font-bold mb-1 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                        <Calendar size={16} /> 想預約的時段:
                    </label>
                    <div className="relative">
                        <button
                            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                            className={`w-full p-4 border-2 rounded-xl text-left text-base font-semibold flex justify-between items-center transition-all hover:bg-opacity-80 active:scale-[0.98]`}
                            style={{ borderColor: COLORS.CAL_ACCENT, color: COLORS.TEXT_DARK, backgroundColor: COLORS.BG_OUTER }}
                        >
                            {selectedDateKey 
                                ? `${selectedDateKey.substring(5)} ${getDayOfWeek(selectedDateKey)}`
                                : '-- 點擊選擇日期 (可換日多選) --'}
                            <ArrowDown size={16} className={`text-[${COLORS.TEXT_DARK}] transition-transform ${isCalendarOpen ? 'rotate-180' : 'rotate-0'}`} />
                        </button>
                        
                        <div className="mt-2 text-xs font-bold flex gap-2 items-center" style={{ color: COLORS.TEXT_NORMAL }}>
                             <span>{statusMessage}</span>
                             {extraInfo && <span style={{ color: extraInfo.color }}>{extraInfo.text}</span>}
                        </div>

                        {isCalendarOpen && (
                            <div className="mt-2 p-3 rounded-2xl shadow-xl border-2 animate-in fade-in-0 slide-in-from-top-2 relative z-20" style={{ backgroundColor: COLORS.BG_LIGHT, borderColor: COLORS.CAL_ACCENT }}>
                                <div className="flex justify-end mb-2">
                                     <button onClick={() => setIsCalendarOpen(false)}><X size={22} className={`text-[${COLORS.TEXT_DARK}]`} /></button>
                                </div>
                                <DateCalendarView monthInfo={janInfo} availableSlots={availableSlots} selectedDateKey={selectedDateKey} onSelectDate={handleDateSelection} COLORS={COLORS} />
                                <DateCalendarView monthInfo={febInfo} availableSlots={availableSlots} selectedDateKey={selectedDateKey} onSelectDate={handleDateSelection} COLORS={COLORS} />
                            </div>
                        )}
                    </div>
                    
                    {/* Time Slot Selection Anchor */}
                    <div ref={timeSectionRef}></div>

                    {selectedDateKey && !is2_20 && availableTimes.length > 0 && (
                        <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2">
                            <label className={`block text-sm font-bold mb-2 flex items-center gap-1`} style={{ color: COLORS.TEXT_HIGHLIGHT }}>
                                <Clock size={16} /> 請至少點選 2 個時段 (以利安排):
                            </label>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {DEFAULT_SLOTS_LIST.map(time => {
                                    const isAvailable = availableTimes.includes(time);
                                    const isSelected = selectedTimes.some(s => s.date === selectedDateKey && s.time === time);
                                    
                                    return (
                                        <button
                                            key={time}
                                            onClick={() => isAvailable && handleTimeToggle(time)}
                                            disabled={!isAvailable}
                                            className={`
                                                relative h-12 flex items-center justify-center rounded-lg text-sm font-bold transition-all
                                                ${isAvailable ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-not-allowed opacity-60'}
                                            `}
                                            style={{
                                                backgroundColor: isSelected ? COLORS.OPEN_BOOKING : isAvailable ? COLORS.SLOT_AVAILABLE + '20' : COLORS.SLOT_DISABLED,
                                                color: isSelected ? 'white' : isAvailable ? COLORS.TEXT_DARK : COLORS.TEXT_DISABLED,
                                                border: isSelected ? `2px solid ${COLORS.OPEN_BOOKING}` : isAvailable ? `1.5px solid ${COLORS.SLOT_AVAILABLE}` : `1px solid ${COLORS.TEXT_DISABLED}`
                                            }}
                                        >
                                            {time}
                                            {!isAvailable && <span className="ml-1 text-[10px] opacity-70">(已滿)</span>}
                                            {isSelected && <Check size={16} className="absolute top-1/2 -translate-y-1/2 right-1 text-white" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Selected Slots Summary List */}
                    {selectedTimes.length > 0 && (
                        <div className="mt-4 p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                             <label className="block text-sm font-bold mb-2 text-[#15803d] flex items-center gap-1">
                                <CheckCircle size={16}/> 已加入的預約時段 ({selectedTimes.length}):
                             </label>
                             <div className="flex flex-wrap gap-2">
                                {selectedTimes.map((slot, index) => (
                                    <div key={`${slot.date}-${slot.time}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#86EFAC] rounded-full text-xs font-bold text-[#166534] shadow-sm">
                                        <span>{slot.date.substring(5)} {getDayOfWeek(slot.date)} {slot.time}</span>
                                        <button 
                                            onClick={() => removeSelectedSlot(index)}
                                            className="hover:text-red-500 ml-1 p-0.5"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>

                {/* 3. Removal Option */}
                <div>
                    <label className={`block text-sm font-bold mb-2 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                        <Eraser size={16} /> 需要卸甲嗎:
                    </label>
                    
                    {/* Level 1: Main Toggle */}
                    <div className="flex gap-2 mb-3">
                        {REMOVAL_MAIN_OPTS.map(opt => {
                            const isExtendRemoval = opt === '卸延甲';
                            const isSelected = removalType === opt;
                            return (
                                <button
                                    key={opt}
                                    onClick={() => handleRemovalMainSelect(opt)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all flex flex-col items-center justify-center h-12 hover:scale-[1.02] active:scale-95`} // Reduced height h-16 -> h-12
                                    style={{
                                        borderColor: isSelected ? COLORS.OPEN_BOOKING : COLORS.ACCENT_PALE,
                                        backgroundColor: isSelected ? COLORS.OPEN_BOOKING : 'transparent',
                                        color: isSelected ? 'white' : COLORS.TEXT_NORMAL
                                    }}
                                >
                                    <span>{opt}</span>
                                    {isExtendRemoval && (
                                        <span className={`text-xs ${isSelected ? 'text-white' : 'text-[#B55745]'}`}>$200</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Level 2: Details (Only if '需要' is selected) */}
                    {removalType === '需要' && (
                        <div className="animate-in fade-in-0 slide-in-from-left-2 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                {REMOVAL_DETAIL_OPTS.map(detail => {
                                    const isSelected = removalDetail === detail.name;
                                    return (
                                        <button
                                            key={detail.name}
                                            onClick={() => setRemovalDetail(detail.name)}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold border-2 flex flex-col items-center justify-center transition-all h-12 hover:scale-[1.02] active:scale-95`} // Reduced height h-16 -> h-12
                                            style={{
                                                borderColor: isSelected ? COLORS.OPEN_BOOKING : COLORS.ACCENT_PALE,
                                                backgroundColor: isSelected ? COLORS.OPEN_BOOKING : 'transparent',
                                                color: isSelected ? 'white' : COLORS.TEXT_NORMAL
                                            }}
                                        >
                                            <span>{detail.name}</span>
                                            <span style={{ color: isSelected ? 'white' : COLORS.TEXT_HIGHLIGHT }}>{detail.price}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            
                            <div className="p-3 rounded-xl flex items-start gap-2" style={{ backgroundColor: '#FFF5F5', border: `1px dashed ${COLORS.TEXT_HIGHLIGHT}` }}>
                                <Gift size={16} className="shrink-0 mt-0.5" style={{ color: COLORS.TEXT_HIGHLIGHT }} />
                                <div>
                                    <p className="text-xs font-bold" style={{ color: COLORS.TEXT_DARK }}>他店續作優惠 (首次新客)：</p>
                                    <p className="text-xs" style={{ color: COLORS.TEXT_NORMAL }}>
                                        卸甲特價 <span className="font-black" style={{ color: COLORS.TEXT_HIGHLIGHT }}>$200</span> 
                                        <span className="opacity-50 line-through ml-1"> (原價 $300)</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Service Selection */}
                <div>
                    <label className={`block text-sm font-bold mb-2 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                        <Sparkles size={16} /> 選擇項目:
                    </label>
                    
                    <div className="flex overflow-x-auto gap-2 pb-2 mb-2 no-scrollbar">
                        {SERVICE_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1 hover:scale-[1.05] active:scale-95`}
                                style={{
                                    backgroundColor: selectedCategory === cat.id ? COLORS.CAL_ACCENT : COLORS.BG_OUTER,
                                    color: selectedCategory === cat.id ? 'white' : COLORS.TEXT_NORMAL,
                                    border: selectedCategory === cat.id ? 'none' : `1px solid ${COLORS.ACCENT_PALE}`
                                }}
                            >
                                {cat.icon} {cat.name}
                            </button>
                        ))}
                    </div>
                    
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: #F0E8E6; border-radius: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D6A5A3; border-radius: 4px; }
                    `}</style>

                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {SERVICE_ITEMS[selectedCategory].map((item) => {
                            const isSelected = selectedService?.id === item.id;
                            const isRestricted = isRestrictedDate(selectedDateKey) && !isServiceAllowedOnRestrictedDate(item);
                            
                            return (
                                <div 
                                    key={item.id}
                                    onClick={() => handleServiceSelect(item)}
                                    className={`p-4 rounded-xl border-2 transition-all relative ${isRestricted ? 'cursor-not-allowed grayscale opacity-60' : 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]'}`}
                                    style={{
                                        borderColor: isSelected ? COLORS.OPEN_BOOKING : 'transparent',
                                        backgroundColor: isRestricted ? '#f3f4f6' : isSelected ? COLORS.OPEN_BOOKING : COLORS.BG_OUTER,
                                        color: isSelected ? 'white' : undefined,
                                        opacity: isRestricted ? 0.6 : 1
                                    }}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold text-base`} style={{ color: isSelected ? 'white' : COLORS.TEXT_DARK }}>{item.name}</span>
                                        <div className="text-right">
                                            {item.originalPrice && (
                                                <span className="text-xs line-through mr-2 opacity-50" style={{ color: isSelected ? 'white' : COLORS.TEXT_NORMAL }}>
                                                    {item.originalPrice}
                                                </span>
                                            )}
                                            <span className={`font-black text-sm`} style={{ color: isSelected ? 'white' : COLORS.TEXT_HIGHLIGHT }}>{item.price}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : COLORS.TEXT_NORMAL }}>{item.note}</span>
                                        {item.time && <span className="text-xs font-bold" style={{ color: isSelected ? 'white' : COLORS.CAL_ACCENT }}>⏱ {item.time}</span>}
                                    </div>
                                    
                                    {isSelected && <div className="absolute top-3 right-3 text-white bg-white/20 rounded-full p-1"><Check size={14}/></div>}
                                </div>
                            )
                        })}
                    </div>
                     <div className="text-center text-xs text-gray-400 mt-2 flex items-center justify-center gap-1 animate-pulse">
                        <ArrowDown size={12}/> 上下滑動查看更多選項
                    </div>
                </div>

                {/* 5. Summary & Copy */}
                <div className="mt-6 pt-6 border-t-2 border-dashed" style={{ borderColor: COLORS.ACCENT_PALE }}>
                    <div className="flex justify-between items-end mb-2">
                         <label className={`block text-sm font-bold text-[${COLORS.TEXT_DARK}]`}>
                            預約內容預覽:
                        </label>
                        <span className="text-xs font-bold text-[#B55745]">
                            *價格未包含過年加成
                        </span>
                    </div>
                    
                    <div className="bg-[#FAF9F8] p-4 rounded-xl text-sm leading-relaxed whitespace-pre-line mb-3 border-2" style={{ borderColor: COLORS.ACCENT_PALE, color: COLORS.TEXT_NORMAL }}>
                        {generateBookingText()}
                    </div>
                    
                    {validationMsg && (
                        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-bold text-center animate-in fade-in slide-in-from-top-1 whitespace-pre-line">
                            <AlertCircle size={16} className="inline mr-1 mb-0.5"/>
                            {validationMsg}
                        </div>
                    )}
                    
                    {copySuccess && (
                        <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-bold text-center animate-in fade-in slide-in-from-top-1">
                            ✅ 已複製！有完成卡位才會傳送定金資訊，請勿著急等待回復
                        </div>
                    )}

                    <button
                        onClick={handleCopy}
                        className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md`}
                        style={{ 
                            backgroundColor: copySuccess ? COLORS.SLOT_AVAILABLE : COLORS.OPEN_BOOKING 
                        }}
                    >
                        {copySuccess ? <CheckCircle size={24} /> : <Copy size={24} />}
                        {copySuccess ? "已複製 (點擊再次複製)" : "複製預約資訊"}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- ADMIN DATA EDITOR COMPONENT (Updated) ---
const DataEditor = ({ db, appId, availableSlots, janInfo, febInfo, COLORS }) => {
    
    const [selectedDate, setSelectedDate] = useState('2026-01-14');
    const [activeSlots, setActiveSlots] = useState(DEFAULT_SLOTS_LIST); 
    const [message, setMessage] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const handleDateSelection = (dateKey) => {
        setSelectedDate(dateKey);
        setIsCalendarOpen(false);
    };

    useEffect(() => {
        if (!selectedDate) return;
        
        const docData = availableSlots[selectedDate];
        if (docData) {
            const availableTimes = docData.slots.filter(s => s.available).map(s => s.time);
            setActiveSlots(availableTimes); 
        } else {
            setActiveSlots(DEFAULT_SLOTS_LIST);
        }
        setMessage('');
    }, [selectedDate, availableSlots]);

    const toggleSlot = (time) => {
        if (activeSlots.includes(time)) {
            setActiveSlots(prev => prev.filter(t => t !== time));
        } else {
            setActiveSlots(prev => [...prev, time].sort()); 
        }
    };

    const handleSave = async () => {
        if (!db || !appId || !selectedDate) {
            setMessage("錯誤：資料庫未準備好或未選取日期。");
            return;
        }

        const newSlots = activeSlots.map(time => ({ time: time, available: true }));
        const docPath = `/artifacts/${appId}/public/data/available_slots/${selectedDate}`;

        try {
            await setDoc(doc(db, docPath), { 
                slots: newSlots, 
                isFullyBooked: newSlots.length === 0,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            setMessage(`✅ ${selectedDate} 同步成功！`);
        } catch (error) {
            console.error("Error", error);
            setMessage(`❌ 失敗：${error.message}`);
        }
    };

    return (
        <div className="bg-white p-5 rounded-2xl shadow-lg mt-8" style={{ border: `2px solid ${COLORS.TEXT_HIGHLIGHT}` }}>
            <h3 className={`font-black text-xl mb-3 flex items-center gap-2`} style={{ color: COLORS.TEXT_HIGHLIGHT }}>
                <Database size={20} /> 🛠️ 管理員後台 (點擊開關時段)
            </h3>
            <p className={`text-sm mb-4 text-[${COLORS.TEXT_NORMAL}]`}>
                <span className="font-bold text-red-500">注意：</span> 
                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded mx-1">綠色</span> = 開放，
                <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-500 rounded mx-1">灰色</span> = 關閉。<br/>
                確認無誤後請按<span className="font-bold underline">同步</span>。
            </p>
            
            <div className="space-y-4">
                <div className="relative">
                    <label className={`block text-sm font-bold mb-1 text-[${COLORS.TEXT_DARK}] flex items-center gap-1`}>
                        <Calendar size={16} className={`text-[${COLORS.CAL_ACCENT}]`} /> 編輯日期:
                    </label>
                    <button
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className={`w-full p-3 border-2 rounded-xl text-left text-base font-semibold flex justify-between items-center transition-all hover:bg-opacity-80 cursor-pointer relative`}
                        style={{ borderColor: COLORS.CAL_ACCENT, color: COLORS.TEXT_DARK, backgroundColor: COLORS.BG_OUTER }}
                    >
                        {selectedDate 
                            ? `${selectedDate.substring(5)} ${getDayOfWeek(selectedDate)}`
                            : '-- 點擊選擇要修改的日期 --'}
                        <ArrowDown size={16} className={`text-[${COLORS.TEXT_DARK}] transition-transform ${isCalendarOpen ? 'rotate-180' : 'rotate-0'}`} />
                    </button>

                    {isCalendarOpen && (
                        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 p-3 rounded-2xl shadow-xl border-2 animate-in fade-in-0 slide-in-from-bottom-2" style={{ backgroundColor: COLORS.BG_LIGHT, borderColor: COLORS.CAL_ACCENT }}>
                            <h3 className={`font-bold text-lg mb-2 flex items-center justify-between px-1`} style={{ color: COLORS.TEXT_DARK }}>
                                選擇編輯日期
                                <button onClick={() => setIsCalendarOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                                     <X size={18} className={`text-[${COLORS.TEXT_DARK}]`} />
                                </button>
                            </h3>
                            <DateCalendarView monthInfo={janInfo} availableSlots={availableSlots} selectedDateKey={selectedDate} onSelectDate={handleDateSelection} COLORS={COLORS} isAdmin={true} />
                            <DateCalendarView monthInfo={febInfo} availableSlots={availableSlots} selectedDateKey={selectedDate} onSelectDate={handleDateSelection} COLORS={COLORS} isAdmin={true} />
                        </div>
                    )}
                </div>
                
                <label className={`block text-sm font-bold mb-2 text-[${COLORS.TEXT_DARK}] flex items-center gap-1 mt-4`}>
                    <Clock size={16} className={`text-[${COLORS.CAL_ACCENT}]`} /> 設定該日空檔狀態:
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {DEFAULT_SLOTS_LIST.map(time => {
                        const isActive = activeSlots.includes(time);
                        return (
                            <button
                                key={time}
                                onClick={() => toggleSlot(time)}
                                className={`h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all shadow-sm`}
                                style={{
                                    backgroundColor: isActive ? COLORS.SLOT_AVAILABLE : COLORS.SLOT_DISABLED,
                                    color: isActive ? 'white' : COLORS.TEXT_DISABLED,
                                    opacity: isActive ? 1 : 0.7
                                }}
                            >
                                {time} {isActive ? '' : '(關)'}
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={handleSave} 
                    className={`w-full py-3 rounded-xl text-white font-bold text-base transition-colors hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-2`}
                    style={{ backgroundColor: COLORS.TEXT_HIGHLIGHT }}
                    disabled={!selectedDate}
                >
                    同步至日曆 (確認修改)
                </button>
                
                {message && (
                    <p className={`text-sm font-bold p-2 rounded-lg text-center`} style={{ color: COLORS.TEXT_HIGHLIGHT, backgroundColor: COLORS.TEXT_HIGHLIGHT + '15' }}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};


// Main App Component
const App = () => {
  const janDays = 31;
  const janStartDay = 4; 
  const febDays = 28;
  const febStartDay = 0; 

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [availableSlots, setAvailableSlots] = useState({}); 

  const [selectedDateInfo, setSelectedDateInfo] = useState(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showScrollGuide, setShowScrollGuide] = useState(true);
  const detailedRulesRef = useRef(null);
  
  const [showAdmin, setShowAdmin] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleSecretAdminTrigger = () => {
      setClickCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 5) { 
              setShowAdmin(prevAdmin => !prevAdmin); 
              return 0; 
          }
          return newCount;
      });
  };
  
  const janInfo = { days: janDays, start: janStartDay, month: 1 };
  const febInfo = { days: febDays, start: febStartDay, month: 2 };

  useEffect(() => {
    setLogLevel('error'); 
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    try {
      const firebaseConfig = {
  apiKey: "AIzaSyDYe4y-PkCxxhl9SWGigrPNoZwBb5UpxZA",
  authDomain: "my-nail-booking.firebaseapp.com",
  projectId: "my-nail-booking",
  storageBucket: "my-nail-booking.firebasestorage.app",
  messagingSenderId: "696974969394",
  appId: "1:696974969394:web:5b53b2f6a0363480490a2b",
  measurementId: "G-SZGWBDJBRH"
};
      if (!app) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
      }
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
          try {
            if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
            else await signInAnonymously(auth);
          } catch (error) { console.error("Auth failed:", error); }
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) { console.error("Firebase setup failed:", e); setIsAuthReady(true); }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const q = query(collection(db, `/artifacts/${appId}/public/data/available_slots`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newSlots = {};
      snapshot.forEach((doc) => { newSlots[doc.id] = doc.data(); });
      setAvailableSlots(newSlots);
    });
    return () => unsubscribe();
  }, [isAuthReady]); 
  
  useEffect(() => {
    const handleScroll = () => {
      const isAtBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 50);
      setShowScrollGuide(!isAtBottom);
      setShowScrollToTop(isAtBottom);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToDetailedRules = () => detailedRulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  const handleDateClick = (day, month) => {
    const dateKey = formatDate(day, month);
    const availableTimes = getSlotsForDate(dateKey, availableSlots);

    // --- UPDATED LOGIC: Normal Line System check ---
    const dateParts = dateKey.split('-');
    const m = parseInt(dateParts[1]);
    const d = parseInt(dateParts[2]);
    const isNormalLine = (m === 1 && d <= 13) || (m === 2 && d >= 23);

    let status = "normal";
    let title = "正常預約時段";
    let message = "此時段依照原價收費，無特殊限制。";
    let themeColor = COLORS.BG_DEFAULT_CIRCLE;
    let icon = <Calendar size={24} className={`text-[${COLORS.TEXT_DARK}]`} />;
    let customMessage = null; 

    // Override for Normal Line System Dates
    if (isNormalLine) {
       title = "正常預約時段";
       message = "請至官方LINE線上系統預約";
    }

    const isHoliday = (month === 2 && day >= 14 && day <= 22);
    const isOpenBookingDay = (month === 2 && day === 20);
    const isRestrictedAndSurcharge = (month === 2 && day >= 1 && day <= 13);
    const isSurchargeOnly = (month === 1 && day >= 14);

    if (isOpenBookingDay) {
      status = "openbooking";
      title = "三月預約開放日";
      message = "10:00 開放3月預約囉，請至官方LINE線上系統預約"; 
      themeColor = COLORS.OPEN_BOOKING;
      icon = <Calendar size={24} className="text-white" />;
    } else if (isHoliday) {
      status = "holiday";
      title = "春節公休";
      message = "闆娘休假去囉！我們 2/23 (一) 開工見，期間預約與訊息將會稍後回復您。新年快樂！";
      themeColor = COLORS.HOLIDAY;
      icon = <Heart size={24} className="text-white" fill="white" />;
    } else if (isRestrictedAndSurcharge) {
      status = "restricted";
      title = "限制＋加價時段 (2/1 ~ 2/13)";
      message = "年前忙碌期，均加價+$100。\n‼️僅接造型款式❌期間暫不接透明/單色/純漸層/純卸甲/純保養";
      themeColor = COLORS.RESTRICTED;
      icon = <XCircle size={24} className={`text-[${COLORS.TEXT_DARK}]`} />;
    } else if (isSurchargeOnly) {
      status = "surcharge";
      title = "💰 加價時段 (1/14 ~ 1/31)";
      message = "年前忙碌期，均加價+$100。";
      themeColor = COLORS.SURCHARGE;
      icon = <DollarSign size={24} className={`text-[${COLORS.TEXT_DARK}]`} />;
    }
    
    // --- Dynamic Slot Logic ---
    if (!isHoliday && !isOpenBookingDay && !isNormalLine) {
        if (availableTimes.length === 0) {
            customMessage = (
                <div className="mt-3 p-3 rounded-lg border border-dashed" style={{ borderColor: COLORS.HOLIDAY, backgroundColor: COLORS.HOLIDAY + '10' }}>
                    <h4 className={`font-bold text-base mb-2 flex items-center gap-1`} style={{ color: COLORS.HOLIDAY }}>
                        <XCircle size={16} /> 本日預約已滿
                    </h4>
                    <p className={`mt-1 text-sm text-[${COLORS.TEXT_NORMAL}]`}>
                        此時段預約非常熱門，請嘗試其他日期。
                    </p>
                </div>
            );
        } else {
            customMessage = (
                <div className="mt-3 p-3 rounded-lg border border-dashed" style={{ borderColor: COLORS.SLOT_AVAILABLE, backgroundColor: COLORS.SLOT_AVAILABLE + '10' }}>
                    <h4 className={`font-bold text-base mb-2 flex items-center gap-1`} style={{ color: COLORS.SLOT_AVAILABLE }}>
                        <Clock size={16} /> 本日可預約時段 ({availableTimes.length} 個空檔)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {availableTimes.map(time => (
                            <span key={time} className={`px-2 py-1 text-xs font-bold rounded-full text-white`} style={{ backgroundColor: COLORS.SLOT_AVAILABLE }}>
                                {time}
                            </span>
                        ))}
                    </div>
                    <p className={`mt-3 text-sm font-semibold`} style={{ color: COLORS.TEXT_HIGHLIGHT }}>
                        請立即聯繫闆娘線上登記！
                    </p>
                </div>
            );
            if (status === "normal") {
               themeColor = COLORS.SLOT_AVAILABLE;
               icon = <Clock size={24} className="text-white" />;
            }
        }
    }
    
    const rawTheme = 
        status === "holiday" || status === "openbooking" || (availableTimes.length > 0 && status === "normal" && !isNormalLine)
            ? `bg-[${themeColor}] text-white`
            : `bg-[${themeColor}] text-[${COLORS.TEXT_DARK}]`;
    
    setSelectedDateInfo({
      date: `${month}/${day}`,
      status,
      title: status === 'holiday' ? `🧧 ${title}` : status === 'restricted' ? `⚠️ ${title}` : status === 'surcharge' ? `💰 ${title}` : title,
      message,
      themeColor,
      rawTheme,
      icon,
      customMessage
    });
  };

  const generateCalendar = (daysInMonth, startDay, monthIndex) => {
    let days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${monthIndex}-${i}`} className="flex flex-col items-center justify-start h-[3rem]"> <div className="h-7 w-7"></div><div className="h-1.5 mt-1"></div> </div>); 
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = formatDate(i, monthIndex);
      const availableTimes = getSlotsForDate(dateKey, availableSlots);
      const hasAvailableSlots = availableTimes.length > 0;
      const isLastSlot = availableTimes.length === 1;

      const isHoliday = (monthIndex === 2 && i >= 14 && i <= 22);
      const isRestrictedAndSurcharge = (monthIndex === 2 && i >= 1 && i <= 13);
      const isSurchargeOnly = (monthIndex === 1 && i >= 14);
      const isOpenBookingDay = (monthIndex === 2 && i === 20); 
      
      let containerClass = `rounded-full transition-all cursor-pointer hover:shadow-lg hover:scale-[1.05] active:scale-95 bg-[${COLORS.BG_DEFAULT_CIRCLE}] border border-white shadow-sm`;
      let textClass = `text-[${COLORS.TEXT_DARK}]`; 
      let indicator = <div className="h-1.5 mt-1"></div>; 

      if (isOpenBookingDay) {
        containerClass = `bg-[${COLORS.OPEN_BOOKING}] text-white shadow-lg border-2 border-white/50 rounded-full`; 
        textClass = "text-white font-black";
      } else if (isHoliday) {
        containerClass = `bg-[${COLORS.HOLIDAY}] text-white shadow-md rounded-full`; 
        textClass = "text-white font-bold";
      } else if (hasAvailableSlots) {
         if (isRestrictedAndSurcharge) {
            containerClass = `bg-[${COLORS.RESTRICTED}] text-[${COLORS.TEXT_DARK}] shadow-md border border-[${COLORS.ACCENT_PALE}] rounded-full`; 
         } else if (isSurchargeOnly) {
            containerClass = `bg-[${COLORS.SURCHARGE}] text-[${COLORS.TEXT_DARK}] shadow-sm border border-[${COLORS.ACCENT_PALE}] rounded-full`; 
         } else {
            containerClass = `bg-[${COLORS.BG_DEFAULT_CIRCLE}] text-[${COLORS.TEXT_DARK}] shadow-sm border border-[${COLORS.ACCENT_PALE}] rounded-full`; 
         }
         textClass = `text-[${COLORS.TEXT_DARK}] font-bold`;
         
         // Logic for Red/Green Dot
         if (isLastSlot) {
              indicator = ( <div className="w-1.5 h-1.5 rounded-full mt-1 shadow-md animate-pulse" style={{ backgroundColor: COLORS.TEXT_HIGHLIGHT }}></div> );
         } else {
              indicator = ( <div className="w-1.5 h-1.5 rounded-full mt-1 shadow-md" style={{ backgroundColor: COLORS.SLOT_AVAILABLE }}></div> );
         }
      } else if (isRestrictedAndSurcharge || isSurchargeOnly) {
         if (isRestrictedAndSurcharge) containerClass = `bg-[${COLORS.RESTRICTED}] text-[${COLORS.TEXT_DARK}] shadow-md border border-[${COLORS.ACCENT_PALE}] rounded-full opacity-80`;
         else containerClass = `bg-[${COLORS.SURCHARGE}] text-[${COLORS.TEXT_DARK}] shadow-sm border border-[${COLORS.ACCENT_PALE}] rounded-full opacity-80`;
      } else {
         containerClass = `bg-[${COLORS.BG_DEFAULT_CIRCLE}] text-[${COLORS.TEXT_NORMAL}] shadow-inner border border-[${COLORS.ACCENT_PALE}] rounded-full opacity-80`; 
         textClass = `text-[${COLORS.TEXT_NORMAL}]`;
      }

      days.push(
        <div key={i} className="flex flex-col items-center justify-start h-[3rem]">
          <div onClick={() => handleDateClick(i, monthIndex)} className={`flex items-center justify-center h-7 w-7 ${containerClass}`} >
            <div className={`text-xs ${textClass} z-10`}> {i} </div>
          </div>
          {indicator} 
        </div>
      );
    }
    return days;
  };
  
  return (
    <div className="min-h-screen font-sans flex justify-center py-6 sm:py-8 relative" style={{ backgroundColor: COLORS.BG_OUTER, color: COLORS.TEXT_NORMAL }}>
      {showScrollGuide && !selectedDateInfo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 p-2 pointer-events-none z-30 opacity-70 transition-opacity duration-300">
          <ArrowDown size={36} className="text-white animate-bounce shadow-xl rounded-full p-1" style={{ backgroundColor: COLORS.OPEN_BOOKING }} />
        </div>
      )}
      {showScrollToTop && (
        <button onClick={scrollToDetailedRules} className="fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-xl transition-opacity duration-300 animate-in fade-in active:scale-95 animate-bounce" style={{ backgroundColor: COLORS.OPEN_BOOKING, opacity: 0.9 }} title="跳回詳細規定">
          <ArrowUp size={24} className="text-white" />
        </button>
      )}
      {selectedDateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/10 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
              <div className={`p-4 flex items-center justify-between ${selectedDateInfo.rawTheme}`}>
                  <div className="flex items-center gap-3">
                     {selectedDateInfo.icon}
                     <span className="text-xl font-black tracking-wider">{selectedDateInfo.date}</span>
                  </div>
                  <button onClick={() => setSelectedDateInfo(null)} className="p-1 rounded-full hover:bg-black/10 transition-colors"> <X size={20} className="opacity-80" /> </button>
              </div>
              <div className="p-5">
                  <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 text-[${COLORS.TEXT_DARK}]`}> {selectedDateInfo.title} </h3>
                  <p className={`text-base leading-relaxed whitespace-pre-line text-[${COLORS.TEXT_NORMAL}]`}> {selectedDateInfo.message} </p>
                  {selectedDateInfo.customMessage}
                  <button onClick={() => setSelectedDateInfo(null)} className={`mt-5 w-full py-3 rounded-xl text-[${COLORS.TEXT_DARK}] font-bold text-base hover:bg-white transition-colors`} style={{ backgroundColor: COLORS.ACCENT_PALE, border: `1px solid ${COLORS.ACCENT_PALE}` }}>我知道了</button>
              </div>
           </div>
        </div>
      )}

      {/* Main Container - Full width on mobile by removing margins and border radius on small screens if desired, but keeping max-w-2xl for readability */}
      {/* To satisfy "full width on mobile", we remove padding/margins on small breakpoints */}
      <div className="w-full max-w-2xl shadow-2xl overflow-hidden sm:rounded-[2rem] sm:my-8" style={{ backgroundColor: COLORS.BG_LIGHT, border: `1px solid ${COLORS.ACCENT_PALE}` }}>
        
        {/* Header - Fixed order: Title -> Calendar */}
        <div className={`p-8 text-center relative overflow-hidden`} style={{ backgroundColor: COLORS.ACCENT_PALE }}>
          <div className={`absolute top-[-20px] left-[-20px] w-28 h-28 bg-white rounded-full opacity-60`}></div>
          <div className={`absolute bottom-[-15px] right-[-15px] w-36 h-36 rounded-full opacity-40`} style={{ backgroundColor: COLORS.CAL_ACCENT }}></div>
          <h1 className={`relative z-10 text-3xl font-bold tracking-widest mb-2 drop-shadow-sm opacity-80 text-[${COLORS.TEXT_DARK}]`}>2026</h1>
          <h2 className={`relative z-10 text-4xl font-black tracking-wider mb-2 text-[${COLORS.TEXT_DARK}]`}>年前預約公告</h2>
          <div className="relative z-10 flex justify-center gap-2">
            <span className="px-3 py-1 bg-white/50 rounded-full text-base font-bold tracking-widest backdrop-blur-sm animate-[pulse_0.75s_infinite]" style={{ color: COLORS.TEXT_DARK }}>點擊日曆圖塊查看詳情</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-8 space-y-8">
            
          {/* 1. Calendar (Visual Overview) - Moved to TOP as requested */}
          <div className="space-y-6 px-1">
             <div className="flex justify-center gap-4 text-sm font-bold text-[${COLORS.TEXT_NORMAL}]">
                 <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full shadow-md" style={{ backgroundColor: COLORS.SLOT_AVAILABLE }}></div><span>空檔</span></div>
                 <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full shadow-md animate-pulse" style={{ backgroundColor: COLORS.TEXT_HIGHLIGHT }}></div><span>🔥即將約滿</span></div>
                 <div className="flex items-center gap-1"><div className={`w-3 h-3 rounded-full opacity-80`} style={{ backgroundColor: COLORS.BG_DEFAULT_CIRCLE, border: `1px solid ${COLORS.ACCENT_PALE}` }}></div><span>已滿 / 休息</span></div>
             </div>
            <div className="relative">
              <h3 className={`text-center font-bold text-3xl mb-3 tracking-[0.2em] text-[${COLORS.CAL_ACCENT}]`} style={{fontFamily: 'serif'}}>JANUARY</h3>
              <div className="grid grid-cols-7 text-center mb-2 px-1">{['日', '一', '二', '三', '四', '五', '六'].map(d => (<div key={d} className={`text-xs font-bold uppercase text-[${COLORS.TEXT_NORMAL}]`}>{d}</div>))}</div>
              {/* Reduced gap from 3 to 1 */}
              <div className="grid grid-cols-7 gap-1 place-items-center"> {generateCalendar(janDays, janStartDay, 1)}</div>
            </div>
            <div className="relative pt-2">
              <h3 className={`text-center font-bold text-3xl mb-3 tracking-[0.2em] text-[${COLORS.CAL_ACCENT}]`} style={{fontFamily: 'serif'}}>FEBRUARY</h3>
              <div className="grid grid-cols-7 text-center mb-2 px-1">{['日', '一', '二', '三', '四', '五', '六'].map(d => (<div key={d} className={`text-xs font-bold uppercase text-[${COLORS.TEXT_NORMAL}]`}>{d}</div>))}</div>
              {/* Reduced gap from 3 to 1 */}
              <div className="grid grid-cols-7 gap-1 place-items-center">{generateCalendar(febDays, febStartDay, 2)}</div>
            </div>
          </div>
          
          {/* 2. Rules & Info */}
          <div ref={detailedRulesRef} className="bg-white p-5 rounded-2xl shadow-lg" style={{ border: `1px solid ${COLORS.ACCENT_PALE}` }}>
            <h3 className={`text-center text-base font-black mb-4 tracking-wider`} style={{ color: COLORS.TEXT_DARK }}><span className="inline-block mr-1">💅</span> 2026 年前預約須知總覽 <span className="inline-block ml-1">💅</span></h3>
            <div className={`p-4 rounded-xl space-y-4`} style={{ backgroundColor: COLORS.BG_OUTER, border: `1px solid ${COLORS.ACCENT_PALE}` }}>
                <h4 className={`font-extrabold text-base flex items-center gap-2 border-b pb-2`} style={{ color: COLORS.TEXT_DARK, borderColor: COLORS.ACCENT_PALE }}><Info size={16} className={`text-[${COLORS.CAL_ACCENT}]`}/> 詳細規定</h4>
                <div className={`text-sm text-[${COLORS.TEXT_NORMAL}]`}>
                    <span className={`font-bold text-[${COLORS.TEXT_DARK}]`}>【價格調整 (1/14起實施)】</span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        <li className={`text-[${COLORS.TEXT_NORMAL}]`}>當次消費總金額 (含卸甲)：<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}] inline-block`}>+$100</span></li>
                        <li className={`text-[${COLORS.TEXT_NORMAL}]`}>延甲單指：<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}] inline-block`}>+$150</span></li>
                        <li className={`text-[${COLORS.TEXT_NORMAL}]`}>延甲卸除續作：<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}] inline-block`}>+$200</span></li>
                    </ul>
                </div>
                <div className={`text-sm text-[${COLORS.TEXT_NORMAL}]`}>
                    <span className={`font-bold text-[${COLORS.TEXT_DARK}]`}>【項目限制 (限 2/1 ~ 2/13)】</span>
                    <p className="mt-1" style={{ color: COLORS.TEXT_NORMAL }}>
                        為確保年前服務速度，此期間<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>只接造型款式</span>，❌期間暫不接透明/單色/純漸層/純卸甲/純保養
                    </p>
                </div>
                <div className={`text-sm text-[${COLORS.TEXT_NORMAL}]`}>
                    <span className={`font-bold text-[${COLORS.TEXT_DARK}]`}>【重要日期】</span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        <li className={`text-[${COLORS.TEXT_NORMAL}]`}>春節公休：<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>2/14 ~ 2/22</span></li>
                        <li className={`text-[${COLORS.TEXT_NORMAL}]`}>正式開工日：<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>2/23 (一)</span></li>
                        <li className={`text-[${COLORS.TEXT_HIGHLIGHT}] font-bold underline`}>3月預約開放：<span className="font-black">2/20 (五) 10:00</span></li>
                    </ul>
                </div>
            </div>
            <p className={`text-center text-base font-bold mt-4 flex items-center justify-center gap-2 text-[${COLORS.TEXT_DARK}]`}><Info size={18} className={`text-[${COLORS.CAL_ACCENT}]`} /> 點擊日期查看詳情</p>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm" style={{ border: `1px solid ${COLORS.ACCENT_PALE}` }}>
                 <div className="flex items-center gap-2 mb-3"><AlertCircle size={18} className={`text-[${COLORS.CAL_ACCENT}]`} /><h4 className={`font-bold text-[${COLORS.TEXT_DARK}]`}>預約須知</h4></div>
                 <div className="space-y-3">
                    <div className={`flex gap-3 text-sm text-[${COLORS.TEXT_NORMAL}]`}><span className={`font-bold shrink-0 text-[${COLORS.CAL_ACCENT}]`}>01</span><p>定金：單項<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>$500</span> / 手足<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>$1000</span> 請於<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>2小時內</span>匯款，逾時釋出。</p></div>
                    <div className={`flex gap-3 text-sm text-[${COLORS.TEXT_NORMAL}]`}><span className={`font-bold shrink-0 text-[${COLORS.CAL_ACCENT}]`}>02</span><p>遲到滿10分鐘自動取消，<span className={`text-[${COLORS.TEXT_HIGHLIGHT}] font-bold underline`}>不退定金</span>。時間以「坐下操作」為準。</p></div>
                    <div className={`flex gap-3 text-sm text-[${COLORS.TEXT_NORMAL}]`}><span className={`font-bold shrink-0 text-[${COLORS.CAL_ACCENT}]`}>03</span><p>熱門時段<span className={`font-bold underline text-[${COLORS.TEXT_HIGHLIGHT}]`}>不可更改時間</span>，臨時取消將鎖定帳號。請確認再預約。</p></div>
                 </div>
                 <div className={`mt-4 text-white p-3 rounded-xl text-center shadow-lg`} style={{ backgroundColor: COLORS.OPEN_BOOKING }}><p className="text-sm font-bold tracking-wide">⚠️ 請先由闆娘線上登記<br/><span className="text-[#F1E4EC]">確認後再匯款才算成功哦！</span></p></div>
            </div>
          </div>
          
          <BookingForm availableSlots={availableSlots} janInfo={janInfo} febInfo={febInfo} COLORS={COLORS} getDayOfWeek={getDayOfWeek} />

          {isAuthReady && db && showAdmin && (
             <DataEditor db={db} appId={typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'} availableSlots={availableSlots} janInfo={janInfo} febInfo={febInfo} COLORS={COLORS} />
          )}
          
          <div className="mt-4 text-center pb-8" onClick={handleSecretAdminTrigger}>
             <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full cursor-pointer select-none" style={{ color: COLORS.TEXT_NORMAL, backgroundColor: COLORS.ACCENT_PALE + '80' }}>
                <Heart size={10} fill={COLORS.HEART_PINK} className="" style={{ color: COLORS.HEART_PINK }} />
                <span className="text-xs tracking-[0.2em] font-medium">THANK YOU</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
