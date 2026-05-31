const { GoogleGenAI } = require('@google/genai');
const AIProvider = require('./ai-provider.service');

class GeminiProvider extends AIProvider {
    constructor() {
        super();
        const apiKey = process.env.GEMINI_API_KEY;
        this.primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        this.fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
        
        if (apiKey) {
            try {
                this.client = new GoogleGenAI({ apiKey });
            } catch (e) {
                console.error('[Gemini Client Init Error]:', e.message);
            }
        }
    }

    isAvailable() {
        return !!this.client;
    }

    async generateResponse(prompt, context = '', requestedModel = null) {
        if (!this.isAvailable()) {
            throw new Error('Gemini API key is missing or client failed to initialize');
        }

        const modelToUse = requestedModel || this.primaryModel;
        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.log(`[Gemini Retry] Attempt ${attempt} for model ${modelToUse} after ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const systemPrompt = `أنت مساعد ذكي لنظام إدارة العمليات.
مهمتك هي تحليل البيانات التي سأزودك بها والإجابة على أسئلة المستخدم بدقة ومصداقية.

قواعد أساسية:
1. أجب باللغة العربية بلهجة مهنية ومختصرة جداً.
2. ادخل في صلب الإجابة مباشرة دون أي مقدمات أو ترحيب أو ذكر لاسم النظام.
3. لا تبدأ بعبارات مثل "بصفتي مساعد ذكي" أو "بناءً على البيانات".
4. إذا سأل المستخدم عن شخص برقم قومي أو موبايل ولم تجده في البيانات، قل ببساطة "لم يتم العثور على سجلات تطابق هذا الرقم".
5. لا تخترع بيانات. إذا كانت البيانات ناقصة، قل "البيانات غير متوفرة".
6. اجعل الإجابة مباشرة جداً (Direct answer only).

البيانات المستخرجة من قاعدة البيانات (Context):
${context}

سؤال المستخدم الحالي:
${prompt}`;

                const response = await this.client.models.generateContent({
                    model: modelToUse,
                    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
                });

                if (response && response.candidates && response.candidates[0] && response.candidates[0].content) {
                    return {
                        text: response.candidates[0].content.parts[0].text,
                        model: modelToUse,
                        retryCount: attempt
                    };
                }
                
                throw new Error('Empty response from Gemini');
            } catch (error) {
                lastError = error;
                const errorMessage = error.message || '';
                const statusCode = error.status || (errorMessage.includes('429') ? 429 : 500);
                const isQuotaError = statusCode === 429 || errorMessage.includes('Quota exceeded') || errorMessage.includes('RESOURCE_EXHAUSTED');
                
                if (isQuotaError) {
                    console.error(`[Gemini Quota Error] ${modelToUse}: ${errorMessage}`);
                    return {
                        error: errorMessage,
                        model: modelToUse,
                        errorCode: 429,
                        isQuotaExceeded: true,
                        isRetryable: false // Do not retry 429 immediately
                    };
                }

                const retryableCodes = [500, 502, 503, 504];
                const isRetryable = retryableCodes.some(code => errorMessage.includes(String(code)) || statusCode === code);

                if (!isRetryable || attempt === maxRetries) {
                    console.error('[Gemini Provider Error]:', {
                        message: errorMessage,
                        model: modelToUse,
                        attempt: attempt + 1,
                        isRetryable
                    });
                    break;
                }
            }
        }

        // Return error info instead of throwing to allow orchestrator to handle fallback model
        return {
            error: lastError.message,
            model: modelToUse,
            isRetryable: true // We already checked this in the loop
        };
    }
}

module.exports = new GeminiProvider();
