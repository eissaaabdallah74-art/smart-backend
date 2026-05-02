const axios = require('axios');

class AIService {
    constructor() {
        this.baseURL = 'http://localhost:11434/api/generate';
    }

    /**
     * Ask Llama3 a question with any data context
     * @param {string} prompt - User message
     * @param {string} contextData - Formatted data string from DB
     * @returns {Promise<string>} - AI response
     */
    async askGeneric(prompt, contextData = '') {
        try {
            const systemPrompt = `أنت مساعد ذكي ونظام خبير (Expert System) لشركة Smart Vibe.
مهمتك هي تحليل البيانات التي سأزودك بها والإجابة على أسئلة المستخدم بدقة ومصداقية.

قواعد أساسية:
1. أجب باللغة العربية حصراً.
2. لا تخترع بيانات غير موجودة (Don't hallucinate). إذا كانت البيانات ناقصة، قل "البيانات غير متوفرة في النظام حالياً".
3. إذا وجدت قائمة (مثل أسماء الموظفين أو العملاء)، اعرضها بشكل نقاط واضحة.
4. إذا سألك المستخدم "من أنت؟"، أجب بأنك المساعد الذكي لـ Smart Vibe المدعوم بـ Llama 3.

البيانات المستخرجة من قاعدة البيانات (Context):
${contextData}

سؤال المستخدم الحالي:
${prompt}`;

            const response = await axios.post(this.baseURL, {
                model: 'llama3',
                prompt: systemPrompt,
                stream: false,
                options: {
                    temperature: 0.1, // Low temperature for high accuracy/factuality
                    num_predict: 500
                }
            });

            return response.data.response;
        } catch (error) {
            console.error('[AI Service Error]:', error.message);
            if (error.code === 'ECONNREFUSED') {
                return "عذراً، محرك الذكاء الاصطناعي (Ollama) غير متاح حالياً. تأكد من تشغيله.";
            }
            return "حدث خطأ أثناء معالجة الطلب بالذكاء الاصطناعي.";
        }
    }

    /**
     * Generic data formatter for any array of objects
     */
    formatGenericList(title, items, fields = []) {
        if (!items || items.length === 0) return `لا توجد بيانات مسجلة لـ ${title}.\n`;

        let context = `--- ${title} ---\n`;
        items.forEach((item, idx) => {
            context += `رقم ${idx + 1}:\n`;
            if (fields.length > 0) {
                fields.forEach(f => {
                    context += `- ${f}: ${item[f] || 'غير محدد'}\n`;
                });
            } else {
                context += `- المعرف: ${item.id}\n`;
                context += `- الاسم: ${item.name || item.fullName || 'غير مسجل'}\n`;
            }
        });
        return context + "\n";
    }

    formatEmployeeContext(emp) {
        if (!emp) return "";
        return `بيانات الموظف ${emp.fullName}:
- المعرف (ID): ${emp.id}
- القسم: ${emp.employment?.department || 'غير محدد'}
- الوظيفة: ${emp.employment?.jobTitle || 'غير محدد'}
- الحالة: ${emp.employment?.isWorking ? 'على رأس العمل' : 'مستقيل/غير نشط'}
- الراتب: ${emp.payrollInsurance?.salaryGross || 'غير محدد'}\n\n`;
    }

    formatDriverContext(drv) {
        if (!drv) return "";
        return `بيانات السائق ${drv.name}:
- المعرف (ID): ${drv.id}
- الكود: ${drv.courierCode || 'غير مسجل'}
- العميل المرتبط: ${drv.clientName || 'غير محدد'}
- الحالة: ${drv.contractStatus || 'نشط'}\n\n`;
    }
}

module.exports = new AIService();
