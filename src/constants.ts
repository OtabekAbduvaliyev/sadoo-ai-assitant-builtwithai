import { CRMContact } from './types';

export const MOCK_CONTACTS: CRMContact[] = [
  {
    id: '1',
    name: 'Dilshod Ahmedov',
    phone: '+998 90 123 45 67',
    email: 'd.ahmedov@example.uz',
    lastPurchase: '2024-03-15',
    notes: 'Tez-tez chegirmalar haqida so\'raydi. Sifatga e\'tiborli.',
    loyaltyTier: 'Gold',
  },
  {
    id: '2',
    name: 'Malika Karimova',
    phone: '+998 93 987 65 43',
    email: 'm.karimova@example.uz',
    lastPurchase: '2024-04-10',
    notes: 'Yangi mahsulotlar bilan qiziqadi. Telegram orqali muloqotni afzal ko\'radi.',
    loyaltyTier: 'Silver',
  }
];

export const SALES_SCRIPTS = [
  {
    stage: 'Salomlashish',
    lines: [
      '- Assalomu alaykum, ismim [Ismingiz], "Sadoo AI assistant" orqali bog\'lanyapman.',
      '- Sizga qulaymi muloqot qilish?'
    ]
  },
  {
    stage: 'Ehtiyoj va Tahlil',
    lines: [
      '- Hozirda qanday muammolarga duch kelyapsiz?',
      '- Bizning platforma qanday yordam bera oladi deb o\'ylaysiz?'
    ]
  }
];

export const UZBEK_PROMPT_SYSTEM = `
Siz professional suhbat tahlilchisi va "Sadoo AI assistant" strategisiz.
Suhbat o'zbek tilida olib borilmoqda. Operatorga real vaqt rejimida suhbat strategiyasi va usullarini tahlil qilib maslahat bering.

Sizning vazifangiz:
1. Suhbatning hissiy holatini (sentiment) aniqlash.
2. Operatorga real vaqtda feedback va taktikalar berish.
3. Eng muhimi: Suhbat yo'nalishidan kelib chiqib, bir nechta savdo yoki muloqot usullarini birlashtirgan yangi strategiya ("Strategy Synthesis") taklif qilish. Masalan: "Sandwich method" + "Scarcity" kombinatsiyasi.

Javob formati har doim JSON bo'lishi kerak:
{
  "sentiment": "positive" | "neutral" | "negative",
  "suggestions": [
    {
      "type": "tactic" | "feedback" | "alert",
      "title": "Sarlavha", 
      "description": "Tavsif",
      "priority": "high" | "medium" | "low"
    }
  ],
  "strategy": {
    "methodName": "Yangi metod nomi",
    "combination": "Qaysi metodlar kombinatsiyasi",
    "benefit": "Nima uchun bu samarali (o'zbek tilida)"
  }
}
`;
