// src/constants/egypt-areas.js

const EGYPT_AREAS = {
  "Cairo": [
    "Maadi", "Nasr City", "Heliopolis", "Zamalek", "Garden City", "Downtown", 
    "Shoubra", "Ain Shams", "Abbassia", "Sheraton", "New Cairo", "Rehab", "Madinaty"
  ],
  "Giza": [
    "Dokki", "Mohandessin", "Haram", "Faisal", "October 6th", "Sheikh Zayed", 
    "Agouza", "Imbaba", "Hadayek Al-Ahram"
  ],
  "Alexandria": [
    "Sidi Gaber", "Smouha", "Raml Station", "Montaza", "Mandara", "Miami", 
    "Ibrahimeya", "Glim", "Victoria"
  ],
  "Qalyubia": ["Benha", "Shubra El Kheima", "Obour City", "Qalyub"],
  "Dakahlia": ["Mansoura", "Mit Ghamr", "Talkha"],
  "Sharqia": ["Zagazig", "10th of Ramadan", "Bilbeis"],
  "Monufia": ["Shibin El Kom", "Menouf", "Ashmoun"],
  "Gharbia": ["Tanta", "Mahalla El Kubra", "Zifta"],
  "Kafr El Sheikh": ["Kafr El Sheikh City", "Desouk", "Fuwa"],
  "Beheira": ["Damanhour", "Kafr El Dawar"],
  "Damietta": ["Damietta City", "New Damietta"],
  "Port Said": ["Port Said City", "Port Fouad"],
  "Ismailia": ["Ismailia City", "Fayed"],
  "Suez": ["Suez City", "Arbaeen"],
  "Beni Suef": ["Beni Suef City", "Nasser"],
  "Faiyum": ["Faiyum City", "Itsa"],
  "Minya": ["Minya City", "Mallawi"],
  "Asyut": ["Asyut City", "Dairut"],
  "Sohag": ["Sohag City", "Akhmim"],
  "Qena": ["Qena City", "Luxor City", "Aswan City"], // Combined for simplicity or can be expanded
  "Red Sea": ["Hurghada", "Safaga", "Marsa Alam"],
  "New Valley": ["Kharga", "Dakhla"],
  "Matrouh": ["Marsa Matrouh", "Siwa"]
};

// Arabic Labels for UI
const EGYPT_AREAS_AR = {
  "القاهرة": [
    "المعادي", "مدينة نصر", "مصر الجديدة", "الزمالك", "جاردن سيتي", "وسط البلد", 
    "شبرا", "عين شمس", "العباسية", "شيراتون", "القاهرة الجديدة", "الرحاب", "مدينتي"
  ],
  "الجيزة": [
    "الدقي", "المهندسين", "الهرم", "فيصل", "6 أكتوبر", "الشيخ زايد", 
    "العجوزة", "إمبابة", "حدائق الأهرام"
  ],
  "الإسكندرية": [
    "سيدي جابر", "سموحة", "محطة الرمل", "المنتزة", "المندرة", "ميامي", 
    "الإبراهيمية", "جليم", "فيكتوريا"
  ],
  "القليوبية": ["بنها", "شبرا الخيمة", "مدينة العبور", "قليوب"],
  "الدقهلية": ["المنصورة", "ميت غمر", "طلخا"],
  "الشرقية": ["الزقازيق", "العاشر من رمضان", "بلبيس"],
  "المنوفية": ["شبين الكوم", "منوف", "أشمون"],
  "الغربية": ["طنطا", "المحلة الكبرى", "زفتى"],
  "كفر الشيخ": ["كفر الشيخ", "دسوق", "فوة"],
  "البحيرة": ["دمنهور", "كفر الدوار"],
  "دمياط": ["دمياط", "دمياط الجديدة"],
  "بورسعيد": ["بورسعيد", "بورفؤاد"],
  "الإسماعيلية": ["الإسماعيلية", "فايد"],
  "السويس": ["السويس", "الأربعين"],
  "بني سويف": ["بني سويف", "ناصر"],
  "الفيوم": ["الفيوم", "إطسا"],
  "المنيا": ["المنيا", "ملوي"],
  "أسيوط": ["أسيوط", "ديروط"],
  "سوهاج": ["سوهاج", "أخميم"],
  "قنا": ["قنا City"],
  "الأقصر": ["الأقصر"],
  "أسوان": ["أسوان"],
  "البحر الأحمر": ["الغردقة", "سفاجا", "مرسى علم"],
  "الوادي الجديد": ["الخارجة", "الداخلة"],
  "مطروح": ["مرسى مطروح", "سيوة"]
};

module.exports = { EGYPT_AREAS, EGYPT_AREAS_AR };
