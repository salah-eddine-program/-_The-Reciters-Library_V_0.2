document.addEventListener('DOMContentLoaded', () => {
    // ============ المتغيرات الأساسية ============
    
    // عناصر DOM الموجودة
    const recitersContainer = document.getElementById('reciters-container');
    const surahsContainer = document.getElementById('surahs-container');
    const audioPlayer = document.getElementById('audio-player');
    const currentReciterLabel = document.getElementById('current-reciter-label');
    const currentSurahLabel = document.getElementById('current-surah-label');
    const themeToggle = document.getElementById('theme-toggle');
    const riwayaFilter = document.getElementById('riwaya-filter');
    const reciterSearchInput = document.getElementById('reciter-search');
    const surahSearchInput = document.getElementById('surah-search');
    const saveBookmarkBtn = document.getElementById('save-bookmark-btn');
    const loadBookmarkBtn = document.getElementById('load-bookmark-btn');
    const downloadSurahBtn = document.getElementById('download-surah-btn');
    const downloadMushafBtn = document.getElementById('download-mushaf-btn');
    const recitersCount = document.getElementById('reciters-count');
    const surahsCount = document.getElementById('surahs-count');

    // عناصر DOM الجديدة للتشغيل التلقائي
    const autoNextSurahCheckbox = document.getElementById('auto-next-surah');
    const autoNextReciterCheckbox = document.getElementById('auto-next-reciter');
    const repeatModeCheckbox = document.getElementById('repeat-mode');

    // عناصر DOM للتاريخ ومواقيت الصلاة
    const hijriDateElement = document.getElementById('hijri-date');
    const gregorianDateElement = document.getElementById('gregorian-date');
    const nextPrayerElement = document.getElementById('next-prayer');
    
    // عناصر DOM لصفحة "حول الموقع"
    const aboutPageBtn = document.getElementById('about-page-btn');
    const aboutPage = document.getElementById('about-page');
    const closeAboutBtn = document.getElementById('close-about-btn');

    // متغيرات البيانات
    let allReciters = [];
    let allSurahs = [];
    let allRiwayat = [];
    let selectedReciter = null;
    let selectedSurah = null;
    let currentReciterCard = null;
    let currentSurahCard = null;
    
    // متغيرات التشغيل التلقائي الجديدة
    let isAutoNextSurah = false;
    let isAutoNextReciter = false;
    let isRepeatMode = false;

    // إعدادات API
    const apiBaseUrl = 'https://www.mp3quran.net/api/v3';
    const CACHE_DURATION = 300000; // 5 دقائق
    const RIWAYAT_CACHE_DURATION = 1800000; // 30 دقيقة

    // ============ دوال التاريخ الهجري ومواقيت الصلاة ============
    
    // دالة تحميل التاريخ الهجري
    async function loadHijriDate() {
        try {
            const response = await axios.get('https://api.aladhan.com/v1/gToH', {
                timeout: 5000
            });
            
            if (response.data && response.data.data) {
                const hijriData = response.data.data.hijri;
                const gregorianData = response.data.data.gregorian;
                
                // تحديث التاريخ الهجري
                const hijriDate = `${hijriData.day} ${hijriData.month.ar} ${hijriData.year} هـ`;
                hijriDateElement.textContent = hijriDate;
                
                // تحديث التاريخ الميلادي
                const gregorianDate = `${gregorianData.day} ${getArabicMonth(gregorianData.month.number)} ${gregorianData.year} م`;
                gregorianDateElement.textContent = gregorianDate;
                
                console.log('تم تحميل التاريخ الهجري بنجاح');
            }
        } catch (error) {
            console.error('خطأ في تحميل التاريخ الهجري:', error);
            hijriDateElement.textContent = 'غير متاح';
            gregorianDateElement.textContent = new Date().toLocaleDateString('ar-SA');
        }
    }

    // دالة تحميل مواقيت الصلاة
    async function loadPrayerTimes() {
        try {
            // الحصول على الموقع الجغرافي
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        await fetchPrayerTimes(latitude, longitude);
                    },
                    () => {
                        // في حالة فشل الحصول على الموقع، استخدم مكة المكرمة كافتراضي
                        fetchPrayerTimes(21.4225, 39.8262);
                    }
                );
            } else {
                // استخدم مكة المكرمة كافتراضي
                fetchPrayerTimes(21.4225, 39.8262);
            }
        } catch (error) {
            console.error('خطأ في تحميل مواقيت الصلاة:', error);
            nextPrayerElement.textContent = 'غير متاح';
        }
    }

    // دالة جلب مواقيت الصلاة من API
    async function fetchPrayerTimes(latitude, longitude) {
        try {
            const response = await axios.get(`https://api.aladhan.com/v1/timings`, {
                params: {
                    latitude: latitude,
                    longitude: longitude,
                    method: 4 // طريقة أم القرى
                },
                timeout: 5000
            });

            if (response.data && response.data.data) {
                const timings = response.data.data.timings;
                const nextPrayer = getNextPrayer(timings);
                nextPrayerElement.textContent = nextPrayer;
                
                console.log('تم تحميل مواقيت الصلاة بنجاح');
            }
        } catch (error) {
            console.error('خطأ في جلب مواقيت الصلاة:', error);
            nextPrayerElement.textContent = 'غير متاح';
        }
    }

    // دالة تحديد الصلاة القادمة
    function getNextPrayer(timings) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = [
            { name: 'الفجر', time: timings.Fajr, key: 'Fajr' },
            { name: 'الظهر', time: timings.Dhuhr, key: 'Dhuhr' },
            { name: 'العصر', time: timings.Asr, key: 'Asr' },
            { name: 'المغرب', time: timings.Maghrib, key: 'Maghrib' },
            { name: 'العشاء', time: timings.Isha, key: 'Isha' }
        ];

        // تحويل أوقات الصلاة إلى دقائق
        const prayerTimes = prayers.map(prayer => {
            const [hours, minutes] = prayer.time.split(':');
            return {
                ...prayer,
                totalMinutes: parseInt(hours) * 60 + parseInt(minutes)
            };
        });

        // البحث عن الصلاة القادمة
        for (let prayer of prayerTimes) {
            if (prayer.totalMinutes > currentTime) {
                const timeLeft = prayer.totalMinutes - currentTime;
                const hoursLeft = Math.floor(timeLeft / 60);
                const minutesLeft = timeLeft % 60;
                
                if (hoursLeft > 0) {
                    return `${prayer.name} خلال ${hoursLeft} ساعة و ${minutesLeft} دقيقة`;
                } else {
                    return `${prayer.name} خلال ${minutesLeft} دقيقة`;
                }
            }
        }

        // إذا لم تتبق صلوات اليوم، فالصلاة القادمة هي فجر الغد
        const fajrTime = prayerTimes[0].totalMinutes;
        const timeUntilFajr = (24 * 60) - currentTime + fajrTime;
        const hoursLeft = Math.floor(timeUntilFajr / 60);
        const minutesLeft = timeUntilFajr % 60;
        
        return `فجر الغد خلال ${hoursLeft} ساعة و ${minutesLeft} دقيقة`;
    }

    // دالة تحويل رقم الشهر إلى اسم عربي
    function getArabicMonth(monthNumber) {
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        return months[monthNumber - 1];
    }

    // ============ دوال صفحة "حول الموقع" ============
    
    // إظهار صفحة حول الموقع
    function showAboutPage() {
        aboutPage.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // إخفاء صفحة حول الموقع
    function hideAboutPage() {
        aboutPage.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    // ============ دوال التشغيل التلقائي المحسنة ============

    // دالة إعداد التشغيل التلقائي المحسن
    function setupAutoPlayAdvanced() {
        if (audioPlayer) {
            audioPlayer.addEventListener('ended', handleAudioEnded);
        }

        // إعداد مستمعي الأحداث للإعدادات
        if (autoNextSurahCheckbox) {
            autoNextSurahCheckbox.addEventListener('change', (e) => {
                isAutoNextSurah = e.target.checked;
                saveAutoPlaySettings();
                showNotification(
                    isAutoNextSurah ? 'تم تفعيل التنقل التلقائي بين السور' : 'تم إيقاف التنقل التلقائي بين السور',
                    'info'
                );
            });
        }

        if (autoNextReciterCheckbox) {
            autoNextReciterCheckbox.addEventListener('change', (e) => {
                isAutoNextReciter = e.target.checked;
                saveAutoPlaySettings();
                showNotification(
                    isAutoNextReciter ? 'تم تفعيل التنقل التلقائي بين القراء' : 'تم إيقاف التنقل التلقائي بين القراء',
                    'info'
                );
            });
        }

        if (repeatModeCheckbox) {
            repeatModeCheckbox.addEventListener('change', (e) => {
                isRepeatMode = e.target.checked;
                saveAutoPlaySettings();
                showNotification(
                    isRepeatMode ? 'تم تفعيل الإعادة المستمرة' : 'تم إيقاف الإعادة المستمرة',
                    'info'
                );
            });
        }

        // تحميل الإعدادات المحفوظة
        loadAutoPlaySettings();
    }

    // دالة معالجة انتهاء الصوت
    function handleAudioEnded() {
        console.log('انتهى تشغيل الصوت');

        if (isAutoNextSurah && selectedSurah && allSurahs.length > 0) {
            const currentSurahIndex = allSurahs.findIndex(s => s.id == selectedSurah.id);
            
            if (currentSurahIndex >= 0 && currentSurahIndex < allSurahs.length - 1) {
                // الانتقال للسورة التالية
                goToNextSurah();
            } else if (isAutoNextReciter && selectedReciter && allReciters.length > 0) {
                // انتهت السور، الانتقال للقارئ التالي
                goToNextReciter();
            } else if (isRepeatMode) {
                // إعادة التشغيل من البداية
                restartPlayback();
            } else {
                showNotification('انتهت قائمة التشغيل', 'info');
            }
        } else if (isRepeatMode) {
            // إعادة تشغيل نفس السورة
            audioPlayer.currentTime = 0;
            audioPlayer.play();
        }
    }

    // دالة الانتقال للسورة التالية
    function goToNextSurah() {
        if (!selectedSurah || allSurahs.length === 0) return;

        const currentIndex = allSurahs.findIndex(s => s.id == selectedSurah.id);
        if (currentIndex >= 0 && currentIndex < allSurahs.length - 1) {
            const nextSurah = allSurahs[currentIndex + 1];
            const nextSurahCard = document.querySelector(`.surah[data-id="${nextSurah.id}"]`);
            
            if (nextSurahCard) {
                selectSurah(nextSurahCard);
                highlightCurrentCard(nextSurahCard);
                showNotification(`تم الانتقال إلى: ${nextSurah.name}`, 'success');
            }
        }
    }

    // دالة الانتقال للقارئ التالي
    function goToNextReciter() {
        if (!selectedReciter || allReciters.length === 0) return;

        const currentIndex = allReciters.findIndex(r => r.id == selectedReciter.id);
        let nextIndex = currentIndex + 1;

        // إذا وصلنا لآخر قارئ وكان الوضع المستمر مفعل، نبدأ من الأول
        if (nextIndex >= allReciters.length) {
            if (isRepeatMode) {
                nextIndex = 0;
            } else {
                showNotification('انتهت قائمة القراء', 'info');
                return;
            }
        }

        const nextReciter = allReciters[nextIndex];
        const nextReciterCard = document.querySelector(`.reciter[data-id="${nextReciter.id}"]`);
        
        if (nextReciterCard) {
            selectReciter(nextReciterCard);
            highlightCurrentCard(nextReciterCard);
            
            // العودة للسورة الأولى
            if (allSurahs.length > 0) {
                const firstSurah = allSurahs[0];
                const firstSurahCard = document.querySelector(`.surah[data-id="${firstSurah.id}"]`);
                if (firstSurahCard) {
                    selectSurah(firstSurahCard);
                    highlightCurrentCard(firstSurahCard);
                }
            }
            
            showNotification(`تم الانتقال إلى القارئ: ${nextReciter.name}`, 'success');
        }
    }

    // دالة إعادة التشغيل من البداية
    function restartPlayback() {
        if (allReciters.length > 0 && allSurahs.length > 0) {
            const firstReciter = allReciters[0];
            const firstSurah = allSurahs[0];
            
            const firstReciterCard = document.querySelector(`.reciter[data-id="${firstReciter.id}"]`);
            const firstSurahCard = document.querySelector(`.surah[data-id="${firstSurah.id}"]`);
            
            if (firstReciterCard && firstSurahCard) {
                selectReciter(firstReciterCard);
                selectSurah(firstSurahCard);
                highlightCurrentCard(firstReciterCard);
                highlightCurrentCard(firstSurahCard);
                showNotification('تم إعادة التشغيل من البداية', 'info');
            }
        }
    }

    // دالة إبراز الكارت الحالي
    function highlightCurrentCard(card) {
        // إزالة التأثير من جميع الكروت
        document.querySelectorAll('.card').forEach(c => c.classList.remove('auto-playing'));
        
        // إضافة التأثير للكارت الحالي
        if (card) {
            card.classList.add('auto-playing');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // دالة حفظ إعدادات التشغيل التلقائي
    function saveAutoPlaySettings() {
        const settings = {
            autoNextSurah: isAutoNextSurah,
            autoNextReciter: isAutoNextReciter,
            repeatMode: isRepeatMode
        };
        localStorage.setItem('autoplay_settings', JSON.stringify(settings));
    }

    // دالة تحميل إعدادات التشغيل التلقائي
    function loadAutoPlaySettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('autoplay_settings') || '{}');
            
            isAutoNextSurah = settings.autoNextSurah || false;
            isAutoNextReciter = settings.autoNextReciter || false;
            isRepeatMode = settings.repeatMode || false;

            // تحديث واجهة المستخدم
            if (autoNextSurahCheckbox) autoNextSurahCheckbox.checked = isAutoNextSurah;
            if (autoNextReciterCheckbox) autoNextReciterCheckbox.checked = isAutoNextReciter;
            if (repeatModeCheckbox) repeatModeCheckbox.checked = isRepeatMode;
        } catch (error) {
            console.error('خطأ في تحميل إعدادات التشغيل التلقائي:', error);
        }
    }

    // ============ الدوال المساعدة ============
    
    // دالة إنشاء البطاقات المحسنة
    function createOptimizedCard(text, type, dataId, clickHandler) {
        const card = document.createElement('div');
        card.className = `card ${type}`;
        card.textContent = text;
        card.dataset.id = dataId;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${type}: ${text}`);

        // إضافة مستمع الأحداث مع debounce
        let timeout;
        card.addEventListener('click', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => clickHandler(card), 200);
        });

        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler(card);
            }
        });

        return card;
    }

    // دالة إنشاء البطاقات الأساسية
    function createCard(text, type, dataId, clickHandler) {
        const card = document.createElement('div');
        card.className = `card ${type}`;
        card.textContent = text;
        card.dataset.id = dataId;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${type}: ${text}`);

        card.addEventListener('click', () => clickHandler(card));
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler(card);
            }
        });

        return card;
    }

    // دالة إنشاء مؤشر التحميل
    function createLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري التحميل...`;
        return spinner;
    }

    // دالة إزالة مؤشر التحميل
    function removeLoadingSpinner(container) {
        const spinner = container.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    }

    // دالة التخزين المؤقت
    function getCachedData(key, maxAge = CACHE_DURATION) {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const parsedData = JSON.parse(cached);
                const isExpired = Date.now() - parsedData.timestamp > maxAge;
                if (!isExpired) {
                    return parsedData.data;
                }
            }
        } catch (error) {
            console.error('خطأ في قراءة البيانات المخزنة:', error);
        }
        return null;
    }

    // دالة حفظ البيانات في التخزين المؤقت
    function setCachedData(key, data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
        }
    }

    // دالة عرض الإشعارات
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // تطبيق الأنماط مباشرة
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            backgroundColor: type === 'success' ? '#4caf50' : 
                           type === 'error' ? '#f44336' : 
                           type === 'warning' ? '#ff9800' : '#2196f3',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10000',
            fontFamily: 'Cairo, sans-serif',
            fontSize: '0.9rem',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // دالة معالجة الأخطاء
    function displayErrorMessage(container, title, message) {
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>${title}</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i>
                    إعادة المحاولة
                </button>
            </div>
        `;
    }

    // ============ دوال تحميل البيانات ============
    
    // دالة تحميل الروايات المحسنة
    async function loadRiwayatOptimized() {
        try {
            console.log('بدء تحميل الروايات...');
            
            // محاولة تحميل من التخزين المؤقت أولاً
            const cachedRiwayat = getCachedData('riwayat_cache', RIWAYAT_CACHE_DURATION);
            if (cachedRiwayat) {
                allRiwayat = cachedRiwayat;
                await displayRiwayatInSelect(allRiwayat);
                setupRiwayaFilterListener(allRiwayat);
                console.log('تم تحميل الروايات من التخزين المؤقت');
                return;
            }

            // تحميل من API
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة تحميل الروايات')), 8000)
            );

            const riwayaPromise = axios.get(`${apiBaseUrl}/riwayat?language=ar`, {
                timeout: 6000,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=1800'
                }
            });

            const response = await Promise.race([riwayaPromise, timeoutPromise]);

            if (response.data && response.data.riwayat) {
                allRiwayat = response.data.riwayat.filter(riwaya => 
                    riwaya && riwaya.name && riwaya.name.trim().length > 0
                );

                console.log(`تم تحميل ${allRiwayat.length} رواية بنجاح`);
                await displayRiwayatInSelect(allRiwayat);
                setCachedData('riwayat_cache', allRiwayat);
                setupRiwayaFilterListener(allRiwayat);
                showNotification('تم تحميل الروايات بنجاح', 'success');
            } else {
                throw new Error('لا توجد بيانات الروايات');
            }
        } catch (error) {
            console.error('خطأ في تحميل الروايات:', error);
            showNotification('فشل تحميل الروايات', 'error');
            displayErrorInSelect();
        }
    }

    // دالة عرض الروايات في القائمة المنسدلة
    async function displayRiwayatInSelect(riwayat) {
        if (!riwayaFilter) {
            console.error('عنصر فلتر الروايات غير موجود');
            return;
        }

        try {
            const fragment = document.createDocumentFragment();

            // إضافة الخيار الافتراضي
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'كل الروايات';
            defaultOption.selected = true;
            fragment.appendChild(defaultOption);

            // ترتيب الروايات أبجدياً
            const sortedRiwayat = riwayat.sort((a, b) => 
                a.name.localeCompare(b.name, 'ar')
            );

            // إضافة الروايات للقائمة
            sortedRiwayat.forEach(riwaya => {
                const option = document.createElement('option');
                option.value = riwaya.id;
                option.textContent = riwaya.name;
                option.dataset.slug = riwaya.slug || '';
                fragment.appendChild(option);
            });

            // تفريغ القائمة وإضافة العناصر الجديدة
            riwayaFilter.innerHTML = '';
            riwayaFilter.appendChild(fragment);

            // تأثير بصري
            riwayaFilter.style.opacity = '0';
            requestAnimationFrame(() => {
                riwayaFilter.style.opacity = '1';
            });

            console.log('تم عرض الروايات بنجاح');
        } catch (error) {
            console.error('خطأ في عرض الروايات:', error);
            displayErrorInSelect();
        }
    }

    // دالة إعداد مستمع أحداث فلتر الروايات
    function setupRiwayaFilterListener(riwayat) {
        if (!riwayaFilter) return;

        // إزالة المستمع السابق
        riwayaFilter.removeEventListener('change', handleRiwayaChange);

        // إضافة المستمع الجديد
        riwayaFilter.addEventListener('change', handleRiwayaChange);

        function handleRiwayaChange(event) {
            const selectedRiwayaId = event.target.value;
            if (selectedRiwayaId) {
                const selectedRiwaya = riwayat.find(r => r.id == selectedRiwayaId);
                if (selectedRiwaya) {
                    filterRecitersByRiwaya(selectedRiwaya);
                    updateURLWithRiwaya(selectedRiwayaId);
                    console.log(`تم اختيار رواية: ${selectedRiwaya.name}`);
                }
            } else {
                displayAllReciters();
                updateURLWithRiwaya('');
            }
        }
    }

    // دالة تصفية القراء حسب الرواية
    function filterRecitersByRiwaya(selectedRiwaya) {
        if (!selectedRiwaya || !allReciters.length) {
            displayNoRecitersMessage();
            return;
        }

        try {
            const filteredReciters = allReciters.filter(reciter => {
                return reciter.moshaf && reciter.moshaf.some(moshaf =>
                    moshaf.name && (moshaf.name.includes(selectedRiwaya.name) || 
                    moshaf.rewaya_id == selectedRiwaya.id)
                );
            });

            if (filteredReciters.length > 0) {
                displayFilteredReciters(filteredReciters, selectedRiwaya.name);
                updateRecitersCount(filteredReciters.length);
                showNotification(`تم العثور على ${filteredReciters.length} قارئ لرواية ${selectedRiwaya.name}`, 'info');
            } else {
                displayNoRecitersForRiwaya(selectedRiwaya.name);
            }
        } catch (error) {
            console.error('خطأ في تصفية القراء:', error);
            displayErrorMessage(recitersContainer, 'خطأ في التصفية', error.message);
        }
    }

    // دالة عرض القراء المصفيين
    function displayFilteredReciters(filteredReciters, riwayaName) {
        const fragment = document.createDocumentFragment();

        filteredReciters.forEach(reciter => {
            const card = createOptimizedCard(reciter.name, 'reciter', reciter.id, selectReciter);
            card.dataset.riwaya = riwayaName;
            card.dataset.server = reciter.moshaf[0]?.server || '';

            // إضافة شارة الرواية
            const riwayaBadge = document.createElement('div');
            riwayaBadge.className = 'riwaya-badge';
            riwayaBadge.textContent = riwayaName;
            riwayaBadge.style.cssText = `
                position: absolute;
                top: 5px;
                left: 5px;
                background: #4caf50;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.7rem;
                z-index: 1;
            `;
            card.style.position = 'relative';
            card.appendChild(riwayaBadge);

            fragment.appendChild(card);
        });

        recitersContainer.innerHTML = '';
        recitersContainer.appendChild(fragment);
    }

    // دالة عرض رسالة عدم وجود قراء للرواية
    function displayNoRecitersForRiwaya(riwayaName) {
        recitersContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>لا يوجد قراء متاحين</h3>
                <p>لم يتم العثور على قراء لرواية "${riwayaName}"</p>
                <button onclick="resetRiwayaFilter()" class="btn btn-primary">
                    <i class="fas fa-filter"></i>
                    إظهار جميع القراء
                </button>
            </div>
        `;
        updateRecitersCount(0);
    }

    // دالة تحميل القراء المحسنة
    async function loadRecitersOptimized() {
        const loadingSpinner = createLoadingSpinner();
        recitersContainer.appendChild(loadingSpinner);

        try {
            console.log('بدء تحميل القراء...');

            // محاولة تحميل من التخزين المؤقت
            const cachedData = getCachedData('reciters_cache');
            if (cachedData) {
                allReciters = cachedData;
                removeLoadingSpinner(recitersContainer);
                await displayRecitersOptimized();
                updateRecitersCount(allReciters.length);
                showNotification('تم تحميل القراء من التخزين المؤقت', 'info');
                return;
            }

            // تحميل من API
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('انتهت مهلة التحميل')), 10000)
            );

            const dataPromise = axios.get(`${apiBaseUrl}/reciters?language=ar`, {
                timeout: 8000,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'max-age=300'
                }
            });

            const response = await Promise.race([dataPromise, timeoutPromise]);

            if (response.data && response.data.reciters) {
                allReciters = response.data.reciters.filter(reciter =>
                    reciter && reciter.name && reciter.moshaf && 
                    reciter.moshaf.some(m => 
                        m && m.server && m.surah_total === 114 && 
                        m.server.includes('https://')
                    )
                );

                console.log(`تم تحميل ${allReciters.length} قارئ بنجاح`);
                removeLoadingSpinner(recitersContainer);
                await displayRecitersOptimized();
                updateRecitersCount(allReciters.length);

                // حفظ في التخزين المؤقت
                setCachedData('reciters_cache', allReciters);
                showNotification('تم تحميل القراء بنجاح', 'success');
            } else {
                throw new Error('لا توجد بيانات القراء');
            }
        } catch (error) {
            console.error('خطأ في تحميل القراء:', error);
            removeLoadingSpinner(recitersContainer);
            displayErrorMessage(recitersContainer, 'فشل تحميل القراء', error.message);
        }
    }

    // دالة عرض القراء المحسنة
    async function displayRecitersOptimized() {
        const fragment = document.createDocumentFragment();
        const batchSize = 20;

        for (let i = 0; i < Math.min(allReciters.length, batchSize); i++) {
            const reciter = allReciters[i];
            const card = createOptimizedCard(reciter.name, 'reciter', reciter.id, selectReciter);
            card.dataset.rewaya = reciter.moshaf[0]?.name || '';
            card.dataset.server = reciter.moshaf[0]?.server || '';
            fragment.appendChild(card);
        }

        recitersContainer.innerHTML = '';
        recitersContainer.appendChild(fragment);

        // تحميل باقي القراء تدريجياً
        if (allReciters.length > batchSize) {
            setTimeout(() => loadRemainingReciters(batchSize), 100);
        }
    }

    // دالة تحميل باقي القراء تدريجياً
    function loadRemainingReciters(startIndex) {
        const batchSize = 15;
        const endIndex = Math.min(startIndex + batchSize, allReciters.length);

        for (let i = startIndex; i < endIndex; i++) {
            const reciter = allReciters[i];
            const card = createOptimizedCard(reciter.name, 'reciter', reciter.id, selectReciter);
            card.dataset.rewaya = reciter.moshaf[0]?.name || '';
            card.dataset.server = reciter.moshaf[0]?.server || '';
            recitersContainer.appendChild(card);
        }

        if (endIndex < allReciters.length) {
            setTimeout(() => loadRemainingReciters(endIndex), 50);
        }
    }

    // دالة تحميل السور
    async function loadSurahs() {
        const loadingSpinner = createLoadingSpinner();
        surahsContainer.appendChild(loadingSpinner);

        try {
            console.log('بدء تحميل السور...');

            // محاولة تحميل من التخزين المؤقت
            const cachedSurahs = getCachedData('surahs_cache');
            if (cachedSurahs) {
                allSurahs = cachedSurahs;
                removeLoadingSpinner(surahsContainer);
                displaySurahs();
                updateSurahsCount(allSurahs.length);
                return;
            }

            const response = await axios.get(`${apiBaseUrl}/suwar?language=ar`, {
                timeout: 5000
            });

            if (response.data && response.data.suwar) {
                allSurahs = response.data.suwar;
                console.log(`تم تحميل ${allSurahs.length} سورة`);
                removeLoadingSpinner(surahsContainer);
                displaySurahs();
                updateSurahsCount(allSurahs.length);

                // حفظ في التخزين المؤقت
                setCachedData('surahs_cache', allSurahs);
            } else {
                throw new Error('لا توجد بيانات السور');
            }
        } catch (error) {
            console.error('خطأ في تحميل السور:', error);
            removeLoadingSpinner(surahsContainer);
            displayErrorMessage(surahsContainer, 'فشل تحميل السور', error.message);
        }
    }

    // دالة عرض السور
    function displaySurahs() {
        const fragment = document.createDocumentFragment();

        allSurahs.forEach(surah => {
            const card = createCard(surah.name, 'surah', surah.id, selectSurah);
            fragment.appendChild(card);
        });

        surahsContainer.innerHTML = '';
        surahsContainer.appendChild(fragment);
    }

    // دالة عرض جميع القراء
    function displayAllReciters() {
        if (allReciters.length > 0) {
            displayRecitersOptimized();
            updateRecitersCount(allReciters.length);
        }
    }

    // ============ دوال التفاعل ============
    
    // دالة اختيار القارئ
    function selectReciter(card) {
        // إزالة التحديد السابق
        if (currentReciterCard) {
            currentReciterCard.classList.remove('selected');
        }

        // تحديد القارئ الجديد
        card.classList.add('selected');
        currentReciterCard = card;

        const reciterId = card.dataset.id;
        selectedReciter = allReciters.find(r => r.id == reciterId);

        if (selectedReciter) {
            currentReciterLabel.textContent = selectedReciter.name;
            console.log(`تم اختيار القارئ: ${selectedReciter.name}`);

            // حفظ الاختيار
            saveLastSelection();

            // تحديث مصدر الصوت
            updateAudioSource();
        }
    }

    // دالة اختيار السورة
    function selectSurah(card) {
        // إزالة التحديد السابق
        if (currentSurahCard) {
            currentSurahCard.classList.remove('selected');
        }

        // تحديد السورة الجديدة
        card.classList.add('selected');
        currentSurahCard = card;

        const surahId = card.dataset.id;
        selectedSurah = allSurahs.find(s => s.id == surahId);

        if (selectedSurah) {
            currentSurahLabel.textContent = selectedSurah.name;
            console.log(`تم اختيار السورة: ${selectedSurah.name}`);

            // حفظ الاختيار
            saveLastSelection();

            // تحديث مصدر الصوت
            updateAudioSource();
        }
    }

    // دالة تحديث مصدر الصوت
    function updateAudioSource() {
        if (selectedReciter && selectedSurah) {
            const moshaf = selectedReciter.moshaf[0];
            if (moshaf && moshaf.server) {
                const paddedSurahId = selectedSurah.id.toString().padStart(3, '0');
                const audioUrl = `${moshaf.server}${paddedSurahId}.mp3`;
                
                console.log(`رابط الصوت: ${audioUrl}`);
                playAudioOptimized(audioUrl);

                // تتبع الاستخدام
                trackUsage('audio_play', {
                    reciter: selectedReciter.name,
                    surah: selectedSurah.name
                });
            }
        }
    }

    // دالة تشغيل الصوت المحسنة
    function playAudioOptimized(audioUrl) {
        if (!audioUrl || !audioPlayer) {
            showNotification('رابط الصوت غير صالح', 'error');
            return;
        }

        try {
            // إيقاف الصوت الحالي
            if (audioPlayer.src) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }

            // تحضير الصوت الجديد
            audioPlayer.src = audioUrl;
            audioPlayer.load();

            // إضافة مؤشر تحميل
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'audio-loading';
            loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحميل الصوت...';
            loadingIndicator.style.cssText = `
                text-align: center;
                padding: 1rem;
                color: var(--primary-color);
                font-weight: 500;
            `;

            if (audioPlayer.parentNode) {
                audioPlayer.parentNode.insertBefore(loadingIndicator, audioPlayer);
            }

            // معالجة أحداث التحميل
            const removeLoadingIndicator = () => {
                if (loadingIndicator && loadingIndicator.parentNode) {
                    loadingIndicator.remove();
                }
            };

            audioPlayer.addEventListener('loadstart', () => {
                console.log('بدء تحميل الصوت...');
            }, { once: true });

            audioPlayer.addEventListener('canplaythrough', () => {
                removeLoadingIndicator();
                audioPlayer.play().catch(error => {
                    console.error('خطأ في تشغيل الصوت:', error);
                    showNotification('فشل تشغيل الصوت', 'error');
                });
            }, { once: true });

            audioPlayer.addEventListener('error', (e) => {
                removeLoadingIndicator();
                console.error('خطأ في تحميل الصوت:', e);
                showNotification('فشل تحميل الصوت', 'error');
            }, { once: true });

        } catch (error) {
            console.error('خطأ في إعداد الصوت:', error);
            showNotification('خطأ في إعداد الصوت', 'error');
        }
    }

    // ============ دوال البحث ============
    
    // دالة البحث في القراء
    function searchReciters() {
        const searchTerm = reciterSearchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displayAllReciters();
            return;
        }

        const filteredReciters = allReciters.filter(reciter =>
            reciter.name.toLowerCase().includes(searchTerm)
        );

        displaySearchResults(filteredReciters, 'reciter');
        updateRecitersCount(filteredReciters.length);

        if (filteredReciters.length === 0) {
            showNotification('لم يتم العثور على نتائج', 'info');
        }
    }

    // دالة البحث في السور
    function searchSurahs() {
        const searchTerm = surahSearchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displaySurahs();
            return;
        }

        const filteredSurahs = allSurahs.filter(surah =>
            surah.name.toLowerCase().includes(searchTerm)
        );

        displaySearchResults(filteredSurahs, 'surah');
        updateSurahsCount(filteredSurahs.length);

        if (filteredSurahs.length === 0) {
            showNotification('لم يتم العثور على نتائج', 'info');
        }
    }

    // دالة عرض نتائج البحث
    function displaySearchResults(results, type) {
        const container = type === 'reciter' ? recitersContainer : surahsContainer;
        const fragment = document.createDocumentFragment();

        results.forEach(item => {
            const clickHandler = type === 'reciter' ? selectReciter : selectSurah;
            const card = createCard(item.name, type, item.id, clickHandler);
            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // ============ دوال الإعدادات والحفظ ============
    
    // دالة حفظ الموضع
    function saveBookmark() {
        if (selectedReciter && selectedSurah) {
            const bookmark = {
                reciter: selectedReciter,
                surah: selectedSurah,
                timestamp: Date.now(),
                currentTime: audioPlayer.currentTime || 0
            };
            
            localStorage.setItem('quran_bookmark', JSON.stringify(bookmark));
            showNotification('تم حفظ الموضع بنجاح', 'success');
        } else {
            showNotification('يرجى اختيار قارئ وسورة أولاً', 'warning');
        }
    }

    // دالة استرجاع الموضع
    function loadBookmark() {
        try {
            const bookmark = JSON.parse(localStorage.getItem('quran_bookmark'));
            
            if (bookmark && bookmark.reciter && bookmark.surah) {
                selectedReciter = bookmark.reciter;
                selectedSurah = bookmark.surah;
                
                currentReciterLabel.textContent = selectedReciter.name;
                currentSurahLabel.textContent = selectedSurah.name;

                // تحديث التحديد البصري
                updateVisualSelection();
                updateAudioSource();

                // استرجاع الوقت المحفوظ
                if (bookmark.currentTime && audioPlayer) {
                    audioPlayer.addEventListener('loadedmetadata', () => {
                        audioPlayer.currentTime = bookmark.currentTime;
                    }, { once: true });
                }

                showNotification('تم استرجاع الموضع بنجاح', 'success');
            } else {
                showNotification('لا يوجد موضع محفوظ', 'info');
            }
        } catch (error) {
            console.error('خطأ في استرجاع الموضع:', error);
            showNotification('خطأ في استرجاع الموضع', 'error');
        }
    }

    // دالة حفظ الاختيار الأخير
    function saveLastSelection() {
        if (selectedReciter && selectedSurah) {
            const lastSelection = {
                reciter: selectedReciter,
                surah: selectedSurah,
                timestamp: Date.now()
            };
            localStorage.setItem('last_selection', JSON.stringify(lastSelection));
        }
    }

    // دالة تحديث التحديد البصري
    function updateVisualSelection() {
        // تحديث القارئ
        if (selectedReciter) {
            const reciterCard = document.querySelector(`.card[data-id="${selectedReciter.id}"]`);
            if (reciterCard) {
                if (currentReciterCard) {
                    currentReciterCard.classList.remove('selected');
                }
                reciterCard.classList.add('selected');
                currentReciterCard = reciterCard;
            }
        }

        // تحديث السورة
        if (selectedSurah) {
            const surahCard = document.querySelector(`.card[data-id="${selectedSurah.id}"]`);
            if (surahCard) {
                if (currentSurahCard) {
                    currentSurahCard.classList.remove('selected');
                }
                surahCard.classList.add('selected');
                currentSurahCard = surahCard;
            }
        }
    }

    // دالة تحميل السورة
    function downloadSurah() {
        if (selectedReciter && selectedSurah) {
            const moshaf = selectedReciter.moshaf[0];
            if (moshaf && moshaf.server) {
                const paddedSurahId = selectedSurah.id.toString().padStart(3, '0');
                const audioUrl = `${moshaf.server}${paddedSurahId}.mp3`;
                
                const link = document.createElement('a');
                link.href = audioUrl;
                link.download = `${selectedSurah.name} - ${selectedReciter.name}.mp3`;
                link.target = '_blank';
                link.click();

                showNotification('بدء تحميل السورة', 'success');
                trackUsage('download_surah', {
                    reciter: selectedReciter.name,
                    surah: selectedSurah.name
                });
            }
        } else {
            showNotification('يرجى اختيار قارئ وسورة أولاً', 'warning');
        }
    }

    // دالة تحميل المصحف
    function downloadMushaf() {
        if (selectedReciter) {
            showNotification('ميزة تحميل المصحف الكامل قيد التطوير', 'info');
            // TODO: تنفيذ تحميل المصحف الكامل
        } else {
            showNotification('يرجى اختيار قارئ أولاً', 'warning');
        }
    }

    // ============ دوال الإعدادات ============
    
    // دالة تبديل الوضع الداكن
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('dark_mode', isDarkMode);
        
        showNotification(
            isDarkMode ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح',
            'info'
        );
    }

    // دالة إعداد الوضع الداكن
    function setupDarkMode() {
        const savedMode = localStorage.getItem('dark_mode');
        if (savedMode === 'true') {
            document.body.classList.add('dark-mode');
            if (themeToggle) {
                themeToggle.checked = true;
            }
        }
    }

    // ============ دوال مساعدة إضافية ============
    
    // دالة تحديث عداد القراء
    function updateRecitersCount(count) {
        if (recitersCount) {
            recitersCount.textContent = count;
        }
    }

    // دالة تحديث عداد السور
    function updateSurahsCount(count) {
        if (surahsCount) {
            surahsCount.textContent = count;
        }
    }

    // دالة عرض خطأ في القائمة المنسدلة
    function displayErrorInSelect() {
        if (riwayaFilter) {
            riwayaFilter.innerHTML = '<option value="">خطأ في تحميل البيانات</option>';
        }
    }

    // دالة عرض رسالة عدم وجود قراء
    function displayNoRecitersMessage() {
        recitersContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-info-circle"></i>
                <h3>لا يوجد قراء</h3>
                <p>لم يتم تحميل بيانات القراء بعد</p>
            </div>
        `;
        updateRecitersCount(0);
    }

    // دالة إعادة تعيين فلتر الروايات
    function resetRiwayaFilter() {
        if (riwayaFilter) {
            riwayaFilter.value = '';
            displayAllReciters();
            updateRecitersCount(allReciters.length);

            // إزالة معامل الرواية من الـ URL
            const url = new URL(window.location);
            url.searchParams.delete('riwaya');
            window.history.pushState({}, '', url);
        }
    }

    // دالة تحديث الـ URL
    function updateURLWithRiwaya(riwayaId) {
        try {
            const url = new URL(window.location);
            if (riwayaId) {
                url.searchParams.set('riwaya', riwayaId);
            } else {
                url.searchParams.delete('riwaya');
            }
            window.history.pushState({}, '', url);
        } catch (error) {
            console.error('خطأ في تحديث الـ URL:', error);
        }
    }

    // دالة تتبع الاستخدام
    function trackUsage(action, data = {}) {
        try {
            const usage = JSON.parse(localStorage.getItem('usage_stats') || '{}');
            const today = new Date().toISOString().split('T')[0];

            if (!usage[today]) {
                usage[today] = {};
            }

            if (!usage[today][action]) {
                usage[today][action] = 0;
            }

            usage[today][action]++;

            // حفظ بيانات إضافية
            Object.keys(data).forEach(key => {
                const statKey = `${action}_${key}_${data[key]}`;
                usage[today][statKey] = (usage[today][statKey] || 0) + 1;
            });

            localStorage.setItem('usage_stats', JSON.stringify(usage));
        } catch (error) {
            console.error('خطأ في تتبع الاستخدام:', error);
        }
    }

    // ============ دوال التحكم اليدوي ============

    // دالة الانتقال للسورة التالية يدوياً
    function navigateToNextSurah() {
        goToNextSurah();
    }

    // دالة الانتقال للسورة السابقة يدوياً
    function navigateToPrevSurah() {
        if (selectedSurah && allSurahs.length > 0) {
            const currentIndex = allSurahs.findIndex(s => s.id == selectedSurah.id);
            if (currentIndex > 0) {
                const prevSurah = allSurahs[currentIndex - 1];
                const prevCard = document.querySelector(`.surah[data-id="${prevSurah.id}"]`);
                
                if (prevCard) {
                    selectSurah(prevCard);
                    highlightCurrentCard(prevCard);
                    showNotification(`تم الانتقال إلى: ${prevSurah.name}`, 'success');
                }
            }
        }
    }

    // دالة الانتقال للقارئ التالي يدوياً
    function navigateToNextReciter() {
        goToNextReciter();
    }

    // دالة الانتقال للقارئ السابق يدوياً
    function navigateToPrevReciter() {
        if (selectedReciter && allReciters.length > 0) {
            const currentIndex = allReciters.findIndex(r => r.id == selectedReciter.id);
            if (currentIndex > 0) {
                const prevReciter = allReciters[currentIndex - 1];
                const prevCard = document.querySelector(`.reciter[data-id="${prevReciter.id}"]`);
                
                if (prevCard) {
                    selectReciter(prevCard);
                    highlightCurrentCard(prevCard);
                    showNotification(`تم الانتقال إلى القارئ: ${prevReciter.name}`, 'success');
                }
            }
        }
    }

    // ============ اختصارات لوحة المفاتيح ============
    
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (!audioPlayer) return;

            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    if (audioPlayer.paused) {
                        audioPlayer.play();
                    } else {
                        audioPlayer.pause();
                    }
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 10, audioPlayer.duration);
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 10, 0);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    audioPlayer.volume = Math.min(audioPlayer.volume + 0.1, 1);
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    audioPlayer.volume = Math.max(audioPlayer.volume - 0.1, 0);
                    break;

                case 'n':
                    e.preventDefault();
                    navigateToNextSurah();
                    break;

                case 'p':
                    e.preventDefault();
                    navigateToPrevSurah();
                    break;

                case 'N':
                    e.preventDefault();
                    navigateToNextReciter();
                    break;

                case 'P':
                    e.preventDefault();
                    navigateToPrevReciter();
                    break;

                case 'r':
                    e.preventDefault();
                    if (repeatModeCheckbox) {
                        repeatModeCheckbox.checked = !repeatModeCheckbox.checked;
                        repeatModeCheckbox.dispatchEvent(new Event('change'));
                    }
                    break;

                case 'a':
                    e.preventDefault();
                    if (autoNextSurahCheckbox) {
                        autoNextSurahCheckbox.checked = !autoNextSurahCheckbox.checked;
                        autoNextSurahCheckbox.dispatchEvent(new Event('change'));
                    }
                    break;
            }
        });
    }

    // ============ إعداد مستمعي الأحداث ============
    
    function setupEventListeners() {
        // البحث
        if (reciterSearchInput) {
            reciterSearchInput.addEventListener('input', debounce(searchReciters, 300));
        }
        
        if (surahSearchInput) {
            surahSearchInput.addEventListener('input', debounce(searchSurahs, 300));
        }

        // الأزرار
        if (saveBookmarkBtn) {
            saveBookmarkBtn.addEventListener('click', saveBookmark);
        }
        
        if (loadBookmarkBtn) {
            loadBookmarkBtn.addEventListener('click', loadBookmark);
        }
        
        if (downloadSurahBtn) {
            downloadSurahBtn.addEventListener('click', downloadSurah);
        }
        
        if (downloadMushafBtn) {
            downloadMushafBtn.addEventListener('click', downloadMushaf);
        }

        // الوضع الداكن
        if (themeToggle) {
            themeToggle.addEventListener('change', toggleDarkMode);
        }

        // أزرار صفحة حول الموقع
        if (aboutPageBtn) {
            aboutPageBtn.addEventListener('click', showAboutPage);
        }
        
        if (closeAboutBtn) {
            closeAboutBtn.addEventListener('click', hideAboutPage);
        }

        // إغلاق صفحة حول الموقع بالنقر خارجها
        if (aboutPage) {
            aboutPage.addEventListener('click', (e) => {
                if (e.target === aboutPage) {
                    hideAboutPage();
                }
            });
        }

        // إغلاق صفحة حول الموقع بمفتاح ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !aboutPage.classList.contains('hidden')) {
                hideAboutPage();
            }
        });

        // مشغل الصوت
        if (audioPlayer) {
            audioPlayer.addEventListener('play', () => {
                trackUsage('audio_play');
            });

            audioPlayer.addEventListener('pause', () => {
                trackUsage('audio_pause');
            });
        }
    }

    // دالة debounce للبحث
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============ التهيئة الأولية ============
    
    function initializeApp() {
        console.log('بدء تهيئة التطبيق...');

        // تحميل التاريخ الهجري ومواقيت الصلاة
        if (hijriDateElement) loadHijriDate();
        if (nextPrayerElement) loadPrayerTimes();

        // إعداد تحديث دوري للتاريخ والمواقيت
        setInterval(() => {
            if (hijriDateElement) loadHijriDate();
        }, 60000 * 60); // كل ساعة
        
        setInterval(() => {
            if (nextPrayerElement) loadPrayerTimes();
        }, 60000 * 5); // كل 5 دقائق

        // إعداد الوضع الداكن
        setupDarkMode();

        // إعداد مستمعي الأحداث
        setupEventListeners();

        // إعداد التشغيل التلقائي المحسن
        setupAutoPlayAdvanced();

        // إعداد اختصارات لوحة المفاتيح
        setupKeyboardShortcuts();

        // تحميل البيانات
        loadRecitersOptimized();
        loadSurahs();
        loadRiwayatOptimized();

        // تحميل الاختيار الأخير
        loadLastSelection();

        console.log('تم تهيئة التطبيق بنجاح');
    }

    // دالة تحميل الاختيار الأخير
    function loadLastSelection() {
        try {
            const lastSelection = JSON.parse(localStorage.getItem('last_selection'));
            
            if (lastSelection && lastSelection.reciter && lastSelection.surah) {
                // تأخير التحميل حتى تكتمل البيانات
                setTimeout(() => {
                    if (allReciters.length > 0 && allSurahs.length > 0) {
                        selectedReciter = allReciters.find(r => r.id == lastSelection.reciter.id);
                        selectedSurah = allSurahs.find(s => s.id == lastSelection.surah.id);

                        if (selectedReciter && selectedSurah) {
                            currentReciterLabel.textContent = selectedReciter.name;
                            currentSurahLabel.textContent = selectedSurah.name;
                            updateVisualSelection();
                        }
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('خطأ في تحميل الاختيار الأخير:', error);
        }
    }

    // إضافة دالة resetRiwayaFilter للنطاق العام
    window.resetRiwayaFilter = resetRiwayaFilter;

    // بدء التطبيق
    initializeApp();
});
